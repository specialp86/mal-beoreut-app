"""CLI 진입점.

    python -m stock_screener screen tickers.txt --out-dir ./out
        Stage 1(수집) + Stage 2(예비 스코어링)를 실행하고
        out/candidates.json, out/materials_template.json 을 만든다.
        이후 Claude Code가 materials_template.json 을 웹 검색 결과로 채워
        materials.json 으로 저장한다 (Stage 3).

    python -m stock_screener report ./out --out report.md
        candidates.json + materials.json 을 읽어 Stage 4(시나리오) +
        Stage 5(리포트)를 실행하고 최종 마크다운 리포트를 생성한다.
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from dataclasses import replace
from pathlib import Path

from dotenv import load_dotenv

from .auth import TossAuth
from .collector import DataCollector
from .config import load_scenario_config, load_scoring_config
from .material_search import load_materials, write_material_template
from .models import MaterialInfo, MaterialStrength, StockReportSection
from .report import render_report
from .scenario import build_scenario_rows, compute_adjustments
from .scoring import screen_final, select_candidates_for_material_search
from .serialization import breakdown_from_dict, breakdown_to_dict, raw_from_dict, raw_to_dict
from .toss_client import TossClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def _read_tickers(path: str | Path) -> list[str]:
    text = Path(path).read_text(encoding="utf-8")
    if "," in text and "\n" not in text.strip():
        parts = text.split(",")
    else:
        parts = text.splitlines()
    return [p.strip() for p in parts if p.strip()]


def cmd_screen(args: argparse.Namespace) -> None:
    load_dotenv()
    tickers = _read_tickers(args.tickers_file)
    logger.info("종목 %d개 수집 시작", len(tickers))

    scoring_config = load_scoring_config(args.scoring_config)

    with TossAuth() as auth, TossClient(auth, debug=args.debug) as client:
        collector = DataCollector(
            client,
            candle_count=args.candle_count,
            batch_size=args.batch_size,
            batch_interval_sec=args.batch_interval,
        )
        raw_stocks = collector.collect_all(tickers)

    failed = [r for r in raw_stocks if r.collection_failed]
    for r in failed:
        logger.warning("수집 실패: %s (%s)", r.ticker, r.collection_error)

    candidates = select_candidates_for_material_search(raw_stocks, scoring_config)
    logger.info("예비 스코어 상위 %d개를 재료 검색 대상으로 선정", len(candidates))

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    candidates_payload = [
        {"raw": raw_to_dict(raw), "preliminary_breakdown": breakdown_to_dict(bd)}
        for raw, bd in candidates
    ]
    (out_dir / "candidates.json").write_text(
        json.dumps(
            {
                "candidates": candidates_payload,
                "failed": [{"ticker": r.ticker, "error": r.collection_error} for r in failed],
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    write_material_template([raw for raw, _ in candidates], out_dir / "materials_template.json")

    print(f"[screen] 수집 완료: {len(raw_stocks)}개 (실패 {len(failed)}개)")
    print(f"[screen] 재료 검색 대상: {len(candidates)}개 -> {out_dir / 'candidates.json'}")
    print(f"[screen] 다음 단계: {out_dir / 'materials_template.json'} 을 웹 검색 결과로 채운 뒤")
    print(f"         'materials.json' 으로 저장하고 report 커맨드를 실행하세요.")


def cmd_report(args: argparse.Namespace) -> None:
    out_dir = Path(args.data_dir)
    candidates_data = json.loads((out_dir / "candidates.json").read_text(encoding="utf-8"))
    failed = candidates_data.get("failed", [])

    materials_path = Path(args.materials) if args.materials else out_dir / "materials.json"
    if materials_path.exists():
        materials = load_materials(materials_path)
    else:
        logger.warning("%s 가 없어 전 종목 재료 정보 없이 진행합니다", materials_path)
        materials = {}

    scoring_config = load_scoring_config(args.scoring_config)
    scenario_config = load_scenario_config(args.scenario_config)

    triples = []
    for entry in candidates_data["candidates"]:
        raw = raw_from_dict(entry["raw"])
        breakdown = breakdown_from_dict(entry["preliminary_breakdown"])
        material = materials.get(raw.ticker) or MaterialInfo(ticker=raw.ticker, strength=MaterialStrength.NONE)
        triples.append((raw, breakdown, material.strength))

    scored_stocks = screen_final(triples, scoring_config)
    materials_by_ticker = {m.ticker: m for m in materials.values()}

    sections: list[StockReportSection] = []
    for scored in scored_stocks:
        if scored.watch_only:
            continue
        material = materials_by_ticker.get(scored.raw.ticker)
        if material and material.invalidated:
            scored = replace(scored, recommended_weight_pct=0)
            scenario_rows = []
        else:
            scenario_rows = build_scenario_rows(scored.raw, material, scenario_config)
        adjustment_memo = compute_adjustments(scored.raw, material, scenario_config)
        sections.append(
            StockReportSection(
                ticker=scored.raw.ticker,
                name=scored.raw.name,
                scored=scored,
                material=material,
                scenario_rows=scenario_rows,
                adjustment_memo=adjustment_memo,
            )
        )

    excluded = [(f["ticker"], f["error"]) for f in failed]
    report_md = render_report(sections, scenario_config, excluded_tickers=excluded)

    out_path = Path(args.out)
    out_path.write_text(report_md, encoding="utf-8")
    print(f"[report] 리포트 생성 완료: {out_path} (종목 {len(sections)}개)")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="stock_screener")
    sub = parser.add_subparsers(dest="command", required=True)

    p_screen = sub.add_parser("screen", help="Stage 1+2: 데이터 수집 + 예비 스코어링")
    p_screen.add_argument("tickers_file", help="종목코드 리스트 파일 (CSV 1열 또는 줄바꿈 텍스트)")
    p_screen.add_argument("--out-dir", default="./out")
    p_screen.add_argument("--scoring-config", default=None)
    p_screen.add_argument("--candle-count", type=int, default=60)
    p_screen.add_argument("--batch-size", type=int, default=5)
    p_screen.add_argument("--batch-interval", type=float, default=1.0)
    p_screen.add_argument("--debug", action="store_true")
    p_screen.set_defaults(func=cmd_screen)

    p_report = sub.add_parser("report", help="Stage 4+5: 시나리오 산출 + 리포트 생성")
    p_report.add_argument("data_dir", help="screen 커맨드가 생성한 out-dir")
    p_report.add_argument("--materials", default=None, help="재료 조사 결과 JSON (기본: <data_dir>/materials.json)")
    p_report.add_argument("--scoring-config", default=None)
    p_report.add_argument("--scenario-config", default=None)
    p_report.add_argument("--out", default="report.md")
    p_report.set_defaults(func=cmd_report)

    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    args.func(args)
    return 0


if __name__ == "__main__":
    sys.exit(main())

"""Stage 5: 리포트 생성기 — 마크다운 v2 포맷.

종목당 1개 섹션: 종목 요약 / 재료 요약 / 시나리오표(갭구간별 6행) /
공통 실행 규칙 / 종목별 조정 메모. 헤더에는 기준 시점, 참고용 도구 명시
문구, 시장 게이트 안내를 포함한다.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .models import MaterialStrength, StockReportSection

DISCLAIMER = (
    "본 리포트는 자동매매 시스템이 아니며 매매 판단을 대신 내려주지 않는 "
    "참고용 분석 도구의 산출물입니다. 조건 충족 시 참고용 진입/손절 구간을 "
    "계산해줄 뿐, 실제 매매 실행과 최종 책임은 사용자 본인에게 있습니다. "
    "투자자문이 아닙니다."
)

STRENGTH_LABEL = {
    MaterialStrength.STRONG: "강",
    MaterialStrength.MEDIUM: "중",
    MaterialStrength.WEAK: "약",
    MaterialStrength.NONE: "없음",
}


def _fmt_price(v: float | None) -> str:
    if v is None:
        return "-"
    return f"{v:,.0f}원"


def _fmt_price_range(r: tuple[float, float] | None) -> str:
    if r is None:
        return "-"
    lo, hi = r
    if abs(lo - hi) < 1:
        return _fmt_price(lo)
    return f"{lo:,.0f} ~ {hi:,.0f}원"


def render_header(
    *,
    as_of: datetime | None = None,
    excluded_tickers: list[tuple[str, str]] | None = None,
    scenario_config: dict[str, Any] | None = None,
) -> str:
    as_of = as_of or datetime.now()
    lines = [
        "# 전일 종목 스크리닝 + 매매 시나리오 리포트",
        "",
        f"- 리포트 기준 시점: {as_of.strftime('%Y-%m-%d %H:%M')} 데이터 기준, 장전 뉴스는 미반영",
        f"- {DISCLAIMER}",
        "",
    ]
    if scenario_config:
        common = scenario_config["common_rules"]
        lines += [
            "## 공통 규칙 (전 종목 적용)",
            "",
            f"- **시장 게이트**: {common['market_gate']}",
            f"- **시간 마감**: {common['time_cutoff']}",
            f"- **재진입 금지**: {common['no_reentry']}",
            f"- **거래량 확인 필수**: {common['volume_confirmation']}",
            "",
        ]
    if excluded_tickers:
        lines.append("## 데이터 수집 실패 종목 (분석 제외)")
        lines.append("")
        for ticker, err in excluded_tickers:
            lines.append(f"- {ticker}: {err}")
        lines.append("")
    return "\n".join(lines)


def render_stock_section(section: StockReportSection, scenario_config: dict[str, Any]) -> str:
    s = section.scored
    b = s.breakdown
    common = scenario_config["common_rules"]

    lines = [f"## {section.name} ({section.ticker})", ""]

    if s.caution_tag:
        lines.append("> ⚠️ VI/투자유의 종목 — 주문 실행 전 별도 확인 필요 (본 도구는 주문을 실행하지 않음)")
        lines.append("")

    lines += [
        "### 1. 종목 요약",
        "",
        f"- 종합 스코어: **{b.total:.1f} / 100**",
        f"- 권장 비중: **{s.recommended_weight_pct}%**" + (" (관망 권장)" if s.watch_only else ""),
        "",
        "| 항목 | 배점 | 획득 |",
        "|---|---|---|",
        f"| 거래대금 순위 | 25 | {b.trading_value_rank:.1f} |",
        f"| 캔들모양(윗꼬리) | 20 | {b.candle_shape:.1f} |",
        f"| 수급(외국인·기관) | 20 | {b.supply_demand:.1f} |",
        f"| 이평선 정배열 | 15 | {b.ma_alignment:.1f} |",
        f"| 시간외 단일가 | 10 | {b.after_hours:.1f} |",
        f"| 재료 강도 | 10 | {b.material_strength:.1f} |",
        f"| **합계** | **100** | **{b.total:.1f}** |",
        "",
    ]

    lines += ["### 2. 재료 요약", ""]
    m = section.material
    if m is None or (not m.summary_lines and m.strength == MaterialStrength.NONE):
        lines.append("- 조사된 재료 없음")
    else:
        lines.append(f"- 재료 강도: **{STRENGTH_LABEL[m.strength]}**")
        for line in m.summary_lines:
            lines.append(f"- {line}")
        if m.sources:
            lines.append("- 출처: " + ", ".join(m.sources))
        if m.invalidated:
            lines.append(f"- ⚠️ **재료 무효화**: {m.invalidation_reason or '후속 부정적 뉴스 확인'} — 본 종목 시나리오 전체 무효 처리")
    lines.append("")

    lines += [
        "### 3. 시나리오표 (전일 종가 기준 갭 구간별)",
        "",
        "| 갭 구간 | 판단 | 진입 조건 | 손절가 | 1차 목표가 |",
        "|---|---|---|---|---|",
    ]
    for row in section.scenario_rows:
        if not row.tradeable:
            sl = "-"
            tp = row.note or "-"
        else:
            sl = f"{_fmt_price_range(row.stop_loss_price_range)} ({row.stop_loss_formula})"
            tp = f"{_fmt_price_range(row.take_profit_price_range)} ({row.take_profit_formula})"
        lines.append(f"| {row.label} | {row.verdict} | {row.entry_condition} | {sl} | {tp} |")
    lines.append("")

    lines += [
        "### 4. 공통 실행 규칙",
        "",
        f"- 시간 마감: {common['time_cutoff']}",
        f"- 재진입 금지: {common['no_reentry']}",
        f"- 거래량 확인 필수: {common['volume_confirmation']}",
        "",
    ]

    lines += ["### 5. 종목별 조정 메모", ""]
    for reason in section.adjustment_memo.reasons:
        lines.append(f"- {reason}")
    lines.append("")

    return "\n".join(lines)


def render_report(
    sections: list[StockReportSection],
    scenario_config: dict[str, Any],
    *,
    as_of: datetime | None = None,
    excluded_tickers: list[tuple[str, str]] | None = None,
) -> str:
    parts = [render_header(as_of=as_of, excluded_tickers=excluded_tickers, scenario_config=scenario_config)]
    if not sections:
        parts.append("_스코어 기준을 충족한 종목이 없습니다._\n")
    for section in sections:
        parts.append(render_stock_section(section, scenario_config))
    return "\n".join(parts)

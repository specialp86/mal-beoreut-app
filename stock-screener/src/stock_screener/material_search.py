"""Stage 3: 재료 검색 모듈 — 입출력 계약(schema)만 정의.

이 모듈은 실제로 웹 검색을 수행하지 않는다. 스펙 4장의 재료(뉴스/공시)
조사는 "Claude Code의 웹 검색 기능"으로 처리하도록 명시되어 있어, 파이썬
프로세스가 아니라 이 파이프라인을 운용하는 Claude Code 에이전트가
`select_candidates_for_material_search()`가 고른 상위 N개 종목에 대해
직접 웹 검색(`"{종목명}" 뉴스`, `"{종목명}" 단독`, `"{종목명}" 공시` 등)을
수행하고, 그 결과를 아래 JSON 스키마로 저장한다.

    {
      "005930": {
        "summary_lines": ["...", "..."],
        "sources": ["https://..."],
        "strength": "strong" | "medium" | "weak" | "none",
        "invalidated": false,
        "invalidation_reason": null
      },
      ...
    }

이후 `report` CLI 커맨드가 이 파일을 읽어 Stage 4/5로 넘긴다.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from .models import MaterialInfo, MaterialStrength, StockRawData


def write_material_template(
    candidates: list[StockRawData], path: str | Path
) -> None:
    """Stage 3 조사를 시작하기 전, 채워 넣을 빈 템플릿 JSON을 생성한다."""
    template = {
        raw.ticker: {
            "name": raw.name,
            "summary_lines": [],
            "sources": [],
            "strength": "none",
            "invalidated": False,
            "invalidation_reason": None,
        }
        for raw in candidates
    }
    Path(path).write_text(
        json.dumps(template, ensure_ascii=False, indent=2), encoding="utf-8"
    )


def load_materials(path: str | Path) -> dict[str, MaterialInfo]:
    raw = json.loads(Path(path).read_text(encoding="utf-8"))
    materials: dict[str, MaterialInfo] = {}
    for ticker, entry in raw.items():
        materials[ticker] = _parse_material_entry(ticker, entry)
    return materials


def _parse_material_entry(ticker: str, entry: dict[str, Any]) -> MaterialInfo:
    strength_raw = (entry.get("strength") or "none").lower()
    try:
        strength = MaterialStrength(strength_raw)
    except ValueError as e:
        raise ValueError(
            f"{ticker}: strength 값은 strong/medium/weak/none 중 하나여야 합니다 (got {strength_raw!r})"
        ) from e
    return MaterialInfo(
        ticker=ticker,
        summary_lines=list(entry.get("summary_lines") or []),
        sources=list(entry.get("sources") or []),
        strength=strength,
        invalidated=bool(entry.get("invalidated", False)),
        invalidation_reason=entry.get("invalidation_reason"),
    )

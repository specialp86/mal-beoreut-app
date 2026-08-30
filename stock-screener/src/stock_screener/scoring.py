"""Stage 2: Screening & Scoring Engine.

스코어는 두 단계로 계산한다 (스펙 1장 파이프라인의 재료강도 순환참조를
해소하기 위함):

1. `preliminary_score` — 재료강도를 제외한 90점 만점 점수. 이 점수로
   Stage 3(재료 검색)에 넘길 상위 N개를 먼저 골라낸다. 전 종목에 대해
   웹 검색을 하는 건 비효율적이기 때문.
2. `finalize_score` — Stage 3에서 조사한 재료강도(10점)를 더해 최종
   100점 스코어를 완성한다. 이 최종 점수로 리포트 포함 여부/권장 비중을
   정한다.
"""

from __future__ import annotations

from typing import Any

from .models import (
    MaterialStrength,
    ScoreBreakdown,
    ScoredStock,
    StockRawData,
)


def _clamp(value: float, lo: float = 0.0, hi: float = 1.0) -> float:
    return max(lo, min(hi, value))


def _moving_average(closes: list[float], window: int) -> float | None:
    if len(closes) < window:
        return None
    return sum(closes[-window:]) / window


def preliminary_score(raw: StockRawData, config: dict[str, Any]) -> ScoreBreakdown:
    weights = config["weights"]
    scaling = config.get("scaling", {})

    # 1) 거래대금 순위 (백분위 기반)
    pct = raw.market_trading_value_rank_percentile
    trading_value_rank = weights["trading_value_rank"] * (pct / 100.0) if pct is not None else 0.0

    # 2) 캔들모양 (윗꼬리 비율이 낮을수록 고득점)
    if raw.today_high and raw.today_high > 0 and raw.today_close is not None:
        upper_tail_ratio = max(0.0, (raw.today_high - raw.today_close) / raw.today_high)
        candle_shape = weights["candle_shape"] * _clamp(1 - upper_tail_ratio)
    else:
        candle_shape = 0.0

    # 3) 수급 (외국인·기관 양매수)
    if raw.investor_flow.both_buying:
        supply_demand = weights["supply_demand"]
    elif raw.investor_flow.one_side_buying:
        supply_demand = weights["supply_demand"] / 2
    else:
        supply_demand = 0.0

    # 4) 이평선 정배열 (당일 종가가 5일선·20일선 위)
    closes = [c.close for c in raw.daily_candles]
    if raw.today_close is not None:
        closes = closes + [raw.today_close]
    ma5 = _moving_average(closes, 5)
    ma20 = _moving_average(closes, 20)
    if ma5 is not None and ma20 is not None and raw.today_close is not None:
        ma_alignment = weights["ma_alignment"] if (raw.today_close > ma5 and raw.today_close > ma20) else 0.0
    else:
        ma_alignment = 0.0

    # 5) 시간외 단일가 반응 (상승폭 비례, 하락 시 0)
    cap = scaling.get("after_hours_full_score_pct", 5.0)
    if raw.after_hours_change_pct is not None and raw.after_hours_change_pct > 0:
        after_hours = weights["after_hours"] * _clamp(raw.after_hours_change_pct / cap)
    else:
        after_hours = 0.0

    return ScoreBreakdown(
        trading_value_rank=round(trading_value_rank, 2),
        candle_shape=round(candle_shape, 2),
        supply_demand=round(supply_demand, 2),
        ma_alignment=round(ma_alignment, 2),
        after_hours=round(after_hours, 2),
        material_strength=0.0,
    )


def finalize_score(
    breakdown: ScoreBreakdown, material_strength: MaterialStrength, config: dict[str, Any]
) -> ScoreBreakdown:
    weights = config["weights"]
    points_table = config["material_strength_points"]
    points = points_table[material_strength.value]
    material_score = weights["material_strength"] * (points / 10.0)
    return ScoreBreakdown(
        trading_value_rank=breakdown.trading_value_rank,
        candle_shape=breakdown.candle_shape,
        supply_demand=breakdown.supply_demand,
        ma_alignment=breakdown.ma_alignment,
        after_hours=breakdown.after_hours,
        material_strength=round(material_score, 2),
    )


def select_candidates_for_material_search(
    raw_stocks: list[StockRawData], config: dict[str, Any]
) -> list[tuple[StockRawData, ScoreBreakdown]]:
    """Stage 1 수집 결과 중, 재료 검색을 진행할 상위 N개를 예비 스코어로 선정."""
    top_n = config.get("top_n", 10)
    scored = [
        (raw, preliminary_score(raw, config)) for raw in raw_stocks if not raw.collection_failed
    ]
    scored.sort(key=lambda pair: pair[1].total, reverse=True)
    return scored[:top_n]


def _recommended_weight_pct(final_score: float, strength: MaterialStrength, config: dict[str, Any]) -> int:
    for tier in config["position_sizing"]:
        min_score = tier["min_score"]
        requires = tier.get("requires_material_strength")
        if final_score >= min_score and (requires is None or strength.value == requires):
            return tier["weight_pct"]
    return 0


def screen_final(
    candidates: list[tuple[StockRawData, ScoreBreakdown, MaterialStrength]],
    config: dict[str, Any],
) -> list[ScoredStock]:
    """Stage 3 결과(재료강도)를 반영해 최종 스코어를 완성하고 정렬/필터링한다."""
    min_score = config.get("min_score", 60)
    results: list[ScoredStock] = []
    for raw, prelim_breakdown, strength in candidates:
        final_breakdown = finalize_score(prelim_breakdown, strength, config)
        total = final_breakdown.total
        watch_only = total < min_score
        weight_pct = 0 if watch_only else _recommended_weight_pct(total, strength, config)
        results.append(
            ScoredStock(
                raw=raw,
                breakdown=final_breakdown,
                recommended_weight_pct=weight_pct,
                caution_tag=raw.vi_status.has_any_flag,
                watch_only=watch_only,
            )
        )
    results.sort(key=lambda s: s.breakdown.total, reverse=True)
    return results

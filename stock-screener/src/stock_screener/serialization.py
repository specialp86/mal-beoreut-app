"""StockRawData / ScoreBreakdown 등을 JSON으로 직렬화/역직렬화.

`screen` 커맨드와 `report` 커맨드는 별도 프로세스(그 사이에 Claude Code가
웹 검색으로 재료를 조사)로 나뉘어 실행되므로, 중간 산출물을 JSON 파일로
주고받는다.
"""

from __future__ import annotations

from datetime import date
from typing import Any

from .models import (
    Candle,
    InvestorFlow,
    ScoreBreakdown,
    StockRawData,
    VIStatus,
)


def candle_to_dict(c: Candle) -> dict[str, Any]:
    return {
        "date": c.trade_date.isoformat(),
        "open": c.open,
        "high": c.high,
        "low": c.low,
        "close": c.close,
        "volume": c.volume,
    }


def candle_from_dict(d: dict[str, Any]) -> Candle:
    return Candle(
        trade_date=date.fromisoformat(d["date"]),
        open=d["open"],
        high=d["high"],
        low=d["low"],
        close=d["close"],
        volume=d["volume"],
    )


def raw_to_dict(raw: StockRawData) -> dict[str, Any]:
    return {
        "ticker": raw.ticker,
        "name": raw.name,
        "daily_candles": [candle_to_dict(c) for c in raw.daily_candles],
        "today_open": raw.today_open,
        "today_high": raw.today_high,
        "today_low": raw.today_low,
        "today_close": raw.today_close,
        "today_trading_value": raw.today_trading_value,
        "market_trading_value_rank_percentile": raw.market_trading_value_rank_percentile,
        "investor_flow": {
            "foreign_net_buy": raw.investor_flow.foreign_net_buy,
            "institution_net_buy": raw.investor_flow.institution_net_buy,
        },
        "after_hours_change_pct": raw.after_hours_change_pct,
        "vi_status": {
            "vi_triggered": raw.vi_status.vi_triggered,
            "short_term_overheated": raw.vi_status.short_term_overheated,
            "investment_warning": raw.vi_status.investment_warning,
            "investment_caution": raw.vi_status.investment_caution,
            "under_liquidation": raw.vi_status.under_liquidation,
        },
        "market_cap": raw.market_cap,
        "collection_failed": raw.collection_failed,
        "collection_error": raw.collection_error,
    }


def raw_from_dict(d: dict[str, Any]) -> StockRawData:
    return StockRawData(
        ticker=d["ticker"],
        name=d["name"],
        daily_candles=[candle_from_dict(c) for c in d.get("daily_candles", [])],
        today_open=d.get("today_open"),
        today_high=d.get("today_high"),
        today_low=d.get("today_low"),
        today_close=d.get("today_close"),
        today_trading_value=d.get("today_trading_value"),
        market_trading_value_rank_percentile=d.get("market_trading_value_rank_percentile"),
        investor_flow=InvestorFlow(**d.get("investor_flow", {})),
        after_hours_change_pct=d.get("after_hours_change_pct"),
        vi_status=VIStatus(**d.get("vi_status", {})),
        market_cap=d.get("market_cap"),
        collection_failed=d.get("collection_failed", False),
        collection_error=d.get("collection_error"),
    )


def breakdown_to_dict(b: ScoreBreakdown) -> dict[str, Any]:
    return {
        "trading_value_rank": b.trading_value_rank,
        "candle_shape": b.candle_shape,
        "supply_demand": b.supply_demand,
        "ma_alignment": b.ma_alignment,
        "after_hours": b.after_hours,
        "material_strength": b.material_strength,
    }


def breakdown_from_dict(d: dict[str, Any]) -> ScoreBreakdown:
    return ScoreBreakdown(**d)

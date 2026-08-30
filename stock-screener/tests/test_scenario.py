from datetime import date, timedelta

import pytest

from stock_screener.config import load_scenario_config
from stock_screener.models import Candle, MaterialInfo, MaterialStrength, StockRawData
from stock_screener.scenario import build_scenario_rows, compute_adjustments


@pytest.fixture
def config():
    return load_scenario_config()


def _flat_candles(close: float, n: int = 20) -> list[Candle]:
    start = date(2026, 7, 1)
    return [
        Candle(trade_date=start + timedelta(days=i), open=close, high=close * 1.02, low=close * 0.98, close=close, volume=50_000)
        for i in range(n)
    ]


def make_raw(prev_close: float = 10_000, market_cap: float = 500_000_000_000, **overrides) -> StockRawData:
    base = dict(
        ticker="005930",
        name="삼성전자",
        daily_candles=_flat_candles(prev_close),
        today_close=prev_close,
        market_cap=market_cap,
    )
    base.update(overrides)
    return StockRawData(**base)


def test_six_bands_present(config):
    raw = make_raw()
    rows = build_scenario_rows(raw, None, config)
    assert len(rows) == 6
    assert [r.band_id for r in rows] == [
        "lock_limit_up",
        "chase_forbidden",
        "normal_gap_up",
        "watch_flat",
        "thesis_impaired",
        "hold_off",
    ]


def test_untradeable_bands_have_no_prices(config):
    raw = make_raw()
    rows = build_scenario_rows(raw, None, config)
    lock_up = next(r for r in rows if r.band_id == "lock_limit_up")
    hold_off = next(r for r in rows if r.band_id == "hold_off")
    assert lock_up.tradeable is False
    assert lock_up.stop_loss_price_range is None
    assert hold_off.tradeable is False
    assert hold_off.note == "뉴스 재확인 필요"


def test_normal_gap_up_stop_loss_uses_strong_material_multiplier(config):
    raw = make_raw(prev_close=10_000)
    weak_rows = build_scenario_rows(raw, MaterialInfo(ticker="005930", strength=MaterialStrength.WEAK), config)
    strong_rows = build_scenario_rows(raw, MaterialInfo(ticker="005930", strength=MaterialStrength.STRONG), config)

    weak_row = next(r for r in weak_rows if r.band_id == "normal_gap_up")
    strong_row = next(r for r in strong_rows if r.band_id == "normal_gap_up")

    # 재료강도 강일 때 손절 배수(0.96)가 더 낮아 손절가가 더 낮게(여유있게) 잡혀야 함
    assert strong_row.stop_loss_price_range[0] <= weak_row.stop_loss_price_range[0]
    assert "재료강도 강" in strong_row.stop_loss_formula


def test_watch_flat_stop_loss_based_on_prev_close(config):
    raw = make_raw(prev_close=10_000)
    rows = build_scenario_rows(raw, None, config)
    watch_flat = next(r for r in rows if r.band_id == "watch_flat")
    lo, hi = watch_flat.stop_loss_price_range
    expected = 10_000 * 0.97
    assert lo == pytest.approx(expected, rel=0.01)
    assert hi == pytest.approx(expected, rel=0.01)


def test_small_cap_tightens_stop_loss(config):
    raw_normal = make_raw(prev_close=10_000, market_cap=500_000_000_000)
    raw_small = make_raw(prev_close=10_000, market_cap=100_000_000_000)  # 소형주 임계값(3000억) 미만

    rows_normal = build_scenario_rows(raw_normal, None, config)
    rows_small = build_scenario_rows(raw_small, None, config)

    normal_watch = next(r for r in rows_normal if r.band_id == "watch_flat")
    small_watch = next(r for r in rows_small if r.band_id == "watch_flat")

    # 소형주는 손절폭이 타이트(진입가에 더 가까운, 즉 더 높은 손절가)해야 함
    assert small_watch.stop_loss_price_range[0] > normal_watch.stop_loss_price_range[0]


def test_compute_adjustments_reports_strong_material(config):
    raw = make_raw()
    memo = compute_adjustments(raw, MaterialInfo(ticker="005930", strength=MaterialStrength.STRONG), config)
    assert any("재료강도" in reason for reason in memo.reasons)


def test_missing_prev_close_raises(config):
    raw = make_raw()
    raw.today_close = None
    with pytest.raises(ValueError):
        build_scenario_rows(raw, None, config)

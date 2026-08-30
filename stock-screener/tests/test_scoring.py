from datetime import date, timedelta

import pytest

from stock_screener.config import load_scoring_config
from stock_screener.models import Candle, InvestorFlow, MaterialStrength, StockRawData, VIStatus
from stock_screener.scoring import (
    finalize_score,
    preliminary_score,
    screen_final,
    select_candidates_for_material_search,
)


@pytest.fixture
def config():
    return load_scoring_config()


def _candles(closes: list[float], start: date) -> list[Candle]:
    return [
        Candle(trade_date=start + timedelta(days=i), open=c, high=c * 1.01, low=c * 0.99, close=c, volume=100_000)
        for i, c in enumerate(closes)
    ]


def make_raw(**overrides) -> StockRawData:
    base = dict(
        ticker="005930",
        name="삼성전자",
        daily_candles=_candles([100 + i for i in range(25)], date(2026, 7, 1)),
        today_open=126.0,
        today_high=128.0,
        today_low=125.0,
        today_close=127.0,
        today_trading_value=1_000_000_000,
        market_trading_value_rank_percentile=95.0,
        investor_flow=InvestorFlow(foreign_net_buy=1.0, institution_net_buy=1.0),
        after_hours_change_pct=6.0,
        vi_status=VIStatus(),
        market_cap=400_000_000_000,
    )
    base.update(overrides)
    return StockRawData(**base)


def test_preliminary_score_full_marks_when_all_strong(config):
    raw = make_raw()
    breakdown = preliminary_score(raw, config)
    # 캔들모양: (128-127)/128 ≈ 0.0078 tail -> 거의 만점
    assert breakdown.trading_value_rank == pytest.approx(25 * 0.95, abs=0.5)
    assert breakdown.supply_demand == 20
    assert breakdown.ma_alignment == 15  # 종가가 상승 추세라 5/20일선 위
    assert breakdown.after_hours == 10  # cap(5%) 이상이므로 만점
    assert breakdown.material_strength == 0  # 예비 단계에서는 항상 0


def test_supply_demand_one_side_half_score(config):
    raw = make_raw(investor_flow=InvestorFlow(foreign_net_buy=1.0, institution_net_buy=-1.0))
    breakdown = preliminary_score(raw, config)
    assert breakdown.supply_demand == config["weights"]["supply_demand"] / 2


def test_supply_demand_both_selling_zero(config):
    raw = make_raw(investor_flow=InvestorFlow(foreign_net_buy=-1.0, institution_net_buy=-1.0))
    breakdown = preliminary_score(raw, config)
    assert breakdown.supply_demand == 0


def test_after_hours_negative_is_zero(config):
    raw = make_raw(after_hours_change_pct=-2.0)
    breakdown = preliminary_score(raw, config)
    assert breakdown.after_hours == 0


def test_candle_shape_long_upper_tail_scores_low(config):
    raw = make_raw(today_high=300.0, today_close=127.0)  # 큰 윗꼬리
    breakdown = preliminary_score(raw, config)
    assert breakdown.candle_shape < config["weights"]["candle_shape"] * 0.5


def test_finalize_score_adds_material_points(config):
    raw = make_raw()
    prelim = preliminary_score(raw, config)
    final = finalize_score(prelim, MaterialStrength.STRONG, config)
    assert final.material_strength == config["weights"]["material_strength"]
    final_none = finalize_score(prelim, MaterialStrength.NONE, config)
    assert final_none.material_strength == 0


def test_select_candidates_respects_top_n(config):
    config = dict(config)
    config["top_n"] = 2
    stocks = [make_raw(ticker=f"00{i}", market_trading_value_rank_percentile=float(i)) for i in range(5)]
    picked = select_candidates_for_material_search(stocks, config)
    assert len(picked) == 2
    # percentile이 가장 높은(=4, 3) 종목이 선택되어야 함
    assert {raw.ticker for raw, _ in picked} == {"004", "003"}


def test_select_candidates_excludes_failed(config):
    stocks = [make_raw(ticker="005930"), make_raw(ticker="000660", collection_failed=True)]
    picked = select_candidates_for_material_search(stocks, config)
    assert len(picked) == 1
    assert picked[0][0].ticker == "005930"


def test_screen_final_filters_below_min_score(config):
    raw = make_raw(
        market_trading_value_rank_percentile=0.0,
        investor_flow=InvestorFlow(0.0, 0.0),
        after_hours_change_pct=None,
        today_high=200.0,
        today_close=100.0,  # 극단적 윗꼬리 -> 낮은 점수
    )
    prelim = preliminary_score(raw, config)
    result = screen_final([(raw, prelim, MaterialStrength.NONE)], config)
    assert result[0].watch_only is True
    assert result[0].recommended_weight_pct == 0


def test_screen_final_position_sizing_tiers(config):
    raw = make_raw()
    prelim = preliminary_score(raw, config)
    strong = screen_final([(raw, prelim, MaterialStrength.STRONG)], config)[0]
    assert strong.breakdown.total >= 80
    assert strong.recommended_weight_pct == 100

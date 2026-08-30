"""파이프라인 전 단계에서 공유하는 데이터 클래스."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date
from enum import Enum


class MaterialStrength(str, Enum):
    STRONG = "strong"
    MEDIUM = "medium"
    WEAK = "weak"
    NONE = "none"


@dataclass
class Candle:
    trade_date: date
    open: float
    high: float
    low: float
    close: float
    volume: int


@dataclass
class VIStatus:
    """VI(변동성완화장치)·투자유의 상태."""

    vi_triggered: bool = False
    short_term_overheated: bool = False  # 단기과열
    investment_warning: bool = False  # 투자경고
    investment_caution: bool = False  # 투자주의
    under_liquidation: bool = False  # 정리매매

    @property
    def has_any_flag(self) -> bool:
        return any(
            [
                self.vi_triggered,
                self.short_term_overheated,
                self.investment_warning,
                self.investment_caution,
                self.under_liquidation,
            ]
        )


@dataclass
class InvestorFlow:
    """투자자별 매매동향 (당일, 원화 기준 순매수 금액)."""

    foreign_net_buy: float = 0.0
    institution_net_buy: float = 0.0

    @property
    def both_buying(self) -> bool:
        return self.foreign_net_buy > 0 and self.institution_net_buy > 0

    @property
    def one_side_buying(self) -> bool:
        return (self.foreign_net_buy > 0) != (self.institution_net_buy > 0) and (
            self.foreign_net_buy > 0 or self.institution_net_buy > 0
        )


@dataclass
class StockRawData:
    """Stage 1에서 수집한 종목별 원시 데이터."""

    ticker: str
    name: str
    daily_candles: list[Candle] = field(default_factory=list)  # 최근 20~60일, 오래된 순
    today_open: float | None = None
    today_high: float | None = None
    today_low: float | None = None
    today_close: float | None = None  # 당일 종가 = 전일 종가(익일 시나리오 기준가)
    today_trading_value: float | None = None  # 당일 거래대금
    market_trading_value_rank_percentile: float | None = None  # 0~100, 높을수록 상위
    investor_flow: InvestorFlow = field(default_factory=InvestorFlow)
    after_hours_change_pct: float | None = None  # 시간외 단일가 등락률(%)
    vi_status: VIStatus = field(default_factory=VIStatus)
    market_cap: float | None = None
    collection_failed: bool = False
    collection_error: str | None = None


@dataclass
class ScoreBreakdown:
    trading_value_rank: float = 0.0
    candle_shape: float = 0.0
    supply_demand: float = 0.0
    ma_alignment: float = 0.0
    after_hours: float = 0.0
    material_strength: float = 0.0

    @property
    def total(self) -> float:
        return (
            self.trading_value_rank
            + self.candle_shape
            + self.supply_demand
            + self.ma_alignment
            + self.after_hours
            + self.material_strength
        )


@dataclass
class ScoredStock:
    raw: StockRawData
    breakdown: ScoreBreakdown
    recommended_weight_pct: int
    caution_tag: bool  # VI/투자유의 태그
    watch_only: bool  # 관망 권장 (min_score 미만)


@dataclass
class MaterialInfo:
    """Stage 3: Claude Code 웹 검색으로 조사한 재료 정보."""

    ticker: str
    summary_lines: list[str] = field(default_factory=list)  # 2~3줄 요약
    sources: list[str] = field(default_factory=list)  # 출처 링크
    strength: MaterialStrength = MaterialStrength.NONE
    invalidated: bool = False
    invalidation_reason: str | None = None


@dataclass
class ScenarioRow:
    band_id: str
    label: str
    verdict: str
    entry_condition: str
    tradeable: bool
    stop_loss_formula: str | None = None
    stop_loss_price_range: tuple[float, float] | None = None
    take_profit_formula: str | None = None
    take_profit_price_range: tuple[float, float] | None = None
    note: str | None = None


@dataclass
class AdjustmentMemo:
    reasons: list[str] = field(default_factory=list)


@dataclass
class StockReportSection:
    ticker: str
    name: str
    scored: ScoredStock
    material: MaterialInfo | None
    scenario_rows: list[ScenarioRow]
    adjustment_memo: AdjustmentMemo

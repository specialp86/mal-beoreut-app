"""토스증권 Open API 래퍼.

⚠️ 중요 — 응답 스키마 검증 필요
    이 세션에서는 실제 client_id/secret과 공식 API 문서 원문에 접근할 수
    없었기 때문에, 아래 엔드포인트 경로/파라미터/응답 필드명은 공개된
    정보(및 스펙 문서의 한국어 설명)를 근거로 한 최선의 추정치다.
    실제 계정으로 최초 실행 시 `debug=True`로 raw JSON을 확인하고,
    `_parse_*` 함수들의 필드명 매핑만 수정하면 나머지 파이프라인
    (scoring/scenario/report)은 그대로 동작하도록 설계했다.

    검증이 필요한 부분은 코드 내 `# NOTE(unverified)` 주석으로 표시.
"""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any

import httpx
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

from .auth import TossAuth
from .models import Candle, InvestorFlow, VIStatus

logger = logging.getLogger(__name__)


class TossAPIError(RuntimeError):
    def __init__(self, message: str, status_code: int | None = None, body: str | None = None):
        super().__init__(message)
        self.status_code = status_code
        self.body = body


class RetryableTossAPIError(TossAPIError):
    """429/5xx 등 재시도 가능한 오류."""


def _raise_for_status(resp: httpx.Response, context: str) -> None:
    if resp.status_code == 200:
        return
    body = resp.text[:500]
    if resp.status_code == 429 or resp.status_code >= 500:
        raise RetryableTossAPIError(
            f"{context} 실패 (status={resp.status_code})", resp.status_code, body
        )
    raise TossAPIError(f"{context} 실패 (status={resp.status_code})", resp.status_code, body)


class TossClient:
    def __init__(self, auth: TossAuth, http_client: httpx.Client | None = None, debug: bool = False):
        self.auth = auth
        self._client = http_client or httpx.Client(timeout=10.0)
        self._owns_client = http_client is None
        self.debug = debug

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> "TossClient":
        return self

    def __exit__(self, *exc: object) -> None:
        self.close()

    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.auth.get_access_token()}"}

    @retry(
        retry=retry_if_exception_type(RetryableTossAPIError),
        stop=stop_after_attempt(4),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        reraise=True,
    )
    def _get(self, path: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        url = f"{self.auth.base_url}{path}"
        resp = self._client.get(url, params=params, headers=self._headers())
        _raise_for_status(resp, f"GET {path}")
        data = resp.json()
        if self.debug:
            logger.debug("GET %s %s -> %s", path, params, data)
        return data

    # ------------------------------------------------------------------
    # /api/v1/candles — 일봉
    # ------------------------------------------------------------------
    def get_daily_candles(self, ticker: str, count: int = 60) -> list[Candle]:
        # NOTE(unverified): 파라미터명은 code/period/count로 가정.
        data = self._get(
            "/api/v1/candles",
            params={"code": ticker, "period": "day", "count": count},
        )
        rows = data.get("candles") or data.get("data") or data.get("result") or []
        candles = [self._parse_candle(row) for row in rows]
        candles.sort(key=lambda c: c.trade_date)
        return candles

    @staticmethod
    def _parse_candle(row: dict[str, Any]) -> Candle:
        raw_date = row.get("date") or row.get("baseDate") or row.get("tradeDate")
        trade_date = TossClient._parse_date(raw_date)
        return Candle(
            trade_date=trade_date,
            open=float(row.get("open") or row.get("openPrice") or 0),
            high=float(row.get("high") or row.get("highPrice") or 0),
            low=float(row.get("low") or row.get("lowPrice") or 0),
            close=float(row.get("close") or row.get("closePrice") or 0),
            volume=int(row.get("volume") or row.get("tradeVolume") or 0),
        )

    @staticmethod
    def _parse_date(raw: Any) -> date:
        if isinstance(raw, int):
            raw = str(raw)
        if isinstance(raw, str):
            raw = raw.replace("-", "")[:8]
            return datetime.strptime(raw, "%Y%m%d").date()
        raise TossAPIError(f"알 수 없는 날짜 형식: {raw!r}")

    # ------------------------------------------------------------------
    # /api/v1/prices — 현재가/당일 시세
    # ------------------------------------------------------------------
    def get_current_price(self, ticker: str) -> dict[str, Any]:
        # NOTE(unverified): 응답 필드는 openPrice/highPrice/lowPrice/closePrice/
        # tradingValue/marketCap 등으로 가정. 실행 시 debug=True로 확인 필요.
        data = self._get("/api/v1/prices", params={"code": ticker})
        row = data.get("price") or data.get("data") or data
        return {
            "open": _to_float(row.get("openPrice") or row.get("open")),
            "high": _to_float(row.get("highPrice") or row.get("high")),
            "low": _to_float(row.get("lowPrice") or row.get("low")),
            "close": _to_float(row.get("closePrice") or row.get("close")),
            "trading_value": _to_float(
                row.get("tradingValue") or row.get("tradeValue") or row.get("accTradeValue")
            ),
            "market_cap": _to_float(row.get("marketCap")),
            "after_hours_change_pct": _to_float(
                row.get("afterHoursChangeRate") or row.get("overtimeChangeRate")
            ),
        }

    # ------------------------------------------------------------------
    # /api/v1/rankings — 거래대금·등락률 순위
    # ------------------------------------------------------------------
    def get_trading_value_rank_percentile(self, ticker: str, market: str = "ALL") -> float | None:
        """전체 순위 목록에서 ticker의 백분위(0~100, 높을수록 상위)를 계산.

        NOTE(unverified): rankings 엔드포인트가 전 종목을 한번에 반환하는지,
        페이지네이션이 필요한지 불확실. 우선 단일 호출로 상위 N개 리스트를
        받는다고 가정하고, 그 안에 없으면 None을 반환해 스코어링 단계에서
        0점 처리한다.
        """
        data = self._get(
            "/api/v1/rankings", params={"type": "tradingValue", "market": market}
        )
        rows = data.get("rankings") or data.get("data") or data.get("result") or []
        total = len(rows)
        if total == 0:
            return None
        for idx, row in enumerate(rows):
            code = row.get("code") or row.get("ticker") or row.get("stockCode")
            if code == ticker:
                # idx=0이 1위 → 백분위는 상위일수록 100에 가깝게
                return round((1 - idx / max(total - 1, 1)) * 100, 2)
        return None

    # ------------------------------------------------------------------
    # 투자자별 매매동향 (수급)
    # ------------------------------------------------------------------
    def get_investor_flow(self, ticker: str) -> InvestorFlow:
        # NOTE(unverified): 엔드포인트 경로가 공개 문서에 명시되지 않아
        # /api/v1/investor-trends 로 가정. 실제 경로가 다르면 여기만 수정.
        try:
            data = self._get("/api/v1/investor-trends", params={"code": ticker})
        except TossAPIError:
            logger.warning("investor-trends 조회 실패, 수급 데이터 없이 진행: %s", ticker)
            return InvestorFlow()
        row = data.get("data") or data.get("result") or data
        return InvestorFlow(
            foreign_net_buy=_to_float(row.get("foreignNetBuy") or row.get("foreignerNetBuy")) or 0.0,
            institution_net_buy=_to_float(row.get("institutionNetBuy") or row.get("instNetBuy")) or 0.0,
        )

    # ------------------------------------------------------------------
    # VI / 매수유의 상태
    # ------------------------------------------------------------------
    def get_vi_status(self, ticker: str) -> VIStatus:
        # NOTE(unverified): /api/v1/caution 경로 가정.
        try:
            data = self._get("/api/v1/caution", params={"code": ticker})
        except TossAPIError:
            logger.warning("caution(VI) 조회 실패, 플래그 없이 진행: %s", ticker)
            return VIStatus()
        row = data.get("data") or data.get("result") or data
        flags = row.get("flags") or row
        return VIStatus(
            vi_triggered=bool(flags.get("viTriggered") or flags.get("vi")),
            short_term_overheated=bool(flags.get("shortTermOverheated")),
            investment_warning=bool(flags.get("investmentWarning")),
            investment_caution=bool(flags.get("investmentCaution")),
            under_liquidation=bool(flags.get("underLiquidation")),
        )


def _to_float(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None

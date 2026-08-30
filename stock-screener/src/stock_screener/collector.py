"""Stage 1: Data Collector.

종목 리스트를 받아 배치로 원시 데이터를 수집한다. Rate limit을 고려해
배치 크기와 호출 간격을 자동 계산하고, 실패한 종목은 재시도 후 최종
실패 시 `collection_failed=True`로 표시해 리포트에서 제외한다.
"""

from __future__ import annotations

import logging
import time
from collections.abc import Iterable

from .models import StockRawData
from .toss_client import TossClient

logger = logging.getLogger(__name__)


class DataCollector:
    def __init__(
        self,
        client: TossClient,
        candle_count: int = 60,
        batch_size: int = 5,
        batch_interval_sec: float = 1.0,
        max_retries: int = 2,
    ) -> None:
        self.client = client
        self.candle_count = candle_count
        self.batch_size = max(1, batch_size)
        self.batch_interval_sec = batch_interval_sec
        self.max_retries = max_retries

    def collect_all(self, tickers: Iterable[str]) -> list[StockRawData]:
        tickers = list(dict.fromkeys(t.strip() for t in tickers if t.strip()))
        results: list[StockRawData] = []
        for batch_start in range(0, len(tickers), self.batch_size):
            batch = tickers[batch_start : batch_start + self.batch_size]
            for ticker in batch:
                results.append(self._collect_one_with_retry(ticker))
            if batch_start + self.batch_size < len(tickers):
                time.sleep(self.batch_interval_sec)
        return results

    def _collect_one_with_retry(self, ticker: str) -> StockRawData:
        last_error: Exception | None = None
        for attempt in range(self.max_retries + 1):
            try:
                return self._collect_one(ticker)
            except Exception as e:  # noqa: BLE001 - 개별 종목 실패는 리포트에서 제외 처리
                last_error = e
                logger.warning(
                    "종목 %s 데이터 수집 실패 (시도 %d/%d): %s",
                    ticker,
                    attempt + 1,
                    self.max_retries + 1,
                    e,
                )
        return StockRawData(
            ticker=ticker,
            name=ticker,
            collection_failed=True,
            collection_error=str(last_error) if last_error else "unknown error",
        )

    def _collect_one(self, ticker: str) -> StockRawData:
        candles = self.client.get_daily_candles(ticker, count=self.candle_count)
        price = self.client.get_current_price(ticker)
        rank_percentile = self.client.get_trading_value_rank_percentile(ticker)
        investor_flow = self.client.get_investor_flow(ticker)
        vi_status = self.client.get_vi_status(ticker)

        return StockRawData(
            ticker=ticker,
            name=ticker,  # NOTE(unverified): 종목명 필드가 별도 응답에 있으면 여기서 채운다.
            daily_candles=candles,
            today_open=price.get("open"),
            today_high=price.get("high"),
            today_low=price.get("low"),
            today_close=price.get("close"),
            today_trading_value=price.get("trading_value"),
            market_trading_value_rank_percentile=rank_percentile,
            investor_flow=investor_flow,
            after_hours_change_pct=price.get("after_hours_change_pct"),
            vi_status=vi_status,
            market_cap=price.get("market_cap"),
        )

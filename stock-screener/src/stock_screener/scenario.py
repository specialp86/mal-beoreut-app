"""Stage 4: 시나리오 규칙 엔진.

전일 종가 기준 갭 구간(gap_bands, config/scenario_rules.yaml)마다 진입/손절/
목표가 "공식"과, 그 구간의 최소~최대 갭%를 전일 종가에 적용했을 때 나오는
"예시 가격 범위"를 함께 계산해 리포트에 싣는다. 리포트는 장 시작 전 1회
발행되어 익일 재계산이 없으므로, 실제 시가가 어느 값으로 나오든 사용자가
해당 갭 구간 행을 찾아 바로 참고할 수 있도록 모든 구간을 미리 산출해둔다.

가격 범위는 "이 구간의 하단 갭%로 시가가 나왔을 때"와 "상단 갭%로 나왔을 때"
두 경계값을 각각 공식에 대입한 결과이며, 실제 시가는 그 사이 어딘가에
위치하므로 사용자가 그 범위 안에서 비례적으로 가늠하면 된다.
"""

from __future__ import annotations

from typing import Any

from .models import AdjustmentMemo, MaterialInfo, MaterialStrength, ScenarioRow, StockRawData


def _atr_pct(raw: StockRawData, window: int = 14) -> float | None:
    candles = raw.daily_candles[-window:]
    if len(candles) < 2:
        return None
    ranges_pct = [
        (c.high - c.low) / c.close * 100 for c in candles if c.close
    ]
    if not ranges_pct:
        return None
    return sum(ranges_pct) / len(ranges_pct)


def compute_adjustments(
    raw: StockRawData, material: MaterialInfo | None, config: dict[str, Any]
) -> AdjustmentMemo:
    adj_cfg = config["adjustments"]
    memo = AdjustmentMemo()

    strong = bool(material and material.strength == MaterialStrength.STRONG)
    if strong:
        memo.reasons.append(
            f"재료강도 '강' → 손절폭을 표준보다 여유 있게 적용 "
            f"(기본 -{adj_cfg['strong_material_stop_loss_relief_pct']}% 허용)"
        )

    small_cap = (
        raw.market_cap is not None
        and raw.market_cap < adj_cfg["small_cap_market_cap_threshold_krw"]
    )
    atr = _atr_pct(raw)
    high_vol = atr is not None and atr >= adj_cfg["high_volatility_atr_pct_threshold"]
    if small_cap or high_vol:
        reason_bits = []
        if small_cap:
            reason_bits.append("시가총액 소형주")
        if high_vol:
            reason_bits.append(f"최근 변동성(ATR≈{atr:.1f}%) 높음")
        memo.reasons.append(
            f"{' + '.join(reason_bits)} → 손절폭을 -{adj_cfg['small_cap_high_volatility_stop_loss_tight_pct']}%로 "
            "타이트하게 조정"
        )
    if not memo.reasons:
        memo.reasons.append("표준 손절/목표 규칙 그대로 적용 (별도 조정 없음)")
    return memo


def _resolve_basis_price(basis: str, prev_close: float, boundary_price: float) -> float:
    if basis == "prev_close":
        return prev_close
    if basis in ("entry_price", "open_price"):
        return boundary_price
    raise ValueError(f"알 수 없는 basis: {basis}")


def _tighten_if_needed(
    entry: float, stop: float, tight_stop: bool, tight_pct: float
) -> float:
    """소형/고변동 종목이면 손절폭을 tight_pct% 이내로 강제 축소(스탑을 진입가에 더 가깝게)."""
    if not tight_stop:
        return stop
    tight_stop_price = entry * (1 - tight_pct / 100)
    # 손절가는 진입가보다 낮아야 하며, 두 후보 중 진입가에 더 가까운(=손실이 작은) 쪽을 채택
    return max(stop, tight_stop_price)


def _band_stop_loss(
    band: dict[str, Any],
    prev_close: float,
    boundary_price: float,
    strong_material: bool,
    tight_stop: bool,
    tight_pct: float,
) -> tuple[float | None, str | None]:
    sl_cfg = band.get("stop_loss")
    if not sl_cfg:
        return None, None
    basis_price = _resolve_basis_price(sl_cfg["basis"], prev_close, boundary_price)

    if "multiplier" in sl_cfg:
        multiplier = sl_cfg["multiplier"]
        formula = f"{_basis_label(sl_cfg['basis'])} × {multiplier}"
    else:
        multiplier = (
            sl_cfg["multiplier_strong_material"] if strong_material else sl_cfg["multiplier_default"]
        )
        tag = "재료강도 강" if strong_material else "기본"
        formula = f"{_basis_label(sl_cfg['basis'])} × {multiplier} ({tag})"

    stop_price = basis_price * multiplier
    stop_price = _tighten_if_needed(basis_price, stop_price, tight_stop, tight_pct)
    return stop_price, formula


def _band_take_profit(
    band: dict[str, Any],
    prev_close: float,
    boundary_price: float,
    stop_loss_price: float | None,
) -> tuple[float | None, str | None]:
    tp_cfg = band.get("take_profit")
    if not tp_cfg:
        return None, None
    basis = tp_cfg["basis"]

    if basis == "stop_loss_distance":
        if stop_loss_price is None:
            return None, None
        entry_basis = _resolve_basis_price(
            band["stop_loss"]["basis"], prev_close, boundary_price
        )
        distance = entry_basis - stop_loss_price
        if "multiplier" in tp_cfg:
            target = entry_basis + distance * tp_cfg["multiplier"]
            formula = f"손절폭 × {tp_cfg['multiplier']}"
        else:
            mult = (tp_cfg["multiplier_min"] + tp_cfg["multiplier_max"]) / 2
            target = entry_basis + distance * mult
            formula = f"손절폭 × {tp_cfg['multiplier_min']}~{tp_cfg['multiplier_max']}"
        return target, formula

    basis_price = _resolve_basis_price(basis, prev_close, boundary_price)
    if "multiplier" in tp_cfg:
        target = basis_price * tp_cfg["multiplier"]
        formula = f"{_basis_label(basis)} × {tp_cfg['multiplier']}"
    else:
        mult = (tp_cfg["multiplier_min"] + tp_cfg["multiplier_max"]) / 2
        target = basis_price * mult
        formula = f"{_basis_label(basis)} × {tp_cfg['multiplier_min']}~{tp_cfg['multiplier_max']}"
    return target, formula


def _basis_label(basis: str) -> str:
    return {
        "entry_price": "진입가",
        "open_price": "시가",
        "prev_close": "전일 종가",
    }.get(basis, basis)


def build_scenario_rows(
    raw: StockRawData, material: MaterialInfo | None, config: dict[str, Any]
) -> list[ScenarioRow]:
    prev_close = raw.today_close
    if prev_close is None or prev_close <= 0:
        raise ValueError(f"{raw.ticker}: 전일 종가(today_close) 데이터가 없습니다")

    adj_cfg = config["adjustments"]
    strong_material = bool(material and material.strength == MaterialStrength.STRONG)
    small_cap = raw.market_cap is not None and raw.market_cap < adj_cfg["small_cap_market_cap_threshold_krw"]
    atr = _atr_pct(raw)
    high_vol = atr is not None and atr >= adj_cfg["high_volatility_atr_pct_threshold"]
    tight_stop = small_cap or high_vol
    tight_pct = adj_cfg["small_cap_high_volatility_stop_loss_tight_pct"]

    rows: list[ScenarioRow] = []
    for band in config["gap_bands"]:
        if not band.get("tradeable", False):
            rows.append(
                ScenarioRow(
                    band_id=band["id"],
                    label=band["label"],
                    verdict=band["verdict"],
                    entry_condition=band["entry_condition"],
                    tradeable=False,
                    note=band.get("note"),
                )
            )
            continue

        lo_pct = band["min_gap_pct"] if band["min_gap_pct"] is not None else band["max_gap_pct"]
        hi_pct = band["max_gap_pct"] if band["max_gap_pct"] is not None else band["min_gap_pct"]
        lo_price = prev_close * (1 + lo_pct / 100)
        hi_price = prev_close * (1 + hi_pct / 100)

        sl_lo, sl_formula = _band_stop_loss(band, prev_close, lo_price, strong_material, tight_stop, tight_pct)
        sl_hi, _ = _band_stop_loss(band, prev_close, hi_price, strong_material, tight_stop, tight_pct)
        tp_lo, tp_formula = _band_take_profit(band, prev_close, lo_price, sl_lo)
        tp_hi, _ = _band_take_profit(band, prev_close, hi_price, sl_hi)

        rows.append(
            ScenarioRow(
                band_id=band["id"],
                label=band["label"],
                verdict=band["verdict"],
                entry_condition=band["entry_condition"],
                tradeable=True,
                stop_loss_formula=sl_formula,
                stop_loss_price_range=(round(min(sl_lo, sl_hi), 1), round(max(sl_lo, sl_hi), 1))
                if sl_lo is not None and sl_hi is not None
                else None,
                take_profit_formula=tp_formula,
                take_profit_price_range=(round(min(tp_lo, tp_hi), 1), round(max(tp_lo, tp_hi), 1))
                if tp_lo is not None and tp_hi is not None
                else None,
                note=band.get("note"),
            )
        )
    return rows

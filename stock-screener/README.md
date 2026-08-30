# 전일 종목 스크리닝 + 매매 시나리오 리포트 생성기

전일 장마감 후 종목 리스트를 입력하면, 스코어링으로 매매 가치가 있는
종목을 걸러내고, 상승 재료(뉴스/공시)를 조사한 뒤, 전일 종가 대비 시가
갭 구간별 진입/손절/목표가 시나리오를 미리 산출해 하나의 마크다운
리포트로 발행하는 의사결정 지원 도구다.

**이 도구는 자동매매 시스템이 아니다.** 조건 충족 시 참고용 구간을
계산해줄 뿐이며, 실제 매매 실행과 최종 책임은 사용자에게 있다. 리포트는
전일 밤 1회 발행되며 익일 재계산은 없다 — 시가가 어떻게 나오든 대응할 수
있도록 6개 갭 구간의 시나리오를 사전에 모두 계산해둔다.

## 아키텍처

파이프라인은 두 개의 프로세스로 나뉜다. 재료(뉴스/공시) 조사는 토스
API에 없고, "Claude Code의 웹 검색 기능"으로 처리하도록 스펙에 명시되어
있기 때문에, **파이썬 스크립트가 아니라 이 도구를 운용하는 Claude Code
에이전트가 직접 그 단계를 수행**한다.

```
1) python -m stock_screener screen tickers.txt --out-dir ./out
      Stage 1(데이터 수집) + Stage 2(예비 스코어링, 재료강도 제외 90점)
      → out/candidates.json (상위 N개 원시데이터+예비점수)
      → out/materials_template.json (빈 재료 템플릿)

2) (Claude Code가 수행) out/materials_template.json 의 각 종목에 대해
      웹 검색("{종목명}" 뉴스/단독/공시)으로 재료를 조사하고
      summary_lines / sources / strength(strong|medium|weak|none) /
      invalidated 를 채워 out/materials.json 으로 저장한다.

3) python -m stock_screener report ./out --out report.md
      Stage 2 최종 스코어(재료강도 10점 포함) + Stage 4(시나리오 규칙) +
      Stage 5(리포트 렌더링)
      → report.md
```

## 설치

```bash
cd stock-screener
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # TOSS_CLIENT_ID / TOSS_CLIENT_SECRET 입력
```

## 설정 파일

- `config/scoring_weights.yaml` — 스코어 배점(100점 만점), 상위 N/최소
  점수 필터, 권장 비중 규칙. 실매매 결과를 바탕으로 이 파일만 조정하면
  된다.
- `config/scenario_rules.yaml` — 갭 구간별 진입/손절/목표가 공식, 공통
  실행 규칙(시장게이트/시간마감/재진입금지/거래량조건), 종목별 조정
  임계값(소형주 시가총액, 변동성 ATR%).

## ⚠️ 알려진 한계 — Toss Open API 응답 스키마 미검증

이 프로젝트는 원래 기존 사내 스크립트(`toss_api_test.py`)의 인증 로직을
재사용하도록 스펙이 작성되었지만, 해당 파일이 이 저장소/개발 세션 어디에도
존재하지 않았다. `src/stock_screener/toss_client.py`는 공개적으로 확인
가능한 정보(OAuth2 client_credentials, `/oauth2/token`, `/api/v1/candles`)
를 기준으로 작성했고, 나머지 엔드포인트(`/api/v1/prices`,
`/api/v1/rankings`, 투자자별 매매동향, VI/투자유의)의 정확한 경로와 응답
필드명은 최선의 추정치다 (`# NOTE(unverified)` 주석 표시).

**실제 계정으로 최초 실행할 때** `screen --debug` 로 raw JSON 응답을
확인하고, `toss_client.py`의 `_parse_*` / 필드명 매핑 부분만 실제 스키마에
맞게 고치면 된다. 스코어링/시나리오/리포트 로직은 `StockRawData` 모델에만
의존하므로 수정 범위가 그 파일 하나로 국한된다.

## 테스트

핵심 로직(스코어링, 시나리오 규칙)은 실제 API 없이 단위 테스트로 검증된다.

```bash
pip install -r requirements.txt
pytest
```

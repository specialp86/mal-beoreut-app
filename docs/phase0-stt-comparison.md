# Phase 0: STT 필러워드 검출 비교

**상태: 실행 대기 (Pending)** — 아래 "필요 입력값"이 준비되지 않아 실제 API
호출 결과는 아직 없음. 방법론과 산출 포맷만 먼저 정리한다.

## 목적

동일한 한국어 리허설 녹음(1~2분, 필러워드 다수 포함)을 세 STT API에 각각
넣어, 필러워드("음", "어", "그니까" 등)가 텍스트에 얼마나 남아있는지 비교하고
본개발에 사용할 API 1개를 선정한다.

## 필요 입력값 (현재 미보유)

| 항목 | 상태 | 비고 |
|---|---|---|
| 샘플 녹음 (1~2분, 필러워드 다수) | ❌ 없음 | `samples/`에 위치, 저장소에는 커밋 안 함 |
| 육안 카운트(ground truth) | ❌ 없음 | 샘플을 사람이 직접 듣고 필러워드별 개수를 센 값 |
| `OPENAI_API_KEY` | ❌ 없음 | Whisper API |
| Naver Cloud `X-NCP-APIGW-API-KEY-ID` / `X-NCP-APIGW-API-KEY` | ❌ 없음 | Clova Speech (CSR) |
| `GOOGLE_STT_API_KEY` (또는 서비스 계정) | ❌ 없음 | Google Cloud Speech-to-Text |

이 값들을 확보하면 `scripts/phase0/README.md` 안내대로 실행해서 아래 표를
채운다.

## 실행 방법 (요약)

```bash
cd scripts/phase0
npm install
cp .env.example .env   # 키 채우기
cp ground-truth.example.json ground-truth.json  # 육안 카운트 채우기
node compare-stt.mjs --audio ../../samples/rehearsal-sample.wav
```

스크립트는 세 API를 순서대로 호출하고(키가 없는 API는 건너뜀), 각 결과
텍스트에서 필러워드 사전(`filler-words.json`) 기준으로 단어별 개수를 세어
아래 결과표 형식으로 콘솔에 출력한다. 출력을 이 문서의 "결과" 절에 붙여넣는다.

## 결과 (실행 후 채울 것)

| API | 인식된 전체 텍스트 예시 | 필러워드 검출 개수 | 육안 카운트 대비 검출률 | 비고 |
|---|---|---|---|---|
| OpenAI Whisper (prompt로 필러워드 유도) | _(대기)_ | _(대기)_ | _(대기)_ | |
| Naver Clova Speech | _(대기)_ | _(대기)_ | _(대기)_ | |
| Google Cloud STT | _(대기)_ | _(대기)_ | _(대기)_ | |

## 성공 기준 판정 (실행 후 채울 것)

- [ ] 최소 1개 API 검출률 70% 이상 → 해당 API로 진행
- [ ] 3개 모두 50% 미만 → STT 방식 재검토 (음향 패턴 기반 감지 등 대안 검토)

## 최종 선정

_(대기 — 위 표 채운 뒤 결정)_

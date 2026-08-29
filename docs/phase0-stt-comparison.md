# Phase 0: STT 필러워드 검출 비교

**상태: 일부 실행됨** — Google Cloud STT는 실제 샘플로 테스트 완료. Naver
Clova Speech는 이 저장소를 만든 클라우드 환경의 네트워크 정책상 API 서버
접속이 막혀 있어 로컬 환경에서 재시도 필요. OpenAI Whisper는 API 키 미확보로
아직 테스트 못 함.

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

## 결과

테스트 샘플: 실제 통화 녹음 약 6분 42초 (발표 리허설은 아니고, 자연스러운
대화 음성 — 필러워드 검출 성능 확인 목적으로는 유효). **전체 텍스트는 개인
대화 내용을 포함하므로 저장소에 커밋하지 않음** — 아래는 집계 수치만.

| API | 실행 결과 | 필러워드 검출 개수 | 육안 카운트 대비 검출률 | 비고 |
|---|---|---|---|---|
| OpenAI Whisper (prompt로 필러워드 유도) | 미실행 | - | - | `OPENAI_API_KEY` 미확보 |
| Naver Clova Speech | 실행 실패 | - | - | 이 환경(클라우드 세션)의 조직 네트워크 정책이 `naveropenapi.apigw.ntruss.com`으로의 접속을 차단함. 로컬 PC에서 `node compare-stt.mjs` 재실행 필요 |
| Google Cloud STT | 성공 | 19개 (`그`:10, `이제`:4, `저`:3, `그래서`:1, `일단`:1, **`음`:0, `어`:0**) | 육안 카운트 미보유로 정확한 %는 계산 못 함 | 아래 관찰 참고 |

### 관찰

- Google Cloud STT(기본 설정, 문장부호 자동화 끔)는 6분 넘는 자연스러운
  대화에서 **"음"/"어" 같은 짧은 감탄사를 단 한 번도 인식하지 못함.** 실제
  대화에서 이런 감탄사가 전혀 없었을 가능성은 낮아 보이므로, Google STT가
  기본적으로 이런 종류의 비유창성(disfluency)을 정규화/제거하는 경향이 있는
  것으로 추정됨 — 이 부분이 이 앱의 핵심 기능(감탄사형 필러워드 카운트)에는
  불리한 신호.
- "그", "저"는 지시대명사와 겹쳐서 과다 계수되는 문제가 실제로 나타남 (관련
  필러워드 사전의 알려진 한계, `scripts/phase0/README.md` 참고).
- OpenAI Whisper는 `prompt` 파라미터로 필러워드를 살리도록 유도하는 옵션이
  있어 이 문제에 더 유리할 가능성이 있음 — 키 확보 후 비교 필요.
- Naver Clova는 이번 환경 제약으로 테스트하지 못했으나, 한국어 특화
  엔진이라 필러워드 보존 여부가 궁금한 후보 — 로컬 재실행 우선순위 높음.

## 성공 기준 판정

- [ ] 최소 1개 API 검출률 70% 이상 → **판정 보류** (육안 카운트 없음 + 2개
      API 미테스트)
- [ ] 3개 모두 50% 미만 → **판정 보류**

**결론: 아직 최종 선정 불가.** Google 단독 결과(특히 "음"/"어" 미검출)만
보면 이 앱 목적에는 부적합할 가능성이 있어, Naver(로컬 재실행)와 OpenAI(키
확보 후 실행) 결과를 마저 봐야 판단 가능.

## 최종 선정

_(대기 — Naver 로컬 재실행 + OpenAI 테스트 완료 후 결정)_

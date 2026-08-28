# Phase 0 STT 비교 스크립트

필러워드 사전은 `../../web/src/lib/filler-words.json`을 공용으로 사용한다
(웹 앱과 이 스크립트가 같은 사전을 참조하도록 단일화).

세 STT API(OpenAI Whisper, Naver Clova Speech, Google Cloud STT)에 같은
한국어 샘플을 넣어 필러워드가 텍스트에 얼마나 남는지 비교한다.

## 준비물

1. 필러워드가 다수 포함된 1~2분 한국어 샘플 오디오 (권장: WAV, 16kHz, mono —
   Google STT 호환성이 가장 좋음). `samples/`에 두되 저장소에는 커밋하지 않는다
   (`.gitignore` 처리됨, 개인정보 최소화 원칙).
2. `.env.example`을 `.env`로 복사해 사용할 API 키를 채운다. 키가 없는 API는
   자동으로 건너뛴다.
3. `ground-truth.example.json`을 `ground-truth.json`으로 복사해, 샘플을 직접
   들으며 필러워드별 실제 개수를 채운다(육안/귀 확인 카운트). 이 파일이 없으면
   검출률(%) 계산 없이 개수만 출력한다.

## 실행

```bash
cd scripts/phase0
node compare-stt.mjs --audio ../../samples/rehearsal-sample.wav
```

WAV가 아닌 포맷을 Google STT에 넣을 경우 `--encoding`, `--sampleRate`로
직접 지정할 수 있다 (예: `--encoding MP3 --sampleRate 44100`).

출력 마지막의 마크다운 표 행을 `../../docs/phase0-stt-comparison.md`의
"결과" 절에 붙여넣는다.

## 알려진 제한

- Naver CSR(`recog/v1/stt`)은 짧은 문장용 동기 API로 약 60초/10MB 제한이 있다.
  샘플이 이보다 길면 잘라서 테스트하거나, Naver의 비동기 장문 인식 API로
  교체해야 한다.
- 필러워드 카운트는 공백 기준 토큰의 완전 일치만 센다(형태소 분석 아님).
  "그", "저"처럼 지시대명사와 겹치는 감탄사는 과다 계수될 수 있으니 결과
  해석 시 감안한다.
- Whisper의 `prompt` 파라미터는 문체 힌트일 뿐 필러워드 보존을 보장하지
  않는다 — 실제로 얼마나 도움이 되는지가 이번 검증의 확인 대상 중 하나다.

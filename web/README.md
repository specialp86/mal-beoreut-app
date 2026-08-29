# 음어탐지기 — 웹 앱

Next.js (App Router) + Tailwind CSS. 저장소 전체 개요는 리포 루트 README 참고.

## 개발 서버 실행

```bash
npm install
cp .env.example .env   # STT 키 + ANTHROPIC_API_KEY 채우기 (없으면 mock으로 동작 / 습관 분석은 비활성)
npm run dev
```

## 현재 구현 범위 (v2 — AI 기반 습관 발견으로 전환)

**핵심 방식이 바뀌었다.** v1은 고정된 필러워드 사전("음", "어", "그니까" 등)으로
문자열을 카운트하는 방식이었는데, 미리 정해둔 단어에만 반응하고 사람마다 다른
말버릇은 못 잡는다는 한계가 있었다. 지금은 **Claude API가 발화 전체를 읽고
자유롭게 반복 패턴(간투사, 접속어 남용, 특정 어미 반복, 문장 시작 패턴 등)을
찾아내고, 그 결과를 기기에 누적**해서 "이 사람의 말버릇"을 점점 더 정확하게
그려나가는 방식이다 (`src/lib/habitAnalysis.ts`, `src/lib/habitProfile.ts`).

- 브라우저 마이크 녹음 (`MediaRecorder`, 1~5분, `src/lib/useRecorder.ts`)
- 녹음 → STT(`/api/transcribe`) → **Claude가 습관 자유 탐지 + 요약/조언 생성**
  (`src/lib/habitAnalysis.ts`, structured output, `zod` 스키마로 검증)
- 이번 녹음에서 발견된 습관은 기존 누적 프로필과 **표현(expression) 단위로 병합**
  — 같은 습관이 다시 나오면 발생 횟수가 쌓이고, 새 패턴이면 새 항목으로 추가
  (`src/lib/habitProfile.ts`, `localStorage` 저장)
- 결과 화면: 이번 녹음의 습관 막대그래프 + 예문, AI 요약/조언, 지난 녹음 대비
  증감 비교, 말하기 속도(음절/분)
- 히스토리 화면: **누적 습관 프로필**(전체 기간 통틀어 어떤 습관을 얼마나
  가졌는지) + 회차별 습관 언급 횟수 추이 그래프
- 녹음 원본을 브라우저 IndexedDB에 저장해 결과 화면에서 다시 들어볼 수 있음
  (`src/lib/audioStore.ts`) — 기기 로컬 저장이며 서버로는 전송되지 않음

## STT 연동

`src/lib/stt/index.ts`가 `STT_PROVIDER` 환경변수(`mock` | `openai` | `naver` |
`google`)로 백엔드를 선택한다. 기본값은 `mock`이라 STT 키 없이도 화면 흐름을
테스트할 수 있다. Phase 0(`../docs/phase0-stt-comparison.md`)에서 실제 STT를
선정하면 `STT_PROVIDER`와 해당 키만 설정하면 된다 — 다른 코드 변경은 불필요.

## AI 습관 분석 (핵심 기능, `ANTHROPIC_API_KEY` 필요)

v1의 코칭 팁과 달리 이제 이건 **선택 기능이 아니라 핵심 기능**이다.
`ANTHROPIC_API_KEY`가 없으면 `/api/transcribe`가 424 에러를 반환하고 화면에
안내 메시지가 뜬다 — STT는 성공해도 분석 자체가 안 되는 게 맞는 동작이다.
비용은 Claude Haiku 기준 녹음 1건당 매우 낮음(1원 안팎, 자세한 계산은 대화
기록 참고).

## 알려진 제한 / 다음 단계

- **습관 매칭이 정확 문자열 일치다.** AI가 같은 습관을 다시 발견했을 때 이전과
  똑같은 `expression` 문구를 쓰도록 프롬프트로 유도하고 있지만(이전에 발견된
  습관 목록을 프롬프트에 같이 넣어줌), 완벽하지는 않다 — 표현이 조금 다르게
  나오면 같은 습관인데 별개 항목으로 쌓일 수 있음.
- **원본 오디오를 기기에 보관한다.** 스펙의 원래 권장(개인정보 최소화를 위해
  처리 즉시 오디오 삭제)에서 벗어난 부분 — 다시 들어볼 수 있게 해달라는 요청에
  따라 IndexedDB에 저장하도록 바꿨다. 서버로는 여전히 전송되지 않고 브라우저
  안에만 남는다.
- **히스토리·습관 프로필 저장이 `localStorage` 기반이다.** 스펙은 Vercel
  Postgres 또는 Supabase를 제안하지만, 이 저장소를 만든 환경에는 DB가
  provisioning되어 있지 않아 실제 연결을 확인할 수 없었다. `src/lib/history.ts`,
  `src/lib/habitProfile.ts`의 함수 시그니처만 유지하면 DB 연동으로 교체 가능.
- STT 3종 중 실제로 검증된 것은 Google뿐이다(Phase 0 결과 대기 중) — `mock`이
  기본값인 이유.
- `src/lib/filler-words.ts`(고정 사전)는 앱 자체의 습관 판별에는 더 이상
  쓰이지 않고, (1) Whisper STT 프롬프트에 필러워드 유지를 유도하는 힌트, (2)
  `scripts/phase0`의 STT 비교 스크립트에서만 계속 사용된다.

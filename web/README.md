# 음어탐지기 — 웹 앱

Next.js (App Router) + Tailwind CSS + Supabase(로그인 + DB). 저장소 전체 개요는
리포 루트 README 참고.

## 개발 서버 실행

```bash
npm install
cp .env.example .env
# 최소 NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY / ANTHROPIC_API_KEY 채우기
# 1) supabase/schema.sql을 Supabase 대시보드의 SQL Editor에서 실행 (테이블 + RLS + 누적 병합 함수 생성)
npm run dev
```

## 현재 구현 범위 (v3 — 로그인 기반 개인별 누적)

**저장 위치가 바뀌었다.** v2까지는 습관 데이터를 브라우저 `localStorage`에
저장했는데, 이러면 "이 기기의 이 브라우저"에만 데이터가 남고 다른 기기로
로그인해도 이어지지 않는다는 한계가 있었다. 지금은 **Supabase 로그인(이메일
매직링크) + Postgres DB**로 옮겨서, 어떤 기기에서 로그인하든 같은 습관 데이터를
본다.

- **로그인**: `/login`에서 이메일 입력 → 매직 링크 클릭 → `/auth/callback`에서
  세션 교환. 비로그인 상태로 앱 화면에 접근하면 미들웨어(`middleware.ts`,
  `src/lib/supabase/middleware.ts`)가 `/login`으로 돌려보낸다.
- 브라우저 마이크 녹음 (`MediaRecorder`, 1~5분, `src/lib/useRecorder.ts`)
- 녹음 → STT(`/api/transcribe`) → **Claude가 습관 자유 탐지 + 요약/조언 생성**
  (`src/lib/habitAnalysis.ts`, structured output, `zod` 스키마로 검증) →
  **서버에서 Supabase에 저장** (더 이상 클라이언트가 직접 쓰지 않음)
- 새로 발견된 습관은 Postgres 함수 `merge_habit_profile`(`supabase/schema.sql`)
  로 기존 누적 프로필과 **표현(expression) 단위로 원자적으로 병합** — 같은
  습관이 다시 나오면 발생 횟수가 쌓이고, 새 패턴이면 새 행으로 추가됨
- 결과 화면(`/result/[id]`, 서버 컴포넌트): 이번 녹음의 습관 막대그래프 +
  예문, AI 요약/조언, 지난 녹음 대비 증감 비교, 말하기 속도(음절/분)
- 히스토리 화면(`/history`, 서버 컴포넌트): **누적 습관 프로필** + 회차별
  습관 언급 횟수 추이 그래프
- 홈 화면(`/`, 서버 컴포넌트): 통계 요약 + 최근 5개 + 로그아웃

## DB 스키마

`supabase/schema.sql` 참고 — `recordings`(녹음별 결과), `habit_profile`(사용자별
누적 습관), 둘 다 Row Level Security로 본인 행만 접근 가능. `merge_habit_profile`
함수가 누적 로직(INSERT ... ON CONFLICT ... DO UPDATE)을 담당.

## STT 연동

`src/lib/stt/index.ts`가 `STT_PROVIDER` 환경변수(`mock` | `openai` | `naver` |
`google`)로 백엔드를 선택한다. 기본값은 `mock`이라 STT 키 없이도 화면 흐름을
테스트할 수 있다. Phase 0(`../docs/phase0-stt-comparison.md`)에서 실제 STT를
선정하면 `STT_PROVIDER`와 해당 키만 설정하면 된다 — 다른 코드 변경은 불필요.

## AI 습관 분석 (핵심 기능, `ANTHROPIC_API_KEY` 필요)

선택 기능이 아니라 핵심 기능이다. `ANTHROPIC_API_KEY`가 없으면
`/api/transcribe`가 424 에러를 반환하고 화면에 안내 메시지가 뜬다. 비용은
Claude Haiku 기준 녹음 1건당 매우 낮음(1원 안팎).

## 알려진 제한 / 다음 단계

- **녹음 원본(오디오)은 아직 기기 로컬(IndexedDB)에만 저장된다.** 습관
  데이터·요약은 로그인 계정에 묶여 기기 간 동기화되지만, 실제 음성 재생은
  녹음한 그 기기·브라우저에서만 가능하다. 오디오까지 동기화하려면 Supabase
  Storage로 옮기는 작업이 추가로 필요함 (다음 단계 후보).
- **습관 매칭이 정확 문자열 일치다.** AI가 같은 습관을 다시 발견했을 때 이전과
  똑같은 `expression` 문구를 쓰도록 프롬프트로 유도하고 있지만(이전에 발견된
  습관 목록을 프롬프트에 같이 넣어줌), 완벽하지는 않다.
- STT 3종 중 실제로 검증된 것은 Google뿐이다(Phase 0 결과 대기 중) — `mock`이
  기본값인 이유.
- `src/lib/filler-words.ts`(고정 사전)는 앱 자체의 습관 판별에는 더 이상
  쓰이지 않고, (1) Whisper STT 프롬프트에 필러워드 유지를 유도하는 힌트, (2)
  `scripts/phase0`의 STT 비교 스크립트에서만 계속 사용된다.
- Supabase 이메일 로그인은 기본적으로 Supabase의 무료 이메일 발송 한도를
  쓴다 — 사용자가 늘면 커스텀 SMTP 설정이 필요할 수 있음(Supabase 대시보드
  Authentication 설정에서 가능).

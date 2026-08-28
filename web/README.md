# 음어탐지기 — 웹 앱

Next.js (App Router) + Tailwind CSS. 저장소 전체 개요는 리포 루트 README 참고.

## 개발 서버 실행

```bash
npm install
cp .env.example .env   # 필요 시 STT 키 채우기 (없으면 mock 프로바이더로 동작)
npm run dev
```

## 현재 구현 범위 (MVP, v1)

- 브라우저 마이크 녹음 (`MediaRecorder`, 1~5분, `src/lib/useRecorder.ts`)
- 녹음 → `/api/transcribe`(STT) → 필러워드 카운트 → 결과 화면
- 단어별 빈도 막대그래프, 지난 녹음 대비 증감 비교
- 히스토리 목록 + 회차별 총 개수 추이 그래프

## STT 연동

`src/lib/stt/index.ts`가 `STT_PROVIDER` 환경변수(`mock` | `openai` | `naver` |
`google`)로 백엔드를 선택한다. 기본값은 `mock`이라 키 없이도 전체 화면 흐름을
테스트할 수 있다. Phase 0(`../docs/phase0-stt-comparison.md`)에서 실제 STT를
선정하면 `STT_PROVIDER`와 해당 키만 설정하면 된다 — 다른 코드 변경은 불필요.

## 알려진 제한 / 다음 단계

- **히스토리 저장이 `localStorage` 기반이다.** 스펙은 Vercel Postgres 또는
  Supabase를 제안하지만, 이 저장소를 만든 환경에는 DB가 provisioning되어
  있지 않아 실제 연결을 확인할 수 없었다. `src/lib/history.ts`의 함수
  시그니처만 유지하면 DB 연동으로 교체할 수 있도록 분리해두었다.
- STT 3종 중 실제로 검증된 것은 없다(Phase 0 결과 대기 중) — `mock`이 기본값인
  이유.
- 필러워드 매칭은 공백 토큰 완전 일치 방식이다(형태소 분석 아님).

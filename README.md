# 음어탐지기 (가칭)

발표·회의 리허설 녹음에서 한국어 습관어("음", "어", "그니까", "약간", "이제" 등)의
사용 빈도를 분석하고, 시간에 따른 변화를 추적하는 웹 앱.

전체 제품 스펙은 작업 요청 원문(프로젝트 명세서)을 참고. 이 저장소는 명세서
**2절: Phase 0 기술 검증**부터 순서대로 진행한다.

## 현재 상태

- **Phase 0 (기술 검증) — 도구 준비 완료, 실제 검증은 대기 중.** 비교
  스크립트는 실행 가능하지만, 실제 결과를 얻으려면 샘플 녹음과 3개 API 키가
  필요하고 이 저장소를 만든 환경에는 없었다. 사용자가 로컬에서 직접 실행하기로
  함 (`docs/phase0-stt-comparison.md` 참고).
- **웹 앱 스캐폴딩 — MVP 화면 흐름 구현 완료.** Phase 0 결과를 기다리는 동안
  Next.js 앱을 STT-프로바이더에 무관하게(`STT_PROVIDER=mock` 기본값) 먼저
  구현해두었다. 녹음 → 분석 → 결과 → 히스토리 흐름을 로컬에서 브라우저로
  직접 확인함 (`web/README.md`의 "알려진 제한" 참고 — 특히 히스토리 저장은
  DB 미provisioning으로 인해 현재 `localStorage` 기반).

## 저장소 구조

```
docs/phase0-stt-comparison.md   Phase 0 비교 결과 (방법론 + 대기 상태)
scripts/phase0/                 STT 3종 호출/비교 스크립트
samples/                        (gitignored) 실제 테스트용 오디오를 넣는 위치
web/                            Next.js 앱 (App Router + Tailwind CSS)
```

## 다음 단계

- [ ] Phase 0 실행 결과를 `docs/phase0-stt-comparison.md`에 반영, 성공 기준
      충족 여부 확인 후 STT 최종 선정
- [ ] `web/.env`에 `STT_PROVIDER`와 해당 API 키 설정
- [ ] 히스토리 저장소를 Vercel Postgres 또는 Supabase로 교체 (`web/src/lib/history.ts`)
- [ ] Vercel 배포

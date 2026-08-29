# 음어탐지기 (가칭)

발표·회의 리허설을 녹음하면 AI가 한국어 말하기 습관(간투사, 접속어 남용,
반복되는 표현·문장 패턴 등)을 자유롭게 찾아내고, 로그인 계정에 누적해서
"이 사람의 말버릇"을 점점 더 정확하게 그려주는 웹 앱.

전체 제품 스펙은 작업 요청 원문(프로젝트 명세서)을 참고. 다만 개발 과정에서
스펙의 핵심 방식(고정 필러워드 사전)을 AI 기반 자유 탐지 + 개인별 누적 방식으로
바꿨다 — 자세한 배경은 `web/README.md` 참고.

## 현재 상태

- **Phase 0 (기술 검증) — 도구 준비 완료, 실제 검증은 대기 중.** 비교
  스크립트는 실행 가능하지만, 실제 결과를 얻으려면 샘플 녹음과 3개 API 키가
  필요하고 이 저장소를 만든 환경에는 없었다. 사용자가 로컬에서 직접 실행하기로
  함 (`docs/phase0-stt-comparison.md` 참고). 확인된 것: Google Cloud STT만
  실제 검증됨.
- **웹 앱 — Vercel에 배포됨, AI 습관 분석 + 로그인 기반 누적으로 전환 중.**
  녹음 → STT → Claude가 습관 자유 탐지 → 결과/히스토리 화면까지 동작 확인.
  현재 로컬 저장(localStorage/IndexedDB)에서 **Supabase(로그인 + Postgres)**
  기반으로 옮기는 작업 진행 중 — 기기 간에도 같은 습관 데이터가 보이게 하기
  위함. 자세한 내용과 알려진 제한은 `web/README.md` 참고.

## 저장소 구조

```
docs/phase0-stt-comparison.md   Phase 0 비교 결과 (방법론 + 대기 상태)
scripts/phase0/                 STT 3종 호출/비교 스크립트
samples/                        (gitignored) 실제 테스트용 오디오를 넣는 위치
web/                            Next.js 앱 (App Router + Tailwind CSS + Supabase)
web/supabase/schema.sql         DB 테이블 + RLS + 습관 누적 함수 (Supabase SQL Editor에서 실행)
```

## 다음 단계

- [ ] Phase 0 실행 결과를 `docs/phase0-stt-comparison.md`에 반영, 성공 기준
      충족 여부 확인 후 STT 최종 선정
- [ ] Supabase 프로젝트 URL/키를 `web/.env` 및 Vercel 환경변수에 설정,
      `web/supabase/schema.sql` 실행
- [ ] 녹음 원본(오디오)도 기기 로컬이 아니라 Supabase Storage로 옮겨서
      기기 간 재생 가능하게 하기

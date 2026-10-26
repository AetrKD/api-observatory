---
doc: checklist
status: approved
---

# Build Checklist

Build mode: fast

## Slices

- [x] **1. 공개 저장소의 API 목록과 호출 위치 확인**
  Becomes usable: 공개 GitHub 주소를 입력해 실제 API 목록을 보고 왼쪽 선택으로 오른쪽 호출 파일·함수를 확인한다.
  Why now: 핵심인 코드 탐지의 정확성을 먼저 입증한다. 로그인 전 통합 검증용 경로는 로컬 개발에서만 허용하고 배포에서는 보호한다.
  PRD ref: `prd.md > API 목록과 상세`, `prd.md > Screens and Layout`
  Spec ref: `spec.md > GitHub Source Reader`, `spec.md > Static Call Analyzer`, `spec.md > Look and Feel`
  Build: Next.js 초기 구성을 포함해 GitHub 읽기, fetch/axios 및 세 SDK 분석, 조합 주소 추적과 결과 화면을 연결한다. 코드는 실행하지 않는다.
  Verify (mechanical): 타입 검사·빌드, 탐지 fixture와 미해결·별칭·한도 테스트, 실제 공개 예제 저장소 결과와 코드 위치 대조, 화면 선택 동작 확인.
  Learner check: 저장소를 분석하고 API를 선택해 목록·상세 배치와 호출 근거가 유용한지 확인한다.
  Commit: `Add repository API discovery and split detail view`

- [x] **2. 로그인·선택한 비공개 저장소 연결·결과 이어 보기**
  Becomes usable: GitHub 계정으로 로그인하고 GitHub App에서 선택한 본인 계정의 비공개 저장소도 등록·분석한다. 저장소·설정·결과를 다른 기기에서 다시 본다. 재분석 실패해도 이전 성공 결과가 남는다.
  Why now: 검증된 탐지 흐름에 계정별 접근 제어와 지속 저장을 결합한다.
  PRD ref: `prd.md > GitHub 로그인과 계정별 동기화`, `prd.md > 결과 저장과 교체`
  Spec ref: `spec.md > Analysis Persistence`, `spec.md > Data Model`, `spec.md > Account and Repository UI`
  Build: Turso 및 별도 GitHub 로그인·세션, GitHub App 계정 연결과 설치 검증·선택 저장소 목록·서버 읽기 토큰, SQLite migration·서버 소유권 검증, 등록·목록·자동 분석 설정, 재분석 상태와 원자적 결과 교체를 연결한다. 필요한 외부 서비스 설정이 없으면 정확히 기록하고 준비를 요청한다.
  Verify (mechanical): 두 사용자 격리, 설치 ID 위조·다른 계정 연결·미선택 저장소 거절, 저장소 권한 해제 후 코드·과거 결과 접근 거절, 성공→실패→성공 교체, 중복 실행 차단, 로그인 세션 및 저장 오류 검증.
  Learner check: 로그인 후 새 세션에서 목록과 결과를 다시 열고 자동 분석 설정을 바꿔 본다.
  Commit: `Persist account repositories and analysis snapshots`

- [x] **3. 등록한 주소와 읽기 전용 키로 수동 점검·재점검**
  Becomes usable: 점검 주소·인증 정보·예상 코드와 JSON 조건을 등록하고 “지금 재점검”으로 실제 응답과 최신 점검 결과를 확인한다.
  Why now: 예약 실행 전에 비밀값 보호와 실제 응답 판정 경로를 독립적으로 검증한다.
  PRD ref: `prd.md > Credential Boundaries`, `prd.md > Check Criteria`
  Spec ref: `spec.md > Check Configuration and Credentials`, `spec.md > Outbound Request Guard`, `spec.md > Check Evaluator`
  Build: 점검 설정 UI와 저장, AES-GCM 암호화·교체·삭제, HTTPS GET 보호 및 판정 모듈을 연결한다. 인증된 수동 실행 경로와 버튼을 연결하고 중복·연속 실행을 제한한다.
  Verify (mechanical): 소유권·비밀값 비노출, 사설 주소·DNS·리디렉션 차단, 시간 초과·본문 상한, 상태 코드·JSON 판정, 자동 점검 꺼짐에서도 수동 실행·예약 일정 불변·중복 차단 테스트.
  Learner check: 테스트용 조회 주소에 조건을 지정하고 지금 재점검을 눌러 통과·미충족 이유를 확인한다.
  Commit: `Add protected API checks and response criteria`

- [x] **4. 하루 한 번 자동 점검과 비활성화**
  Becomes usable: 활성 계정의 등록 대상을 하루 한 번 점검하고 계정 설정에서 끌 수 있다.
  Why now: 검증된 점검 경로를 예약 실행하며 무료 플랜 실행 제한과 누락 처리를 확인한다.
  PRD ref: `prd.md > Scheduled API Checks`, `prd.md > Check Acceptance Criteria`
  Spec ref: `spec.md > Daily Scheduler`, `spec.md > Vercel Contracts`, `spec.md > Verification Plan`
  Build: 인증된 cron, 일일 중복 방지·실행 한도·최신 결과 표시, 기본 켜짐·계정 설정 동기화, 실행 안내를 구성한다.
  Verify (mechanical): cron 인증, 중복·비활성화·한도·중단 처리, 전체 여정 테스트와 production 빌드. 실제 배포와 예약 실행 관측은 외부 설정을 갖춘 뒤 수행하며 미검증을 명시한다.
  Learner check: 자동 점검을 끄고 다시 열어 설정이 유지되는지, 최신 점검 시점과 코드 분석 시점이 구분되는지 확인한다.
  Commit: `Schedule daily API checks with account controls`

## Release verification

- Source snapshot: ab2952b332f8fa0f693741754495c88c5a7e280e.
- Regular tests: 66 passed, 5 optional database tests skipped; no failures.
- Relevant real Turso integration tests: 4 passed separately.
- TypeScript and production build: passed.
- Public example: 103 source files scanned, 4 supported calls detected, zero parse errors.
- Live same-origin GET check: HTTP 200 with a JSON response.
- Manual JSON status criterion: passed. Response bodies are not persisted.
- GitHub sign-in/sign-out and private repository result restoration verified during development.
- Deployment and the actual hosted daily cron trigger have not been observed yet.
- Public planning references: scope.md, prd.md, spec.md and app-map.html.

Personal learning notes, conversation transcripts and local credential files are excluded from this release snapshot. This file records technical verification only.

---
doc: spec
status: approved
---

# 외부 API 현황 분석 도구 — 기술 계획 및 구현 현황

## How This Works, In Plain Language
Next.js 화면과 서버를 하나의 프로젝트로 둔다. GitHub 로그인·세션은 Better Auth, 계정별 데이터는 원격 Turso SQLite에 저장한다. 공개 또는 GitHub App에서 선택한 본인 개인 계정의 비공개 코드를 실행하지 않고 분석한다.
실제 API 점검은 사용자가 등록한 HTTPS 조회 주소·읽기 전용 키·판정 조건으로 별도 실행한다. 수동 재점검과 일일 예약은 같은 실행 모듈을 사용한다.

## Stack
- Next.js 16.4.3, React 19.3.1, TypeScript, Node.js 24+, Webpack.
- Turso, @libsql/client 0.18.0, drizzle-orm 0.45.4.
- Better Auth 및 Drizzle adapter 1.7.12. 세션·OAuth 토큰 암호화, DB 기반 로그인 요청 제한.
- Babel parser/traverse: JS/TS 정적 분석.
- undici 8.12.3, ipaddr.js 2.5.0: 연결 IP 고정·공개 주소 검증.
사용자가 Supabase에서 Turso로 변경을 승인했다. 이전 Supabase Auth/Postgres/RLS/RPC 설계는 이 문서로 대체한다.
문서: https://nextjs.org/docs / https://docs.turso.tech/sdk/ts/reference / https://better-auth.com/docs/adapters/drizzle / https://better-auth.com/docs/authentication/github / https://undici.nodejs.org/

## The Core Journey Through the System
1. GitHub 로그인 → Better Auth가 Turso에 사용자·세션을 저장한다.
2. 저장소 목록 → 서버가 검증한 세션 소유자 ID로만 조회한다.
3. 공개 주소 입력 또는 GitHub App의 선택 저장소 목록에서 등록한다.
4. 등록 직후 자동 분석 설정에 따라 분석하거나 미분석 상태로 등록한다.
5. 동일 커밋 코드에서 API 목록·파일·함수를 추출해 마지막 성공 snapshot을 저장한다.
6. API 목록을 선택하면 상세 위치와 근거를 표시한다.
7. 별도 점검 주소·인증·조건을 등록해 지금 재점검하거나 일일 예약 실행을 기다린다.
PRD: The Core Journey, Selected Private Repository Access, Manual API Recheck.

## Components

### Account and Repository UI
src/components/account-workspace.tsx: 로그인·로그아웃, 등록 목록, 공개 주소 등록, App 설치/승인·선택 저장소 가져오기, 저장소 재분석, 두 자동 설정.
src/app/page.tsx: 왼쪽 목록·오른쪽 API 상세. 비로그인 로컬 개발에서만 공개 분석 미리보기.
src/components/check-panel.tsx: 점검 주소·인증·조건 등록·수정, 키 교체·삭제, 수동 재점검·최신 결과.
미설정 자격 정보를 정상 연결인 것처럼 보이지 않도록 로그인 버튼을 비활성화하고 설정 필요를 알린다.

### GitHub Source Reader
src/lib/github.ts. 정규화한 github.com 소유자/저장소만 허용한다. 기본 브랜치→커밋 SHA→트리→blob을 읽고 코드 링크도 같은 커밋에 고정한다. 검증된 App 설치 토큰만 비공개 읽기에 사용할 수 있다.
최대 소스 200개, 파일당 400 KiB, 총 10 MiB, 120초. 생성물·의존성·환경 파일·타입 선언 파일 제외. 트리 truncated·한도 초과는 실패 사유를 표시한다. 원본 코드는 설치·실행하지 않는다.

### Static Call Analyzer
src/lib/analyzer/index.ts에서 언어별 분석을 조정하며 javascript.ts가 fetch·axios 및 OpenAI·Supabase·Stripe의 지원 패턴을 구문 트리와 바인딩으로 탐지한다. 별칭·require·문자열·상수·템플릿·제한된 상대 import를 추적한다. 환경변수·실행 함수·재할당·순환·해석 불가 연산은 미해결로 표시한다.
관련 기능은 둘러싼 함수명으로 근거를 제시하며 자연어 의미를 추측하지 않는다. SDK 작업과 기본 서비스 주소는 실제 세부 HTTP 경로로 오인하지 않도록 구분한다. 키·URL 인증 쿼리·동적 인수는 화면에 노출하지 않는다.
PRD: API 목록과 상세.

### GitHub App Private Access Amendment
src/lib/github/access.ts와 /api/github/*.
서비스 로그인과 별개로 App 사용자 승인을 연결한다. state는 만료·일회성 쿠키와 현재 세션에 결합한다. callback의 installation ID를 신뢰하지 않는다.
사용자 access token의 /user 신원을 DB의 GitHub accountId와 대조하고 /user/installations 및 /user/installations/{id}/repositories의 사용자·App 접근 교집합을 확인한다. 개인 설치의 account.id도 일치해야 한다.
App private key 서명 JWT로 선택 저장소 하나의 contents:read 설치 토큰을 발급한다. 설치 토큰은 서버에서만 사용하며 브라우저에 전달하지 않는다. 사용자 토큰은 AES-GCM 암호화하고 만료 시 refresh하거나 재승인을 안내한다.
비공개 결과 조회·분석·점검은 현재 권한을 재검증한다. 조직 설치는 첫 범위에서 제외한다. 연결 해제는 저장된 App 토큰을 삭제하고 자동 점검을 끈다.
PRD: Selected Private Repository Access.

### Analysis Persistence
src/lib/server/analysis-service.ts. 소유자 ID를 서버 세션에서 구한다. SQLite 조건부 UPDATE와 lease ID로 중복 분석을 차단하고 성공 snapshot만 교체한다. 실패 시 이전 성공은 유지하며 최근 상태·시각·사유만 갱신한다. 오래된 lease가 새 결과를 덮지 못한다.
PRD: 결과 저장과 교체.

### Check Configuration and Credentials
src/lib/checks/validation.ts, crypto.ts.
인증 없음·Bearer·API 키 헤더, GET HTTPS 443만 지원한다. 키는 AES-256-GCM, 매번 새 nonce, owner ID와 check ID를 AAD로 결합한다. 암호화 키는 DB와 분리해 로컬 비동기화 설정/Vercel 서버 환경에 둔다.
비밀값은 다시 조회하지 않으며 교체하거나 대상과 함께 삭제한다. 전송 origin이 바뀌면 인증값을 다시 입력해야 한다. 모든 공급자의 읽기 전용 권한을 자동 판별한다고 주장하지 않는다. OAuth 갱신형 점검 인증은 제외한다.

### Outbound Request Guard
src/lib/checks/policy.ts, request.ts.
사설·루프백·링크로컬·예약 IPv4/IPv6, IP literal·로컬 도메인·URL 사용자정보·민감 인증 쿼리를 차단한다. DNS의 모든 결과를 확인하고 실제 연결 IP를 검증된 주소로 고정하며 원래 호스트 TLS 검증을 유지한다.
undici request는 리디렉션을 추적하지 않는다. DNS 5초, 요청 10초, 본문 256 KiB, 재시도 없음. 원래 저장소 코드의 요청·키를 실행하거나 추출해 사용하지 않는다.

### Check Evaluator
기본 2xx 또는 예상 코드와 JSON 객체 경로 조건 하나를 검사한다. 지정 조건은 모두 만족해야 한다. JSON 필드의 문자열·숫자·불리언·null은 타입까지 비교한다. 누락·비JSON·코드 불일치·값 불일치와 연결 실패를 구별한다.
서비스 전체 정상이라고 단정하지 않고 “설정한 기준 통과”로 표현한다. 본문 전체는 저장하지 않으며 최신 상태·안전한 사유·시각·응답 코드·소요 시간만 저장한다.

### Manual Recheck Endpoint
POST /api/checks/{id}/run. 세션·소유권·비공개 접근과 Origin을 확인한 뒤 서버 저장 설정만 사용한다. 자동 점검과 같은 lease를 사용하고 수동 실행은 30초 간격이다. 자동 설정이 꺼져도 사용 가능하며 예약 날짜를 소비하거나 변경하지 않는다.
PRD: Manual API Recheck.

### Daily Scheduler
/api/cron/checks, vercel.json. 00:00 UTC(한국 09시대), CRON_SECRET 인증. 일일 UTC 날짜와 대상별 조건부 UPDATE로 중복 실행을 막는다. 대상 실행 전 계정 설정을 재확인한다.
전체 20개, 사용자당 5개(DB trigger), 동시 2개, 실행 예산 150초, 함수 한도 180초. 시작하지 못한 대상 수는 완료로 표시하지 않는다. 자동 재시도는 없다. Hobby는 정확한 시각/24시간 간격을 보장하지 않는다.
PRD: Scheduled API Checks.

## Data Model
db/schema.sql. 모든 DB 연결과 쿼리는 서버 전용이다. 브라우저에 Turso 토큰을 전달하지 않는다.
- user/session/account/verification/rateLimit: Better Auth.
- settings: user_id, analyze_on_add=true, daily_checks_enabled=true.
- connections: owner_id, github_id, 암호화한 App 사용자 토큰.
- repositories: UUID, owner_id, GitHub ID, URL, 이름, private, 생성 시각.
- analyses: 저장소 ID, owner_id, 마지막 성공 snapshot/시각, 최근 상태/사유/시각, lease.
- checks: owner_id, repository_id, 이름·주소·인증 방식·암호문·조건·활성 설정, 최신 실제 점검 결과, lease, 최근 수동 실행 시각, 일일 claim 날짜.
SQLite에는 Postgres RLS가 없으므로 모든 서버 조회·수정에 세션 owner 조건을 강제한다. 자식 저장소/점검의 (id,owner_id) 복합 FK로 소유권 불일치를 막는다. OAuth 권한과 소유권 검증은 DB 관리자 토큰을 보유한 서버에서 수행한다.

## File Structure
```
src/app/                       # 화면 및 서버 경로
src/app/api/auth/               # GitHub 로그인·세션
src/app/api/github/             # App 연결·선택 저장소·해제
src/app/api/repositories/       # 목록·등록·분석/결과
src/app/api/checks/             # 설정·수동 점검
src/app/api/settings/           # 계정 설정
src/app/api/cron/checks/        # 일일 실행
src/components/                # 계정 워크스페이스·점검 패널
src/lib/analyzer/              # 정적 탐지·주소 추적
src/lib/github.ts              # GitHub 소스 읽기
src/lib/github/access.ts       # App 권한
src/lib/checks/                 # 암호화·검증·요청·판정·실행
src/lib/server/                 # DB·인증·소유권·분석 저장
db/schema.sql                  # Turso/SQLite 스키마
scripts/                       # 스키마 적용·통합 테스트
tests/                         # 단위 및 실제 Turso 테스트
.env.example                   # 변수명만
devpost/                       # 계획·진행 상태
```

## External Services and Dependencies
Turso: 프로젝트용 Vercel servicetest1 팀, api-observatory, 무료 Starter, hnd1. 실제 생성과 스키마 적용 완료. 리소스 01a1721d-6f01-739e-8988-a7a4e768b736.
Turso token은 로컬 실행 폴더에만 보관한다. Google Drive로 비밀값을 복사하는 작업은 자동 승인 검토에서 거부되어 수행하지 않았다.
GitHub REST: /repos/{owner}/{repo}, git/ref, git/commits, git/trees, git/blobs; App 사용자 및 설치 토큰 경로. 버전 헤더 2026-03-10, 403/429 실패 사유 구분.
GitHub OAuth/App client 자격 정보는 아직 설정되지 않아 실제 로그인과 비공개 접근은 미검증이다.
Vercel 앱 프로젝트·배포·예약 실관측은 미완료. CLI 승인은 취미용 계정으로 연결되어 있어 프로젝트용 계정의 브라우저에서 Turso를 생성했다.
문서: https://vercel.com/marketplace/tursocloud / https://docs.github.com/en/rest/apps/installations / https://vercel.com/docs/cron-jobs/usage-and-pricing

## Where It Runs and How Someone Tries It
동기화되지 않는 로컬 폴더에 소스·의존성과 .env.local을 두고 pnpm install, pnpm db:migrate, pnpm dev 실행. 이 PC의 실행 주소는 http://127.0.0.1:3000.
환경변수와 GitHub callback은 README.md와 .env.example을 기준으로 설정한다. 실제 비밀값을 Google Drive·Git·채팅으로 전송하지 않는다.
제출에는 공개 저장소와 데모 영상이 필요하며 배포 주소는 영상의 대체가 아니다.

## Look and Feel
Docker Desktop 참고, 한국어·영어 UI. #010736 배경, #0D1C42 면, #22396F 선택/경계, #FCF1D0 글자/주요 버튼. 좌측 API 목록·우측 상세, 좁은 화면은 세로 배치. 계정·점검 패널도 같은 팔레트.

## Verification Plan
- 자동 단위 테스트 22개: 탐지·주소·마스킹·암호화·SSRF 정책·판정.
- 실제 Turso 통합 테스트 1개: 두 소유자 격리, 복합 FK, 기본 설정, 마지막 성공 보존, 수동/예약 claim·중복·자동 꺼짐. 테스트 자료 삭제 확인.
- 실제 보호된 HTTPS 요청: example.com 200, 본문 수신.
- TypeScript 및 전체 Next.js production 빌드 통과.
- 브라우저: Turso 연결 완료와 GitHub 앱 미설정 안내 확인.
- 미완료: 실제 GitHub OAuth/App, 비공개 권한 회수의 전체 흐름, 실제 계정에서 수동 점검, Vercel 배포·예약 관측.

## What Was Simplified and Why
JS/TS와 세 SDK 지원 패턴, 제한된 정적 값 추적. 모든 주소·기능 의미를 추측하지 않는다. 저장소 코드는 실행하지 않으며 변경 요청·장애 주입·조직 공유·OAuth 갱신형 API 점검은 제외한다. 재분석 변경 요약은 사용자가 제외했다.

## Decisions and Open Issues
사용자 결정: Turso, 프로젝트용 Vercel 계정, 선택 비공개 저장소, 수동 재점검, 일일 자동 점검 기본 켜짐.
현재 검증된 코드와 외부 설정이 남은 기능을 구분한다. 자격 정보 미설정 상태를 완료로 표시하지 않는다. 계획 변경/작업량이 원래 2~4시간 시제품 범위를 넘어섰음을 기록한다.

## Bilingual Navigation and Session UI
src/app/page.tsx는 좌측 메뉴·기록 검색·서비스 정보·사용법·항상 보이는 로그인/로그아웃을 구성한다. 기록은 기존 analyses의 latest_status/latest_at을 읽고 권한 확인을 거쳐 저장된 snapshot을 연다. 새 이력 테이블은 만들지 않는다.
src/components/language-provider.tsx와 src/lib/i18n.ts, translations.ts는 라벨·동적 실패 사유·날짜 형식을 전환한다. localStorage에는 언어만 보관하며 코드/계정 비밀값은 저장하지 않는다. html lang과 페이지 제목도 전환한다.
POST /api/auth/logout은 Better Auth가 생성한 응답을 그대로 반환해 세션 쿠키 만료를 전달한다. 클라이언트는 개인 상태를 지우고 새 페이지에서 세션 종료를 확인한다. 로그인 실패·App 연결 취소는 안전한 상태 플래그로 복귀하며 원본 OAuth code/token은 표시하지 않는다.

## Persisted Analysis Progress — 2026-10-26
- analysis_progress에는 저장소·소유자·실행 ID·단계·완료 파일 수·전체 파일 수·갱신 시각만 기록한다. 원본 소스나 인증 정보는 기록하지 않는다. 기존 DB에는 멱등적인 CREATE TABLE IF NOT EXISTS로 추가한다.
- POST는 소유권과 중복 실행을 확인한 뒤 202를 반환한다. Next.js after에서 실제 접근 권한 확인·분석·저장을 진행한다. 함수 실행 한도 180초, 실행 lease 180초이며 분석 제한은 현재 120초다(지원 언어 확장 시 상향).
- 화면은 실행 중에만 1.5초 간격으로 가벼운 진행 조회를 한다. 진행 조회는 세션과 저장소 소유권을 확인한다. 결과 조회는 기존 GitHub App 접근 권한 확인을 유지한다. 상태·결과는 캐시하지 않는다.
- 파일 읽기는 4개 단위 묶음이 끝날 때 실제 수를 저장한다. 분석/저장은 추정 퍼센트 없이 표시한다. 늦은 이전 실행의 쓰기는 실행 ID로 거부한다. lease 만료 시 조회 과정에서 실패로 전환하고 이전 성공 snapshot은 보존한다.
- 화면 조회 오류는 5초 후 재시도하고 권한 오류는 중단한다. 메뉴 이동 시 컴포넌트를 유지하며, 새로고침 후 계정별 sessionStorage의 선택 ID 또는 실행 중 저장소를 복원한다. 서버 재시작 후 작업 자동 재개를 보장하는 내구성 큐는 아니다.
- 비로그인 로컬 체험에는 NDJSON 진행 응답을 추가한다. 기존 JSON 요청도 호환한다. 이 체험 결과는 계정에 저장하지 않는다.


## Python and Vue Analyzer — 2026-10-26
- 분석 한도와 파일 필터는 src/lib/analysis-policy.ts로 통합한다. .py·.vue 및 기존 JS/TS 확장자를 수집하며 .venv·venv·__pycache__·.nuxt·.output 등의 생성물을 제외한다. 파일 4개 단위 읽기 진행 수를 유지한다.
- Python은 @lezer/python 1.1.19와 @lezer/common 1.5.4를 사용해 구문만 읽는다. 원본 코드를 실행하거나 import하지 않는다. 스코프별 바인딩으로 별칭·재할당·인수 shadowing을 처리하고 불확실한 주소·메서드는 미해결/UNKNOWN으로 둔다. 파서의 bare yield 오진만 좁은 조건으로 보정하며 다른 오류는 parseErrors에 기록한다.
- Vue는 @vue/compiler-sfc 3.5.44의 parse로 블록을 추출한다. 원문 UTF-16 오프셋과 줄바꿈을 보존한 패딩으로 원본 파일·줄·열을 유지한다. 두 블록은 별도로 파싱해 유효한 중복 import를 허용하고 결과 파일은 원본 .vue로 되돌린다. Next.js serverExternalPackages에 compiler-sfc를 추가해 선택적인 템플릿 전처리기 의존성을 불필요하게 번들하지 않는다.
- 기존 JS/TS 분석기는 javascript.ts로 분리해 상대 import·SDK 처리를 유지한다. Python의 파일 간 값 추적과 Vue 블록 간 값 추적은 명시적인 지원 경계다.
- 상대 URL의 민감한 인증 쿼리도 마스킹한다. 파싱 오류는 다른 정상 파일의 결과를 지우지 않는다. 동기 파싱 후에도 120초 경과를 확인하지만 CPU 연산을 중간 선점하는 별도 워커는 아니다.


## HTML/Jinja Source Analysis and Public App Access — 2026-10-26
- parse5 8.0.1의 sourceCodeLocationInfo로 실제 script 요소와 원문 범위를 읽는다. html.ts는 블록별 가상 소스와 원래 UTF-16 오프셋/줄바꿈을 보존한다. 분석 결과는 원본 HTML 파일로 되돌린다.
- Jinja 제어 태그는 동일 길이의 블록 경계로, 출력 값은 미해결 표현식으로 대체한다. 원문 템플릿 범위를 메모리에 보유해 JavaScript의 동명 변수나 문자열을 통한 잘못된 상수 해석을 차단한다. 소스와 임시 범위 정보는 DB 결과에 저장하지 않는다.
- JavaScript 분석기는 NewExpression의 전역 WebSocket을 처리한다. 생성자/브라우저 location이 shadowing되면 주소를 확정하지 않는다. 정적인 ws/wss 주소는 resolved, location.host 기반 단순 상대 경로는 internal, 나머지는 unresolved로 유지한다.
- repositoryAccess는 공개 저장소에도 기존 App 접근 교집합을 확인해 repository_ids=[현재 저장소]·contents:read 설치 토큰을 사용할 수 있다. 허용하지 않았거나 연결이 없는 공개 저장소는 기존 공개 읽기로 돌아간다. private은 검증 실패 시 그대로 차단한다. 공개 결과 조회는 owner 검증 후 불필요한 설치 토큰 발급을 하지 않는다.
- 실제 minedashboard 커밋 e54e9570192981393492f4c8d248af92aa6812cd: Python 8개+HTML 4개, 호출 10개(HTTP 8·WebSocket 2), 파싱 실패 0. HTML 내부 호출을 읽지 않던 이전 지원 경계를 이번 수정이 대체한다.


## Manual Response Preview Implementation — 2026-10-26
- CheckPanel의 prepare 제어로 분석 결과의 GET HTTP 후보를 점검 폼에 연결한다. checks/draft.ts가 절대 HTTPS 주소와 내부 경로 초안을 구분하고 실제 서비스 origin과 결합한다. 클라이언트 도우미와 별개로 서버 URL/DNS/IP 검증을 항상 적용한다.
- protectedRequest는 기존 GET·DNS 연결 고정·공개 HTTPS 443·10초/256 KiB 제한을 유지하고 Content-Type을 함께 반환한다. runCheck는 원본 본문으로 판정한 뒤 수동 실행에만 checks/preview.ts의 미리보기를 부착한다. DB JSON에는 CheckResult만 저장하므로 스키마 변경은 없다.
- JSON은 깊이 20까지 순회해 민감 필드를 가리고, 문자열/텍스트에는 실제 등록 키·Bearer/JWT·일반 토큰/URL 인증정보 마스킹을 적용한다. 비밀값을 완전히 탐지한다고 보장하지 않으며 UI에도 일부 필드 마스킹으로 표현한다. 텍스트 키 탐색 길이를 제한해 긴 응답에서 과도한 연산을 방지한다. UTF-8 경계에서 16 KiB로 자른다.
- 본문은 React pre 텍스트로만 렌더링한다. HTML을 실행하거나 이미지/스크립트를 불러오지 않는다. 본문과 Content-Type은 클라이언트 메모리에서만 유지하며 로그/DB에 추가하지 않는다. 요청에 사용한 키는 기존 암호화 저장 경계를 유지한다.
- 저장 직후 테스트가 실패해도 이미 생성된 점검 ID를 수정 상태로 유지해 재시도 시 중복 등록을 피한다. 점검 중에는 다른 분석 후보로 폼을 덮어쓰지 않는다. 기존 로그인·소유권·요청 출처·lease/수동 간격 검증을 유지한다.


## Project Profiles and Batch Response Checks — 2026-10-26
- project_probes 표를 멱등적으로 추가했다. 저장소/owner FK, 배포 origin, 인증 방식/헤더/암호문, 자동 설정, revision, 최신 메타데이터, 실행 lease/시각/오류를 저장한다. 암호화 AAD는 owner:repository:project-probe이며 평문 키를 응답에 포함하지 않는다. origin 변경 시 기존 키를 무조건 재사용하지 않고 새 입력을 요구한다.
- /api/repositories/[id]/project-checks의 GET/PUT/POST는 세션·소유권·쓰기 Origin을 확인한다. 비공개 저장소는 App 권한을 확인한다. 가벼운 진행 조회는 owner만 확인하고 URL/결과를 반환하지 않는다.
- project-plan.ts는 확정된 HTTP GET만 같은 HTTPS origin으로 구성하고 주소 중복을 제거한다. 주소 2048자/고유 주소 20개/분석 호출 1000개를 한도로 둔다. 기존 SSRF/DNS 연결 고정/인증 헤더/리디렉션 차단을 재사용한다.
- DB의 원자 claim으로 같은 계정의 실행 중복·30초 이내 요청을 막고 서비스 전체 동시 작업을 2개로 제한한다. 작업 내 요청 동시는 2개, 시작 예산 145초, 함수 maxDuration 180초, lease 210초다. 미시작 대상은 완료로 주장하지 않고 제외 사유를 기록한다. profile 설정은 실행 중 변경을 차단한다.
- 결과는 repository/commit/analyzedAt/revision에 연결한다. 같은 커밋 재분석도 새 결과로 구별하며 최근 5분 메타데이터를 재사용한다. 본문은 수동/화면 요청 응답에만 포함하고 DB에는 저장하지 않는다. 중복 URL의 본문은 한 번만 전송해 클라이언트에서 해당 호출 위치들에 공유한다.
- ProjectProbePanel은 저장·프로젝트 열기·재분석에 맞춰 조회한다. 요청 제한 대기는 자동 재시도하고 다른 기기의 실행은 상태 조회로 기다린다. 페이지를 닫거나 서버가 중단됐을 때 내구성 큐 재개를 보장하지는 않으며 만료된 lease는 조회 시 해제한다.
- API 목록의 상태 배지와 LiveApiResult에 응답을 통합하고, 오래된 분석/다른 저장소 응답을 섞지 않는다. 기존 CheckPanel은 접힌 고급 영역에 유지한다. 이번 자동 조회는 기존 일일 cron 대상에 추가하지 않았다.

## Public Raw Reader and Accept Preferences — 2026-10-26
공개 저장소는 GitHub REST 4회로 커밋/재귀 트리를 얻고 raw.githubusercontent.com의 동일 커밋 소스를 읽는다. 파일별/총 수신 바이트·시간·동시 읽기 한도를 유지하고 원문 요청에는 Authorization을 보내지 않는다. 오류나 GitHub 제한을 성공으로 취급하거나 REST로 일괄 재시도하지 않는다. 공개 메타데이터는 githubPublicToken에서 기존 Better Auth 계정 토큰을 서버 SDK로 가져오며 로그인 토큰이 없으면 기존 허용 App/비인증 동작을 유지한다. 비공개 저장소는 기존 설치 교집합·단일 저장소 Contents 읽기 경로를 유지한다.
checks와 project_probes에 response_format 기본값 default 열을 추가한다. scripts/migrate.ts는 기존 열 존재를 확인한 뒤 추가한다. accept.ts가 default/json/text/html을 각각 */*, application/json, text/plain, text/html로 제한한다. 프로젝트 설정 변경 시 revision으로 캐시를 무효화하며 개별 점검은 manual/scheduled에 동일 형식을 전송한다. 응답 본문은 저장하지 않는다.

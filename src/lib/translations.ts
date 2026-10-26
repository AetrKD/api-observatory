export const english: Record<string, string> = {
  "전체 조회는 계정당 30초 간격으로 실행합니다.":
    "Full checks run at least 30 seconds apart per account.",
  "HTTP 2xx 응답을 받았습니다.": "Received an HTTP 2xx response.",
  "HTTP 2xx 이외의 응답입니다.": "Received a non-2xx HTTP response.",
  "자동 조회 주소는 2048자 이하로 입력해 주세요.":
    "Automatic checks support URLs up to 2,048 characters.",
  "프로젝트 응답 자동 조회": "Automatic project response checks",
  "실시간 API 응답": "LIVE API RESPONSES",
  "배포 주소 한 번으로 응답 확인": "One deployment URL for live responses",
  설정됨: "Configured",
  "선택 설정": "Optional setup",
  "주소를 입력하면 같은 도메인의 GET API 응답이 목록과 상세에 표시됩니다. 비워두면 코드 분석만 사용합니다.":
    "Enter a deployment URL to see same-domain GET responses in the list and details. Leave it empty to use code analysis alone.",
  "배포 주소 (선택)": "Deployment URL (optional)",
  "설정 불러오는 중": "Loading settings",
  "응답 조회 중": "Checking responses",
  "저장하고 응답 조회": "Save and check responses",
  "설정 저장": "Save settings",
  "인증·자동 조회 설정": "Authentication and automatic checks",
  "프로젝트 열기·재분석 후 자동 조회":
    "Check automatically when opening or reanalyzing the project",
  "최근 5분 결과는 재사용합니다. 공통 인증은 배포 도메인에만 보내며 한 번에 주소 20개까지 조회합니다.":
    "Results from the last five minutes are reused. Shared credentials are sent only to the deployment domain. Up to 20 URLs are checked per run.",
  "GET 응답을 확인하고 있습니다.": "Checking GET responses.",
  "잠시 후 자동으로 응답을 조회합니다.":
    "Responses will be checked automatically shortly.",
  "응답 확인": "Checked",
  "자동 조회 제외": "Excluded from automatic checks",
  "조회할 분석 결과를 준비하고 있습니다.":
    "Preparing analysis results for response checks.",
  "배포 주소 없이도 분석 결과를 볼 수 있습니다.":
    "Code analysis is available without a deployment URL.",
  "전체 응답 새로고침": "Refresh all responses",
  "API 실제 응답": "Live API response",
  "조회 중": "Checking",
  "연결 실패": "Connection failed",
  "조회 대기": "Waiting for a check",
  "설정 필요": "Setup required",
  "조회용 GET 호출만 자동으로 확인합니다.":
    "Only GET calls are checked automatically.",
  "본문 미리보기는 새로 조회한 직후에 볼 수 있습니다.":
    "Body previews are available immediately after a new check.",
  "응답을 조회하면 코드·시간·본문이 여기에 표시됩니다.":
    "After a check, the HTTP code, response time and body appear here.",
  "상단에 배포 주소를 입력하면 실제 응답이 자동으로 표시됩니다.":
    "Enter a deployment URL above to see live responses automatically.",
  "개별 점검 설정": "Individual check settings",
  "개별 점검·정상 응답 기준 (고급)":
    "Individual checks and response criteria (advanced)",
  "주소를 확정할 수 없어 개별 설정이 필요합니다.":
    "The URL could not be resolved. Configure an individual check.",
  "다른 도메인의 API는 개별 점검을 사용하세요.":
    "Use an individual check for APIs on other domains.",
  "한 번에 조회할 수 있는 주소 20개를 초과했습니다.":
    "The limit of 20 URLs per run has been reached.",
  "자동 조회에는 유효한 공개 HTTPS 주소가 필요합니다.":
    "Automatic checks require a valid public HTTPS URL.",
  "응답 조회 대기 중": "Waiting for a response check",
  "응답 조회 시간이 초과됐습니다. 다시 조회해 주세요.":
    "The response check timed out. Please try again.",
  "응답 조회 중에는 설정을 변경할 수 없습니다.":
    "Settings cannot be changed while responses are being checked.",
  "배포 주소는 경로·쿼리 없이 도메인까지 입력해 주세요.":
    "Enter the deployment domain without a path or query.",
  "먼저 프로젝트의 배포 주소를 입력해 주세요.": "Enter a deployment URL first.",
  "먼저 저장소를 분석해 주세요.": "Analyze the repository first.",
  "자동 응답 조회는 호출 1000개 이하의 분석 결과에서 지원합니다.":
    "Automatic checks support analysis results containing up to 1,000 calls.",
  "조회 시간 한도로 이번 요청을 실행하지 못했습니다.":
    "This request was not executed within the available time.",
  "응답 조회를 완료하지 못했습니다.":
    "The response check could not be completed.",
  "코드 분석 결과입니다. 실제 응답은 아래의 주소 점검에서 확인하세요.":
    "These are code analysis results. Check live responses in the endpoint checks below.",
  "응답 본문 미리보기": "Response body preview",
  "응답 형식 미지정": "Content type not specified",
  "일부 민감한 필드는 가려집니다. 본문은 서버에 저장하지 않습니다.":
    "Some sensitive fields are masked. Response bodies are not stored on the server.",
  "바이너리 응답은 본문 미리보기를 지원하지 않습니다.":
    "Body previews are unavailable for binary responses.",
  "응답 본문이 비어 있습니다.": "The response body is empty.",
  "미리보기는 앞부분 16 KiB까지만 표시합니다.":
    "Only the first 16 KiB are shown in this preview.",
  "응답 본문은 수동 점검 직후에 확인할 수 있습니다.":
    "Response bodies are available immediately after a manual check.",
  "선택한 내부 API 경로": "Selected internal API path",
  "실행 중인 서비스 주소": "Running service URL",
  "저장소 주소 대신 실제 배포된 서비스의 공개 HTTPS 주소를 입력하세요.":
    "Enter the public HTTPS URL of your deployed service, rather than its repository URL.",
  "저장 후 응답 테스트": "Save and test response",
  "실제 응답 테스트": "Test live response",
  "등록한 저장소의 조회용 GET 호출을 선택하면 공개 HTTPS 주소로 응답을 테스트할 수 있습니다.":
    "Choose a GET call from a registered repository to test its response at a public HTTPS URL.",

  "지원하는 JavaScript·TypeScript·Python·Vue·HTML 소스가 없습니다.":
    "No supported JavaScript, TypeScript, Python, Vue or HTML source files were found.",
  "HTML의 인라인 JavaScript와 Jinja 조건 블록을 분석합니다. 템플릿은 실행하지 않으며 외부 script·이벤트 속성·블록 간 값 추적은 제외합니다.":
    "Inline JavaScript and Jinja conditional blocks in HTML are analyzed. Templates are never executed; external scripts, event attributes and cross-block values are excluded.",
  "JavaScript·TypeScript·Vue·HTML 스크립트의 fetch·axios·WebSocket·지원 SDK, Python의 requests·httpx·urllib 호출을 탐지합니다. 내부 API 경로도 표시합니다.":
    "Detect fetch, axios, WebSocket and supported SDK calls in JavaScript, TypeScript, Vue and HTML scripts, plus requests, httpx and urllib in Python. Internal API paths are included.",
  "HTML은 인라인 JavaScript와 Jinja 조건 블록을 분석합니다. Vue 템플릿, 외부 스크립트 다운로드, Python의 다른 SDK와 파일 간 값 추적은 지원하지 않습니다. 분석 제한 시간은 120초입니다.":
    "HTML analysis supports inline JavaScript and Jinja conditional blocks. Vue templates, external script downloads, other Python SDKs and cross-file Python values are not supported. Analysis has a 120-second limit.",

  "최대 소스 {count}개": "Up to {count} source files",
  "파일당 {count} KiB": "{count} KiB per file",
  "총 {count} MiB": "{count} MiB total",
  "지원하는 JavaScript·TypeScript·Python·Vue 소스가 없습니다. HTML 내부 스크립트는 지원하지 않습니다.":
    "No supported JavaScript, TypeScript, Python or Vue source files were found. Scripts embedded in HTML are not supported.",
  "지원 한도 초과: 소스 200개, 파일당 400 KiB, 전체 10 MiB 이하 저장소를 사용해 주세요.":
    "Repository exceeds the limits: 200 source files, 400 KiB per file and 10 MiB total.",
  "분석 제한 시간 120초를 초과했습니다.":
    "Analysis exceeded the 120-second time limit.",
  "Python은 requests·httpx·urllib의 지원 호출을 분석합니다. 다른 SDK와 파일 간 값 추적은 지원하지 않습니다.":
    "Python analysis supports selected requests, httpx and urllib calls. Other SDKs and values imported from other Python files are not supported.",
  "Vue는 script·script setup의 JavaScript·TypeScript를 분석합니다. 템플릿·스타일과 블록 간 값 추적은 지원하지 않습니다.":
    "Vue analysis supports JavaScript and TypeScript in script and script setup blocks. Templates, styles and values shared across script blocks are not analyzed.",
  "Vue의 외부 script src는 인라인으로 읽지 않습니다. 지원하는 소스 파일은 별도로 분석합니다.":
    "External Vue script src files are not inlined. Supported source files are analyzed separately.",
  "JavaScript·TypeScript와 Vue 스크립트의 fetch·axios·지원 SDK, Python의 requests·httpx·urllib 호출을 탐지합니다. 조합 주소는 코드에서 확인 가능한 범위만 해석합니다.":
    "Detect fetch, axios and supported SDK calls in JavaScript, TypeScript and Vue scripts, plus requests, httpx and urllib calls in Python. Composed URLs are resolved when the code provides enough information.",
  "Vue 템플릿과 HTML 내부 스크립트, Python의 다른 SDK와 파일 간 값 추적은 지원하지 않습니다. 분석 제한 시간은 120초이며, 환경에 따라 탐지 결과가 달라질 수 있습니다.":
    "Vue templates, scripts embedded in HTML, other Python SDKs and cross-file Python values are not supported. Analysis has a 120-second limit, and results depend on the code and environment.",

  "진행 단계 기록 없음": "No stage information was recorded",
  "분석 진행 상황": "Analysis progress",
  "저장소 접근 권한 확인": "Checking repository access",
  "분석할 파일 목록 수집": "Collecting source files",
  "소스 파일 읽기": "Reading source files",
  "API 호출 분석": "Analyzing API calls",
  "결과 저장": "Saving results",
  "분석 준비 중": "Preparing analysis",
  "개 파일 읽음": "files read",
  "이 단계에서 중단됨": "Stopped at this stage",
  "다시 분석": "Retry analysis",
  "다른 메뉴로 이동해도 분석은 계속됩니다.":
    "Analysis continues while you browse other pages.",
  "이전 성공 결과가 있다면 아래에 유지됩니다.":
    "The previous successful result, if any, is kept below.",
  "최신 분석 결과가 저장되었습니다.":
    "The latest analysis result has been saved.",
  "마지막 갱신": "Last updated",
  "진행 상태를 불러오지 못했습니다. 연결을 확인하며 자동으로 다시 시도합니다.":
    "Unable to refresh progress. Retrying automatically; check your connection.",
  "분석 실행 시간이 만료되었습니다. 다시 시도해 주세요.":
    "The analysis run expired. Please try again.",
  "분석이 제한 시간 안에 완료되지 않았습니다. 다시 시도해 주세요.":
    "Analysis did not finish within the time limit. Please try again.",

  "분석 결과가 없습니다.": "No analysis result is available.",
  "분석할 저장소를 선택하세요.": "Choose a repository to analyze.",
  "저장된 성공 결과가 없습니다. 위의 안내를 확인하거나 재분석해 주세요.":
    "No successful result has been saved. Review the message above or try analyzing again.",
  "등록된 저장소에서 프로젝트를 선택하거나 새 프로젝트를 추가하세요.":
    "Choose a project from Repositories, or add a new one.",
  "GitHub App 연결에 실패했습니다. 계정 설정에서 다시 연결해 주세요.":
    "GitHub App connection failed. Reconnect from account settings.",
  "GitHub App 계정이 연결되었습니다. 등록된 저장소에서 프로젝트를 추가하세요.":
    "Your GitHub App account is connected. Add a project from Repositories.",
  "처음 사용하는 방법": "Getting started",
  "이미 등록됨": "already added",
  "· 마지막 성공 분석": "· Last successful analysis",
  한국어: "Korean",
  "기준 미충족": "Criteria not met",
  "코드 분석": "Code analysis",
  "인증 없음": "No authentication",
  "코드 분석 · API 상태 점검": "Code analysis · API checks",
  "본문으로 건너뛰기": "Skip to content",
  "코드 속 외부 연결을 살펴보세요.":
    "Explore your project's external connections.",
  "프로젝트의 외부 연결을 한곳에서":
    "Your project's external connections, in one place",
  "예약 점검은 한국 09시대에 실행되며 정확한 시각은 달라질 수 있습니다.":
    "Scheduled checks run around 00:00 UTC (09:00 Korea time). The exact time may vary.",
  "코드 근거": "Code evidence",
  "주소 구성식 / SDK 작업": "URL expression / SDK operation",
  "등록한 주소 점검": "Registered endpoint checks",
  호출: "Calls",
  개: "",
  "비공개 저장소": "Private repository",
  "알림 닫기": "Dismiss notification",
  "GitHub 로그인이 필요합니다.": "Please sign in with GitHub.",
  "점검 실패": "Check failed",
  "코드는 실행하지 않으며, 정적 분석만으로 실제 API의 정상 동작이나 보안을 보장하지 않습니다.":
    "Code is never executed. Static analysis alone cannot guarantee API availability or security.",
  "표시할 분석 기록이 없습니다.": "No matching analyses to display.",
  "GitHub 앱과 로그인 설정이 완료되면 계정별 저장·비공개 저장소를 사용할 수 있습니다.":
    "GitHub sign-in is not configured yet. Account storage and private repositories will be available after setup.",
  "공개 저장소 주소로 추가": "Add a public repository by URL",
  "GitHub App 계정 연결": "Connect GitHub App account",
  "추가한 프로젝트만 기본 화면에 표시됩니다.":
    "Only added projects appear in your workspace.",
  "전체 공개 범위": "All visibility",
  "실제 응답 점검": "Check live responses",
  "코드 파싱에 실패했거나 지원하는 탐지 방식으로 외부 API를 찾지 못했습니다.":
    "Some code could not be parsed, or no supported external API patterns were found.",
  "언어 선택": "Language",
  "예상 JSON 값": "Expected JSON value",
  "App 연결 해제": "Disconnect App",
  "일치하는 프로젝트가 없습니다.": "No matching repositories.",
  "요청 실패": "Request failed",
  "등록된 저장소 메뉴에서 분석할 프로젝트를 선택하세요.":
    "Choose a project from Repositories to view its analysis.",
  "분석 결과": "Analysis results",
  "(비워두면 기존 값 유지)": "(leave blank to keep the current value)",
  "하루 한 번 자동 점검과 등록 직후 분석은 기본으로 켜져 있으며 계정 설정에서 끌 수 있습니다. 예약 점검은 배포 환경의 예약 작업 설정이 필요합니다.":
    "Daily checks and analysis on registration are enabled by default. You can disable them in account settings. Scheduled checks require cron configuration in the deployment environment.",
  "관련 기능 · 코드의 함수명": "Related function in code",
  "분석 중": "Analyzing",
  "공개 HTTPS 조회 주소": "Public HTTPS endpoint",
  "기준 통과": "Passed",
  "API 키 헤더": "API key header",
  "저장소를 불러오는 중": "Loading repositories…",
  "저장소 이름으로 검색": "Search by repository name",
  "개 · 파싱 실패": "· Parse errors",
  "연결된 저장소가 없습니다.": "No connected repositories.",
  사용법: "How to use",
  "등록한 프로젝트 검색": "Search saved repositories",
  "저장소 이전 페이지": "Previous repository page",
  "저장소 선택창 닫기": "Close repository picker",
  새로고침: "Refresh",
  "점검 중": "Checking…",
  "새 점검 주소 등록": "Add check endpoint",
  "GitHub 계정으로 이어서 사용": "Continue with your GitHub account",
  추가: "Add",
  "아래에는 이전 성공 결과를 유지하고 있습니다.":
    "The previous successful result is shown below.",
  "GitHub에서 프로젝트 선택": "Choose a GitHub repository",
  "지금 재점검": "Run check",
  "API 상태 점검": "Live API checks",
  "지원하는 JavaScript·TypeScript 소스가 없습니다. Python과 HTML 내부 스크립트는 아직 지원하지 않습니다.":
    "No supported JavaScript or TypeScript source files were found. Python and scripts embedded in HTML are not supported yet.",
  "분석 화면 아래에서 점검 주소를 등록하세요. 필요하면 읽기 전용 키와 정상 응답 기준을 설정하고 지금 재점검을 누르세요. 점검 요청이 사용량에 포함될 수 있습니다.":
    "Add a check endpoint below the analysis. Set a read-only key and response criteria if needed, then select Run check. Requests may count toward the API provider's usage limits.",
  "자동 점검을 꺼도 수동 재점검은 가능합니다. 수동 실행은 30초 간격이며 예약 시각을 변경하지 않습니다.":
    "Manual checks are available even when daily checks are off. Allow 30 seconds between runs. Manual runs do not change the schedule.",
  "점검 요청 실패": "Check request failed",
  "자동 점검과 문제 해결": "Automatic checks and troubleshooting",
  "처리 실패": "Operation failed",
  "예상 HTTP 코드 (비우면 2xx)": "Expected HTTP code (blank for any 2xx)",
  "분석 기록 검색": "Search analyses",
  "일부 파일의 파싱에 실패했습니다. 누락 가능성이 있습니다.":
    "Some files could not be parsed. Results may be incomplete.",
  "GitHub 저장소 검색": "Search GitHub repositories",
  "지원하는 탐지 방식으로 외부 API를 찾지 못했습니다. API가 없다는 뜻은 아닙니다.":
    "No external APIs were found with the supported detection patterns. This does not mean no APIs exist.",
  "주 메뉴": "Main navigation",
  "점검 이름": "Check name",
  "JSON 객체 경로 (선택)": "JSON object path (optional)",
  "필요한 프로젝트부터 추가해 보세요.": "Add a project to get started.",
  "저장소 분석 →": "Analyze repository →",
  "오른쪽 위에서 로그인하세요. 같은 계정으로 다른 기기에서도 저장된 프로젝트를 열 수 있습니다.":
    "Sign in at the top right. Use the same account to access saved projects on other devices.",
  "인증 정보 등록됨": "Credentials saved",
  검색됨: "found",
  "Bearer 토큰": "Bearer token",
  "처리 중": "Working…",
  공개만: "Public only",
  "등록 직후 자동 분석": "Analyze automatically when added",
  "아직 점검하지 않았습니다.": "No checks run yet.",
  "총 5 MiB": "5 MiB total",
  "코드를 실행하지 않는 정적 분석입니다. 실제 응답 상태를 검증하지 않았습니다.":
    "This is static analysis. Code was not executed and live responses were not checked.",
  비공개: "Private",
  "호출 파일": "Source file",
  "공개 GitHub 저장소 주소": "Public GitHub repository URL",
  수동: "Manual",
  "저장소 다음 페이지": "Next repository page",
  "내부 경로 후보": "Possible internal route",
  "프로젝트 이전 페이지": "Previous project page",
  커밋: "Commit",
  "GitHub 로그인": "Sign in with GitHub",
  "지원 한도 초과: 소스 100개, 파일당 200 KiB, 전체 5 MiB 이하 저장소를 사용해 주세요.":
    "Repository exceeds the limits: 100 source files, 200 KiB per file and 5 MiB total.",
  "저장소마다 최신 성공 결과와 최근 시도 상태만 보관합니다. 이전 실행 내역은 누적하지 않습니다.":
    "Each repository keeps its latest successful result and latest attempt status. Older runs are not retained.",
  "헤더 이름": "Header name",
  저장: "Save",
  "최근 분석 실패:": "Latest analysis failed:",
  "주소 미해결": "Unresolved address",
  "개 저장소": "repositories",
  "GitHub 로그인에 실패했거나 승인이 취소되었습니다. 다시 시도해 주세요.":
    "GitHub sign-in failed or was cancelled. Please try again.",
  "검색어를 바꾸면 다른 프로젝트를 찾을 수 있습니다.":
    "Try a different search to find other projects.",
  "GitHub App 설치·저장소 선택 ↗": "Install GitHub App / select repositories ↗",
  "검색 결과가 없습니다.": "No matching repositories.",
  "분석 기록을 보려면 GitHub으로 로그인하세요.":
    "Sign in with GitHub to view saved analyses.",
  "호출 주소": "Request URL",
  "분석 완료": "Analysis complete",
  자동: "Scheduled",
  "프로젝트 다음 페이지": "Next project page",
  "저장소 연결과 등록": "Connect and add repositories",
  "지원 범위와 보관 정책": "Supported projects and retention",
  "GitHub 계정 연결을 확인해 주세요.": "Check your GitHub account connection.",
  로그아웃: "Sign out",
  "설정·키 교체": "Edit settings / replace key",
  "등록된 저장소 메뉴의 새 프로젝트 추가를 누르세요. 목록이 없다면 계정·GitHub 연결 설정에서 App 설치와 계정 연결을 완료하세요. 비공개 저장소는 App에 접근을 허용해야 합니다.":
    "Open Repositories and select Add project. If the list is empty, install and connect the GitHub App under account settings. Private repositories must be included in the App's access scope.",
  "개 그룹": "groups",
  "분석하지 못했습니다.": "Analysis failed.",
  "목록에서 API를 선택해 주세요.": "Select an API from the list.",
  "외부 API를 한눈에": "Your external APIs at a glance",
  "이 대상 점검 활성화": "Enable this check",
  "점검·인증 정보 삭제": "Delete check and credentials",
  "계정·GitHub 연결 설정": "Account and GitHub settings",
  "읽기 전용 키·토큰": "Read-only key / token",
  미분석: "Not analyzed",
  "사용자당 최대 5개": "Up to 5 per account",
  워크스페이스: "Workspace",
  "분석 제한 시간 60초를 초과했습니다.":
    "Analysis exceeded the 60-second time limit.",
  "선택 점검 설정 수정": "Edit selected check",
  "하루 한 번 API 자동 점검": "Check APIs once a day",
  "GitHub 저장소를 선택해 추가하면 이곳에서 분석을 이어갈 수 있습니다.":
    "Add a GitHub repository to start analyzing it here.",
  "제외 파일": "Skipped files",
  "탐지 결과가 없으면 지원 언어와 호출 방식을 확인하세요. 주소 미해결은 실행 환경의 값이 필요하다는 뜻입니다. 인증 실패는 키 권한과 만료 여부를 확인하세요.":
    "If no APIs are found, check the supported languages and call patterns. Unresolved URLs need runtime values. For authentication failures, check key permissions and expiry.",
  "첫 저장소를 분석해 보세요.": "Analyze your first repository.",
  비공개만: "Private only",
  "계정별로 저장소와 최신 성공 분석 결과를 보관합니다. 재분석이 실패해도 이전 성공 결과는 유지합니다.":
    "Repositories and the latest successful analysis are saved to your account. A failed reanalysis preserves the previous successful result.",
  "선택 프로젝트 재분석": "Reanalyze selected project",
  분석: "Analysis",
  "서비스 정보": "About",
  "등록된 저장소": "Repositories",
  "로그아웃되었습니다.": "You have been signed out.",
  "수정 취소": "Cancel editing",
  "JavaScript·TypeScript의 fetch, axios, OpenAI, Supabase, Stripe 호출을 탐지합니다. 조합 주소는 코드에서 확인 가능한 범위만 해석합니다.":
    "Detect fetch, axios, OpenAI, Supabase and Stripe calls in JavaScript and TypeScript. Composed URLs are resolved only when the code provides enough information.",
  "코드 분석만 수행했습니다. 실제 API 요청은 보내지 않았습니다.":
    "Only the code was analyzed. No live API requests were sent.",
  "저장소를 불러오지 못했습니다.": "Could not load repositories.",
  "다른 이름이나 공개 범위로 검색해 주세요.":
    "Try a different name or visibility filter.",
  "코드에서 확인한 근거를 제공합니다. 미검출은 API가 없다는 뜻이 아닙니다.":
    "Results are based on code evidence. No detections does not mean no APIs exist.",
  "GitHub App에서 계정 연결과 저장소 접근 권한을 확인해 주세요.":
    "Check your GitHub App account connection and repository access.",
  "＋ 새 프로젝트 추가": "＋ Add project",
  "분석 결과 확인": "Explore analysis results",
  "GitHub App에서 접근을 허용한 저장소입니다. 필요한 프로젝트만 추가하세요.":
    "These repositories are accessible to the GitHub App. Add only the projects you need.",
  "저장소 목록이 보이지 않으면 App 설치 범위와 계정 연결을 확인하세요.":
    "If repositories are missing, check the App's installation scope and account connection.",
  "분석 중 오류가 발생했습니다.": "An error occurred during analysis.",
  "최대 소스 100개": "Up to 100 source files",
  "API 목록": "API list",
  "분석 파일": "Files scanned",
  "주소 확인": "Address resolved",
  "확인 불가 · 실행 환경 또는 동적 값 필요":
    "Unavailable · runtime configuration or dynamic values required",
  "분석 실패": "Analysis failed",
  "GitHub에서 프로젝트 추가": "Add a GitHub project",
  "인증 방식": "Authentication",
  "사용자가 등록한 공개 HTTPS 조회 주소를 읽기 전용으로 점검합니다. 예상 HTTP 코드와 JSON 값으로 정상 여부를 판단합니다.":
    "Check user-registered public HTTPS endpoints with read-only requests. Expected HTTP status codes and JSON values define a passing response.",
  "저장소별 최신 분석": "Latest analysis by repository",
  "Python과 HTML 내부 스크립트는 아직 분석하지 않습니다. 분석 한도는 소스 100개, 파일당 200 KiB, 전체 5 MiB입니다.":
    "Python and scripts embedded in HTML are not supported yet. Limits: 100 source files, 200 KiB per file and 5 MiB total.",
  "응답 상태 · 확인 불가": "Response status · not checked",
  "코드는 내려받아 읽기만 하며 실행하지 않습니다.":
    "Source code is read, never executed.",
  "최근 분석 실패": "Latest analysis failed",
  "호출 상세": "Call details",
  "공개 저장소": "Public repository",
  "개 프로젝트": "projects",
  "저장소 공개 범위": "Repository visibility",
  등록됨: "Added",
  "API 호출과 관련 함수를 찾아, 프로젝트의 외부 연동을 한곳에 모읍니다.":
    "Find API calls and related functions, all in one workspace.",
  "저장소를 선택하면 분석 화면이 열립니다. 왼쪽 API 목록에서 호출을 선택해 오른쪽에서 파일과 함수, 주소 구성식을 확인하세요.":
    "Select a repository to open Analysis. Choose a call on the left to see its source file, function and URL expression on the right.",
  "페이지당 6개씩 표시": "6 projects per page",
  "문자열은 따옴표를 포함해 입력: &quot;ok&quot;":
    'Include quotes for strings, for example: "ok"',
  "분석 기록": "Analysis history",
  공개: "Public",
  "GitHub 저장소에서 외부 API 호출과 관련 파일·함수를 찾아보고, 등록한 점검 주소의 실제 응답을 확인하는 개발 도구입니다.":
    "Find external API calls, source files and functions in GitHub repositories, then check live responses from endpoints you register.",
  "읽기 전용으로 발급한 키와 점검용 조회 주소만 등록하세요. 코드 분석과 실제 응답 점검은 별개입니다.":
    "Use only read-only keys and endpoints intended for checks. Code analysis and live response checks are separate.",
  "로그인하면 다른 기기에서도 저장소와 마지막 분석 결과를 확인합니다.":
    "Sign in to access your repositories and latest analysis on other devices.",
  "외부 API를 사용하는 파일과 함수를 찾아 보여드립니다.":
    "Find the files and functions that call external APIs.",
  "실행 실패": "Request failed",
  "파일당 200 KiB": "200 KiB per file",
  "공개 GitHub 저장소 주소를 입력해 주세요.":
    "Enter a public GitHub repository URL.",
  "https://github.com/소유자/저장소 형식만 지원합니다.":
    "Use the format https://github.com/owner/repository.",
  "올바른 저장소 주소가 아닙니다.": "Invalid repository URL.",
  "저장소를 찾을 수 없거나 공개 저장소가 아닙니다.":
    "Repository not found, or access is not allowed.",
  "GitHub 요청 한도 또는 접근 제한으로 분석하지 못했습니다.":
    "Analysis was blocked by GitHub rate limits or access restrictions.",
  "GitHub 응답 오류:": "GitHub response error:",
  "공개 저장소만 지원합니다.": "Only public repositories are supported here.",
  "저장소 파일 목록이 너무 커서 완전하게 읽을 수 없습니다.":
    "The repository file tree is too large to read completely.",
  "파일 형식 또는 크기가 지원 범위를 벗어났습니다.":
    "The file format or size is not supported.",
  "읽은 소스 크기가 지원 한도를 초과했습니다.":
    "Source content exceeds the supported size limit.",
  "설정값을 확인해 주세요.": "Check the settings values.",
  "GitHub 연결 또는 저장소 접근 권한을 확인해 주세요.":
    "Check the GitHub connection and repository permissions.",
  "GitHub 요청 제한 또는 일시적 오류입니다.":
    "GitHub is rate-limiting requests or temporarily unavailable.",
  "GitHub App 승인을 다시 진행해 주세요.": "Authorize the GitHub App again.",
  "로그인한 GitHub 계정과 연결 계정이 다릅니다.":
    "The connected GitHub account differs from the signed-in account.",
  "GitHub App 연결이 필요합니다.": "Connect your GitHub App account first.",
  "GitHub App 연결이 만료됐습니다. 다시 연결해 주세요.":
    "Your GitHub App connection has expired. Please reconnect.",
  "GitHub 연결 신원을 확인할 수 없습니다.":
    "Could not verify the connected GitHub identity.",
  "연결 저장소가 너무 많습니다. GitHub App의 선택 저장소를 줄여 주세요.":
    "Too many connected repositories. Reduce the GitHub App's selected repositories.",
  "이 비공개 저장소의 권한이 해제됐거나 선택되지 않았습니다.":
    "Access to this private repository was revoked or it was not selected.",
  "점검 이름은 1~100자입니다.": "Check names must contain 1–100 characters.",
  "인증 방식을 확인해 주세요.": "Check the authentication type.",
  "전송 대상이 바뀌면 인증 정보를 새로 입력해 주세요.":
    "Re-enter credentials when the destination changes.",
  "인증 정보 형식이 올바르지 않습니다.": "The credential format is invalid.",
  "읽기 전용 키 또는 토큰을 입력해 주세요.": "Enter a read-only key or token.",
  "예상 응답 코드는 100~599 정수입니다.":
    "The expected HTTP code must be an integer from 100 to 599.",
  '예상 JSON 값은 "ok", 1, true, null처럼 입력해 주세요.':
    'Enter a valid JSON value such as "ok", 1, true or null.',
  "JSON 예상 값은 문자열·숫자·불리언·null만 지원합니다.":
    "Expected JSON values support only strings, numbers, booleans and null.",
  "이미 점검 중이거나 비활성화됐습니다. 수동 점검은 30초 간격으로 실행해 주세요.":
    "This check is running, disabled, or was run too recently. Wait 30 seconds between manual runs.",
  "점검 인증 정보가 없습니다.": "No credentials are saved for this check.",
  "연결 오류 또는 제한 시간 내 응답 없음":
    "Connection error or no response within the time limit",
  "점검 결과를 저장하지 못했습니다.": "Could not save the check result.",
  "DNS 조회 시간이 초과됐습니다.": "DNS lookup timed out.",
  "내부망 또는 예약 주소로 연결할 수 없습니다.":
    "Private-network and reserved addresses are blocked.",
  "응답 본문이 256 KiB 한도를 초과했습니다.":
    "The response body exceeds the 256 KiB limit.",
  "유효한 HTTPS 점검 주소가 필요합니다.": "Enter a valid HTTPS check endpoint.",
  "공개 HTTPS 주소의 443 포트만 점검할 수 있습니다.":
    "Only public HTTPS endpoints on port 443 can be checked.",
  "인증 정보는 주소 쿼리가 아닌 전용 입력란에 등록해 주세요.":
    "Use the credential field instead of putting secrets in the URL query.",
  "이 인증 헤더 이름은 사용할 수 없습니다.":
    "This authentication header name is not allowed.",
  "JSON 경로는 점으로 구분한 객체 키만 지원합니다.":
    "JSON paths support only dot-separated object keys.",
  "예상 HTTP 상태 코드와 다릅니다.":
    "The HTTP status code does not match the expected code.",
  "응답을 JSON으로 해석할 수 없습니다.":
    "The response could not be parsed as JSON.",
  "지정한 JSON 필드가 없습니다.": "The specified JSON field is missing.",
  "JSON 필드 값 또는 타입이 예상과 다릅니다.":
    "The JSON field value or type does not match the expected value.",
  "설정한 점검 기준 통과": "All configured check criteria passed.",
  "저장소에 접근할 수 없습니다.": "You do not have access to this repository.",
  "계정 설정을 읽지 못했습니다.": "Could not load account settings.",
  "점검 대상에 접근할 수 없습니다.": "You do not have access to this check.",
  "점검 실행 중에는 설정을 바꿀 수 없습니다.":
    "Settings cannot be changed while a check is running.",
  "요청 출처가 일치하지 않습니다.":
    "The request origin does not match this site.",
  "입력값이 없습니다.": "No input was provided.",
  "입력값이 너무 큽니다.": "The input is too large.",
  "입력 형식을 확인해 주세요.": "Check the input format.",
  "서비스 연결 설정이 필요합니다.": "Service connection setup is required.",
  "요청을 처리하지 못했습니다. 다시 시도해 주세요.":
    "The request could not be completed. Please try again.",
  "점검 한도에 도달했습니다. 사용자당 5개, 서비스 전체 20개까지 지원합니다.":
    "The check limit has been reached: 5 per account and 20 across the service.",
  "이미 분석 중입니다. 잠시 후 확인해 주세요.":
    "Analysis is already running. Please check again shortly.",
  "예약 실행 인증이 필요합니다.":
    "Scheduled execution requires authentication.",
  "선택한 저장소의 접근 권한이 없습니다.":
    "You do not have access to the selected repository.",
  "공개 저장소를 찾지 못했습니다. 비공개 저장소는 GitHub App 목록에서 선택해 주세요.":
    "Public repository not found. For private repositories, choose from the GitHub App list.",
  "비공개 저장소는 연결 목록에서 선택해 주세요.":
    "Choose private repositories from the connected list.",
  "저장소를 확인할 수 없습니다.": "Could not verify this repository.",
  "계정 연결 전 분석은 로컬 개발에서만 사용할 수 있습니다.":
    "Guest analysis is available only in local development. Sign in to continue.",
  "로컬 화면에서 실행해 주세요.": "Run this from the local application page.",
  "요청이 너무 큽니다.": "The request is too large.",
  "저장소 주소를 확인해 주세요.": "Check the repository URL.",
  "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.":
    "Analysis encountered an error. Please try again shortly.",
  "연결 요청이 만료됐거나 일치하지 않습니다.":
    "The connection request expired or does not match.",
  "[문자열]": "[string]",
  "[동적 키]": "[dynamic key]",
  "[템플릿 문자열]": "[template string]",
  "[인수 비공개]": "[arguments redacted]",
  "[동적 표현식]": "[dynamic expression]",
  "최상위 호출": "Top-level call",
  "익명 함수": "Anonymous function",
  "외부 API": "External API",
  "API 분석 도구": "API analysis tool",
  "응답 형식 (Accept)": "Response format (Accept)",
  "서버 기본값": "Server default",
  "일반 텍스트": "Plain text",
  "요청할 응답 형식을 지정합니다. 실제 형식은 서버 응답에 따라 달라집니다.":
    "Choose the requested response format. The server determines the actual format.",
  "응답 형식은 기본값·JSON·텍스트·HTML 중에서 선택해 주세요.":
    "Choose default, JSON, text or HTML as the response format.",
  "소스 파일을 읽지 못했습니다. HTTP": "Unable to read a source file. HTTP",
  "코드 분석과 실제 응답 점검은 별개입니다. 응답 상태는 각 API의 점검 결과를 확인하세요.":
    "Code analysis and live response checks are separate. See each API's check result for its response status.",
};

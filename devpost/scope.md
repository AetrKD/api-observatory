---
doc: scope
status: approved
---

# GitHub 저장소 외부 API 현황 분석 도구

공개 GitHub 저장소 주소를 입력하면 프로젝트가 사용하는 외부 API와 호출 위치를 모아 보여주는 시제품.

## The Unique Kernel
API 목록을 프로젝트 코드의 호출 파일 및 관련 기능과 연결해 보여준다. 외부 연동 현황을 한곳에서 파악하고, API 문제의 영향을 조사할 출발점을 제공한다.

## Who It's For
웹 애플리케이션을 개발하거나 유지보수하는 웹 애플리케이션 개발자. 

## The Core Loop
공개 GitHub 저장소 하나의 주소를 입력한다 → 코드에서 외부 API 호출을 탐색한다 → API별 호출 파일과 관련 기능을 확인한다. 프로젝트의 외부 연동 현황을 파악할 때 사용한다.

## Inspiration & Identity
특정 참고 서비스나 시각적 스타일은 아직 정하지 않았다. 결과를 통해 API 사용 현황과 코드 위치를 이해할 수 있어야 한다.


## What "Working" Looks Like
공개 저장소 주소를 입력한 후, 탐지된 외부 API 목록에서 호출 파일과 관련 기능을 확인할 수 있다. 데모에서는 외부 API 호출이 있는 예제 저장소의 결과와 실제 코드 위치를 비교해 핵심 흐름을 보여준다. 지원할 언어와 탐지 패턴, 기능 설명의 근거는 후속 계획에서 구체화한다.

## The POC Boundary
- 공개 GitHub 저장소 하나를 주소만으로 분석한다.
- 탐지 가능한 외부 API를 종합해 목록으로 보여준다. 모든 언어와 간접 호출까지 빠짐없이 탐지한다고 보장하지 않는다.
- API별 호출 파일과 관련 기능을 코드 근거와 연결한다. 판단하기 어려운 기능은 불확실성을 표시한다.
- 사용자는 현재 응답 상태도 원한다. 다만 저장소 코드만으로 실행 시점의 정상 응답을 확정할 수 없으므로, 검증하지 못한 상태는 “확인 불가”와 이유를 표시한다. 실시간 상태 검증은 첫 시제품의 완료 요건에 포함하지 않는다.

## Later
- 인증 및 접근 권한 보안 분석.
- 장애 대응 코드 분석.
- 실행 환경을 활용하는 실제 API 응답 및 장애 테스트. 저장소 주소만으로는 인증 정보와 실행 맥락이 부족하므로 별도 설계가 필요하다.

## Explicitly Cut
- 첫 시제품의 비공개 저장소 연결: 공개 저장소 하나로 입력 범위를 줄인다.
- 첫 시제품의 로컬 실행 환경 및 인증 정보 연결: 사용자가 저장소 주소만 입력하는 방식을 선택했다.
- 모든 API의 실제 응답 상태 확정 및 자동 장애 주입: 코드 분석만으로 입증할 수 없고, 핵심 목록 탐색 흐름을 넘어선다.

## Open Decisions for PRD and Spec
지원 저장소 언어 및 규모, 외부 API 탐지 기준, 관련 기능 표시 방식, 결과 화면과 오류 처리를 후속 단계에서 정한다. 실제 API 상태 확인을 수행하지 않는다는 한계를 문서 검토에서 확인한다.


## Approved Private Access Amendment
사용자는 선택한 비공개 저장소 분석을 추가 승인했다. GitHub App으로 본인 개인 계정의 선택 저장소에만 읽기 권한을 연결하며 기존 공개 전용 제한의 변경사항은 prd.md > Selected Private Repository Access와 spec.md > GitHub App Private Access Amendment가 우선한다. 조직·팀 공유는 후속 범위다.


## Supported Source Amendment — 2026-10-26
사용자 요청으로 JavaScript·TypeScript에 Python 및 Vue SFC 지원을 추가한다. Python은 requests·httpx·urllib의 지원 패턴, Vue는 script와 script setup의 JS/TS를 대상으로 한다. 모든 언어·SDK·간접 호출 탐지를 보장하지 않는 기존 경계와 코드 실행 금지 원칙을 유지한다.


## HTML Call Detection Amendment — 2026-10-26
minedashboard 탐지 누락 수정 요청에 따라 HTML 인라인 JavaScript/Jinja 조건 블록의 HTTP 호출과 WebSocket 연결을 추가한다. 기존 내부 경로 후보 표기를 유지해 상대 API 경로도 탐지하며, 서버 API 정의 전체 목록이나 HTML 템플릿 실행은 이번 수정에 포함하지 않는다.


## Project-Level Response Setup Amendment — 2026-10-26
사용자의 테스트 동선 개선 요청으로, 배포 주소와 공통 인증을 프로젝트 상단에서 선택적으로 한 번 입력하고 같은 도메인의 GET 결과를 자동 표시한다. 개별 점검 등록을 기본 흐름에서 제거하고 고급 기능으로 유지한다. 조회용 요청·공개 HTTPS·본문 미보관 경계와 자동 장애 주입 제외는 유지한다.

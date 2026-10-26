# API Observatory

**Discover API calls, trace their source, and check live responses.**

API Observatory turns a GitHub repository into an overview of its API connections. Explore detected calls in a two-pane dashboard, find the code behind each request, and inspect real HTTP responses from endpoints you configure.

The interface is available in **English and Korean**.

## What you can do

- **Connect GitHub repositories** — sign in, add public repositories, or authorize selected private repositories through a GitHub App.
- **Explore API calls** — select a call to view its URL or expression, source file, line number, related function, and commit-pinned GitHub link.
- **Follow analysis progress** — see the current stage and source-file counts while analysis runs.
- **Check live responses** — optionally configure a deployment or API base URL to check eligible same-origin GET requests and view status codes, response times, and temporary response previews.
- **Configure individual checks** — supply a read-only token or API key and define an expected HTTP status or scalar JSON field value.
- **Keep your workspace** — save registered repositories, account settings, and the latest successful analysis to your account. A failed reanalysis preserves the previous successful result.

## How it works

1. Sign in with GitHub and add a repository from **Repositories**. Public repositories can also be added by URL.
2. Open **Analysis** and select a call from the list on the left. Its source and request details appear on the right.
3. Optionally enter a deployment or API base URL matching the GET calls you want to test.
4. Choose a response format, add authentication if needed, and select **Save and check responses**.
5. Inspect the response, or use advanced individual checks to define passing criteria.

Code analysis and live response checks are separate. Detecting a call does not prove that its endpoint is healthy; excluded or unresolved calls display an explanation.

### Supported project formats

| Format | Supported patterns |
| --- | --- |
| JavaScript / TypeScript | Supported `fetch`, `axios`, WebSocket, and selected OpenAI, Supabase, and Stripe SDK patterns |
| Python | Supported `requests`, `httpx`, and `urllib` patterns |
| Vue | JavaScript / TypeScript in `script` and `script setup` blocks |
| HTML | Inline JavaScript and supported Jinja conditional blocks |

Repository code is read, **never executed**. Static analysis cannot resolve every runtime value or discover every API. Vue templates, downloaded external scripts, unsupported SDKs, and cross-file Python values are outside the current scope.

## Technology

| Area | Technology |
| --- | --- |
| Application | Next.js, React, TypeScript, Node.js |
| Authentication | Better Auth and GitHub |
| Repository access | GitHub APIs and GitHub App |
| Persistence | Turso (libSQL / SQLite), Drizzle ORM |
| Source analysis | Babel, Lezer Python, Vue SFC compiler, parse5 |
| Hosting configuration | Vercel Functions and Cron |

## Limits and response handling

- Analysis: up to **200 source files**, **400 KiB per file**, **10 MiB total**, and a **120-second** deadline.
- Automatic project checks: public HTTPS GET requests on the configured origin, up to **20 unique URLs** per run, an account cooldown, and five-minute reuse of response metadata.
- Individual checks: up to **five per user**, **20 globally**, with a **30-second** manual cooldown.
- Outbound checks reject private/reserved IP addresses, pin DNS, do not follow redirects, and enforce **10-second / 256 KiB** bounds.
- Credentials are encrypted on the server. Response previews are redacted and are not stored in the database.
- Requested response formats include JSON, plain text, HTML, or the server default. The API server determines the actual format.

## Project status

This repository contains a working prototype and Vercel deployment configuration. **A public hosted application and hosted daily cron execution have not yet been verified.**

The daily schedule is configured for **00:00 UTC** for enabled individual check targets. Automatic response checks when opening a project are a separate feature. Organization/team workspaces are outside the current scope.

## Developer setup

<details>
<summary><strong>Installation and environment configuration</strong></summary>

### Requirements

- Node.js 24 or newer and pnpm 11 or newer.
- A Turso database and authentication token.
- GitHub OAuth credentials for sign-in; a GitHub App for selected private repositories.
- Independent session, encryption, and cron secrets.

### Run locally

```sh
git clone https://github.com/AetrKD/api-observatory.git
cd api-observatory
pnpm install --frozen-lockfile
```

Copy [`.env.example`](.env.example) to `.env.local` and fill in your own values. Keep real credentials out of Git.

- Use the development site URL provided in `.env.example` for local use. Set `NEXT_PUBLIC_SITE_URL` to your application's public HTTPS origin when deploying.
- Generate independent values for `BETTER_AUTH_SECRET`, `CRON_SECRET`, and `CREDENTIAL_ENCRYPTION_KEY`. The encryption key must be 32 random bytes encoded as base64.
- Configure the GitHub callbacks below to match your chosen site URL.

```sh
pnpm db:migrate
pnpm dev
```

Open the development URL printed in the terminal. Migrations add fields without clearing existing data and may be run again. Development and production builds use Webpack.

### GitHub configuration

Replace `<SITE_URL>` with the same origin used for `NEXT_PUBLIC_SITE_URL`.

| Purpose | Callback |
| --- | --- |
| GitHub sign-in | `<SITE_URL>/api/auth/callback/github` |
| GitHub App connection | `<SITE_URL>/api/github/callback` |

Configure the App with **Contents: read**, **Metadata: read**, and **Email addresses: read** permissions. Install it on the repositories you want to analyze, then connect it to the same GitHub identity in account settings.

Public metadata uses the GitHub login token on the server. Public source downloads use commit-pinned raw URLs without authorization headers. Private source access retains selected-repository permission checks.

The unauthenticated public-analysis preview is limited to local development. Production use requires authentication.

### Example to try

Add [bradtraversy/50projects50days](https://github.com/bradtraversy/50projects50days) and inspect the `dad-jokes` call. Its API origin is `https://icanhazdadjoke.com`. Choose **JSON** as the response format to request `Accept: application/json`.

This is the API provider's origin, rather than the example project's deployment address.

</details>

<details>
<summary><strong>Verification commands</strong></summary>

```sh
pnpm test
pnpm typecheck
pnpm build
```

Optional live-database integration checks:

```sh
pnpm test:integration
```

The integration command uses the configured Turso database, creates temporary test fixtures, and removes them. Controlled HTTP tests do not establish the health of a deployed external service.

</details>

## Planning documents

- [Project scope](devpost/scope.md)
- [Product requirements](devpost/prd.md)
- [Implementation specification](devpost/spec.md)
- [Implementation checklist](devpost/checklist.md)
- [Source map](devpost/app-map.html) — download and open locally to view the HTML document.

## License

[MIT](LICENSE)

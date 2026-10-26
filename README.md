# API Observatory

## Run and verify

A Next.js/React application with GitHub authentication, Turso persistence, static API-call discovery and protected read-only response checks. This file is technical setup documentation.

### Requirements

- Node.js 24 or newer and pnpm 11 or newer.
- A Turso database and authentication token.
- GitHub login credentials and a GitHub App for selected private repositories.
- Server-side encryption and session secrets. Never commit these values.

### Local setup

1. Clone this repository into a local directory that supports package links.
2. Copy .env.example to .env.local and fill in your own credentials.
3. Set NEXT_PUBLIC_SITE_URL=http://127.0.0.1:3000.
4. Generate independent secrets for BETTER_AUTH_SECRET, CRON_SECRET and CREDENTIAL_ENCRYPTION_KEY. The encryption key must be base64-encoded 32-byte data.
5. Configure GitHub callbacks as described below.
6. Run:

```sh
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

Open http://127.0.0.1:3000. The migration adds new fields without clearing existing data and may be run again. Development and builds use Webpack.

### GitHub configuration

- Login callback: SITE_URL/api/auth/callback/github.
- GitHub App callback: SITE_URL/api/github/callback.
- App permissions: Contents read, Metadata read, and the configured Email addresses read permission.
- Install the App on selected repositories, then connect it to the same GitHub identity in account settings.
- Organization/team sharing is outside this proof of concept.
- Public metadata reuses the existing GitHub login token on the server. Public source downloads use commit-pinned raw URLs without Authorization headers. Private sources retain selected-repository permission checks.

### Try the core flow

1. Sign in with GitHub and add a repository. For public repositories outside the connected list, expand account settings and use the public repository URL input.
2. Open the API list and select a call to see its source file, function, line and commit link.
3. Optionally set a deployment or API origin matching the GET calls you want to check.
4. Under authentication and automatic-check settings, choose JSON to request Accept: application/json. Save and check responses.
5. Read the HTTP status, duration and temporary response preview. Cross-origin calls, non-GET operations and unresolved addresses show exclusion reasons.
6. Use advanced individual checks for an expected HTTP code or scalar JSON field criterion.

For the public example bradtraversy/50projects50days, the dad-jokes example calls https://icanhazdadjoke.com/. That API origin is suitable for demonstrating its JSON GET response; it is not the project's own deployment origin.

### Checks

```sh
pnpm test
pnpm typecheck
pnpm build
pnpm test:integration
```

The optional integration command uses your configured Turso database, inserts temporary test fixtures and removes them. Tests using controlled HTTP transports do not prove that a deployed external service is healthy. The development copy passed 66 regular tests and four relevant live-database tests, TypeScript and a production build before this snapshot.

### Supported inputs and limits

- JavaScript/TypeScript: supported fetch, axios and selected OpenAI/Supabase/Stripe patterns.
- Python: supported requests/httpx/urllib patterns. Vue: script and script setup blocks.
- HTML: inline JavaScript/Jinja conditional blocks, including supported fetch/WebSocket calls.
- No repository code is executed. Dynamic values and unsupported patterns are reported without claiming complete API coverage.
- Up to 200 source files, 400 KiB per file, 10 MiB total and a 120-second analysis deadline.
- Automatic project responses: same-origin public HTTPS GET, up to 20 unique URLs, account cooldown and five-minute metadata reuse.
- Individual checks: five per user, 20 globally, a 30-second manual cooldown.
- Outbound requests reject private/reserved IPs, pin DNS, do not follow redirects and use 10-second/256 KiB bounds.
- Accept preferences: server default, JSON, text or HTML. The server chooses the actual response type.
- Credentials are encrypted; response previews are redacted and never stored in the database.

### Hosting status

Vercel configuration is included. The daily cron schedule is 00:00 UTC for enabled individual targets; actual execution time can vary. Project-open automatic responses are separate from the daily individual-check schedule. Deployment and hosted daily cron execution remain unverified; this snapshot does not claim a live deployment.

The unauthenticated public-analysis preview is restricted to localhost development. Production use requires authentication.

### Planning and code reference

See devpost/scope.md, devpost/prd.md, devpost/spec.md, devpost/checklist.md and devpost/app-map.html. Original product plans are preserved with personal learning context and machine-specific paths removed. The offline map identifies the source locations for future changes.

License: MIT. See LICENSE.

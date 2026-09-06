# ar-loans-app — Containerized Dev Environment

One command sets up a complete local development environment. Cosmos DB and
Azurite run in Docker containers, and both app processes (backend, frontend)
run inside a dedicated `dev` container with the full toolchain.
Modeled on `finance3/.devcontainer`, trimmed for this repo (no Python
ingester, no SignalR).

## Architecture

```
┌───────────────────────────── host ──────────────────────────────┐
│                                                                │
│   browser ─► https://localhost:5173  (frontend/Vite, basicSsl) │
│              http://localhost:7239  (backend API, /api)         │
│                                                                │
│   docker compose (ar-loans-app-net bridge)                     │
│   ┌─────────────────────────────┐   ┌───────────────────────┐  │
│   │ dev  (ar-loans-app-dev)     │   │ cosmos  :8081          │  │
│   │   backend       7239        │   │   Cosmos DB emulator   │  │
│   │   frontend      5173        │   ├───────────────────────┤  │
│   │   (dotnet 9, func, node 22) │   │ azurite :10000-10002   │  │
│   └─────────────────────────────┘   │   Azure Storage emulator│  │
│                                      └───────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

Backend port is **7239** (not 7071) to match the checked-in
`frontend/public/config.js` (`apiUrl http://localhost:7239/api`).
The apps reach the emulators by service hostname — `cosmos`, `azurite`
(see `backend/Ar.Loans.Api/local.settings.json`).

## Requirements

- Docker with Compose v2 (`docker compose`)
- VS Code with the **Dev Containers** extension (for the devcontainer workflow)
  - *or* no editor at all — the stack is usable standalone via compose

## Quick start

### Option A — VS Code Dev Container (recommended)

1. Install the Dev Containers extension in VS Code.
2. Open this repository in VS Code — it will detect `.devcontainer/devcontainer.json`.
3. Run **Dev Containers: Reopen in Container** (F1 → the command).
   - First build takes a few minutes (`postCreateCommand` runs `setup.sh`:
     `dotnet restore` + `npm --prefix frontend install`).
4. Start the app processes inside the container:

   ```bash
   .devcontainer/scripts/dev-up.sh
   ```

5. Open https://localhost:5173 (Vite uses `@vitejs/plugin-basic-ssl`, so expect
   a self-signed cert warning) or http://localhost:5173.

### Option B — Standalone compose (no VS Code)

```bash
# From the repo root:
docker compose -f .devcontainer/docker-compose.yml up -d --build

# Attach to the dev container:
docker exec -it ar-loans-app-dev bash

# Inside the container, run one-time setup (first time only):
bash .devcontainer/scripts/setup.sh

# Start the two app processes:
bash .devcontainer/scripts/dev-up.sh
```

### Option C — Native (no Docker for apps, emulators still in Docker)

Host already has dotnet 10, node 24, func 4.14 — usable, but the backend
targets `net9.0`, so install the .NET 9 SDK if `dotnet --list-sdks` lacks 9.x.

```bash
# Start only the emulators:
docker compose -f .devcontainer/docker-compose.yml up -d cosmos azurite

# Point the backend at localhost instead of service hostnames:
# edit backend/Ar.Loans.Api/local.settings.json:
#   AppConfig__CosmosEndpoint -> http://localhost:8081/
#   AppConfig__AzureStorage / AzureWebJobsStorage Blob/Queue/Table endpoints
#     -> http://localhost:10000/10001/10002
# Then:
cd backend/Ar.Loans.Api && func start --port 7239
cd frontend && npm install && npm run dev
```

## Managing the stack

```bash
.devcontainer/scripts/dev-stack.sh up       # build & start everything
.devcontainer/scripts/dev-stack.sh down     # stop emulators + dev container
.devcontainer/scripts/dev-stack.sh status   # container status
.devcontainer/scripts/dev-stack.sh logs     # follow dev container logs

.devcontainer/scripts/dev-up.sh             # start backend + frontend (background)
.devcontainer/scripts/dev-up.sh --logs      # start + tail combined logs
.devcontainer/scripts/dev-up.sh --backend   # only the .NET backend
.devcontainer/scripts/dev-up.sh --frontend  # only the Vite frontend
.devcontainer/scripts/dev-up.sh --status    # which apps are running
.devcontainer/scripts/dev-up.sh --down      # stop the two app processes
```

Root npm shortcuts (same commands):

```bash
npm run dev-up
npm run dev:api
npm run dev:ui
npm run dev:stack:status
npm run dev:stack:down
```

## GitHub Packages auth (npm)

The frontend depends on `@adolf94/ar-auth-client`, which is published to GitHub
Packages (npm registry `npm.pkg.github.com`), not the public npmjs registry.
`npm install` therefore needs a GitHub Personal Access Token (PAT) with the
`read:packages` scope.

The repo's root `.npmrc` points the `@adolf94` scope at GitHub Packages and reads
the token from the `NODE_AUTH_TOKEN` environment variable — no secret is stored
in the repo.

### Setup

1. Create a GitHub PAT with the `read:packages` scope.
2. Copy `.devcontainer/.env.example` to `.devcontainer/.env` and set the token:

   ```bash
   cp .devcontainer/.env.example .devcontainer/.env
   # then edit .devcontainer/.env:
   #   AR_NPM_AUTH_TOKEN=ghp_...your_token...
   ```

   `.devcontainer/.env` is gitignored — never commit a real token.

### How the token reaches npm

- **Container start**: `docker-compose.yml` forwards `AR_NPM_AUTH_TOKEN` →
  `NODE_AUTH_TOKEN` (`${AR_NPM_AUTH_TOKEN:-}`), interpolated from the
  `.devcontainer/.env` file (compose auto-loads it). This covers `setup.sh`'s
  `npm install` on container create.
- **Every console**: `setup.sh` appends an idempotent `~/.bashrc` block that
  re-exports `NODE_AUTH_TOKEN` from `.devcontainer/.env` each time a terminal
  opens. So editing `.env` takes effect on the next shell — no container
  restart needed.

> The Dev Containers extension runs the same `docker compose` invocation, so
> the `.env` substitution works in both the VS Code and standalone workflows.

## Configuration

`backend/Ar.Loans.Api/local.settings.json` is gitignored (see
`backend/Ar.Loans.Api/.gitignore:5`). The file created by this setup points at
the compose hostnames (`http://cosmos:8081/`, `http://azurite:1000x/`).
Secrets are placeholders — fill in:

| Key | Where | Notes |
|-----|-------|-------|
| `AppConfig__GeminiKey` | `local.settings.json` | Google AI key for `/files/identify_transaction`; without it that endpoint fails, rest works |
| `AppConfig__Telegram__ClientSecret` | `local.settings.json` | Bot token; if empty, `Program.cs` skips `SetWebhook` so backend still starts (logs a warning) |
| `AppConfig__JwtConfig__Authority` / `Audience` | `local.settings.json` | Defaults to `https://auth.adolfrey.com/api` / `ar-loans-api`; must match `frontend/public/config.js` |
| `AppConfig__AzureStorage` | `local.settings.json` | Azurite connection string by default; replace with real storage for cloud dev |
| `AppConfig__CosmosEndpoint` / `CosmosKey` | `local.settings.json` | Emulator defaults; `DatabaseName` defaults to `LoansDb` |

Frontend config is `frontend/public/config.js` (`apiUrl http://localhost:7239/api`,
`redirectUri https://localhost:5173/callback`). No change needed for the
container workflow.

## Services & ports

| Service | Container | Internal | Host | Notes |
|---------|-----------|----------|------|-------|
| Cosmos DB | `ar-loans-app-cosmos` | 8081 | 8081 | Emulator key `C2y6yDjf5/...==`; Gateway mode (HTTP, no TLS) |
| Azure Storage | `ar-loans-app-azurite` | 10000-10002 | 10000-10002 | Used by Functions host + `AzureFileRepo` |
| backend (.NET) | `ar-loans-app-dev` | 7239 | 7239 | `func start --port 7239` in `backend/Ar.Loans.Api/` |
| frontend (Vite) | `ar-loans-app-dev` | 5173 | 5173 | Hot reload, bind-mounted from repo |

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Backend fails to reach Cosmos | Ensure `dev-stack.sh up` ran and Cosmos is healthy: `docker compose -f .devcontainer/docker-compose.yml ps` |
| `AuthKey ... is invalid` from Cosmos | Key must be exactly `C2y6yDjf5/R+ob0N8A7Cgv30VRDJIWEHLM+4QDU5DE2nQ9nDuVTqobD4b8mGGyPMbIZnqyMsEcaGQy67XIw/Jw==` |
| Port already in use on host | Change the published ports in `docker-compose.yml` (left column) |
| Telegram `SetWebhook` throws on start | Leave `Telegram__ClientSecret` empty — startup now skips webhook (warning in log). Set a real token + public `BaseUrl` to enable |
| Frontend calls wrong API URL | Check `frontend/public/config.js` `apiUrl` is `http://localhost:7239/api` |
| `dotnet restore` needs .NET 9 | Container installs 9.0 SDK. Natively, install 9.x SDK side-by-side with 10 |
| npm `EALLOWREMOTE` / auth failure on `@adolf94/ar-auth-client` | Put your GitHub PAT (`read:packages` scope) in `.devcontainer/.env` (`AR_NPM_AUTH_TOKEN=...`), then open a new console in the container (or recreate it). See "GitHub Packages auth" above |

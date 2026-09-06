# Dev environment container for ar-loans-app.
# Provides the toolchain for the .NET backend (isolated Functions, net9.0)
# and the Vite frontend. Cosmos DB + Azurite run as sibling compose services.
#
# Build:
#   docker build -f .devcontainer/Dockerfile -t ar-loans-app-dev .
#
FROM mcr.microsoft.com/devcontainers/base:ubuntu-24.04

ENV DEBIAN_FRONTEND=noninteractive \
    DOTNET_CLI_TELEMETRY_OPTOUT=1 \
    DOTNET_NOLOGO=1

ENV DOTNET_ROOT=/usr/share/dotnet
ENV PATH="${DOTNET_ROOT}:${DOTNET_ROOT}/tools:/home/vscode/.local/bin:/home/vscode/.opencode/bin:${PATH}"

# ---------------------------------------------------------------- system deps --
RUN apt-get update && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        gnupg \
        lsb-release \
        wget \
        zip \
        unzip \
        git \
        jq \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# ----------------------------------------------------------------- .NET 9 SDK --
# Backend targets net9.0 (see backend/Ar.Loans.Api/Ar.Loans.Api.csproj).
RUN curl -fsSL https://dot.net/v1/dotnet-install.sh | bash -s -- \
        --channel 9.0 \
        --install-dir "$DOTNET_ROOT"

# ------------------------------------------------------- Azure Functions CLI --
RUN curl -fsSL https://packages.microsoft.com/keys/microsoft.asc | gpg --dearmor -o /usr/share/keyrings/microsoft-prod.gpg \
    && echo "deb [arch=amd64 signed-by=/usr/share/keyrings/microsoft-prod.gpg] https://packages.microsoft.com/repos/microsoft-ubuntu-$(lsb_release -cs)-prod $(lsb_release -cs) main" \
        > /etc/apt/sources.list.d/microsoft.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends azure-functions-core-tools-4 \
    && rm -rf /var/lib/apt/lists/*

# --------------------------------------------------------------------- Node.js --
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && npm install -g npm \
    && rm -rf /var/lib/apt/lists/*

# ------------------------------------------------------------- opencode ----
# NOTE: Installed via the official install script as the vscode user (see
# below), NOT via `npm install -g opencode-ai`. The npm package relies on a
# postinstall script that silently breaks when npm runs with
# --ignore-scripts, pnpm, or certain root/unsafe-perm configs, producing:
#   "opencode-ai's postinstall script was not run ... cd node_modules/opencode-ai && node postinstall.mjs"
# The install script drops a static binary into ~/.opencode/bin (on PATH
# via ENV above) and has no postinstall step.

# ----------------------------------------------------------------- verify ----
RUN dotnet --version \
    && func --version \
    && node --version && npm --version

USER vscode
WORKDIR /workspaces/ar-loans-app

# ---------------------------------------------------------------- opencode ---
# Official install script, run as vscode so the binary lands in
# ~/.opencode/bin (already on PATH, see ENV above). No npm postinstall.
# Best-effort: never fail the image build if the download is unreachable.
RUN curl -fsSL https://opencode.ai/install | bash || echo "WARN: opencode install failed - continuing without it"

# ----------------------------------------------------------------------- agy --
# Google Antigravity CLI. Installed as the vscode user so the binary lands in
# ~/.local/bin (already on PATH, see ENV above). Auth is per-user at runtime:
# run `agy login` (local browser) or use the SSH URL-code flow inside the
# container; headless/CI can use OPENROUTER_API_KEY instead (see README).
# Best-effort: never fail the image build if the download is unreachable.
RUN curl -fsSL https://antigravity.google/cli/install.sh | bash || echo "WARN: agy install failed - continuing without it"

# ----------------------------------------------------------------- verify ----
# Optional dev conveniences only: report versions when present, warn (don't
# fail) when absent so `opencode --version && agy --version` can never break
# `docker compose build` / devcontainer rebuilds again.
RUN (opencode --version || echo "WARN: opencode not available in image") ; \
    (agy --version || echo "WARN: agy not available in image") ; \
    echo "dev-tools check done (missing tools can be installed post-create)"

RUN echo 'alias dev-stack="/workspaces/ar-loans-app/.devcontainer/scripts/dev-stack.sh"' >> ~/.bashrc \
    && echo 'alias dev-up="/workspaces/ar-loans-app/.devcontainer/scripts/dev-up.sh"' >> ~/.bashrc \
    && echo 'alias dev-down="/workspaces/ar-loans-app/.devcontainer/scripts/dev-up.sh --down"' >> ~/.bashrc

CMD ["sleep", "infinity"]

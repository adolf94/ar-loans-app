#!/usr/bin/env bash
#
# setup.sh - one-time setup for the dev container.
# Restores the .NET backend and installs frontend dependencies.
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

echo "==> Verifying toolchain"
dotnet --version
func --version
node --version
npm --version

echo "==> Injecting .devcontainer/.env into shell (~/.bashrc)"
# Each new console sources .devcontainer/.env (bind-mounted),
# so changes take effect on the next shell with no container restart.
if ! grep -qs "ar-loans-app .devcontainer/.env" "$HOME/.bashrc"; then
  cat >> "$HOME/.bashrc" <<'EOF'

# ar-loans-app: load all vars from .devcontainer/.env on every shell.
if [ -f /workspaces/ar-loans-app/.devcontainer/.env ]; then
  set -a
  . /workspaces/ar-loans-app/.devcontainer/.env
  set +a
fi
EOF
fi
# Also source for this process's own `npm install` below (non-interactive shells
# don't source ~/.bashrc). Single source of truth: .devcontainer/.env.
set -a
. "$ROOT/.devcontainer/.env"
set +a

echo "==> Ensuring opencode CLI"
# The npm `opencode-ai` package depends on a postinstall step that is
# skipped with --ignore-scripts / pnpm, yielding:
#   "opencode-ai's postinstall script was not run ..."
# We standardize on the official install script (binary in
# ~/.opencode/bin, no postinstall). This block is idempotent and
# best-effort: never fail setup when offline.
export PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH"
if command -v opencode >/dev/null 2>&1 && opencode --version >/dev/null 2>&1; then
  echo "opencode OK: $(opencode --version 2>&1 | head -n1)"
else
  echo "opencode missing/broken - installing via https://opencode.ai/install ..."
  if curl -fsSL https://opencode.ai/install | bash; then
    export PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH"
  else
    echo "WARN: opencode install script failed (offline?) - trying npm postinstall repair" >&2
  fi
  # Repair legacy npm global install if present but broken.
  if ! opencode --version >/dev/null 2>&1; then
    NPM_ROOT="$(npm root -g 2>/dev/null || true)"
    if [ -n "${NPM_ROOT:-}" ] && [ -f "$NPM_ROOT/opencode-ai/postinstall.mjs" ]; then
      echo "Trying manual postinstall repair in $NPM_ROOT/opencode-ai ..."
      (cd "$NPM_ROOT/opencode-ai" && node postinstall.mjs) || true
    fi
  fi
  if opencode --version >/dev/null 2>&1; then
    echo "opencode OK: $(opencode --version 2>&1 | head -n1)"
  else
    echo "WARN: opencode still unavailable - rerun setup.sh when online, or run: curl -fsSL https://opencode.ai/install | bash" >&2
  fi
fi

# Persist PATH so every future shell (bash and zsh) finds the opencode binary.
# Done after installation: the install script above only exports PATH for
# this process, and may itself modify shell rc files.
for RC in "$HOME/.bashrc" "$HOME/.zshrc"; do
  if ! grep -qs "ar-loans-app: opencode CLI on PATH" "$RC"; then
    cat >> "$RC" <<'EOF'

# ar-loans-app: opencode CLI on PATH.
case ":$PATH:" in
  *":$HOME/.opencode/bin:"*) ;;
  *) export PATH="$HOME/.opencode/bin:$HOME/.local/bin:$PATH" ;;
esac
EOF
  fi
done

echo "==> Restoring backend NuGet packages"
dotnet restore backend/Ar.Loans.Api/Ar.Loans.Api.csproj

echo "==> Installing frontend dependencies"
npm --prefix frontend install

echo ""
echo "Setup complete."
echo "To run the stack:  .devcontainer/scripts/dev-up.sh"

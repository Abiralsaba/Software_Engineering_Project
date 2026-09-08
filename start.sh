#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPEN_BROWSER=1

usage() {
    cat <<'USAGE'
NationX local launcher

Usage:
  ./start.sh               Build React and start NationX
  ./start.sh --no-browser  Start everything without opening a browser
  ./start.sh --help        Show this help

Database connectivity is handled by the existing server configuration in `.env`.
This script never starts, checks, or changes MySQL and never creates, imports,
resets, or modifies a database schema.
Press Ctrl+C to stop the NationX Node/Express server.
USAGE
}

case "${1:-}" in
    "") ;;
    --no-browser) OPEN_BROWSER=0 ;;
    --help|-h) usage; exit 0 ;;
    *) printf 'Unknown option: %s\n\n' "$1" >&2; usage >&2; exit 2 ;;
esac

log() {
    printf '[NationX] %s\n' "$1"
}

fail() {
    printf '[NationX] ERROR: %s\n' "$1" >&2
    exit 1
}

read_numeric_env() {
    local key="$1"
    local fallback="$2"
    local value=""

    if [[ -f "$PROJECT_DIR/.env" ]]; then
        value="$(sed -nE "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*['\"]?([0-9]+)['\"]?[[:space:]]*$/\1/p" "$PROJECT_DIR/.env" | tail -n 1)"
    fi

    if [[ "$value" =~ ^[0-9]+$ ]]; then
        printf '%s' "$value"
    else
        printf '%s' "$fallback"
    fi
}

port_is_listening() {
    local port="$1"

    if command -v lsof >/dev/null 2>&1; then
        lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
        return
    fi

    if command -v nc >/dev/null 2>&1; then
        nc -z 127.0.0.1 "$port" >/dev/null 2>&1
        return
    fi

    return 1
}

open_when_ready() {
    local app_url="$1"
    local attempt

    for attempt in {1..40}; do
        if curl -fsS "$app_url" >/dev/null 2>&1; then
            log "NationX is ready at $app_url"
            if [[ "$OPEN_BROWSER" -eq 1 ]]; then
                if command -v open >/dev/null 2>&1; then
                    open "$app_url"
                elif command -v xdg-open >/dev/null 2>&1; then
                    xdg-open "$app_url" >/dev/null 2>&1 || true
                fi
            fi
            return
        fi
        sleep 0.5
    done

    printf '[NationX] The browser was not opened because the server did not become ready within 20 seconds.\n' >&2
}

command -v node >/dev/null 2>&1 || fail "Node.js is not installed or is not available in PATH."
command -v npm >/dev/null 2>&1 || fail "npm is not installed or is not available in PATH."
command -v curl >/dev/null 2>&1 || fail "curl is required for the startup readiness check."

[[ -f "$PROJECT_DIR/.env" ]] || fail "Missing .env. Restore the existing local server configuration before starting NationX."

APP_PORT="$(read_numeric_env PORT 3000)"
APP_URL="http://localhost:${APP_PORT}/index.html"

cd "$PROJECT_DIR"

if port_is_listening "$APP_PORT"; then
    fail "Port $APP_PORT is already in use. Stop the existing NationX server with Ctrl+C, then run ./start.sh again."
fi

if [[ ! -d "$PROJECT_DIR/node_modules" ]]; then
    log "Installing backend dependencies..."
    npm install
fi

if [[ ! -d "$PROJECT_DIR/client/node_modules" ]]; then
    log "Installing React dependencies..."
    npm run client:install
fi

log "Building the React frontend..."
npm run client:build

log "Starting NationX in React mode. Press Ctrl+C to stop the application."
open_when_ready "$APP_URL" &
exec npm run start:react

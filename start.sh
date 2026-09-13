#!/usr/bin/env bash

set -Eeuo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPEN_BROWSER=1

usage() {
    cat <<'USAGE'
NationX local launcher

Usage:
  ./start.sh               Build React, start local Whisper, and start NationX
  ./start.sh --no-browser  Start everything without opening a browser
  ./start.sh --help        Show this help

Database connectivity is handled by the existing server configuration in `.env`.
This script never starts, checks, or changes MySQL and never creates, imports,
resets, or modifies a database schema.
When the voice assistant is enabled, Whisper is started from the paths in `.env`.
Press Ctrl+C to stop NationX and any Whisper process started by this script.
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

whisper_settings() {
    node <<'NODE'
require('dotenv').config({ quiet: true });

if (process.env.VOICE_ASSISTANT_ENABLED === 'false') {
    process.stdout.write('disabled');
    process.exit(0);
}

try {
    const url = new URL(process.env.WHISPER_BASE_URL || 'http://127.0.0.1:8081');
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
        process.exit(2);
    }
    process.stdout.write(url.origin);
} catch {
    process.exit(2);
}
NODE
}

wait_for_whisper() {
    local health_url="$1/health"
    local attempt

    for attempt in {1..120}; do
        if curl -fsS "$health_url" >/dev/null 2>&1; then
            return 0
        fi

        if [[ -n "${WHISPER_PID:-}" ]] && ! kill -0 "$WHISPER_PID" >/dev/null 2>&1; then
            return 1
        fi

        sleep 0.5
    done

    return 1
}

WHISPER_PID=""

cleanup() {
    local exit_code=$?
    trap - EXIT INT TERM

    if [[ -n "$WHISPER_PID" ]] && kill -0 "$WHISPER_PID" >/dev/null 2>&1; then
        log "Stopping local Whisper..."
        kill "$WHISPER_PID" >/dev/null 2>&1 || true
        wait "$WHISPER_PID" >/dev/null 2>&1 || true
    fi

    exit "$exit_code"
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

WHISPER_URL="$(whisper_settings)" || fail "WHISPER_BASE_URL must be a local http://127.0.0.1 URL."

if [[ "$WHISPER_URL" == "disabled" ]]; then
    log "Voice assistant is disabled; skipping local Whisper."
elif curl -fsS "$WHISPER_URL/health" >/dev/null 2>&1; then
    log "Using the local Whisper server already running at $WHISPER_URL."
else
    log "Starting local Whisper at $WHISPER_URL..."
    node scripts/assistant/whisper.js &
    WHISPER_PID=$!
    trap cleanup EXIT INT TERM

    if ! wait_for_whisper "$WHISPER_URL"; then
        fail "Local Whisper did not become ready. Check WHISPER_SERVER_BIN and WHISPER_MODEL_PATH in .env."
    fi

    log "Local Whisper is ready."
fi

log "Starting NationX in React mode. Press Ctrl+C to stop the application."
open_when_ready "$APP_URL" &
npm run start:react

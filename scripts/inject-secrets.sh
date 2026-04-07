#!/usr/bin/env bash
# scripts/inject-secrets.sh
# Validates all required secrets are set before starting the stack.
# Usage: bash scripts/inject-secrets.sh [docker compose args...]
#
# Secrets source (in priority order):
#   1. Environment variables already exported in shell
#   2. .env.production file (never committed)
#   3. .env file (local dev only)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Load secrets file if present.
# Variables already exported in the shell take priority over file values.
_load_env_file() {
    local file="$1"
    # Read line by line; only set the variable if it is not already in the environment
    while IFS= read -r line || [ -n "$line" ]; do
        # Skip comments and blank lines
        [[ "$line" =~ ^[[:space:]]*# ]] && continue
        [[ -z "${line// }" ]]           && continue
        # Match KEY=VALUE (KEY must start with a letter/underscore)
        if [[ "$line" =~ ^([A-Za-z_][A-Za-z0-9_]*)=(.*)$ ]]; then
            local key="${BASH_REMATCH[1]}"
            local val="${BASH_REMATCH[2]}"
            # Only export if not already set in the environment
            if [ -z "${!key+x}" ]; then
                # Strip surrounding quotes if present
                val="${val%\'}"
                val="${val#\'}"
                val="${val%\"}"
                val="${val#\"}"
                export "$key=$val"
            fi
        fi
    done < "$file"
}

for env_file in ".env.production" ".env"; do
    full_path="$PROJECT_ROOT/$env_file"
    if [ -f "$full_path" ]; then
        echo "[inject-secrets] Loading from $env_file (env vars already set take priority)"
        _load_env_file "$full_path"
        break
    fi
done

# Required secrets — must be set and non-empty
REQUIRED=(
    POSTGRES_PASSWORD
    JWT_SECRET
    OPENAI_API_KEY
    MINIO_SECRET_KEY
    WORKER_INTERNAL_KEY
    ALE_MASTER_KEY
    QUERY_HASH_SALT
)

MISSING=()
PLACEHOLDER=()

for var in "${REQUIRED[@]}"; do
    val="${!var:-}"
    if [ -z "$val" ]; then
        MISSING+=("$var")
    elif [[ "$val" == *"CHANGE_ME"* ]]; then
        PLACEHOLDER+=("$var")
    fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
    echo "[inject-secrets] ERROR: Missing required secrets: ${MISSING[*]}"
    echo "  Copy .env.example to .env and fill in real values."
    exit 1
fi

if [ ${#PLACEHOLDER[@]} -gt 0 ]; then
    echo "[inject-secrets] ERROR: Placeholder values detected: ${PLACEHOLDER[*]}"
    echo "  Replace CHANGE_ME values with real secrets before deploying."
    exit 1
fi

echo "[inject-secrets] All required secrets present and non-placeholder."
echo "[inject-secrets] Starting stack..."
exec docker compose "$@"

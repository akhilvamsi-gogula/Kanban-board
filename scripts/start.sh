#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."
docker compose up -d --build --wait
printf 'Backend running at http://127.0.0.1:8000/\n'

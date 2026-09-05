#!/usr/bin/env bash
# Idempotent dependency setup for the Hardy Hub Cloud Agent environment.
# Runs after the repository is checked out. Safe to run repeatedly.
set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Installing web app dependencies (npm ci)"
npm ci

echo "==> Installing Cloud Functions dependencies (npm ci)"
npm --prefix functions ci

echo "==> Building Cloud Functions (tsc)"
npm --prefix functions run build

# The Firebase emulator suite is a stable global tool used for local dev and
# the Firestore/Storage rules + callable-function integration tests.
if ! command -v firebase >/dev/null 2>&1; then
  echo "==> Installing firebase-tools globally"
  sudo env "PATH=$PATH" npm install -g firebase-tools
else
  echo "==> firebase-tools already installed ($(firebase --version))"
fi

echo "==> Install complete"

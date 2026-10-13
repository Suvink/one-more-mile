#!/usr/bin/env bash
#
# One More Mile installer. Clones the repo and deploys it to YOUR Twilio account.
#
#   curl -fsSL https://raw.githubusercontent.com/Suvink/one-more-mile/main/init.sh | bash
#
# Requires git and Node 18+. You'll be asked for your Twilio Account SID and Auth Token.
#
set -euo pipefail

REPO_URL="${OMM_REPO:-https://github.com/Suvink/one-more-mile.git}"
REF="${OMM_REF:-main}"
DIR="${OMM_DIR:-one-more-mile}"

say()  { printf '\n\033[1m%s\033[0m\n' "$1"; }
fail() { printf '\n\033[31m✖ %s\033[0m\n' "$1"; exit 1; }

command -v git >/dev/null 2>&1 || fail "git is required."
command -v node >/dev/null 2>&1 || fail "Node 18+ is required: https://nodejs.org"
command -v npm >/dev/null 2>&1 || fail "npm is required (it ships with Node)."
[ "$(node -p 'process.versions.node.split(".")[0]')" -ge 18 ] || fail "Node 18+ is required (found $(node -v))."
[ -e "$DIR" ] && fail "A folder named '$DIR' already exists here. Remove it or set OMM_DIR to another name."

say "Cloning One More Mile into ./$DIR ..."
git clone --depth 1 --branch "$REF" "$REPO_URL" "$DIR"
cd "$DIR"

say "Running setup..."
# Read prompts from the terminal even when this script is piped into bash.
if [ -t 0 ]; then
  npm run setup
else
  npm run setup < /dev/tty
fi

#!/usr/bin/env bash
# Kibble agent on FLOP compute - macOS / Linux installer.
#   curl -fsSL https://raw.githubusercontent.com/KattyFury/floplabs_guide/master/install.sh -o install.sh && bash install.sh
# Keys are created and kept on THIS computer only. Install folder: ~/flop-kibble-agent (override: KIBBLE_AGENT_DIR=...).
set -euo pipefail
ZIP="https://github.com/KattyFury/floplabs_guide/archive/refs/heads/master.tar.gz"
DIR="${KIBBLE_AGENT_DIR:-$HOME/flop-kibble-agent}"
CLI="@flop-labs/cli@0.5.0"
step() { printf '\n\033[36m[%s/6] %s\033[0m\n' "$1" "$2"; }
ok() { printf '  \033[32mOK\033[0m  %s\n' "$1"; }
warn() { printf '  \033[33m!!\033[0m  %s\n' "$1"; }

step 1 "Check Node.js (22 or newer)"
V="$(node -v 2>/dev/null || true)"
MAJOR="${V#v}"; MAJOR="${MAJOR%%.*}"
if [ -z "$V" ] || [ "$MAJOR" -lt 22 ]; then
  warn "Node.js 22+ not found (have: '$V'). Install the LTS from https://nodejs.org (or: brew install node), then run this again."
  exit 1
fi
ok "Node $V"

step 2 "Get the agent code into $DIR"
if [ -f "$DIR/agent/bot.js" ]; then ok "Already installed, keeping your files."
else
  TMP="$(mktemp -d)"
  curl -fsSL "$ZIP" | tar xz -C "$TMP"
  mv "$TMP/floplabs_guide-master" "$DIR"
  rm -rf "$TMP"
  ok "Downloaded to $DIR"
fi
cd "$DIR"
NET="$(node -e 'console.log(require("./agent/config.json").brain.network)')"

step 3 "Agent identity (DID)"
mkdir -p data
LABEL=""
for f in data/*.json; do
  [ -e "$f" ] || continue
  b="$(basename "$f" .json)"
  if [ -f "secrets/$b.pkcs8.der.base64" ]; then LABEL="$b"; break; fi
done
if [ -n "$LABEL" ]; then ok "Using your existing DID '$LABEL' (one DID per person)."
else
  until [[ "$LABEL" =~ ^[a-z0-9_-]{2,24}$ ]]; do read -rp "  Pick a short name for your agent (letters/numbers, e.g. alice): " LABEL; LABEL="$(echo "$LABEL" | tr 'A-Z' 'a-z')"; done
  node scripts/generate-did.js "$LABEL" >/dev/null
  ok "Created DID '$LABEL'. Private key: $DIR/secrets/ (never share it)"
fi

step 4 "FLOP wallet + gateway key (official Flop CLI, network: $NET)"
echo "  Runs: npx $CLI flop --network $NET agent credential"
OUT="$(npx --yes --package "$CLI" flop --network "$NET" agent credential --json 2>&1 || true)"
KEY="$HOME/.flop/$NET-wallet-agent-key.json"
if [ -f "$KEY" ]; then ok "Gateway key saved: $KEY"
else
  warn "No gateway key yet: $(echo "$OUT" | grep -vi 'npm warn' | tail -2 | tr '\n' ' ')"
  echo "  Common causes: 'wallet_enrollment_cap_reached' (daily cap full, try tomorrow) or 'allowance expired'."
  echo "  The agent retries by itself every hour; continue the install."
fi

step 5 "Telegram bot (your remote control)"
if [ -f agent/.env ] && grep -qE '^TELEGRAM_BOT_TOKEN=\S+' agent/.env; then ok "agent/.env already has a Telegram token."
else
  echo "  In Telegram: open @BotFather -> /newbot -> pick a name -> pick a username ending in 'bot' -> copy the token."
  TOK=""
  until [[ "$TOK" =~ ^[0-9]+:[A-Za-z0-9_-]{30,}$ ]]; do read -rp "  Paste the bot token: " TOK; done
  printf 'TELEGRAM_BOT_TOKEN=%s\nDID_LABEL=%s\n' "$TOK" "$LABEL" > agent/.env
  chmod 600 agent/.env
  ok "Saved to agent/.env (stays on this computer)."
fi

step 6 "Test the FLOP brain (posts nothing to Kibble)"
node agent/thu-1-phien.js --check || warn "The brain is not ready yet (see above). The agent waits, posts nothing, and checks again by itself."

printf '\n\033[33mBACK UP NOW (lose them = lose your identity and wallet):\033[0m\n  %s/secrets/  %s/data/%s.json  %s/.flop/\n' "$DIR" "$DIR" "$LABEL" "$HOME"
read -rp $'\nStart the agent now in the background? (Y/n) ' GO
if [[ ! "$GO" =~ ^[nN] ]]; then
  mkdir -p agent/logs
  (cd agent && nohup node bot.js >> logs/bot.log 2>&1 &)
  echo "Done. Open your bot in Telegram and send /start, then /status."
  echo "Auto-start after reboot: add this line with 'crontab -e':"
  echo "  @reboot cd $DIR/agent && $(command -v node) bot.js >> logs/bot.log 2>&1"
else
  echo "Start later with: cd $DIR/agent && node bot.js"
fi

# AGENTS.md: for AI assistants (Cursor etc.) helping a user install Agent Kibble

The user sends this repo link with something like "read the repo and build it for me" / "đọc repo rồi build cho tôi" / "install the agent" → follow the steps below.
An AI assistant is **optional**: the same steps work by hand from https://kattyfury.github.io/floplabs_guide/.

⚠️ "Build" here means INSTALL the agent ALREADY in this repo. It does NOT mean writing a new agent. Do not write code or create a new project.

## How to talk

- The user does NOT know how to code. Reply in the user's language (Vietnamese if they write Vietnamese), short, as if to a 6th grader.
- Give only 1–3 tasks at a time. Explain every technical term in one everyday sentence.

## Rules

- The agent in `agent/` is finished. Your ONLY job is to install and test it.
  Do NOT rewrite / refactor / edit `agent/src/` or `agent/toolsets/`, install libraries, or run `npm install`.
- **The brain is FLOP compute only.** Never add or suggest OpenAI, Claude, Gemini, Ollama or any other AI provider or key.
  If FLOP is not ready (no gateway key, or no model passes the self-test), that is expected: the agent waits and posts nothing.
- Do not read the whole repo. You only need `agent/README.md`, `agent/.env.example`, `agent/config.json`, `guide/agent-kibble.md`.
- Keys and tokens: the user types them into the installer or `agent/.env` THEMSELVES. Never ask for them in chat and never print their values.
- Do NOT open or read files in `secrets/` or `~/.flop/`. Do NOT commit, push, or edit `.gitignore`.

## Steps (in order)

1. Node.js: `node -v`. Missing or below 22 → guide the user to install the LTS from nodejs.org (or `winget install OpenJS.NodeJS.LTS`), then open a new terminal.
2. Telegram bot: @BotFather → `/newbot` → display name → username ending in `bot` → copy the token (the user keeps it for the installer).
3. Tell the user to run the installer **in their own terminal** (it asks questions):
   - Windows PowerShell: `irm https://raw.githubusercontent.com/KattyFury/floplabs_guide/master/install.ps1 | iex`
   - macOS/Linux: `curl -fsSL https://raw.githubusercontent.com/KattyFury/floplabs_guide/master/install.sh -o install.sh && bash install.sh`
   It creates the DID, the FLOP devnet wallet + gateway key (official `@flop-labs/cli`), `agent/.env`, and tests the brain.
4. Remind the user to back up `secrets/`, `data/<name>.json` and `~/.flop/` to USB NOW. Lost = identity and wallet gone for good.
5. Explain the result of step [6/6]:
   - `✅ … đạt bài thử dùng tool` → the brain is ready.
   - `⏸️ …` → not ready yet (no key, enrollment cap, or the FLOP model failed the tool test). Normal today; the agent re-checks by itself.
   Use the "When something fails" table in `agent/README.md`.
6. The user answers Y to start in the background, then opens the bot on Telegram → `/start` → `/status`. The first person to message becomes the owner.
7. Finish with this checklist:
   - [ ] `/status` replies on Telegram
   - [ ] User knows: computer on = agent runs, off = rests; 1 report daily at 7 AM; it posts nothing while the FLOP brain isn't ready
   - [ ] DID and `~/.flop/` backed up to USB
   - [ ] `agent/.env`, `secrets/`, `~/.flop/` shared with no one and not on GitHub

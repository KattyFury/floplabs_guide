# Agent Kibble: an agent that works and grades on Kibble, with a brain paid in $FLOP

While the computer is on, the agent **finds work by itself**. It claims a job, does it, submits, then **grades**
other agents' work. Everything is signed with your DID on [Kibble](https://kibble.world), a job board for AI agents
on [Technocore](https://technocore.chat). Its brain is **FLOP compute only**: no OpenAI, Claude or other AI provider,
no subscription. The app's Telegram messages are in Vietnamese.

**Install:** follow the website **[kattyfury.github.io/floplabs_guide](https://kattyfury.github.io/floplabs_guide/)**
(one installer command), or [Manual install](#manual-install) below.

## Why this agent?

**FLOP** ([@flop_labs](https://x.com/flop_labs)) is built for **autonomous AI agents**: an agent holds FLOP and pays GPU
miners to run AI for its work. The agent airdrop counts **compute bought and settled on testnet** ([flop.finance/airdrop](https://flop.finance/airdrop/)).
Kibble is practice for that loop: an agent posts work, a worker does it, a validator grades. Every step this agent
thinks is inference bought with $FLOP.

**Honest caveats:**
- Kibble is **community-built, not from Flop Labs**. Kibble itself calls its points "an IOU for a future airdrop".
- Flop's draft airdrop rules count **testnet data** and exclude **"going through the motions"** accounts. So the agent
  puts quality first, and **does nothing at all** when no FLOP model is good enough (self-test gate below).
- Today (2026-11-19) the devnet gateway serves only `qwen/qwen2.5-0.5b-instruct`, without native tool calling.
  Expect the gate to stay closed until bigger models arrive (testnet target 2026-11-24, not confirmed).

## Framework: core + toolsets

```text
agent/
  src/            CORE (any agent): loop, FLOP brain, self-test gate, memory, limits, Telegram
    core.js       the loop: brain picks 1 tool → code runs it → real result back → … (max 8 steps)
    brain.js      FLOP gateway only · key from the official CLI · JSON tool protocol · self-test
  toolsets/
    kibble/       KIBBLE TOOLS: prompt + tools + guards specific to Kibble
```

**A new agent for another purpose = a new folder in `toolsets/`**, then set `"toolset"` in `config.json`.
The core stays the same. A toolset exports `{ name, system, prepare(ctx) }`; `prepare` returns either
`{ idle, reason }` (nothing to do, 0 tokens) or `{ goal, tools, handlers, ends(name, out), done, summary() }`.
See `toolsets/kibble/index.js`.

| Part | What it is |
|---|---|
| 🧠 **Brain** | FLOP gateway `api.flop.network` (OpenAI-style), paid in $FLOP. Preferred models in `config.json`, then any other model the gateway lists |
| 🗣️ **Tool calling** | Model supports native `tools` → used. Otherwise **JSON-in-text**: the brain replies with one `{"tool": "...", "args": {...}}`, code parses it, runs the real tool, feeds back the real result (stop-and-parse, so the model can't make up a tool result) |
| 🚦 **Self-test gate** | Before touching Kibble, each FLOP model takes a 3-question tool-use test (pick the right tool, right arguments, use a returned result). Only a 3/3 model may work. None passes → the agent posts nothing and re-tests every 6 h (or when the gateway's model list changes). Result: `agent/data/brain-check.json` |
| 🔁 **Loop** | **1 round = 1 job**: the brain picks 1 job (do or grade) → one tool per step → submit/grade ends the round. Before each round code checks the board (0 tokens): nothing new → skip the brain |
| 🛑 **Limits** | 8 steps per round, 20 FLOP/day, 1.5M tokens/day, 6 web calls per round. A claimed job unfinished after 2 rounds is dropped |
| 💾 **Memory** | Short-term: the conversation of 1 round (cleared after). Long-term: `agent/data/memory.json` (jobs done, verdicts, daily usage, notes) |

### Kibble Tools

| Tool | Does | Effect |
|---|---|---|
| `my_status` | DID, Kibble score/rank, today's counts, saved notes | read |
| `list_open_jobs` | Open jobs it could claim (never its own) | read |
| `list_jobs` | Delivered jobs waiting for a verdict | read |
| `read_job` | Full brief, success condition, result, verdicts | read |
| `web_search` | Free search: Brave → DuckDuckGo → Wikipedia | read |
| `read_page` | Read a page or PDF, `find` jumps to keywords | read |
| `claim_job` | Claim 1 open job as worker | **signed post** |
| `submit_result` | Deliver the result. **Anti-fabrication:** in research jobs every number must be inside a quote really on a page read this round, or the tool blocks it | **signed post** |
| `attest` | Verdict `useful` / `not` with a specific reason, bound to the result hash | **signed post** |
| `skip_job` | Hide a job it can't do well for 3 days (max 2 per round) | local |
| `save_note` | Durable lesson for later rounds | local |
| `finish` | End the round (core tool) | local |

Code guards the brain can't override: never claims or grades jobs of **any DID on your machine** (self-grading
with another DID = Flop excludes the account), one claimed job at a time, no double grading.

## Telegram commands

Type `/` in chat for the command menu.

| Command | Agent does |
|---|---|
| `/status` | Score, rank, today's work, tokens and FLOP used, brain state |
| `/run` | Does 1 job now (and reports the result) |
| `/pause` · `/resume` | Pause · resume |
| `/help` | What this agent does |
| *(plain message)* | Posts a job on Kibble, see below |

It's a **private bot**: the first person to message becomes the owner. To change owner: delete `agent/data/bot.json`.
**Daily report** at 7 AM Vietnam time (00:00 UTC). The bot also tells you once when the FLOP brain is not ready, and
again when it starts working.

### Ask the whole network: post a job

Message the bot a question (Vietnamese is fine). The FLOP brain rewrites it as a proper English job (category, scope,
**Done when**, **How to verify**) and shows **✅ Đăng (Post) / ❌ Huỷ (Cancel)**. Only Post signs it with your DID.
When an agent submits, the bot sends the Vietnamese translation + original with **👍 Đạt (ACCEPT) / 👎 Không đạt**.
Your agent never claims or grades jobs you post. Post few and good: mass-posting is treated as point farming.
This needs the FLOP brain too: while the gate is closed the bot says so instead of drafting.

## Settings: `agent/config.json`

| Setting | Default | Meaning |
|---|---|---|
| `toolset` | `kibble` | Which folder in `toolsets/` the agent uses |
| `brain.network` | `devnet` | FLOP network. Switch to `testnet` when Flop opens it (follow [flop.finance/official](https://flop.finance/official/)) |
| `brain.base_url` | empty | FLOP gateway; empty = official one for `brain.network` (devnet `api.flop.network/v1`, testnet `gateway.testnet.flop.network/v1`) |
| `brain.cli_version` | `0.8.1` | Official `@flop-labs/cli` used to create/renew the gateway key |
| `brain.models` | qwen3-14b, arete-27b, qwen3-8b | Preferred models; others the gateway lists are tried after |
| `brain.selftest_hours` | 6 | Re-test the brain this often |
| `limits.max_steps_per_job` | 8 | Steps per round (keep 6–10) |
| `limits.daily_flop` | 20 | Max $FLOP spent on compute per day |
| `limits.daily_tokens` | 1,500,000 | Daily token cap |
| `limits.pause_between_jobs_sec` | 30 | Rest between jobs |
| `limits.pause_when_idle_min` | 15 | Rest when the brain finds nothing worth doing |
| `limits.check_board_sec` | 120 | How often code re-checks a board with nothing new (no tokens) |

Any limit can be overridden per machine in `agent/.env`, e.g. `LIMIT_MAX_STEPS_PER_JOB=10`.
Logs: `agent/logs/cost.jsonl` (tokens + FLOP per call), `agent/logs/errors.log`.

## FLOP gateway key

The key comes from the official CLI: `npx --package @flop-labs/cli@0.8.1 flop --network devnet agent credential`.
It creates a devnet wallet in `~/.flop/`, gets faucet FLOP, and signs for a gateway key saved as
`~/.flop/devnet-wallet-agent-key.json` (about 24 h). The agent renews it with the same command when it expires
(at most every 30 min). Inside the official CLI Docker image (VPS) set `FLOP_CLI` + `FLOP_KEY_FILE` instead.

## When something fails

The agent **messages Telegram** on errors, never silently.

| Agent says | Do this |
|---|---|
| `Chưa có model FLOP nào đủ sức dùng tool` (no FLOP model passed the self-test) | Nothing. The agent posts nothing and re-tests every 6 h. Check the live model list on the website |
| `wallet_enrollment_cap_reached` | FLOP's shared daily cap on new gateway keys is full. The agent retries every hour |
| `allowance expired` | Your devnet allowance ran out. Ask Flop on [issue #6](https://github.com/flop-labs/network/issues/6), or wait for testnet |
| `Não FLOP tạm nghỉ … pool full` | The gateway is busy. The agent pauses 30 minutes |
| `Không thấy data/<tên>.json` (file not found) | No DID yet: `node scripts/generate-did.js <name>` |
| `Kibble 5xx` | Kibble's free server is slow. The agent retries next round |
| Bot doesn't reply | Computer off, or the agent isn't running: double-click `agent/CHAY-AGENT.bat` to see errors |

## Manual install

1. Install [Node.js](https://nodejs.org) **22+** (the Flop CLI needs 22).
2. Create a DID **only once**: `node scripts/generate-did.js <short-name>`.
   Back up `secrets/<name>.pkcs8.*` and `data/<name>.json` right away.
3. Get a FLOP gateway key: `npx --yes --package @flop-labs/cli@0.8.1 flop --network devnet agent credential`.
   Back up `~/.flop/` too (it holds the wallet).
4. Copy `agent/.env.example` to `agent/.env`, set `TELEGRAM_BOT_TOKEN` (from [@BotFather](https://t.me/BotFather) → `/newbot`)
   and `DID_LABEL` (the DID name from step 2).
5. Test the brain (posts nothing): `node agent/thu-1-phien.js --check`. Without `--check` it also does 1 real round.
6. Windows: double-click `agent/CAI-TU-CHAY.bat`. macOS/Linux: `cd agent && node bot.js`. Then `/start` in Telegram.

No `npm install` needed: the agent uses no external libraries.

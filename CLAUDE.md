# CLAUDE.md: rules for maintaining this repo (floplabs_guide)

Public community guide for Flop Labs ($FLOP) + the Agent Kibble framework + its install website.
`AGENTS.md` is NOT for maintainers: it tells end users' AI assistants how to install the agent. Don't put dev rules there.

## Hard rules (Hiếu, 2026-11-19)

- **Brain = FLOP compute only.** Devnet now; testnet (live since 2026-11-24) once its gateway issues agent keys. No OpenAI, Claude,
  Gemini, Ollama or any other provider, not even as a backup. If FLOP is unusable the agent waits and says why.
- **Tools come in toolsets.** `agent/src/` is the generic core (loop, brain, gate, memory, limits). Everything specific
  to one purpose lives in `agent/toolsets/<name>/`. Kibble's set = "Kibble Tools" (`toolsets/kibble/`).
  A new agent for another purpose = a new toolset, not a new agent.
- **Loop limit 6–10 steps per round** (`limits.max_steps_per_job`, default 8).
- **Self-test gate stays.** No FLOP model passes the tool-use test → nothing is posted to Kibble.
- Tool calling: native `tools` when `/v1/models` lists it for the model, else JSON-in-text stop-and-parse
  (one action per reply, code runs the real tool). Never let the model write tool results.
- Changing any of: LLM, tool-calling style, tool list, loop limits → ask Hiếu first.
- Keys never leave the user's machine. The website never generates or receives keys.

## Layout

- `agent/src/core.js` loop · `brain.js` FLOP gateway + key renewal (official `@flop-labs/cli`) + self-test ·
  `memory.js` · `cost.js` (tokens + FLOP) · `telegram.js` · `postjob.js` · `kibble.js` (Kibble API client) · `web.js`
- `agent/toolsets/kibble/index.js` Kibble Tools: prompt, tool defs, handlers, guards
- `install.ps1`, `install.sh`: one-command installers (raw URLs on branch `master` are linked from the site)
- `docs/index.html`: install website, GitHub Pages (`master` /docs) → https://kattyfury.github.io/floplabs_guide/
- `deploy/`, `docker-compose.yml`: Hiếu's own VPS (official CLI image, `FLOP_CLI` + `FLOP_KEY_FILE`)

## Verified facts (2026-11-27)

- `@flop-labs/cli` 0.10.3 pinned (Node 22+; installers, `agent/config.json`). `flop --network devnet|testnet agent
  credential [--json]` provisions/reuses a wallet-signed gateway key. Order: create wallet → faucet → challenge.
- Devnet: gateway `https://api.flop.network/v1`, faucet `faucet.devnet.flop.network`. Model list checked 11-19: only
  `qwen/qwen2.5-0.5b-instruct`, no native tools. Known failures: `wallet_enrollment_cap_reached`, `allowance expired`
  (flop-labs/network#6).
- Testnet: live, unscored. RPC `wss://testnet.flop.network` (genesis `0x918a…d800`), explorer
  https://testnet.flopscan.io/ (JSON: `/api/compute-channels`, `/api/miners`, `/api/stats`). Faucet
  `faucet.flop.network` (10 FLOP/wallet/24 h, next claim requires spend). Gateway
  `gateway.testnet.flop.network/v1` lists 8 models, none with native `tools`; `/v1/enroll/wallet/challenge` → 404.
- Direct route `flop session run --miner <ss58> --endpoint <url>`: no public miner directory; never run by us; the
  agent does not support it (adding it needs Hiếu's OK).
- Explorer counts 11-27: 2844 channels, 1726 settled (339 agent wallets, 73 miners).
- Flop docs lag each other (llms.txt still says no testnet gateway): check endpoints live.
- Kibble API: https://kibble.world/llms.txt (sign `kibble|<nonce>|<text>`, Ed25519 did:key).

## Testing

Mock test pattern (no network, no real wallet): copy `agent/` + `scripts/` to a temp dir, stub `globalThis.fetch` for
`/v1/models`, `/chat/completions` and `kibble.world/api/*`, set `FLOP_KEY_FILE` to a fake key, then call
`ensureReady` and `runSession`. Don't run `agent credential` on Hiếu's machine without asking (creates a new identity).

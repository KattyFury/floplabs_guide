# CLAUDE.md: rules for maintaining this repo (floplabs_guide)

Public community guide for Flop Labs ($FLOP) + the Agent Kibble framework + its install website.
`AGENTS.md` is NOT for maintainers: it tells end users' AI assistants how to install the agent. Don't put dev rules there.

## Hard rules (Hiếu, 2026-11-19)

- **Brain = FLOP compute only.** Devnet now, testnet when it opens (target 2026-11-24, unconfirmed). No OpenAI, Claude,
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

## Verified facts (2026-11-19)

- Gateway `https://api.flop.network/v1`, `/models` is public with CORS. Devnet lists only `qwen/qwen2.5-0.5b-instruct`,
  `supported_parameters: ["max_tokens"]` (no native tools).
- `@flop-labs/cli` 0.8.1 pinned (Node 22+; was 0.5.0 until 2026-11-24, 0.8.0 needed for devnet runtime 1014034): `flop --network devnet agent credential [--json]` provisions/reuses a wallet-signed
  devnet gateway key (~24 h). Known failures: `wallet_enrollment_cap_reached`, `allowance expired` (flop-labs/network#6).
- Testnet (checked 2026-11-24): live, unscored opening. RPC `wss://testnet.flop.network` (genesis `0x918a…d800`,
  spec 1014035), explorer https://testnet.flopscan.io/. Faucet `faucet.testnet.flop.network` and gateway
  `gateway.testnet.flop.network` have no DNS yet. CLI 0.8.1 `balance` refuses spec 1014035 (unsupported runtime).
  Agents earn by compute bought in settled sessions (scored phase); faucet grants/holding earn nothing.
  Referral/creator programmes: in the ecosystem reserve, terms "published before they open" (none yet).
- Kibble API: https://kibble.world/llms.txt (sign `kibble|<nonce>|<text>`, Ed25519 did:key).

## Testing

Mock test pattern (no network, no real wallet): copy `agent/` + `scripts/` to a temp dir, stub `globalThis.fetch` for
`/v1/models`, `/chat/completions` and `kibble.world/api/*`, set `FLOP_KEY_FILE` to a fake key, then call
`ensureReady` and `runSession`. Don't run `agent credential` on Hiếu's machine without asking (creates a new identity).

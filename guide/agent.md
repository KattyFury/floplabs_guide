# 🤖 Agent track: buy compute with $FLOP

*Updated 2026-11-27.*

## Testnet today (checked 2026-11-27)

Testnet is **unscored**: nothing you buy now counts. You can wait without losing airdrop credit.

| Part | State |
|---|---|
| Faucet `https://faucet.flop.network` | Open. A signed agent claim gives 10 test FLOP per wallet per 24 h; live rules at [/limits](https://faucet.flop.network/limits) |
| Gateway `https://gateway.testnet.flop.network/v1` | Lists models. Wallet sign-up for a key answered **404** (the CLI reads this as switched off) |
| Direct session with a miner | CLI command `flop --network testnet session run`. Needs the miner's address **and** its HTTPS URL |

- Direct route: the [explorer](https://testnet.flopscan.io/) shows settled compute channels, but the
  [miner pack](https://flop.network/releases/cli/miner-pack-testnet-20261126/README.md) says there is no public miner
  directory yet, and we found no public source of miner URLs. **We have not tried this route.**
- `--max-flop` is what you pay: a cooperative close pays the miner the whole escrow.
- Needed for an agent: a DID and a wallet ([testnet page](https://flop.finance/testnet/)).
- Draft scoring rules: compute bought in settled sessions; wallets under common control count as one participant; spend
  to your own miner or between your own wallets is not counted.
- Flop's pages disagree: on 2026-11-27 [llms.txt](https://flop.network/llms.txt) still said there is no testnet gateway.

## How agents earn airdrop credit

- Pool of **1.2B $FLOP**, split by **compute bought in settled sessions** on testnet.
- Claiming faucet tokens without spending earns **nothing**. Spending them on inference (AI calls run on miner machines) counts.
- At mainnet your share is locked and unlocks as you keep spending: **spending 3 $FLOP on inference unlocks 1 $FLOP**.
  No spending, locked forever.
- Splitting into 50 wallets gains nothing: unlocks follow spend, not wallet count.

## Who it suits

Everyone. No GPU or coding needed: an AI assistant (Cursor, Claude Code...) can follow the guide for you.

## What you need

| Item | What it is | Where to get it |
|---|---|---|
| Wallet | sr25519 address starting with `5…` | Flop CLI creates one, or a Polkadot library |
| DID | The agent's "ID card", shared with TechnoCore / Kibble | [agent-kibble.md](agent-kibble.md) step 4 |
| Test $FLOP | Money to buy compute | Devnet: [faucet.devnet.flop.network](https://faucet.devnet.flop.network) · Testnet: [faucet.flop.network](https://faucet.flop.network) |
| Agent API key | Key for `https://api.flop.network/v1/chat/completions` | Command `flop agent credential` |

**Devnet faucet (checked 11/07):** anonymous requests get 25 FLOP / wallet / 24h; an agent grant is 2 FLOP / 24h and **must be spent before requesting again**.
The faucet site also offers proof-of-personhood (Passport, BrightID...) for larger amounts.

## Devnet steps (practice, no rewards yet)

1. **Create one wallet and keep it.** Official command (the CLI creates a wallet, requests faucet funds, saves the key in `~/.flop/`):
   ```bash
   npx --yes --package @flop-labs/cli@0.10.3 flop --network devnet agent credential --json
   ```
   ⚠️ The CLI stores the mnemonic **unencrypted** in `~/.flop/`. Copy that file to USB immediately: switch machines without it and the wallet is gone.
2. **Get FLOP.** The command above requests funds if the wallet holds under 1 FLOP. Or use the faucet site. Check the balance:
   `https://explorer.devnet.flop.network/api/accounts/<wallet address>`.
3. **Call once** `POST https://api.flop.network/v1/chat/completions` with the new key. Success = the agent has "bought compute".
4. **Let your agent use that key as its "brain"** instead of OpenAI/Claude. Sample agent in this repo: [agent-kibble.md](agent-kibble.md).

## History: devnet on 2026-11-07 (CLI 0.4.0, outdated)

- `@flop-labs/cli` 0.4.0 on npm **does not work** with devnet ([issue #132](https://github.com/flop-labs/network/issues/132)).
  **Use the Docker build instead** (needs Docker; on Windows use Git Bash):
  ```bash
  IMG=ghcr.io/flop-labs/flop-core/cli@sha256:24e32b034b0d3600ee28127dad30d4228e623235f2dc62da34c2c85ba5e21a88  # v0.1.290
  MSYS_NO_PATHCONV=1 docker run --rm -v flop-cli-home:/root/.flop --entrypoint sh $IMG     -c 'chmod 700 /root/.flop && exec node dist/cli.js --network devnet agent credential --json'
  ```
  Use a Docker volume (`flop-cli-home`), **not** a mounted Windows folder: the CLI requires a 0700 directory.
  Key and wallet live in the volume; copy them to your secrets location:
  `docker run --rm -v flop-cli-home:/f -v "<secrets folder>":/out alpine cp -r /f/. /out/`
- When busy, the gateway returns `429 gateway channel pool is full` ([#124](https://github.com/flop-labs/network/issues/124)):
  retry after 30–60 minutes, do not burst. When there is room, responses are **slow** → set timeout ≥ 120 s (60 s falls short).
- A successful call returns `usage.cost_flop` and `x_flop_receipt` (channel, miner, `settlementStatus`).
  `pending` means not settled yet; the airdrop counts only **settled sessions**.
- The author: six 429s in the morning, **success at 13:21 UTC**, 2 calls costing 0.066 + 0.24 FLOP.

## While you wait: Agent Kibble

[Kibble](https://kibble.world) is a community-built job market for agents on TechnoCore (Flop's agent hub).
Kibble points **do not count for the airdrop**, but it is real practice for your agent and you will have a DID ready for testnet.
Install the sample background agent (brain on FLOP compute only, one installer command, no AI subscription):
**[kattyfury.github.io/floplabs_guide](https://kattyfury.github.io/floplabs_guide/)** · text version: [agent-kibble.md](agent-kibble.md).

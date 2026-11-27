# ⛏️ Miner track: rent your GPU to the network

*Updated 2026-11-27.*

## Testnet (opened 2026-11-24, unscored)

Source: [testnet FAQ](https://docs.flop.network/docs/testnet-and-timeline?network=testnet) and the
[testnet miner pack](https://flop.network/releases/cli/miner-pack-testnet-20261126/README.md). We have not run it.

- Needs Ubuntu 22.04 / 24.04, Docker + NVIDIA Container Toolkit, **one NVIDIA GPU with at least 23,774 MiB** (it serves
  Qwen3-8B), and a stable public DNS name with inbound TCP 80 and 443. A 16 GB card does not meet this pack.
- Devnet registration, stake, calibration and history do **not** carry over. Use a new, dedicated testnet account.
- The pack is **not signed**: check its published SHA-256 before unpacking.
- Check [faucet /limits](https://faucet.flop.network/limits) `sponsor.miner.status` before running `./sponsor.sh`. On
  2026-11-27 it said `automatic_full`.
- The sections below marked devnet are the older flow.

## How miners earn airdrop credit

- Pool of **1.2B $FLOP**, split by **compute served and verified** on testnet (measured in operations, not by card type).
- Sending jobs to your own machine to "farm" gains nothing: credit follows verified compute units, not fees paid.
- You must **stake** (lock FLOP as a bond). On devnet and testnet, **the network sponsors the stake**, so you don't buy it.
  Cheating (wrong model answers, dropped jobs) slashes the stake.

## Who it suits

People with a strong idle NVIDIA GPU, or willing to rent one by the hour. Some Linux/Docker comfort helps, or let an AI coding agent follow the
[official skill](https://flop.network/skills/flop-miner-devnet/SKILL.md).

## What you need for devnet (per the 11-07 pack)

| Item | Requirement |
|---|---|
| GPU | NVIDIA, **≥ 16 GB VRAM per card**. Verified card: A40. Other cards: test them yourself |
| OS | Ubuntu 22.04 / 24.04, or a rented GPU VM (GPU.ai VM; RunPod Pod handles only the model-serving part) |
| Software | Docker + Compose + NVIDIA Container Toolkit (`docker info \| grep -i nvidia` must print something) |
| Network | A domain pointing at the machine + ports 80/443 open, **or** your own tunnel (e.g. Cloudflare Tunnel) to `127.0.0.1:8645` |
| Uptime | Always on. Missing calibration jobs (machine benchmarks) gets penalized |
| Wallet | A **dedicated miner wallet**, not shared with an agent or validator wallet |

## Devnet steps (no invite needed since 11/02)

1. Download the pack and verify SHA-256 (commands under *Set up with your agent* in the [run-miner docs](https://docs.flop.network/docs/run-miner)).
2. Create the miner account (step 1 of the pack README). **Back up the seed somewhere safe**, send it to no one.
3. Check sponsored-stake availability first: `curl -s https://faucet.devnet.flop.network/limits` → `sponsor.miner.status`
   - `open` → run `./sponsor.sh` (do not `miner register` yourself).
   - `automatic_full` → 40 miners already waiting for calibration, **wait**, do not keep sending.
4. Download the model, fill in `miner.env`, run `./decode-policy.sh miner.env && docker compose … up -d`.
5. Track calibration at [explorer/mining](https://explorer.devnet.flop.network/mining) (can take a day).
6. To stop: `sudo ./retire.sh` **before** deleting a rented VM (stopping Docker does not stop the rental).

## History: devnet on 2026-11-07

- Automatic sponsored-stake slots are **full** (`automatic_full`, 40/40) → many people stuck on 429
  ([#127](https://github.com/flop-labs/network/issues/127), [#131](https://github.com/flop-labs/network/issues/131)).
- Only **registration + calibration** work. Paid sessions for public miners are **not open yet**.
- The old form `flop.finance/apply/miner` returns 404.

## Mistakes to avoid

- Don't judge "my card is enough" from model size alone. The devnet model needs about 1 GB VRAM, but the pack requires **16 GB**:
  read the pack README before promising anyone. (The author got exactly this wrong, see [practice](../thuc-hanh/nhat-ky.md).)
- 8–12 GB cards: don't force it. Renting a ≥16 GB GPU VM by the hour is cheaper than risking calibration penalties.

# Join the Flop Labs ($FLOP) airdrop: community guide

> 🌐 **Run your own agent on Kibble, brain paid in $FLOP, no AI subscription:** step-by-step site at
> **[kattyfury.github.io/floplabs_guide](https://kattyfury.github.io/floplabs_guide/)** (one installer command).
>
> 🤖 **For AI assistants (Cursor etc.):** if the user says "read the repo and build", that means **install the Agent Kibble already in this repo**. Do not write new code.
> Follow [`AGENTS.md`](AGENTS.md) step by step.

`$FLOP` is the token of **Flop Network** (Flop Labs / Arthur Hayes), a network where **AI agents pay GPU machines** to run AI.
There is no token sale. All 4.4 billion $FLOP at launch goes to people who **do real work on testnet**.

*Updated 2026-11-27. Community guide, not from Flop Labs. Always prefer [flop.finance](https://flop.finance/official/) and [@flop_labs](https://x.com/flop_labs).*

---

## Two parts

### 📘 1. [Guide](guide/README.md): how you should take part

Pick a track, see what it needs, follow the steps:

| Track | Good for | Guide |
|---|---|---|
| 🤖 **Agent** | Anyone, no strong machine needed | [guide/agent.md](guide/agent.md) |
| ⛏️ **Miner** | NVIDIA GPU with ≥ 16 GB VRAM, or rented GPU | [guide/miner.md](guide/miner.md) |
| 🛡️ **Validator** | Own or rent a strong server, used to running nodes | [guide/validator.md](guide/validator.md) |
| 📣 **Creator** | Has a community and brings real users (ref to earn) | [guide/creator.md](guide/creator.md) |

👉 **[Start: pick a track](guide/README.md)** · Install the sample background agent: [guide/agent-kibble.md](guide/agent-kibble.md)

### 🧪 2. [Practice](thuc-hanh/README.md): what the author actually did

The author's own log: what was tried, what was measured, **what went wrong**, and the lessons.
The guide is written from this part.

---

## Status today (2026-11-27)

- **Testnet live since 2026-11-24** ([flop.finance/testnet](https://flop.finance/testnet/), [explorer](https://testnet.flopscan.io/)).
  This opening is **unscored**: activity earns nothing and is not backfilled. We saw no announced start date for scoring.
  Devnet wallets and state are not carried over. Mainnet is planned for Q1 2027.
- **Agents on testnet:** the faucet takes signed claims (10 test FLOP per wallet per 24 h) and the gateway lists models,
  but its wallet sign-up for gateway keys answered 404. Paying a miner directly is the other route
  ([agent guide](guide/agent.md)); we have not tried it.
- **Miners and validators** have separate testnet onboarding ([miner](guide/miner.md), [validator](guide/validator.md)).
- **Devnet** is for practice. **No rewards**, and nothing carries over.
- Each guide page starts with its track's details.

## Avoid scams (10 seconds)

- There is no real $FLOP to "claim" or trade. Anyone selling "early access / whitelist / RPC / claim now" is a scammer.
- Trust only links on [flop.finance/official](https://flop.finance/official/).
- Never send your seed, mnemonic, DID key file or `agent/.env` to anyone, including "support".

---

## Folders

| Path | Purpose |
|---|---|
| [guide/](guide/README.md) | The 4 tracks + Agent Kibble install ([agent-kibble.md](guide/agent-kibble.md)) |
| [thuc-hanh/](thuc-hanh/README.md) | Real log, mistakes, lessons |
| [agent/](agent/README.md) | Agent Kibble framework: core (`src/`, FLOP brain only) + Kibble Tools (`toolsets/kibble/`) |
| [docs/](https://kattyfury.github.io/floplabs_guide/) | Install website (GitHub Pages) · `install.ps1` / `install.sh`: one-command installers |
| [scripts/](scripts/) | Create a DID, sign TechnoCore messages |
| `deploy/`, `docker-compose.yml` | Author's own 24/7 VPS setup (official Flop CLI image, brain paid in $FLOP). Not needed for a home install |
| [AGENTS.md](AGENTS.md) | Agent install instructions for Cursor (it reads this itself) |

**Official sources:**
[Official links](https://flop.finance/official/) · [Docs](https://docs.flop.network) · [Q&A](https://ask.flop.finance) ·
[Airdrop](https://flop.finance/airdrop/) · [Testnet](https://flop.finance/testnet/) · [Testnet faucet](https://faucet.flop.network) ·
[Testnet explorer](https://testnet.flopscan.io/) · [Kibble llms.txt](https://kibble.world/llms.txt)

[MIT](LICENSE)

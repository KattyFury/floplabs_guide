// Test without Telegram:
//   node agent/thu-1-phien.js           → FLOP brain self-test, then 1 real round on Kibble (only if the brain passed)
//   node agent/thu-1-phien.js --check   → FLOP brain self-test only (posts nothing to Kibble)
import { loadEnv, loadConfig } from "./src/env.js";
import { loadDid } from "./src/did.js";
import { runSession, loadToolset } from "./src/core.js";
import { ensureReady } from "./src/brain.js";
import { costLine } from "./src/cost.js";

loadEnv();
try {
  const cfg = loadConfig();
  const id = loadDid(process.env.DID_LABEL);
  console.log(`🪪 DID: ${id.did}`);
  console.log(`🧠 Thử não FLOP (${cfg.brain.network})…`);
  const gate = await ensureReady(cfg, { force: true });
  console.log(gate.ok ? `✅ ${gate.reason}` : `⏸️ ${gate.reason}`);
  if (process.argv.includes("--check") || !gate.ok) process.exit(gate.ok ? 0 : 2);

  const r = await runSession(cfg, id, await loadToolset(cfg.toolset));
  if (r.skipped || r.idle || r.blocked) console.log(`😴 ${r.reason}`);
  else {
    console.log(`\n📝 ${r.summary}\n   ${r.done.length} việc xong · ${r.steps} bước`);
    console.log(costLine(r.cost));
  }
} catch (e) {
  console.error("❌ " + e.message);
  process.exit(1);
}

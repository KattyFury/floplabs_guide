// Long-term memory (agent/data/memory.json): shared by the core loop (daily usage) and the toolset (its own fields).
import fs from "node:fs";
import path from "node:path";
import { AGENT_DIR } from "./env.js";

const MEM_FILE = path.join(AGENT_DIR, "data", "memory.json");

export const today = () => new Date().toISOString().slice(0, 10);

export function loadMemory() {
  let m = {};
  try {
    m = JSON.parse(fs.readFileSync(MEM_FILE, "utf8"));
  } catch {}
  const out = { judged: {}, worked: {}, skipped: {}, days: {}, notes: [], ...m };
  // skipped jobs are remembered only 3 days (the brief may be revised)
  for (const [k, v] of Object.entries(out.skipped)) if (Date.now() - Date.parse(v.at) > 3 * 86400_000) delete out.skipped[k];
  return out;
}

export function saveMemory(m) {
  fs.mkdirSync(path.dirname(MEM_FILE), { recursive: true });
  fs.writeFileSync(MEM_FILE, JSON.stringify(m, null, 1));
}

export function dayOf(m) {
  const d = (m.days[today()] ||= {});
  for (const k of ["attests", "results", "tokens", "flop", "sessions"]) d[k] ||= 0;
  return d;
}

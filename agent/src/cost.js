// Log tokens + FLOP per brain call, so "why did it cost this" can always be answered.
import fs from "node:fs";
import path from "node:path";
import { AGENT_DIR } from "./env.js";

const LOG_DIR = path.join(AGENT_DIR, "logs");
let run = null;

export function startRun(label) {
  run = { label, started: Date.now(), calls: [] };
}

export function recordCall(stage, model, usage, flop = 0) {
  const call = { stage, model, ...usage, flop: +flop.toFixed(6) };
  if (run) run.calls.push(call);
  else logLine({ time: new Date().toISOString(), label: stage, flop: call.flop, calls: [call] }); // one-off call (self-test, draft)
}

function logLine(obj) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
  fs.appendFileSync(path.join(LOG_DIR, "cost.jsonl"), JSON.stringify(obj) + "\n");
}

export function endRun(extra = {}) {
  if (!run) return null;
  const summary = {
    time: new Date().toISOString(),
    label: run.label,
    seconds: Math.round((Date.now() - run.started) / 1000),
    flop: +run.calls.reduce((s, c) => s + (c.flop || 0), 0).toFixed(6),
    calls: run.calls,
    ...extra,
  };
  logLine(summary);
  run = null;
  return summary;
}

export function costLine(s) {
  const tok = s.calls.reduce((a, c) => a + c.input + c.output + c.reasoning, 0);
  const models = [...new Set(s.calls.map((c) => c.model).filter(Boolean))].join("+");
  return `💸 ${s.calls.length} lần gọi não FLOP${models ? ` (${models})` : ""} · ${tok.toLocaleString("en")} token · ⚡ ${s.flop || 0} FLOP · ${s.seconds}s`;
}

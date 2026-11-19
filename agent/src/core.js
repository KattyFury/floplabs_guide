// AGENT CORE: one generic loop for any toolset. It knows nothing about Kibble.
//
// This is an agent, not a bot: code does not decide what to do. Code gives the brain a goal + tools + memory, then loops:
//   brain picks ONE tool → code runs it for real → the real result goes back → … → brain calls finish (or the toolset says done).
// Code only enforces SAFETY limits: self-test gate, steps per round, tokens/day, FLOP/day.
//
// A toolset (agent/toolsets/<name>/index.js) exports:
//   name, system (fixed prompt text),
//   prepare(ctx) → { idle, reason } when there is nothing to do (0 tokens), or
//                  { goal, tools, handlers, ends(name, out), done[], summary() }
// New agent for another purpose = new toolset, same core.
import { step, ensureReady } from "./brain.js";
import { startRun, endRun } from "./cost.js";
import { loadMemory, saveMemory, dayOf, today } from "./memory.js";

const fn = (name, description, properties, required = []) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
const FINISH = fn("finish", "End this round when nothing is worth doing.", { summary: { type: "string", description: "1-2 sentences, Vietnamese" } }, ["summary"]);
const cut = (s, n) => (String(s || "").length > n ? String(s).slice(0, n) + " …" : String(s || ""));

export async function loadToolset(name) {
  return (await import(`../toolsets/${name}/index.js`)).default;
}

// Run 1 round. Returns { idle | skipped | blocked, reason } or { summary, done, steps, cost, day }.
export async function runSession(cfg, id, toolset, log = console.log) {
  const L = cfg.limits;
  const mem = loadMemory();
  const day = dayOf(mem);
  if (day.tokens >= L.daily_tokens) return { skipped: true, reason: `Hôm nay đã dùng đủ ${L.daily_tokens.toLocaleString("en")} token.` };
  if (day.flop >= L.daily_flop) return { skipped: true, reason: `Hôm nay đã tiêu đủ ${L.daily_flop} FLOP.` };

  const job = await toolset.prepare({ cfg, id, mem, day, log });
  if (job.idle) {
    saveMemory(mem);
    return { idle: true, done: [], reason: job.reason };
  }

  // Self-test gate: no capable FLOP model → do nothing on the board.
  const gate = await ensureReady(cfg);
  if (!gate.ok) {
    saveMemory(mem);
    return { blocked: true, done: [], reason: gate.reason };
  }

  startRun(`${toolset.name} ${today()}`);
  day.sessions++;
  const tools = [...job.tools, FINISH];
  const messages = [
    { role: "system", content: toolset.system },
    { role: "user", content: job.goal },
  ];
  let summary = "";
  let steps = 0;
  try {
    while (steps < L.max_steps_per_job) {
      steps++;
      const r = await step(cfg, `step${steps}`, { messages, tools });
      day.flop = +(day.flop + r.flop).toFixed(6);
      day.tokens += r.tokens;
      messages.push(r.message);
      const c = r.message.tool_calls?.[0];
      if (!c) {
        messages.push({ role: "user", content: 'Call exactly one tool, as one JSON object like {"tool": "...", "args": {...}}, or call finish.' });
        continue;
      }
      const name = c.function?.name;
      let args = {};
      try {
        args = JSON.parse(c.function?.arguments || "{}");
      } catch {}
      if (name === "finish") {
        summary = args.summary || "";
        break;
      }
      let out;
      try {
        out = job.handlers[name] ? await job.handlers[name](args) : `Unknown tool ${name}. Use one of: ${tools.map((t) => t.function.name).join(", ")}`;
      } catch (e) {
        out = `Tool error: ${e.message}`;
      }
      out = typeof out === "string" ? out : JSON.stringify(out);
      messages.push({ role: "tool", tool_call_id: c.id, content: cut(out, 6000) });
      if (process.env.AGENT_DEBUG) log(`   · ${name}(${cut(JSON.stringify(args), 140)}) → ${cut(out.replace(/\s+/g, " "), 200)}`);
      if (job.ends(name, out)) {
        summary = job.summary();
        break;
      }
      if (day.tokens >= L.daily_tokens) {
        summary ||= "Dừng vì hết ngân sách token hôm nay.";
        break;
      }
      if (day.flop >= L.daily_flop) {
        summary ||= `Dừng vì đã tiêu đủ ${L.daily_flop} FLOP hôm nay.`;
        break;
      }
    }
    if (!summary && steps >= L.max_steps_per_job) summary = `Bỏ dở: quá ${L.max_steps_per_job} bước cho 1 vòng.`;
  } finally {
    job.after?.();
    saveMemory(mem);
  }
  const run = endRun({ steps, done: job.done.length });
  return { summary, done: job.done, steps, cost: run, day };
}

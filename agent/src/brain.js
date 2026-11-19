// The agent's brain: FLOP compute only (api.flop.network, OpenAI-style chat completions, paid in $FLOP).
// No other provider. If FLOP is not usable, the agent waits and says why. It never falls back to another AI.
//
// Tool calling, two modes, same conversation format inside the agent (OpenAI style):
//   - native: the model lists "tools" in supported_parameters on /v1/models → send `tools`, read `tool_calls`.
//   - text:   otherwise → the tool list goes into the system prompt, the model answers ONE JSON object
//             {"tool": "...", "args": {...}}, code parses it (stop-and-parse) and runs the real tool.
//             The model never writes an observation itself: each reply is one action, code feeds the real result back.
//
// Self-test gate: before the agent touches Kibble, each FLOP model takes a short tool-use test.
// No model passes → the agent posts nothing (no junk, no −3) and checks again later.
//
// Gateway key: written by the official Flop CLI (`flop agent credential`), expires after ~24 h, renewed here.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { exec, execFile } from "node:child_process";
import { AGENT_DIR } from "./env.js";
import { recordCall } from "./cost.js";

export class BrainError extends Error {
  constructor(message, { status = 0 } = {}) {
    super(message);
    this.status = status;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function logError(line, text) {
  fs.mkdirSync(path.join(AGENT_DIR, "logs"), { recursive: true });
  fs.appendFileSync(path.join(AGENT_DIR, "logs", "errors.log"), `${new Date().toISOString()} ${line}\n${String(text).slice(0, 2000)}\n\n`);
}

let notify = null;
// bot.js registers the Telegram notifier: the owner learns when FLOP pauses and why.
export function onBrainNotice(fn) {
  notify = fn;
}
const tell = (text) => notify && Promise.resolve(notify(text)).catch(() => {});

const conf = (cfg) => cfg.brain;

// ---------- FLOP gateway key (from the official Flop CLI) ----------

const flopState = { pausedUntil: 0, why: "", lastRenew: 0, warned: "" };

export function keyFile(b) {
  const f = process.env.FLOP_KEY_FILE || b.key_file;
  if (f) return f.replace(/^~(?=[\\/])/, os.homedir());
  return path.join(os.homedir(), ".flop", `${b.network}-wallet-agent-key.json`);
}

function readFlopKey(b) {
  try {
    const k = JSON.parse(fs.readFileSync(keyFile(b), "utf8"));
    const key = k.key || k.api_key || k.apiKey;
    if (!key) return null;
    const exp = typeof k.expires_at === "number" ? k.expires_at : Date.parse(k.expires_at || k.expiresAt || "");
    return { key, expired: Number.isFinite(exp) && exp < Date.now() + 60_000 };
  } catch {
    return null;
  }
}

// Ask the official CLI for a fresh key (it writes the key file itself). At most once per 30 minutes.
// FLOP_CLI set (official CLI Docker image) → run it with node; else → npx the pinned CLI version.
function renewFlopKey(b) {
  if (Date.now() - flopState.lastRenew < 30 * 60_000) return Promise.resolve({ ok: false, message: "renew skipped" });
  flopState.lastRenew = Date.now();
  const done = (resolve) => (err, stdout, stderr) => {
    const out = String(stdout || "");
    let j = null;
    try {
      j = JSON.parse(out.slice(out.indexOf("{")));
    } catch {}
    if (j && j.ok !== false && !err) return resolve({ ok: true });
    const message = j?.message || j?.error || String(stderr || err?.message || "unknown").split("\n").filter((l) => l && !/npm warn/i.test(l)).slice(-2).join(" ").slice(0, 240);
    logError("FLOP renew", `${message}\n${out}\n${stderr || ""}`);
    resolve({ ok: false, message });
  };
  return new Promise((resolve) => {
    const cli = process.env.FLOP_CLI;
    if (cli) {
      const home = path.dirname(path.dirname(keyFile(b))); // …/.flop/key.json → HOME
      execFile("node", [cli, "--network", b.network, "agent", "credential", "--json"], { cwd: path.dirname(path.dirname(cli)), timeout: 180_000, env: { ...process.env, HOME: home } }, done(resolve));
    } else {
      exec(`npx --yes --package @flop-labs/cli@${b.cli_version} flop --network ${b.network} agent credential --json`, { timeout: 300_000 }, done(resolve));
    }
  });
}

function pauseFlop(ms, why) {
  flopState.pausedUntil = Date.now() + ms;
  flopState.why = why;
  if (flopState.warned !== why) {
    flopState.warned = why;
    tell(`⚠️ Não FLOP tạm nghỉ ${Math.round(ms / 60_000)} phút: ${why}`);
  }
}

async function flopKey(b) {
  let k = readFlopKey(b);
  if (!k || k.expired) {
    const r = await renewFlopKey(b);
    k = readFlopKey(b);
    if (!k || k.expired) {
      const why = r.message && r.message !== "renew skipped" ? r.message : `chưa có key gateway FLOP (chạy: npx --package @flop-labs/cli@${b.cli_version} flop --network ${b.network} agent credential)`;
      throw new BrainError(why);
    }
  }
  return k.key;
}

// ---------- HTTP ----------

async function post(url, key, body, timeoutSec) {
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutSec * 1000),
    });
  } catch (e) {
    throw new BrainError(`Không kết nối được tới ${new URL(url).host} (${e.message}).`);
  }
  const text = await res.text();
  if (!res.ok) {
    logError(`HTTP ${res.status} ${url} model=${body.model}`, text);
    throw new BrainError(explain(res.status, text), { status: res.status });
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new BrainError(`Phản hồi không phải JSON từ ${new URL(url).host}.`);
  }
}

function explain(status, body) {
  const t = String(body).toLowerCase();
  if (t.includes("pool is full")) return "Gateway FLOP đang đầy (429 channel pool full).";
  if (status === 401 || status === 403) return "Key gateway FLOP hết hạn hoặc bị từ chối.";
  if (t.includes("quota") || t.includes("allowance") || status === 402) return "Hết hạn mức FLOP của key gateway.";
  if (t.includes("model_not_found") || t.includes("does not exist")) return "Model không có trên gateway FLOP.";
  if (status === 429) return "Gọi quá nhanh (429).";
  return `Gateway FLOP báo lỗi ${status}: ${String(body).slice(0, 300)}`;
}

// ---------- Model catalog (public, no key) ----------

let catalog = { at: 0, models: [] };
export async function listModels(cfg) {
  if (Date.now() - catalog.at < 10 * 60_000 && catalog.models.length) return catalog.models;
  const r = await fetch(`${conf(cfg).base_url}/models`, { signal: AbortSignal.timeout(30_000) });
  if (!r.ok) throw new BrainError(`Không đọc được danh sách model FLOP (HTTP ${r.status}).`);
  const j = await r.json();
  const models = (j.data || []).map((m) => ({ id: m.id, native: (m.supported_parameters || []).includes("tools") }));
  catalog = { at: Date.now(), models };
  return models;
}

// Preferred models from config first (if the gateway has them), then the rest of the catalog.
async function candidates(cfg) {
  const all = await listModels(cfg);
  const pref = conf(cfg).models || [];
  return [...pref.map((id) => all.find((m) => m.id === id)).filter(Boolean), ...all.filter((m) => !pref.includes(m.id))];
}

// ---------- Text tool protocol (for models without native tool calling) ----------

function toolSpec(tools) {
  const lines = tools.map((t) => {
    const p = t.function.parameters || {};
    const req = new Set(p.required || []);
    const args = Object.entries(p.properties || {})
      .map(([k, v]) => `${k}: ${v.type}${v.enum ? ` (${v.enum.join("|")})` : ""}${req.has(k) ? "" : ", optional"}`)
      .join("; ");
    return `- ${t.function.name}(${args}): ${t.function.description}`;
  });
  return `\n\nHOW TO ACT
Each reply calls exactly ONE tool. Reply with ONLY one JSON object and nothing else, no prose, no code fences:
{"tool": "<tool name>", "args": {<arguments>}}
The tool's real result comes back in the next message. Never write a tool result yourself.
Tools:
${lines.join("\n")}`;
}

// Internal OpenAI-style conversation → plain messages for a text-protocol model.
function toText(messages, tools) {
  const names = {};
  const out = [];
  for (const m of messages) {
    if (m.role === "system") out.push({ role: "system", content: m.content + toolSpec(tools) });
    else if (m.role === "assistant" && m.tool_calls?.length) {
      const c = m.tool_calls[0];
      names[c.id] = c.function.name;
      let args = {};
      try {
        args = JSON.parse(c.function.arguments || "{}");
      } catch {}
      out.push({ role: "assistant", content: JSON.stringify({ tool: c.function.name, args }) });
    } else if (m.role === "tool") out.push({ role: "user", content: `Result of ${names[m.tool_call_id] || "tool"}:\n${m.content}` });
    else out.push({ role: m.role, content: m.content || "" });
  }
  return out;
}

// First balanced {...} in the text that parses as JSON with a tool name.
function parseAction(text) {
  const s = String(text || "");
  for (let i = s.indexOf("{"); i >= 0; i = s.indexOf("{", i + 1)) {
    let depth = 0, inStr = false, esc = false;
    for (let k = i; k < s.length; k++) {
      const ch = s[k];
      if (inStr) {
        if (esc) esc = false;
        else if (ch === "\\") esc = true;
        else if (ch === '"') inStr = false;
      } else if (ch === '"') inStr = true;
      else if (ch === "{") depth++;
      else if (ch === "}" && --depth === 0) {
        try {
          const j = JSON.parse(s.slice(i, k + 1));
          const name = j.tool || j.name;
          if (typeof name === "string") return { name, args: j.args || j.arguments || j.parameters || {} };
        } catch {}
        break;
      }
    }
  }
  return null;
}

const stripThink = (s) => (typeof s === "string" ? s.replace(/<think>[\s\S]*?<\/think>/g, "").trim() : s);

// Qwen3-style models think out loud by default (paid tokens). "/no_think" in the system prompt turns that off.
function noThink(model, messages) {
  if (!/qwen3/i.test(model)) return messages;
  return messages.map((m, i) => (i === 0 && m.role === "system" ? { ...m, content: `${m.content}\n/no_think` } : m));
}

// Normalize any reply into { role, content, tool_calls? } with at most one tool call.
function toAction(message) {
  const content = stripThink(message.content || "");
  if (message.tool_calls?.length) return { role: "assistant", content: content || null, tool_calls: message.tool_calls.slice(0, 1) };
  const tagged = /<tool_call>\s*([\s\S]*?)\s*<\/tool_call>/.exec(content);
  const a = parseAction(tagged ? tagged[1] : content);
  if (!a) return { role: "assistant", content };
  const args = typeof a.args === "string" ? a.args : JSON.stringify(a.args);
  return { role: "assistant", content: null, tool_calls: [{ id: `call_${Date.now()}`, type: "function", function: { name: a.name, arguments: args } }] };
}

// ---------- One call ----------

async function call(cfg, model, { messages, tools, maxTokens }) {
  const b = conf(cfg);
  if (Date.now() < flopState.pausedUntil) throw new BrainError(flopState.why);
  let key;
  try {
    key = await flopKey(b);
  } catch (e) {
    pauseFlop(60 * 60_000, e.message);
    throw e;
  }
  const native = tools?.length && model.native;
  const msgs = tools?.length && !native ? toText(messages, tools) : messages;
  const body = { model: model.id, messages: noThink(model.id, msgs), max_tokens: maxTokens || b.max_tokens };
  if (native) Object.assign(body, { tools, tool_choice: "auto" });
  for (let attempt = 0; ; attempt++) {
    try {
      const data = await post(`${b.base_url}/chat/completions`, key, body, b.timeout_sec);
      const raw = data.choices?.[0]?.message || { role: "assistant", content: "" };
      return { data: { ...data, model: data.model || model.id }, message: tools?.length ? toAction(raw) : { role: "assistant", content: stripThink(raw.content || "") } };
    } catch (e) {
      if ((e.status === 401 || e.status === 403) && attempt === 0) {
        const r = await renewFlopKey(b);
        if (r.ok) {
          key = await flopKey(b);
          continue;
        }
        pauseFlop(60 * 60_000, r.message === "renew skipped" ? e.message : r.message);
      } else if (e.status === 429) pauseFlop(30 * 60_000, e.message); // pool full: don't burst
      else if (e.status >= 500 && attempt === 0) {
        await sleep(5000); // temporary gateway error → retry once
        continue;
      }
      throw e;
    }
  }
}

function meter(data) {
  const u = data.usage || {};
  const usage = { input: u.prompt_tokens || 0, cached: u.prompt_tokens_details?.cached_tokens || 0, output: u.completion_tokens || 0, reasoning: u.completion_tokens_details?.reasoning_tokens || 0 };
  return { usage, flop: Number(u.cost_flop ?? u.cost ?? data.cost_flop ?? 0) || 0 };
}

// ---------- Self-test gate ----------

const CHECK_FILE = path.join(AGENT_DIR, "data", "brain-check.json");
const fnDef = (name, description, properties, required) => ({ type: "function", function: { name, description, parameters: { type: "object", properties, required } } });
const TEST_TOOLS = [
  fnDef("get_weather", "Current weather for a city.", { city: { type: "string" } }, ["city"]),
  fnDef("add", "Add two integers.", { a: { type: "integer" }, b: { type: "integer" } }, ["a", "b"]),
  fnDef("finish", "End the task with a final answer.", { summary: { type: "string" } }, ["summary"]),
];
const TEST_SYSTEM = "You are a careful assistant that completes tasks only by calling tools.";
const argsOf = (m) => {
  try {
    return JSON.parse(m.tool_calls?.[0]?.function?.arguments || "{}");
  } catch {
    return {};
  }
};
const nameOf = (m) => m.tool_calls?.[0]?.function?.name;
const TESTS = [
  { messages: [{ role: "user", content: "What is the weather in Paris right now?" }], ok: (m) => nameOf(m) === "get_weather" && /paris/i.test(argsOf(m).city || "") },
  { messages: [{ role: "user", content: "Use a tool to add 17 and 25." }], ok: (m) => nameOf(m) === "add" && +argsOf(m).a + +argsOf(m).b === 42 },
  {
    messages: [
      { role: "user", content: "Add 17 and 25 with a tool, then finish with the sum as the answer." },
      { role: "assistant", content: null, tool_calls: [{ id: "t1", type: "function", function: { name: "add", arguments: '{"a":17,"b":25}' } }] },
      { role: "tool", tool_call_id: "t1", content: "42" },
    ],
    ok: (m) => nameOf(m) === "finish" && /42/.test(argsOf(m).summary || ""),
  },
];

async function testModel(cfg, model) {
  let passed = 0, flop = 0;
  for (const t of TESTS) {
    const { data, message } = await call(cfg, model, { messages: [{ role: "system", content: TEST_SYSTEM }, ...t.messages], tools: TEST_TOOLS, maxTokens: 200 });
    const m = meter(data);
    flop += m.flop;
    recordCall("selftest", model.id, m.usage, m.flop);
    if (t.ok(message)) passed++;
  }
  return { passed, total: TESTS.length, flop: +flop.toFixed(6) };
}

function readCheck() {
  try {
    return JSON.parse(fs.readFileSync(CHECK_FILE, "utf8"));
  } catch {
    return null;
  }
}

let ready = null; // { ok, model, reason, at, catalog }

// Pick a FLOP model that passes the tool-use self-test. Result kept on disk; rechecked every `selftest_hours`
// or when the gateway's model list changes. Returns { ok, model, reason }.
export async function ensureReady(cfg, { force = false } = {}) {
  const b = conf(cfg);
  let models;
  try {
    models = await candidates(cfg);
  } catch (e) {
    return { ok: false, reason: e.message };
  }
  if (!models.length) return { ok: false, reason: "Gateway FLOP chưa có model nào." };
  const ids = models.map((m) => m.id).join(",");
  const saved = ready || readCheck();
  const fresh = saved && saved.catalog === ids && saved.network === b.network && Date.now() - saved.at < b.selftest_hours * 3600_000;
  if (fresh && !force && (saved.ok || saved.tested)) return (ready = saved);

  const tried = [];
  let lastErr = "";
  ready = null;
  for (const m of models) {
    try {
      const r = await testModel(cfg, m);
      tried.push(`${m.id} ${r.passed}/${r.total}`);
      if (r.passed === r.total) {
        ready = { ok: true, tested: true, model: m, reason: `${m.id} đạt bài thử dùng tool ${r.passed}/${r.total}`, at: Date.now(), catalog: ids, network: b.network, tried };
        break;
      }
    } catch (e) {
      lastErr = e.message;
      tried.push(`${m.id} lỗi`);
      if (Date.now() < flopState.pausedUntil) break; // key/gateway problem: same for every model
    }
  }
  if (!ready) {
    const tested = !lastErr || tried.some((t) => /\d\/\d/.test(t));
    ready = {
      ok: false,
      tested, // true = models answered but failed the test; false = could not reach the gateway (retry sooner)
      at: Date.now(),
      catalog: ids,
      network: b.network,
      tried,
      reason: tested
        ? `Chưa có model FLOP nào đủ sức dùng tool (đã thử: ${tried.join(", ")}). Agent chưa đăng gì lên Kibble, sẽ thử lại sau ${b.selftest_hours} giờ.`
        : `Chưa gọi được não FLOP: ${lastErr}`,
    };
  }
  fs.mkdirSync(path.dirname(CHECK_FILE), { recursive: true });
  fs.writeFileSync(CHECK_FILE, JSON.stringify(ready, null, 1));
  return ready;
}

async function readyModel(cfg) {
  const r = await ensureReady(cfg);
  if (!r.ok) throw new BrainError(r.reason);
  return r.model;
}

// One agent step: conversation + tool list → the brain calls one tool (or writes text).
export async function step(cfg, stage, { messages, tools }) {
  const model = await readyModel(cfg);
  const { data, message } = await call(cfg, model, { messages, tools });
  const { usage, flop } = meter(data);
  recordCall(stage, data.model, usage, flop);
  return { message, flop, tokens: usage.input + usage.output };
}

// Ask the brain once, no tools (e.g. drafting a job to post). The caller logs FLOP.
export async function ask(cfg, { system, user, json = false }) {
  const model = await readyModel(cfg);
  const messages = [{ role: "system", content: json ? `${system}\n\nRespond with only one JSON object, no other text.` : system }, { role: "user", content: user }];
  const { data, message } = await call(cfg, model, { messages });
  let text = message.content || "";
  if (json) text = text.replace(/^\s*```(?:json)?\s*|\s*```\s*$/g, "");
  return { text, model: data.model, ...meter(data) };
}

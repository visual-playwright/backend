// Rantai provider LLM vision. Urutan via LLM_PROVIDER (default: auto).
// - opencode (default utama): panggil model gratis via CLI OpenCode dalam sesi
//   OpenCode (free tier hanya boleh dipakai di dalam OpenCode).
//   Model: OPENCODE_MODEL (default opencode/muse-spark-1.3-contributor-free),
//   agent tanpa tool tulis (default plan). Usage+cost dibaca dari event
//   step_finish dan sesi OpenCode.
// - zen: OpenCode Zen Responses langsung (butuh saldo untuk model berbayar;
//   free tier terblokir di luar OpenCode).
// - gemini: Google AI Studio (GEMINI_API_KEY), vision native.
// - pollinations: tanpa key (best-effort, kuota komunitas).
// Output ke runner: {instruction, action, x, y, text, visual_element,
// reasoning, status, done} + usage {input, output, reasoning, cacheRead,
// cacheWrite, cost} + sessionId (khusus opencode).
const { spawn } = require("child_process");
const path = require("path");

const ZEN_MODEL = process.env.ZEN_MODEL || "muse-spark-1.3-contributor-free";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const OPENCODE_BIN = process.env.OPENCODE_BIN || "opencode";
// cwd proses spawn harus direktori project yang sudah dikenal opencode
// (cwd di dalam backend/ menggantung FileSystem); --dir tetap backend.
// Harus direktori project yang sudah ada (direktori baru ditolak FileSystem.access)
const OPENCODE_CWD = process.env.OPENCODE_CWD || path.join(__dirname, "../../..");
// Direktori kerja sesi opencode (isolasinya per --title/session, bukan folder)
const OPENCODE_DIR = process.env.OPENCODE_DIR || path.join(__dirname, "../..");
const OPENCODE_MODEL = process.env.OPENCODE_MODEL || "opencode/muse-spark-1.3-contributor-free";
const OPENCODE_AGENT = process.env.OPENCODE_AGENT || "qa-vision";

function order() {
  const p = (process.env.LLM_PROVIDER || "auto").toLowerCase();
  if (p === "auto") return ["opencode", "gemini", "pollinations"];
  return [p];
}

function zenBase() {
  return (process.env.ZEN_BASE_URL || "https://opencode.ai/zen/v1").replace(/\/$/, "");
}

async function postJson(url, headers, body, timeoutMs) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { method: "POST", signal: controller.signal, headers, body: JSON.stringify(body) });
    const text = await res.text();
    let data = null;
    try {
      data = JSON.parse(text);
    } catch {
      data = { _raw: text.slice(0, 2000) };
    }
    return { status: res.status, data };
  } finally {
    clearTimeout(t);
  }
}

function extractActionBlob(text) {
  const m = String(text).match(/\{[\s\S]*"action"[\s\S]*\}/);
  if (!m) return null;
  try {
    return JSON.parse(m[0]);
  } catch {
    return null;
  }
}

// ---- Provider: opencode CLI (1 sesi OpenCode per run) ----
function parseOpencodeEvents(stdout) {
  let text = "";
  let sessionId = null;
  const usage = { input: 0, output: 0, reasoning: 0, cacheRead: 0, cacheWrite: 0, cost: 0 };
  for (const line of String(stdout).split("\n")) {
    const s = line.trim();
    if (!s.startsWith("{")) continue;
    let ev;
    try {
      ev = JSON.parse(s);
    } catch {
      continue;
    }
    if (ev.sessionID && !sessionId) sessionId = ev.sessionID;
    const part = ev.part || {};
    if (part.type === "text" && typeof part.text === "string") text += part.text;
    if (part.type === "step-finish") {
      const t = part.tokens || {};
      usage.input += t.input || 0;
      usage.output += t.output || 0;
      usage.reasoning += t.reasoning || 0;
      usage.cacheRead += (t.cache || {}).read || 0;
      usage.cacheWrite += (t.cache || {}).write || 0;
      usage.cost += part.cost || 0;
    }
  }
  return { text, sessionId, usage };
}

function viaOpencode({ systemPrompt, screenshotAbsPath, history, timeoutMs, sessionId, title }) {
  const prompt =
    `${systemPrompt}\n\n=== INSTRUKSI LOOP OTOMASI (menggantikan format laporan HTML selama loop) ===\n` +
    `Riwayat steps (JSON): ${JSON.stringify(history).slice(0, 8000)}\n` +
    `JANGAN panggil tool apapun. Analisis screenshot terlampir secara visual, lalu balas HANYA satu JSON: ` +
    `{instruction, action, x, y, text, visual_element, reasoning, status, done}. ` +
    `action ∈ navigate/click/type/take_screenshot/wait_for/hover/press_key/fill_form/select_option/handle_dialog/navigate_back/resize. ` +
    `reasoning ∈ NONE/REDIRECT/ADD/SKIP/EXPAND; status ∈ PASS/FAIL/SKIPPED; koordinat x,y skala 0-1000; done=true bila skenario selesai.`;
  // NOTE: pesan harus sebelum -f (urutan argumen berpengaruh)
  const args = ["run", "-m", OPENCODE_MODEL, "--agent", OPENCODE_AGENT, "--format", "json", "--title", title || "autoqa-run", "--dir", OPENCODE_DIR, prompt, "-f", screenshotAbsPath];
  if (sessionId) args.push("-s", sessionId);
  return new Promise((resolve, reject) => {
    const child = spawn(OPENCODE_BIN, args, { cwd: OPENCODE_CWD, timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    const killer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error("opencode timeout"));
    }, timeoutMs + 10000);
    child.stdout.on("data", (d) => {
      out += d.toString();
    });
    child.stderr.on("data", (d) => {
      err += d.toString();
    });
    child.on("error", (e) => {
      clearTimeout(killer);
      reject(new Error(`opencode gagal dijalankan: ${e.message}`));
    });
    child.on("close", (code) => {
      clearTimeout(killer);
      const { text, sessionId: sid, usage } = parseOpencodeEvents(out);
      const action = extractActionBlob(text);
      if (code !== 0 && !action) {
        reject(new Error(`opencode exit ${code}: ${err.slice(0, 300)}`));
        return;
      }
      if (!action) {
        reject(new Error(`Respon opencode tidak berisi JSON action: ${text.slice(0, 200)}`));
        return;
      }
      resolve({ action, usage, sessionId: sid });
    });
  });
}

function zenOutputText(data) {
  // Responses API: cari output_text / content text secara toleran
  try {
    const out = data.output || [];
    let s = "";
    for (const item of out) {
      for (const c of item.content || []) {
        if (typeof c.text === "string") s += c.text;
      }
    }
    return s;
  } catch {
    return "";
  }
}

async function viaZen({ systemPrompt, screenshotBase64, history, timeoutMs }) {
  if (!process.env.ZEN_API_KEY) throw new Error("ZEN_API_KEY belum diisi");
  const { status, data } = await postJson(
    `${zenBase()}/responses`,
    { Authorization: `Bearer ${process.env.ZEN_API_KEY}`, "Content-Type": "application/json" },
    {
      model: ZEN_MODEL,
      input: [
        { role: "system", content: [{ type: "input_text", text: systemPrompt }] },
        {
          role: "user",
          content: [
            { type: "input_text", text: `Riwayat steps (JSON): ${JSON.stringify(history).slice(0, 8000)}` },
            { type: "input_text", text: "Balas HANYA JSON: {instruction, action, x, y, text, visual_element, reasoning, status, done}. reasoning ∈ NONE/REDIRECT/ADD/SKIP/EXPAND; status ∈ PASS/FAIL/SKIPPED; koordinat x,y skala 0-1000." },
            { type: "input_image", image_url: `data:image/png;base64,${screenshotBase64}` },
          ],
        },
      ],
      max_output_tokens: 2000,
    },
    timeoutMs
  );
  if (status === 429) {
    const e = new Error("Zen rate limit (429)");
    e.code = "ZEN_429";
    throw e;
  }
  if (status !== 200) throw new Error(`Zen error ${status}: ${JSON.stringify(data).slice(0, 200)}`);
  const action = extractActionBlob(zenOutputText(data));
  if (!action) throw new Error("Respon Zen tidak berisi JSON action");
  return { action, usage: null, sessionId: null };
}

function geminiParts({ systemPrompt, screenshotBase64, history }) {
  return [
    { text: systemPrompt },
    { text: `Riwayat steps (JSON): ${JSON.stringify(history).slice(0, 8000)}\nBalas HANYA JSON: {instruction, action, x, y, text, visual_element, reasoning, status, done}. reasoning ∈ NONE/REDIRECT/ADD/SKIP/EXPAND; status ∈ PASS/FAIL/SKIPPED; koordinat x,y skala 0-1000.` },
    { inline_data: { mime_type: "image/png", data: screenshotBase64 } },
  ];
}

async function viaGemini({ systemPrompt, screenshotBase64, history, timeoutMs }) {
  if (!process.env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY belum diisi");
  const { status, data } = await postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${process.env.GEMINI_API_KEY}`,
    { "Content-Type": "application/json" },
    { contents: [{ parts: geminiParts({ systemPrompt, screenshotBase64, history }) }], generationConfig: { maxOutputTokens: 2000 } },
    timeoutMs
  );
  if (status !== 200) throw new Error(`Gemini error ${status}: ${JSON.stringify(data).slice(0, 200)}`);
  const text = (((data.candidates || [])[0] || {}).content || {}).parts || [];
  const action = extractActionBlob(text.map((p) => p.text || "").join(""));
  if (!action) throw new Error("Respon Gemini tidak berisi JSON action");
  return { action, usage: null, sessionId: null };
}

async function viaPollinations({ systemPrompt, screenshotBase64, history, timeoutMs }) {
  const { status, data } = await postJson(
    "https://text.pollinations.ai/openai",
    { "Content-Type": "application/json" },
    {
      model: "openai",
      messages: [
        { role: "system", content: systemPrompt.slice(0, 12000) },
        {
          role: "user",
          content: [
            { type: "text", text: `Riwayat steps (JSON): ${JSON.stringify(history).slice(0, 4000)}\nBalas HANYA JSON: {instruction, action, x, y, text, visual_element, reasoning, status, done}.` },
            { type: "image_url", image_url: { url: `data:image/png;base64,${screenshotBase64}` } },
          ],
        },
      ],
      max_tokens: 1000,
    },
    timeoutMs
  );
  if (status !== 200) throw new Error(`Pollinations error ${status}: ${JSON.stringify(data).slice(0, 200)}`);
  const text = ((data.choices || [])[0] || {}).message || {};
  const action = extractActionBlob(text.content || "");
  if (!action) throw new Error("Respon Pollinations tidak berisi JSON action");
  return { action, usage: null, sessionId: null };
}

const PROVIDERS = { opencode: viaOpencode, zen: viaZen, gemini: viaGemini, pollinations: viaPollinations };

// Coba berurutan; yang gagal dicatat, yang pertama sukses dipakai.
async function callZen(args) {
  const errs = [];
  for (const name of order()) {
    try {
      const res = await PROVIDERS[name](args);
      if (name !== "opencode") console.log(`[ai] provider dipakai: ${name}`);
      return res;
    } catch (e) {
      errs.push(`${name}: ${e.message}`);
    }
  }
  throw new Error(`Semua provider gagal — ${errs.join(" | ")}`);
}

module.exports = { ZEN_MODEL, callZen };

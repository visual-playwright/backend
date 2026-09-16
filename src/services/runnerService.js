// Antrean run async sederhana (in-memory; upgrade ke BullMQ bila perlu).
// Aturan: timeout per-step macet → SKIPPED, lanjut step berikutnya, run tidak berhenti.
const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const Run = require("../models/Run");
const RunStep = require("../models/RunStep");
const { callZen } = require("./aiService");
const { exec, VIEWPORT_W, VIEWPORT_H } = require("./playwrightService");
const {
  mentionsMissing,
  mentionsLogin,
  isContradiction,
  isSkipSignal,
  actionKey,
  isLooping,
  verifiedGoal,
} = require("./contradiction");

const MAX_STEPS = 30;
const STALL_LIMIT = 3; // gagal/timeout beruntun → SKIPPED lalu lanjut
const RUN_BUDGET_MS = 20 * 60 * 1000; // 20 menit per run

const queue = [];
let running = false;

function enqueue(runId) {
  queue.push(runId);
  pump();
}

async function pump() {
  if (running) return;
  running = true;
  while (queue.length) {
    const runId = queue.shift();
    try {
      await executeRun(runId);
    } catch (e) {
      console.error(`run ${runId} gagal:`, e.message);
      try {
        await Run.finish(runId, {
          status: "FAILED", total_steps: 0, steps_passed: 0,
          executable_rate: 0, goal_achieved: false, dynamic_reasoning_count: 0,
        });
      } catch {}
    }
  }
  running = false;
}

function shotPath(runId, no) {
  const dir = path.join(__dirname, "../../storage/runs", runId);
  fs.mkdirSync(dir, { recursive: true });
  return { abs: path.join(dir, `step-${String(no).padStart(2, "0")}.png`), rel: `/storage/runs/${runId}/step-${String(no).padStart(2, "0")}.png` };
}

async function executeRun(runId) {
  const run = await Run.findForWorker(runId);
  if (!run) return;
  await Run.markRunning(runId);

  const browser = await chromium.launch({
    headless: process.env.BROWSER_HEADLESS !== "false",
    // Wajib di container: /dev/shm kecil (64MB) + sandbox bermasalah.
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  const context = await browser.newContext({ viewport: { width: VIEWPORT_W, height: VIEWPORT_H } });
  const page = await context.newPage();
  // Dialog konfirmasi (R-04): terima otomatis kecuali LLM minta dismiss
  let dismissNextDialog = false;
  page.on("dialog", async (d) => {
    try {
      if (dismissNextDialog) await d.dismiss();
      else await d.accept();
    } catch {}
    dismissNextDialog = false;
  });

  const history = [];
  let no = 0;
  let stalls = 0;
  let entityName = null;
  let dataContoh = null;
  let sessionId = run.opencode_session || null;
  const started = Date.now();
  // Jaring pengaman skor-jujur (prompt & skenario tidak diubah):
  // abortReason menghentikan run sebagai FAILED; recentKeys mendeteksi loop klik.
  let abortReason = null;
  const recentKeys = [];
  // Buffer screenshot terakhir — di-scope luar agar recordAbort bisa memakainya.
  let buffer = null;

  // Mencatat marker penghentian (1 step FAIL) lalu keluar loop via break oleh pemanggil.
  async function recordAbort(reason) {
    abortReason = reason;
    no += 1;
    const sp = shotPath(runId, no);
    try {
      const fresh = await page.screenshot();
      if (fresh) buffer = fresh;
    } catch {}
    try {
      if (buffer) fs.writeFileSync(sp.abs, buffer);
    } catch {}
    const step = {
      no,
      instruction: "Run dihentikan",
      visual_element: "-",
      status: "FAIL",
      dynamic_reasoning: "SKIP",
      notes: String(reason).slice(0, 300),
      screenshot_path: sp.rel,
    };
    await RunStep.add({ run_id: runId, ...step }).catch(() => {});
    history.push({ ...step, screenshot: sp.rel });
  }

  try {
    await page.goto(run.url, { waitUntil: "domcontentloaded", timeout: 20000 });
    buffer = await page.screenshot();
    let p = shotPath(runId, 0);
    fs.writeFileSync(p.abs, buffer);
    history.push({ no: 0, instruction: `Buka ${run.url}`, status: "PASS", dynamic_reasoning: "NONE", screenshot: p.rel });

    while (no < MAX_STEPS && Date.now() - started < RUN_BUDGET_MS) {
      // Lapis 3b — login gate (R-02..R-05): prasyarat login harus lepas dari
      // halaman login paling lambat langkah ke-6. R-01 dikecualikan.
      if (!abortReason && run.scenario_id !== "R-01") {
        const main = history.filter((s) => s.no > 0);
        if (main.length >= 6) {
          const tail = main.slice(-3);
          const stuck = tail.every(
            (s) =>
              mentionsLogin(`${s.visual_element} ${s.instruction}`) &&
              mentionsMissing(`${s.visual_element} ${s.instruction}`)
          );
          if (stuck) {
            await recordAbort("Prasyarat login tak tercapai hingga langkah ke-6 — run dihentikan");
            break;
          }
        }
      }

      let decision;
      try {
        const res = await callZen({
          systemPrompt: run.rendered_prompt,
          screenshotAbsPath: p.abs,
          screenshotBase64: buffer.toString("base64"),
          history: history.map(({ screenshot, ...h }) => h),
          timeoutMs: 300000,
          sessionId,
          title: run.result_name,
        });
        decision = res.action;
        if (res.sessionId && !sessionId) {
          sessionId = res.sessionId;
          await Run.saveSession(runId, sessionId).catch(() => {});
        }
        await Run.addUsage(runId, res.usage).catch(() => {});
        stalls = 0;
      } catch (e) {
        stalls += 1;
        no += 1;
        const sp = shotPath(runId, no);
        fs.writeFileSync(sp.abs, buffer);
        const step = { no, instruction: "Analisis LLM", visual_element: "-", status: "SKIPPED", dynamic_reasoning: "SKIP", notes: `LLM gagal/timeout (${stalls}x): ${e.message}`.slice(0, 300), screenshot_path: sp.rel };
        await RunStep.add({ run_id: runId, ...step });
        history.push({ ...step, screenshot: sp.rel });
        if (stalls >= STALL_LIMIT && Date.now() - started > RUN_BUDGET_MS / 2) break;
        continue;
      }

      if (!decision || typeof decision !== "object" || !decision.action) {
        no += 1;
        const sp = shotPath(runId, no);
        fs.writeFileSync(sp.abs, buffer);
        const step = { no, instruction: "Analisis LLM", visual_element: "-", status: "SKIPPED", dynamic_reasoning: "SKIP", notes: "Respon LLM tidak valid", screenshot_path: sp.rel };
        await RunStep.add({ run_id: runId, ...step });
        history.push({ ...step, screenshot: sp.rel });
        continue;
      }

      if (decision.entity_name) entityName = decision.entity_name;
      if (decision.data_contoh) dataContoh = decision.data_contoh;
      if (decision.action === "handle_dialog" && decision.accept === false) dismissNextDialog = true;

      // Lapis 1 — sinyal SKIP model dihormati: catat SKIPPED tanpa eksekusi tool.
      if (isSkipSignal(decision)) {
        no += 1;
        const sp = shotPath(runId, no);
        try {
          fs.writeFileSync(sp.abs, buffer);
        } catch {}
        const step = {
          no,
          instruction: String(decision.instruction || decision.action).slice(0, 500),
          visual_element: String(decision.visual_element || "-").slice(0, 500),
          status: "SKIPPED",
          dynamic_reasoning: "SKIP",
          notes: "Model menandai SKIP — eksekusi dilewati",
          screenshot_path: sp.rel,
        };
        await RunStep.add({ run_id: runId, ...step });
        history.push({ ...step, screenshot: sp.rel });
        continue;
      }

      // Lapis 2 — kontradiksi: target dicatat tak terlihat tapi minta eksekusi.
      if (isContradiction(decision)) {
        no += 1;
        const sp = shotPath(runId, no);
        try {
          fs.writeFileSync(sp.abs, buffer);
        } catch {}
        const step = {
          no,
          instruction: String(decision.instruction || decision.action).slice(0, 500),
          visual_element: String(decision.visual_element || "-").slice(0, 500),
          status: "SKIPPED",
          dynamic_reasoning: "SKIP",
          notes: "Kontradiksi: target dicatat tak terlihat — eksekusi dibatalkan",
          screenshot_path: sp.rel,
        };
        await RunStep.add({ run_id: runId, ...step });
        history.push({ ...step, screenshot: sp.rel });
        continue;
      }

      // Lapis 3a — loop detector: aksi klik/tekan yang sama >= 3x dalam 5 aksi terakhir.
      const key = actionKey(decision);
      recentKeys.push(key);
      if (isLooping(recentKeys, key)) {
        await recordAbort(`Loop terdeteksi: aksi "${decision.action}" berulang — run dihentikan`);
        break;
      }

      no += 1;
      let status = "PASS";
      let notes = "";
      try {
        const out = await exec(page, { ...decision, url: decision.url || run.url });
        // take_screenshot mengembalikan Buffer — jangan simpan biner ke DB
        notes = Buffer.isBuffer(out) ? "screenshot captured" : String(out || "").replace(/[^ -~\n\r\t]/g, "").slice(0, 300);
        await page.waitForTimeout(800);
      } catch (e) {
        status = decision.status === "SKIPPED" ? "SKIPPED" : "FAIL";
        notes = `Eksekusi gagal: ${e.message}`.slice(0, 300);
      }
      try {
        buffer = await page.screenshot();
      } catch {}
      const sp = shotPath(runId, no);
      try {
        fs.writeFileSync(sp.abs, buffer);
      } catch {}
      const step = {
        no,
        instruction: String(decision.instruction || decision.action).slice(0, 500),
        visual_element: String(decision.visual_element || "-").slice(0, 500),
        status,
        dynamic_reasoning: ["NONE", "REDIRECT", "ADD", "SKIP", "EXPAND"].includes(decision.reasoning) ? decision.reasoning : "NONE",
        notes,
        screenshot_path: sp.rel,
      };
      await RunStep.add({ run_id: runId, ...step });
      history.push({ ...step, screenshot: sp.rel });

      if (decision.done === true) break;
    }
  } finally {
    await browser.close().catch(() => {});
  }

  const main = history.filter((s) => s.no > 0);
  const passed = main.filter((s) => s.status === "PASS").length;
  const total = main.length;
  await Run.finish(runId, {
    // Lapis 4 — skoring jujur: abort paksa FAILED; goal butuh verifikasi berbukti.
    status: abortReason ? "FAILED" : "DONE",
    total_steps: total,
    steps_passed: passed,
    executable_rate: total ? Math.round((passed / total) * 10000) / 100 : 0,
    goal_achieved: !abortReason && verifiedGoal(main),
    dynamic_reasoning_count: main.filter((s) => s.dynamic_reasoning && s.dynamic_reasoning !== "NONE").length,
    entity_name: entityName,
    data_contoh: typeof dataContoh === "string" ? dataContoh : dataContoh ? JSON.stringify(dataContoh) : null,
  });
}

module.exports = { enqueue, executeRun };

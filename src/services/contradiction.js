// Util murni (tanpa I/O) untuk pertahanan skor-jujur worker.
// Diuji via node -e tanpa DB/browser. Prompt & skenario TIDAK diubah —
/// semua aturan di sini adalah jaring pengaman backend atas klaim model.
const NEGATIVE_PHRASES = [
  "tidak terlihat",
  "tidak ditemukan",
  "tidak tampil",
  "tidak muncul",
  "masih di halaman login",
  "masih dihalaman login",
  "masih di halaman awal",
  "not visible",
  "not found",
  "cannot be found",
  "cannot see",
  "can't see",
  "still on the login",
  "still on login",
];

// Aksi yang menyentuh aplikasi — klaim "target tak terlihat" + aksi ini = kontradiksi.
const EXEC_ACTIONS = new Set([
  "click",
  "type",
  "fill_form",
  "select_option",
  "press_key",
  "handle_dialog",
]);

// Aksi yang dihitung untuk deteksi loop (klik/frustasi berulang).
const LOOP_ACTIONS = new Set(["click", "press_key"]);

function mentionsMissing(text) {
  const t = String(text || "").toLowerCase();
  return NEGATIVE_PHRASES.some((p) => t.includes(p));
}

function mentionsLogin(text) {
  return /login/i.test(String(text || ""));
}

// True bila model meminta EKSEKUSI padahal ia sendiri mencatat target tak terlihat.
function isContradiction(decision) {
  if (!decision || typeof decision !== "object") return false;
  if (!EXEC_ACTIONS.has(decision.action)) return false;
  return mentionsMissing(decision.instruction) || mentionsMissing(decision.visual_element);
}

function isSkipSignal(decision) {
  if (!decision || typeof decision !== "object") return false;
  if (String(decision.status || "").toUpperCase() === "SKIPPED") return true;
  return decision.reasoning === "SKIP";
}

// Kunci aksi untuk deteksi pengulangan: aksi + koordinat dibulatkan ke grid 50px.
// Grid longgar agar klik frustasi (998,415 → 998,402) tetap terdeteksi sama.
function actionKey(decision) {
  const q = (v) => Math.round(Number(v || 0) / 50) * 50;
  return `${decision.action}|${q(decision.x)}|${q(decision.y)}`;
}

// True bila kunci saat ini sudah muncul >= 3x dalam 5 aksi terakhir.
function isLooping(recentKeys, key) {
  if (!LOOP_ACTIONS.has(String(key).split("|")[0])) return false;
  const tail = recentKeys.slice(-5);
  return tail.filter((k) => k === key).length >= 3;
}

function isVerifyText(text) {
  return /verifik|verify/i.test(String(text || ""));
}

// goal_achieved yang jujur: ada step VERIFIKASI berstatus PASS tanpa catatan negatif.
// Bukan lagi "step terakhir PASS".
function verifiedGoal(mainSteps) {
  const verifs = (mainSteps || []).filter(
    (s) => Number(s.no) > 0 && s.status === "PASS" && isVerifyText(s.instruction)
  );
  return verifs.some(
    (s) =>
      !mentionsMissing(s.instruction) &&
      !mentionsMissing(s.visual_element) &&
      !mentionsMissing(s.notes)
  );
}

module.exports = {
  NEGATIVE_PHRASES,
  EXEC_ACTIONS,
  mentionsMissing,
  mentionsLogin,
  isContradiction,
  isSkipSignal,
  actionKey,
  isLooping,
  verifiedGoal,
};

// Kontrak waktu UTC untuk API.
// DB menyimpan DATETIME sebagai UTC wall-time (UTC_TIMESTAMP).
// Driver mysql2 dengan timezone:'Z' mengembalikan JS Date UTC,
// tapi untuk ketahanan (string mentah "YYYY-MM-DD HH:mm:ss" tanpa zona)
// normalisasi eksplisit ke ISO-8601 dengan suffix Z agar
// `new Date(iso)` di browser (WIB) tidak selisih +7 jam.
function toISOZ(v) {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) {
    return Number.isNaN(v.getTime()) ? null : v.toISOString();
  }
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return null;
    // Sudah ada zona (Z atau ±HH:mm / ±HHmm / ±HH) -> parse langsung.
    if (/([Zz]|[+-]\d{2}:?\d{2})$/.test(s)) {
      const d = new Date(s);
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }
    // Format MySQL DATETIME tanpa zona -> anggap UTC.
    const isoLike = s.includes("T") ? s : s.replace(" ", "T");
    const d = new Date(`${isoLike}Z`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

function normalizeRunRow(row) {
  if (!row || typeof row !== "object") return row;
  if ("started_at" in row) row.started_at = toISOZ(row.started_at);
  if ("finished_at" in row) row.finished_at = toISOZ(row.finished_at);
  return row;
}

function normalizeStepRow(row) {
  if (!row || typeof row !== "object") return row;
  if ("created_at" in row) row.created_at = toISOZ(row.created_at);
  return row;
}

module.exports = { toISOZ, normalizeRunRow, normalizeStepRow };

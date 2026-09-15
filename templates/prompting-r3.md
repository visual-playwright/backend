# 🧪 Direct Prompting — Visual Assessment (R-03: Update)
# Vision-Based Testing | No DOM Access
---

## Role

Kamu adalah seorang QA Visual Automation Tester yang bertindak MURNI SEBAGAI PENGGUNA MANUSIA (Pure Human Roleplay). Seluruh langkah pengujian fungsional sudah ditentukan secara **konkret dan tetap (fixed)** oleh peneliti — tugasmu mengeksekusinya secara literal, dan hanya memakai penalaran visual saat elemen tidak persis cocok dengan yang terlihat di layar.

---

## 🚨 ATURAN KETAT (STRICT RULES)

1. ❌ **DILARANG MEMBACA KODE:** Jangan membaca source code, HTML, CSS, class, ID, Inspect Element, DevTools.
2. 🛠️ **TOOL:** Tool yang diizinkan sudah diatur lewat permission config (`playwright_browser_navigate/click/type/take_screenshot/wait_for/hover/press_key/fill_form/select_option/handle_dialog/navigate_back/resize`). Tool berbasis DOM (`snapshot/evaluate/find/run_code_unsafe/console_messages/network_request(s)`) **sudah diblokir di level sistem** — kalau gagal terpanggil, itu memang disengaja, bukan error.
3. 👁️ **MURNI VISUAL:** Temukan elemen hanya berdasarkan screenshot, layaknya manusia.
4. 📏 **LITERAL:** Jangan ubah urutan/tafsirkan ulang instruksi `(Event)/(Action)` di bawah.
5. ⚠️ **DYNAMIC REASONING HANYA SAAT MACET** (lihat tabel strategi di bawah).
6. ⏱️ **TIMEOUT 10 MENIT → SKIP**, jangan hentikan seluruh sesi.
7. ⚡ **WAJIB EKSEKUSI NYATA:** Setiap instruksi harus diikuti tool call sungguhan, bukan deskripsi rencana saja.
8. 🚫 **JANGAN MENULIS FILE SKRIP PLAYWRIGHT APA PUN** — semua interaksi lewat tool call langsung/terminal interaktif, bukan file kode tersimpan.
9. 🚫 **JANGAN PERNAH MENULIS ATAU MENJALANKAN `require()` ATAU `import`** — tool `playwright_browser_*` adalah MCP tools bawaan opencode, bukan module JavaScript yang bisa di-require.

---

## 📌 PROJECT INFO & VARIABEL
*(diisi dari prompt chat)*

| Variabel | Keterangan |
|---|---|
| `{{PROJECT_ID}}` | ID unik proyek/mahasiswa yang diuji |
| `{{MODEL_NAME}}` | Nama model AI (pakai tanda hubung, contoh: `GPT-5-Nano`, bukan spasi) |
| `{{APP_DOMAIN}}` | Domain aplikasi |
| `{{URL}}` | URL aplikasi yang diuji |
| `{{USERNAME}}` / `{{PASSWORD}}` | Kredensial login |

**Skenario file ini: `R-03` — Update (fixed, tidak perlu isi variabel Skenario ID)**

---

## 📚 INSTRUKSI KONKRET — R-03

### Prasyarat — Login (diam-diam, catat sebagai "Prasyarat")
1. Buka {{URL}}, login pakai `{{USERNAME}}` / `{{PASSWORD}}`

### Setup Data (HANYA jika daftar/tabel kosong — catat sebagai "Setup Data", tidak dihitung ke skor)
1. Jalankan 1x langkah Create (lihat pola R-02: cari widget Tambah → isi form data valid → submit) untuk memastikan ada ≥1 baris data

### Skenario Utama: R-03 — Update (Edit Data)
1. (Event) Cari widget Edit pada baris data pertama → analisis visual
2. (Action) Klik widget Edit → `playwright_browser_click`
3. (Event) Amati form edit, identifikasi field yang bisa diubah → `playwright_browser_take_screenshot`
4. (Action) Pilih 1 field, tentukan nilai baru, ubah (catat field & nilai) → `playwright_browser_click`, `playwright_browser_type`
5. (Event) Cari widget Update/Simpan → analisis visual
6. (Action) Klik widget Update → `playwright_browser_click`
7. (Event) Verifikasi perubahan tampil di daftar → `playwright_browser_take_screenshot`

---

## 🔄 DYNAMIC REASONING

| Strategi | Kapan | Tindakan |
|---|---|---|
| **REDIRECT** | Target tidak ada, ada elemen lain yang mungkin mengarah ke sana | Klik elemen alternatif paling masuk akal |
| **ADD** | Target tersembunyi di balik elemen lain | Tambah 1 langkah eksplorasi ekstra sebelum langkah utama |
| **SKIP** | Target benar-benar tidak ditemukan | Tandai SKIPPED, lanjut ke langkah berikutnya |
| **EXPAND** | Semua langkah dijalankan tapi goal belum tercapai | Eksplorasi mandiri elemen lain |

Catat strategi yang dipakai (atau `NONE`).

---

## ⚙️ ALUR EKSEKUSI

1. Jalankan instruksi di bagian "Instruksi Konkret" di atas urut dari atas — panggil tool nyata sesuai anotasi, jangan hanya deskripsi.
2. Terapkan Dynamic Reasoning hanya bila diperlukan; catat strateginya.
3. Susun laporan sesuai format di bawah.

---

## 📋 FORMAT LAPORAN (1 file HTML per run)

Nama file: `result_{{PROJECT_ID}}_R-03_{{MODEL_NAME}}_direct.html`

```html
<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<style>table{border-collapse:collapse;width:100%;margin-bottom:16px}th,td{border:1px solid #999;padding:6px 8px;text-align:left}th{background:#f2f2f2}</style>
</head><body>

<h2>Metadata Run</h2>
<table>
<tr><th>Project ID</th><td>{{PROJECT_ID}}</td></tr>
<tr><th>App Domain</th><td>{{APP_DOMAIN}}</td></tr>
<tr><th>Model AI</th><td>{{MODEL_NAME}}</td></tr>
<tr><th>Strategi Prompting</th><td>Direct Prompting</td></tr>
<tr><th>Skenario ID</th><td>R-03</td></tr>
<tr><th>Entity Name</th><td></td></tr>
<tr><th>Data Contoh</th><td></td></tr>
<tr><th>Total Langkah</th><td></td></tr>
<tr><th>Langkah Berhasil</th><td></td></tr>
<tr><th>Executable Rate (%)</th><td></td></tr>
<tr><th>Goal Tercapai</th><td></td></tr>
<tr><th>Jumlah Dynamic Reasoning</th><td></td></tr>
</table>

<h2>Tabel — Eksekusi per Langkah</h2>
<table>
<thead><tr><th>No</th><th>Instruksi</th><th>Elemen Visual</th><th>Status</th><th>Dynamic Reasoning</th><th>Catatan</th></tr></thead>
<tbody><!-- Status: PASS/FAIL/SKIPPED --></tbody>
</table>

</body></html>
```
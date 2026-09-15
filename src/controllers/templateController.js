const Template = require("../models/Template");

async function list(req, res) {
  try {
    const rows = await Template.list();
    res.json({ message: "Berhasil mengambil template", data: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal mengambil template" });
  }
}

async function detail(req, res) {
  try {
    const row = await Template.findById(req.params.id);
    if (!row) return res.status(404).json({ message: "Template tidak ditemukan" });
    res.json({ message: "Berhasil mengambil template", data: row });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal mengambil template" });
  }
}

async function update(req, res) {
  try {
    const { content } = req.body;
    if (!content || content.length < 10) {
      return res.status(400).json({ message: "Isi template minimal 10 karakter" });
    }
    const ok = await Template.updateContent(req.params.id, content);
    if (!ok) return res.status(404).json({ message: "Template tidak ditemukan" });
    res.json({ message: "Template berhasil diperbarui" });
  } catch (e) {
    console.error(e);
    res.status(500).json({ message: "Gagal memperbarui template" });
  }
}

module.exports = { list, detail, update };

const express = require("express");
const reportController = require("../controllers/reportController");

const router = express.Router();

router.get("/:id", reportController.detail);

module.exports = router;

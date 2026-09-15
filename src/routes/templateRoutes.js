const express = require("express");
const templateController = require("../controllers/templateController");

const router = express.Router();

router.get("/", templateController.list);
router.get("/:id", templateController.detail);
router.put("/:id", templateController.update);

module.exports = router;

const express = require("express");
const runController = require("../controllers/runController");

const router = express.Router();

router.post("/", runController.create);
router.get("/", runController.list);
router.get("/:id", runController.detail);
router.delete("/:id", runController.remove);

module.exports = router;

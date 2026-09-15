const express = require("express");
const publicController = require("../controllers/publicController");

const router = express.Router();

router.get("/latest", publicController.latest);

module.exports = router;

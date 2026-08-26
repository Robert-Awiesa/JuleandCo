const express = require("express");
const {
  initialisePayment,
  paystackWebhook,
  paymentStatus,
  abandonPayment,
} = require("../controllers/paymentController");

const router = express.Router();

router.post("/initialise", initialisePayment);

// Public by necessity — Paystack calls it. The signature is the authentication.
router.post("/webhook", paystackWebhook);

router.get("/status/:orderNumber", paymentStatus);
router.post("/abandon", abandonPayment);

module.exports = router;

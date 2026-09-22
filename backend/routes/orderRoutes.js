import express from "express";
import {
  createOrder, getOrderQuote, getMyOrders, getOrder,
  updateOrderStatus, cancelOrder, getSellerOrders,
} from "../controllers/orderController.js";
import { razorpayInit, razorpayConfirm } from "../controllers/paymentController.js";
import { protect, requireSeller } from "../middleware/authMiddleware.js";

const router = express.Router();

// ── Static routes first (must be before /:id) ─────────────────────────────
router.post("/quote",            protect, getOrderQuote);
router.post("/razorpay-init",    protect, razorpayInit);
router.post("/razorpay-confirm", protect, razorpayConfirm);
router.post("/",                 protect, createOrder);
router.get("/my",                protect, getMyOrders);
router.get("/seller",            protect, requireSeller, getSellerOrders);

// ── Parameterised routes ───────────────────────────────────────────────────
router.get("/:id",               protect, getOrder);
router.put("/:id/status",        protect, updateOrderStatus);
router.put("/:id/cancel",        protect, cancelOrder);

export default router;

import express from "express";
import {
  createOrder, getOrderQuote, getMyOrders, getOrder,
  updateOrderStatus, cancelOrder, getSellerOrders,
} from "../controllers/orderController.js";
import { protect, requireSeller } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/quote",       protect, getOrderQuote);
router.post("/",            protect, createOrder);
router.get("/my",           protect, getMyOrders);
router.get("/seller",       protect, requireSeller, getSellerOrders);
router.get("/:id",          protect, getOrder);
router.put("/:id/status",   protect, updateOrderStatus);
router.put("/:id/cancel",   protect, cancelOrder);

export default router;

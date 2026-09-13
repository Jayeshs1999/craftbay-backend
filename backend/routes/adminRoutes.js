import express from "express";
import {
  adminGetAllOrders,
  adminGetOrder,
  adminGetStats,
  adminNudgeSeller,
  adminGetUsers,
  adminUpdateOrderStatus,
  adminGetSellers,
  adminMailSellers,
  adminGetBuyers,
  adminMailBuyers,
} from "../controllers/adminController.js";
import { protect, requireAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// All admin routes require auth + admin role
router.use(protect, requireAdmin);

router.get("/stats",                    adminGetStats);
router.get("/orders",                   adminGetAllOrders);
router.get("/orders/:id",               adminGetOrder);
router.put("/orders/:id/status",        adminUpdateOrderStatus);
router.post("/orders/:id/nudge-seller", adminNudgeSeller);
router.get("/users",                    adminGetUsers);
router.get("/sellers",                  adminGetSellers);
router.post("/mail-sellers",            adminMailSellers);
router.get("/buyers",                   adminGetBuyers);
router.post("/mail-buyers",             adminMailBuyers);

export default router;

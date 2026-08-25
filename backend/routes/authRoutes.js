import express from "express";
import {
  registerUser, loginUser, logoutUser, getMe,
  becomeSeller, updateProfile, addAddress, deleteAddress,
} from "../controllers/authController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register",        registerUser);
router.post("/login",           loginUser);
router.post("/logout",          protect, logoutUser);
router.get("/me",               protect, getMe);
router.put("/become-seller",    protect, becomeSeller);
router.put("/profile",          protect, updateProfile);
router.post("/address",         protect, addAddress);
router.delete("/address/:id",   protect, deleteAddress);

export default router;

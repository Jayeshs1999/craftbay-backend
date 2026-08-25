import express from "express";
import { getDeliveryQuote, getDeliveryModes } from "../controllers/deliveryController.js";

const router = express.Router();

router.post("/quote", getDeliveryQuote);
router.get("/modes",  getDeliveryModes);

export default router;

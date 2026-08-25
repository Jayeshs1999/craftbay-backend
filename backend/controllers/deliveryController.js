import asyncHandler from "../middleware/asyncHandler.js";
import { calcShipping } from "../utils/deliveryHelper.js";

// @desc  Calculate shipping charge for given params
// @route POST /api/delivery/quote
// @access Public
export const getDeliveryQuote = asyncHandler(async (req, res) => {
  const { fromState, fromCity, toState, toCity, weightGrams, orderTotal, isCOD } = req.body;

  const result = calcShipping({
    fromState, fromCity, toState, toCity,
    weightGrams: Number(weightGrams) || 500,
    orderTotal:  Number(orderTotal)  || 0,
    isCOD:       Boolean(isCOD),
  });

  res.json({
    ...result,
    note: result.charge === 0 ? "Free shipping on orders ?999+" : undefined,
  });
});

// @desc  Get delivery mode options for a cart
// @route GET /api/delivery/modes
// @access Public
export const getDeliveryModes = asyncHandler(async (req, res) => {
  res.json([
    {
      mode: "platform",
      label: "Platform Delivery (Recommended)",
      description: "We arrange a courier partner to pick up from the seller and deliver to you.",
      priceNote: "Calculated at checkout based on location & weight",
      etaNote: "2–7 business days",
    },
    {
      mode: "self_ship",
      label: "Seller Ships",
      description: "The seller ships via their own courier. Tracking may vary.",
      priceNote: "As stated by seller (may be free)",
      etaNote: "3–10 business days",
    },
    {
      mode: "pickup",
      label: "Pick Up",
      description: "Pick up directly from the seller's location. Best for local buyers.",
      priceNote: "Free",
      etaNote: "Coordinate with seller",
    },
  ]);
});

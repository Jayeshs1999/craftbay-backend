import Razorpay from "razorpay";
import crypto from "crypto";
import asyncHandler from "../middleware/asyncHandler.js";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import { calcShipping, calcPlatformFee } from "../utils/deliveryHelper.js";
import { sendMail } from "../utils/mailer.js";
import { orderPlacedBuyerEmail, newOrderSellerEmail } from "../utils/emailTemplates.js";

const razorpay = new Razorpay({
  key_id:     process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Shared helpers (mirrors orderController) ─────────────────────────────────

function resolveDeliveryCfg(cfg = {}) {
  return {
    selfShipEnabled:       cfg.selfShipEnabled       ?? true,
    freeShippingAbove:     cfg.freeShippingAbove     ?? 0,
    localCharge:           cfg.localCharge           ?? 10,
    regionalCharge:        cfg.regionalCharge        ?? 10,
    nationalCharge:        cfg.nationalCharge        ?? 10,
    codEnabled:            cfg.codEnabled            ?? true,
    codExtraCharge:        cfg.codExtraCharge        ?? 30,
    estimatedDaysLocal:    cfg.estimatedDaysLocal    ?? 2,
    estimatedDaysRegional: cfg.estimatedDaysRegional ?? 4,
    estimatedDaysNational: cfg.estimatedDaysNational ?? 7,
    deliveryNote:          cfg.deliveryNote          ?? "",
  };
}

function calcSelfShip({ cfg, fromCity, fromState, toCity, toState, orderTotal, isCOD }) {
  const dc = resolveDeliveryCfg(cfg);
  if (dc.freeShippingAbove > 0 && orderTotal >= dc.freeShippingAbove) {
    return { charge: 0, etaDays: dc.estimatedDaysLocal };
  }
  const sameCity  = fromCity?.toLowerCase()  === toCity?.toLowerCase();
  const sameState = fromState?.toLowerCase() === toState?.toLowerCase();
  let base, etaDays;
  if (sameCity)       { base = dc.localCharge;    etaDays = dc.estimatedDaysLocal; }
  else if (sameState) { base = dc.regionalCharge; etaDays = dc.estimatedDaysRegional; }
  else                { base = dc.nationalCharge;  etaDays = dc.estimatedDaysNational; }
  const codExtra = (isCOD && dc.codEnabled) ? dc.codExtraCharge : 0;
  return { charge: base + codExtra, etaDays };
}

async function buildOrderItems(cartItems) {
  const items = [];
  for (const ci of cartItems) {
    const product = await Product.findById(ci.product)
      .populate("seller", "sellerProfile.shopCity sellerProfile.shopState sellerProfile.deliveryConfig");
    if (!product || !product.isActive) throw new Error(`Product unavailable: ${ci.product}`);
    if (product.stock < ci.quantity)   throw new Error(`Insufficient stock for: ${product.name}`);
    items.push({
      product:  product._id,
      seller:   product.seller._id,
      name:     product.name,
      image:    product.images[0]?.url || "",
      price:    product.price,
      quantity: ci.quantity,
      variant:  ci.variant || "",
      _sellerCity:        product.seller.sellerProfile?.shopCity,
      _sellerState:       product.seller.sellerProfile?.shopState,
      _sellerDeliveryCfg: product.seller.sellerProfile?.deliveryConfig,
    });
  }
  return items;
}

function calcTotals({ rawItems, shippingAddress, deliveryMode }) {
  const itemsTotal = rawItems.reduce((s, i) => s + i.price * i.quantity, 0);
  // Razorpay orders are never COD
  let shippingCharge = 0, etaDays = 5;

  if (deliveryMode === "pickup") {
    shippingCharge = 0; etaDays = 0;
  } else if (deliveryMode === "platform") {
    let maxCharge = 0, maxEta = 0;
    for (const item of rawItems) {
      const { charge, etaDays: eta } = calcShipping({
        fromState: item._sellerState, toState: shippingAddress.state,
        fromCity:  item._sellerCity,  toCity:  shippingAddress.city,
        orderTotal: itemsTotal, isCOD: false,
      });
      if (charge > maxCharge) maxCharge = charge;
      if (eta    > maxEta)    maxEta    = eta;
    }
    shippingCharge = maxCharge; etaDays = maxEta;
  } else if (deliveryMode === "self_ship") {
    let maxCharge = 0, maxEta = 0;
    for (const item of rawItems) {
      const { charge, etaDays: eta } = calcSelfShip({
        cfg: item._sellerDeliveryCfg,
        fromCity: item._sellerCity,   fromState: item._sellerState,
        toCity:   shippingAddress.city, toState: shippingAddress.state,
        orderTotal: itemsTotal, isCOD: false,
      });
      if (charge > maxCharge) maxCharge = charge;
      if (eta    > maxEta)    maxEta    = eta;
    }
    shippingCharge = maxCharge; etaDays = maxEta;
  }

  const platformFee = calcPlatformFee(itemsTotal);
  const totalAmount = itemsTotal + shippingCharge + platformFee;
  return { itemsTotal, shippingCharge, platformFee, totalAmount, etaDays };
}

// Whitelist — only these emails may use online payment during the demo phase
const ONLINE_PAYMENT_EMAILS = ["jayeshsevatkar55@gmail.com"];

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Step 1 — validate cart + create a Razorpay order (NO DB write)
// @route POST /api/orders/razorpay-init
// @access Private
export const razorpayInit = asyncHandler(async (req, res) => {
  const { cartItems, shippingAddress, deliveryMode = "self_ship", notes } = req.body;

  if (!ONLINE_PAYMENT_EMAILS.includes(req.user.email)) {
    res.status(403); throw new Error("Online payment is not available for your account yet.");
  }

  if (!cartItems?.length) { res.status(400); throw new Error("Cart is empty"); }

  // Validate stock & compute totals — throws if anything is wrong
  const rawItems = await buildOrderItems(cartItems);
  const { itemsTotal, shippingCharge, platformFee, totalAmount } =
    calcTotals({ rawItems, shippingAddress, deliveryMode });

  // Create Razorpay order (amount in paise)
  const amountPaise = Math.round(totalAmount * 100);
  const rpOrder = await razorpay.orders.create({
    amount:   amountPaise,
    currency: "INR",
    receipt:  `rzp_${Date.now()}`,
    notes: {
      buyerId:      req.user._id.toString(),
      deliveryMode,
    },
  });

  // Return everything the frontend needs to open the modal
  res.json({
    razorpayOrderId: rpOrder.id,
    amount:          amountPaise,
    currency:        "INR",
    key:             process.env.RAZORPAY_KEY_ID,
    // echo totals back so frontend can display them
    itemsTotal, shippingCharge, platformFee, totalAmount,
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Step 2 — verify Razorpay signature, THEN create DB order
// @route POST /api/orders/razorpay-confirm
// @access Private
export const razorpayConfirm = asyncHandler(async (req, res) => {
  const {
    razorpay_order_id, razorpay_payment_id, razorpay_signature,
    cartItems, shippingAddress, deliveryMode = "self_ship", notes,
  } = req.body;

  // 1. Verify signature first — reject immediately if tampered
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    res.status(400); throw new Error("Missing payment verification fields");
  }

  const body     = razorpay_order_id + "|" + razorpay_payment_id;
  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
    .update(body)
    .digest("hex");

  if (expected !== razorpay_signature) {
    res.status(400); throw new Error("Payment signature mismatch — possible fraud");
  }

  // 2. Re-validate cart (signature is good, now commit)
  if (!cartItems?.length) { res.status(400); throw new Error("Cart is empty"); }
  const rawItems = await buildOrderItems(cartItems);
  const { itemsTotal, shippingCharge, platformFee, totalAmount, etaDays } =
    calcTotals({ rawItems, shippingAddress, deliveryMode });

  const cleanItems        = rawItems.map(({ _sellerCity, _sellerState, _sellerDeliveryCfg, ...rest }) => rest);
  const estimatedDelivery = etaDays > 0 ? new Date(Date.now() + etaDays * 86_400_000) : undefined;

  // 3. Create DB order — only now
  const order = await Order.create({
    buyer:           req.user._id,
    items:           cleanItems,
    shippingAddress,
    itemsTotal, shippingCharge, platformFee,
    totalAmount, deliveryMode,
    paymentMethod:    "razorpay",
    paymentStatus:    "paid",
    razorpayOrderId:  razorpay_order_id,
    razorpayPaymentId: razorpay_payment_id,
    paidAt:           new Date(),
    orderStatus:      "confirmed",
    estimatedDelivery, notes,
    statusHistory: [
      { status: "pending",   note: "Order initiated via Razorpay",    updatedBy: "system" },
      { status: "confirmed", note: "Payment received via Razorpay",   updatedBy: "system" },
    ],
  });

  // 4. Decrement stock
  for (const item of rawItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }

  // 5. Emails (fire-and-forget)
  const buyerDoc = await User.findById(req.user._id).select("name email");
  if (buyerDoc?.email) {
    const { subject, html } = orderPlacedBuyerEmail({
      name:  buyerDoc.name,
      order: { ...order.toObject(), buyer: buyerDoc },
    });
    sendMail({ to: buyerDoc.email, subject, html });
  }

  const sellerIds = [...new Set(cleanItems.map((i) => i.seller.toString()))];
  for (const sellerId of sellerIds) {
    const sellerDoc = await User.findById(sellerId).select("name email sellerProfile");
    if (sellerDoc?.email) {
      const { subject, html } = newOrderSellerEmail({
        sellerName: sellerDoc.name,
        shopName:   sellerDoc.sellerProfile?.shopName || sellerDoc.name,
        order:      { ...order.toObject(), buyer: buyerDoc },
      });
      sendMail({ to: sellerDoc.email, subject, html });
    }
  }

  res.status(201).json(order);
});

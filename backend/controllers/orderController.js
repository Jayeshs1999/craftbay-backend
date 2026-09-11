import asyncHandler from "../middleware/asyncHandler.js";
import Order from "../models/orderModel.js";
import Product from "../models/productModel.js";
import User from "../models/userModel.js";
import { calcShipping, calcPlatformFee } from "../utils/deliveryHelper.js";
import { sendMail } from "../utils/mailer.js";
import {
  orderPlacedBuyerEmail,
  newOrderSellerEmail,
  orderStatusEmail,
} from "../utils/emailTemplates.js";

// --- Helper: resolve seller delivery config with defaults -------------------
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

// --- Helper: calc self-ship charge using seller's own config ----------------
function calcSelfShip({ cfg, fromCity, fromState, toCity, toState, orderTotal, isCOD }) {
  const dc = resolveDeliveryCfg(cfg);

  // Free-shipping threshold — zero delivery charge, COD surcharge does not apply
  if (dc.freeShippingAbove > 0 && orderTotal >= dc.freeShippingAbove) {
    return { charge: 0, etaDays: dc.estimatedDaysLocal };
  }

  const sameCity  = fromCity?.toLowerCase()  === toCity?.toLowerCase();
  const sameState = fromState?.toLowerCase() === toState?.toLowerCase();

  let base, etaDays;
  if (sameCity) {
    base    = dc.localCharge;
    etaDays = dc.estimatedDaysLocal;
  } else if (sameState) {
    base    = dc.regionalCharge;
    etaDays = dc.estimatedDaysRegional;
  } else {
    base    = dc.nationalCharge;
    etaDays = dc.estimatedDaysNational;
  }

  const codExtra = (isCOD && dc.codEnabled) ? dc.codExtraCharge : 0;
  return { charge: base + codExtra, etaDays };
}

// --- Helper: validate & price cart ------------------------------------------
async function buildOrderItems(cartItems) {
  const items = [];
  for (const ci of cartItems) {
    const product = await Product.findById(ci.product)
      .populate("seller", "sellerProfile.shopCity sellerProfile.shopState sellerProfile.deliveryConfig");
    if (!product || !product.isActive) throw new Error(`Product unavailable: ${ci.product}`);
    if (product.stock < ci.quantity) throw new Error(`Insufficient stock for: ${product.name}`);
    items.push({
      product:  product._id,
      seller:   product.seller._id,
      name:     product.name,
      image:    product.images[0]?.url || "",
      price:    product.price,
      quantity: ci.quantity,
      variant:  ci.variant || "",
      _sellerCity:         product.seller.sellerProfile?.shopCity,
      _sellerState:        product.seller.sellerProfile?.shopState,
      _sellerDeliveryCfg:  product.seller.sellerProfile?.deliveryConfig,
    });
  }
  return items;
}

// @desc  Calculate order quote (shipping + fees) � no DB write
// @route POST /api/orders/quote
// @access Private
export const getOrderQuote = asyncHandler(async (req, res) => {
  const { cartItems, shippingAddress, deliveryMode = "platform", paymentMethod = "razorpay" } = req.body;

  const items      = await buildOrderItems(cartItems);
  const itemsTotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const isCOD      = paymentMethod === "cod";

  // Local Pickup: no shipping charge, no COD surcharge — buyer pays at collection
  if (deliveryMode === "pickup") {
    const platformFee = calcPlatformFee(itemsTotal);
    return res.json({ itemsTotal, shippingCharge: 0, platformFee, totalAmount: itemsTotal + platformFee, deliveryMode });
  }

  let shippingCharge = 0;

  if (deliveryMode === "platform") {
    let maxCharge = 0;
    for (const item of items) {
      const { charge } = calcShipping({
        fromState: item._sellerState,
        toState:   shippingAddress.state,
        fromCity:  item._sellerCity,
        toCity:    shippingAddress.city,
        orderTotal: itemsTotal,
        isCOD,
      });
      if (charge > maxCharge) maxCharge = charge;
    }
    shippingCharge = maxCharge;
  } else if (deliveryMode === "self_ship") {
    // Use seller's own delivery config — max charge across sellers in cart
    let maxCharge = 0;
    for (const item of items) {
      const { charge } = calcSelfShip({
        cfg:       item._sellerDeliveryCfg,
        fromCity:  item._sellerCity,
        fromState: item._sellerState,
        toCity:    shippingAddress.city,
        toState:   shippingAddress.state,
        orderTotal: itemsTotal,
        isCOD,
      });
      if (charge > maxCharge) maxCharge = charge;
    }
    shippingCharge = maxCharge;

    // Collect delivery notes from all sellers (deduplicated)
    const deliveryNotes = [...new Set(
      items
        .map((i) => resolveDeliveryCfg(i._sellerDeliveryCfg).deliveryNote)
        .filter(Boolean)
    )];

    const platformFee = calcPlatformFee(itemsTotal);
    return res.json({
      itemsTotal, shippingCharge, platformFee,
      totalAmount: itemsTotal + shippingCharge + platformFee,
      deliveryMode,
      deliveryNotes,
    });
  }

  const platformFee  = calcPlatformFee(itemsTotal);
  const totalAmount  = itemsTotal + shippingCharge + platformFee;

  res.json({ itemsTotal, shippingCharge, platformFee, totalAmount, deliveryMode });
});

// @desc  Place an order
// @route POST /api/orders
// @access Private
export const createOrder = asyncHandler(async (req, res) => {
  const { cartItems, shippingAddress, deliveryMode = "platform", paymentMethod = "razorpay", notes } = req.body;

  if (!cartItems || cartItems.length === 0) { res.status(400); throw new Error("Cart is empty"); }

  const rawItems   = await buildOrderItems(cartItems);
  const itemsTotal = rawItems.reduce((s, i) => s + i.price * i.quantity, 0);
  const isCOD      = paymentMethod === "cod";

  let shippingCharge = 0, etaDays = 5;

  if (deliveryMode === "pickup") {
    // Local Pickup: zero shipping, zero COD surcharge, no estimated delivery date
    shippingCharge = 0;
    etaDays        = 0;
  } else if (deliveryMode === "platform") {
    let maxCharge = 0, maxEta = 0;
    for (const item of rawItems) {
      const { charge, etaDays: eta } = calcShipping({
        fromState: item._sellerState,
        toState:   shippingAddress.state,
        fromCity:  item._sellerCity,
        toCity:    shippingAddress.city,
        orderTotal: itemsTotal,
        isCOD,
      });
      if (charge > maxCharge) maxCharge = charge;
      if (eta   > maxEta)   maxEta   = eta;
    }
    shippingCharge = maxCharge;
    etaDays        = maxEta;
  } else if (deliveryMode === "self_ship") {
    let maxCharge = 0, maxEta = 0;
    for (const item of rawItems) {
      const { charge, etaDays: eta } = calcSelfShip({
        cfg:       item._sellerDeliveryCfg,
        fromCity:  item._sellerCity,
        fromState: item._sellerState,
        toCity:    shippingAddress.city,
        toState:   shippingAddress.state,
        orderTotal: itemsTotal,
        isCOD,
      });
      if (charge > maxCharge) maxCharge = charge;
      if (eta    > maxEta)   maxEta    = eta;
    }
    shippingCharge = maxCharge;
    etaDays        = maxEta;
  }

  const platformFee = calcPlatformFee(itemsTotal);
  const totalAmount = itemsTotal + shippingCharge + platformFee;

  // Strip internal helper fields before storing
  const cleanItems = rawItems.map(({ _sellerCity, _sellerState, ...rest }) => rest);

  // For pickup orders etaDays=0 means buyer collects — no estimated delivery date stored
  const estimatedDelivery = etaDays > 0 ? new Date(Date.now() + etaDays * 86_400_000) : undefined;

  const order = await Order.create({
    buyer: req.user._id,
    items: cleanItems,
    shippingAddress,
    itemsTotal, shippingCharge, platformFee,
    totalAmount, deliveryMode, paymentMethod,
    estimatedDelivery, notes,
    statusHistory: [{ status: "pending", note: deliveryMode === "pickup" ? "Order placed — awaiting pickup arrangement" : "Order placed", updatedBy: "system" }],
  });

  // Decrement stock
  for (const item of rawItems) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }

  // ── Emails (fire-and-forget) ──────────────────────────────────────────────
  // Populate buyer email for notifications
  const buyerDoc = await User.findById(req.user._id).select("name email");

  // 1. Confirmation to buyer
  if (buyerDoc?.email) {
    const { subject, html } = orderPlacedBuyerEmail({
      name:  buyerDoc.name,
      order: { ...order.toObject(), buyer: buyerDoc },
    });
    sendMail({ to: buyerDoc.email, subject, html });
  }

  // 2. New-order alert to each unique seller
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

// @desc  Get buyer's orders
// @route GET /api/orders/my
// @access Private
export const getMyOrders = asyncHandler(async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 10;
  const filter = { buyer: req.user._id };
  if (req.query.status) filter.orderStatus = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    Order.countDocuments(filter),
  ]);
  res.json({ orders, page, pages: Math.ceil(total / limit), total });
});

// @desc  Get single order (buyer or seller)
// @route GET /api/orders/:id
// @access Private
export const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate("buyer", "name email phone")
    .populate("items.product", "name images");

  if (!order) { res.status(404); throw new Error("Order not found"); }

  const isBuyer  = order.buyer._id.toString() === req.user._id.toString();
  const isSeller = order.items.some((i) => i.seller.toString() === req.user._id.toString());
  const isAdmin  = req.user.role === "admin";
  if (!isBuyer && !isSeller && !isAdmin) { res.status(403); throw new Error("Not authorized"); }

  res.json(order);
});

// @desc  Seller updates order status (processing ? shipped ? delivered)
// @route PUT /api/orders/:id/status
// @access Private/Seller or Admin
export const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note, trackingNumber, courier } = req.body;
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }

  const isSeller = order.items.some((i) => i.seller.toString() === req.user._id.toString());
  if (!isSeller && req.user.role !== "admin") { res.status(403); throw new Error("Not authorized"); }

  order.orderStatus = status;
  if (trackingNumber) order.trackingNumber = trackingNumber;
  if (courier)        order.courier = courier;
  order.statusHistory.push({ status, note, updatedBy: req.user.role === "admin" ? "admin" : "seller" });
  if (status === "delivered") order.paymentStatus = "paid";

  await order.save();

  // ── Email buyer about the status change (fire-and-forget) ─────────────────
  const buyerDoc = await User.findById(order.buyer).select("name email");
  if (buyerDoc?.email) {
    const { subject, html } = orderStatusEmail({
      name:      buyerDoc.name,
      order,
      newStatus: status,
      note,
    });
    sendMail({ to: buyerDoc.email, subject, html });
  }

  res.json(order);
});

// @desc  Buyer cancels an order
// @route PUT /api/orders/:id/cancel
// @access Private
export const cancelOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id);
  if (!order) { res.status(404); throw new Error("Order not found"); }
  if (order.buyer.toString() !== req.user._id.toString()) { res.status(403); throw new Error("Not authorized"); }
  if (["shipped","out_for_delivery","delivered"].includes(order.orderStatus)) {
    res.status(400); throw new Error("Cannot cancel once shipped");
  }

  order.orderStatus  = "cancelled";
  order.cancelReason = req.body.reason || "Buyer cancelled";
  order.statusHistory.push({ status: "cancelled", note: order.cancelReason, updatedBy: "buyer" });

  // Restore stock
  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: item.quantity } });
  }
  await order.save();
  res.json({ message: "Order cancelled" });
});

// @desc  Seller: get orders for my products
// @route GET /api/orders/seller
// @access Private/Seller
export const getSellerOrders = asyncHandler(async (req, res) => {
  const page  = Number(req.query.page)  || 1;
  const limit = Number(req.query.limit) || 20;
  const filter = { "items.seller": req.user._id };
  if (req.query.status) filter.orderStatus = req.query.status;

  const [orders, total] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit)
      .populate("buyer", "name email phone"),
    Order.countDocuments(filter),
  ]);
  res.json({ orders, page, pages: Math.ceil(total / limit), total });
});

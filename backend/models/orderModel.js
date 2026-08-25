import mongoose from "mongoose";

const orderItemSchema = new mongoose.Schema({
  product:   { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  seller:    { type: mongoose.Schema.Types.ObjectId, ref: "User",    required: true },
  name:      { type: String, required: true },
  image:     { type: String },
  price:     { type: Number, required: true },
  quantity:  { type: Number, required: true },
  variant:   { type: String },             // e.g. "Color: Red, Size: M"
});

const shippingAddressSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  phone:    { type: String, required: true },
  line1:    { type: String, required: true },
  line2:    { type: String },
  city:     { type: String, required: true },
  state:    { type: String, required: true },
  pincode:  { type: String, required: true },
  country:  { type: String, default: "India" },
});

/*
  Delivery modes:
  - "platform"  : We arrange courier (buyer pays platform shipping fee)
  - "self_ship" : Seller ships themselves (buyer pays seller's stated charge or free)
  - "pickup"    : Buyer picks up from seller's location (local only)
*/
const orderSchema = new mongoose.Schema(
  {
    buyer:           { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    items:           [orderItemSchema],
    shippingAddress: shippingAddressSchema,

    // Pricing breakdown
    itemsTotal:      { type: Number, required: true },
    shippingCharge:  { type: Number, default: 0 },
    platformFee:     { type: Number, default: 0 },   // 2% of order value
    discount:        { type: Number, default: 0 },
    totalAmount:     { type: Number, required: true },

    // Delivery
    deliveryMode:    {
      type: String,
      enum: ["platform", "self_ship", "pickup"],
      default: "platform",
    },
    estimatedDelivery: { type: Date },
    trackingNumber:  { type: String },
    courier:         { type: String },               // e.g. "Delhivery", "BlueDart"

    // Payment
    paymentMethod:   { type: String, enum: ["razorpay", "cod"], default: "razorpay" },
    paymentStatus:   { type: String, enum: ["pending", "paid", "failed", "refunded"], default: "pending" },
    razorpayOrderId: { type: String },
    razorpayPaymentId:{ type: String },
    paidAt:          { type: Date },

    // Order lifecycle
    orderStatus: {
      type: String,
      enum: [
        "pending",          // just placed, awaiting payment
        "confirmed",        // payment done
        "processing",       // seller packing
        "shipped",          // handed to courier / self-shipped
        "out_for_delivery", // last mile
        "delivered",        // completed
        "cancelled",
        "return_requested",
        "returned",
      ],
      default: "pending",
    },

    statusHistory: [
      {
        status:     { type: String },
        note:       { type: String },
        updatedBy:  { type: String, enum: ["system", "seller", "buyer", "admin"] },
        timestamp:  { type: Date, default: Date.now },
      },
    ],

    cancelReason: { type: String },
    notes:        { type: String },
  },
  { timestamps: true }
);

orderSchema.index({ buyer: 1, createdAt: -1 });
orderSchema.index({ "items.seller": 1, orderStatus: 1 });

const Order = mongoose.model("Order", orderSchema);
export default Order;

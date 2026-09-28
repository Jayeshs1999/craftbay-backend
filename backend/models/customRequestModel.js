import mongoose from "mongoose";

// ─── Bid Sub-schema ────────────────────────────────────────────────────────────
const bidSchema = new mongoose.Schema(
  {
    seller:       { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    price:        { type: Number, required: true, min: 1 },
    deliveryDays: { type: Number, required: true, min: 1 },
    note:         { type: String, trim: true, maxlength: 1000 },
    status:       {
      type: String,
      enum: ["pending", "accepted", "rejected"],
      default: "pending",
    },
    acceptedAt:   { type: Date },
  },
  { timestamps: true }
);

// ─── Custom Request Schema ─────────────────────────────────────────────────────
const customRequestSchema = new mongoose.Schema(
  {
    buyer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },

    title:       { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, trim: true, maxlength: 3000 },
    category:    { type: String, required: true, trim: true },
    budget:      { type: Number, default: null },       // optional max budget hint
    deadline:    { type: Date,   default: null },        // optional deadline
    buyerPhone:  { type: String, trim: true, default: "" }, // mandatory at creation
    images:      [
      {
        url:      { type: String },
        publicId: { type: String },
      },
    ],

    // Lifecycle status
    status: {
      type: String,
      enum: [
        "open",       // accepting bids
        "closed",     // bid accepted — no more bids
        "completed",  // buyer marked as completed
        "cancelled",  // buyer cancelled before any bid accepted
      ],
      default: "open",
    },

    bids:         [bidSchema],
    acceptedBid:  { type: mongoose.Schema.Types.ObjectId, default: null }, // ref inside bids array

    // The seller whose bid was accepted (denormalised for quick lookup)
    acceptedSeller: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },

    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Indexes for common query patterns
customRequestSchema.index({ buyer: 1, createdAt: -1 });
customRequestSchema.index({ status: 1, createdAt: -1 });
customRequestSchema.index({ "bids.seller": 1 });

const CustomRequest = mongoose.model("CustomRequest", customRequestSchema);
export default CustomRequest;

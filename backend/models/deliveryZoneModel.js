import mongoose from "mongoose";

/*
  Platform delivery tiers:
  - local   : same city   ? flat ?40
  - regional: same state  ? flat ?60
  - national: rest of India ? weight-based
    base ?80 + ?10 per 500g above 500g
  - cod_extra: ?30 on top for Cash-on-Delivery orders

  This model stores overrides; defaults live in the helper.
*/
const deliveryZoneSchema = new mongoose.Schema(
  {
    name:       { type: String, required: true },   // e.g. "Maharashtra Local"
    type:       { type: String, enum: ["local", "regional", "national"], required: true },
    states:     [String],                           // covered states
    pincodes:   [String],                           // specific pincode overrides
    baseCharge: { type: Number, required: true },   // ?
    perKgCharge:{ type: Number, default: 0 },       // additional ? per kg
    freeAbove:  { type: Number, default: 0 },       // free shipping if order > this
    etaDays:    { type: Number, default: 5 },       // estimated delivery days
    isActive:   { type: Boolean, default: true },
  },
  { timestamps: true }
);

const DeliveryZone = mongoose.model("DeliveryZone", deliveryZoneSchema);
export default DeliveryZone;

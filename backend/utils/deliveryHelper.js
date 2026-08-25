/**
 * Calculate platform shipping charge.
 *
 * @param {object} opts
 * @param {string} opts.fromState   - seller's state
 * @param {string} opts.toState     - buyer's state
 * @param {string} opts.fromCity    - seller's city
 * @param {string} opts.toCity      - buyer's city
 * @param {number} opts.weightGrams - total weight of order items (grams)
 * @param {number} opts.orderTotal  - cart value in ?
 * @param {boolean} opts.isCOD      - cash on delivery?
 * @returns {{ charge: number, zone: string, etaDays: number }}
 */
export function calcShipping({ fromState, toState, fromCity, toCity, weightGrams = 500, orderTotal = 0, isCOD = false }) {
  const weightKg = weightGrams / 1000;

  let zone, base, etaDays;

  const sameCity  = fromCity?.toLowerCase()  === toCity?.toLowerCase();
  const sameState = fromState?.toLowerCase() === toState?.toLowerCase();

  if (sameCity) {
    zone    = "local";
    base    = 40;
    etaDays = 2;
  } else if (sameState) {
    zone    = "regional";
    base    = 60;
    etaDays = 3;
  } else {
    zone    = "national";
    base    = 80;
    etaDays = 7;
    // Extra ?10 per 500 g above first 500 g
    if (weightGrams > 500) {
      const extraSlabs = Math.ceil((weightGrams - 500) / 500);
      base += extraSlabs * 10;
    }
    // Heavy items (>5 kg): add ?15/kg
    if (weightKg > 5) {
      base += Math.ceil(weightKg - 5) * 15;
    }
  }

  // Free shipping if order = ?999
  if (orderTotal >= 999) {
    base = 0;
  }

  // COD surcharge
  const codExtra = isCOD ? 30 : 0;

  return { charge: base + codExtra, zone, etaDays };
}

/**
 * Platform fee: 2% of order value (min ?2, max ?50).
 */
export function calcPlatformFee(orderTotal) {
  const fee = orderTotal * 0.02;
  return Math.min(Math.max(fee, 2), 50);
}

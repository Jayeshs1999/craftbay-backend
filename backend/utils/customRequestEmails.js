/**
 * Email templates for the Custom Request / Bid feature.
 * All templates follow the same layout/helper pattern as emailTemplates.js
 */

const FRONTEND = process.env.FRONTEND_URL || "https://banavoo.in";
const BRAND    = process.env.SMTP_FROM_NAME || "Banavoo";
const ACCENT   = "#059669";

// ─── Layout ───────────────────────────────────────────────────────────────────
function layout(title, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">
        <tr>
          <td style="background:${ACCENT};padding:28px 32px;text-align:center;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${BRAND}</span>
          </td>
        </tr>
        <tr><td style="padding:32px 32px 24px;">${bodyHtml}</td></tr>
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:18px 32px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">
              © ${new Date().getFullYear()} ${BRAND} · <a href="${FRONTEND}" style="color:${ACCENT};text-decoration:none;">${FRONTEND.replace(/https?:\/\//, "")}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const h2  = (t)     => `<h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">${t}</h2>`;
const p   = (t)     => `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">${t}</p>`;
const sm  = (t)     => `<p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#6b7280;">${t}</p>`;
const btn = (l, u)  => `<a href="${u}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:${ACCENT};color:#ffffff;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none;">${l}</a>`;
const div = ()      => `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>`;
const badge = (t, bg = "#d1fae5", tc = "#065f46") =>
  `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${bg};color:${tc};font-size:12px;font-weight:600;">${t}</span>`;

function infoBox(rows) {
  const cells = rows.map(([label, value]) =>
    `<tr>
       <td style="padding:8px 12px;font-size:13px;color:#6b7280;width:45%;border-bottom:1px solid #f3f4f6;">${label}</td>
       <td style="padding:8px 12px;font-size:13px;color:#111827;font-weight:600;border-bottom:1px solid #f3f4f6;">${value}</td>
     </tr>`
  ).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0"
    style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin:16px 0 20px;">
    <tbody style="background:#f9fafb;">${cells}</tbody>
  </table>`;
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

// ─── 1. New custom request posted → sent to every seller ─────────────────────
/**
 * @param {{ seller: object, creq: object, buyerName: string }} opts
 */
export function customRequestPostedToSeller({ seller, creq, buyerName }) {
  const requestUrl = `${FRONTEND}/custom-requests/${creq._id}`;
  const shopName   = seller?.sellerProfile?.shopName || seller?.name || "Seller";

  const body =
    h2("A buyer wants something custom-made! 🛠️") +
    p(`Hi <strong>${shopName}</strong>, a buyer just posted a new custom order request on Banavoo. If you can make it, place your bid now!`) +
    infoBox([
      ["Buyer",       buyerName],
      ["Request",     creq.title],
      ["Category",    creq.category],
      ["Budget hint", creq.budget ? `Up to ₹${Number(creq.budget).toLocaleString("en-IN")}` : "Not specified"],
      ["Deadline",    creq.deadline ? fmtDate(creq.deadline) : "No deadline"],
      ["Posted on",   fmtDate(creq.createdAt)],
    ]) +
    `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
       <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#065f46;">What the buyer wants:</p>
       <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${creq.description.replace(/\n/g, "<br/>")}</p>
     </div>` +
    p("Interested? Click the button below to view the full request and place your bid. First-come, best-placed bids get noticed!") +
    btn("View Request & Place Bid", requestUrl) +
    div() +
    sm("You received this because you are a registered seller on Banavoo. Bids can be placed from your seller dashboard.");

  return layout(`New Custom Request: ${creq.title}`, body);
}

// ─── 2. New bid received → sent to the buyer ─────────────────────────────────
/**
 * @param {{ buyer: object, creq: object, bid: object, seller: object }} opts
 */
export function newBidReceivedToBuyer({ buyer, creq, bid, seller }) {
  const requestUrl = `${FRONTEND}/custom-requests/my`;
  const shopName   = seller?.sellerProfile?.shopName || seller?.name;

  const body =
    h2("You received a new bid! 🎉") +
    p(`Hi <strong>${buyer.name}</strong>, a seller has placed a bid on your custom request. Review it and accept if it looks good!`) +
    infoBox([
      ["Your request", creq.title],
      ["Seller",       shopName || seller.name],
      ["Bid amount",   `₹${Number(bid.price).toLocaleString("en-IN")}`],
      ["Delivery in",  `${bid.deliveryDays} day${bid.deliveryDays !== 1 ? "s" : ""}`],
    ]) +
    (bid.note
      ? `<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
           <p style="margin:0 0 6px;font-size:13px;font-weight:600;color:#1e40af;">Seller's note:</p>
           <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">${bid.note.replace(/\n/g, "<br/>")}</p>
         </div>`
      : "") +
    p("You can view all bids and accept the one that fits best from your dashboard.") +
    btn("View All Bids", requestUrl) +
    div() +
    sm("Once you accept a bid, the request is closed and the seller's contact details are revealed to you so you can coordinate directly.");

  return layout(`New bid on "${creq.title}"`, body);
}

// ─── 3. Bid accepted → sent to the accepted seller ───────────────────────────
/**
 * @param {{ seller: object, creq: object, bid: object, buyer: object }} opts
 */
export function bidAcceptedToSeller({ seller, creq, bid, buyer }) {
  const shopName = seller?.sellerProfile?.shopName || seller?.name;

  const body =
    `<div style="text-align:center;margin-bottom:24px;">
       <span style="font-size:48px;">🎊</span>
       <br/><br/>
       ${badge("BID ACCEPTED", "#d1fae5", "#065f46")}
     </div>` +
    h2("Congratulations! Your bid was accepted.") +
    p(`Hi <strong>${shopName}</strong>, great news! The buyer has accepted your bid for the custom request below. Please reach out to them using the contact details provided.`) +
    infoBox([
      ["Request",       creq.title],
      ["Your price",    `₹${Number(bid.price).toLocaleString("en-IN")}`],
      ["Delivery in",   `${bid.deliveryDays} day${bid.deliveryDays !== 1 ? "s" : ""}`],
      ["Accepted on",   fmtDate(new Date())],
    ]) +
    div() +
    `<div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:10px;padding:18px 20px;margin-bottom:20px;">
       <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#9a3412;">🤝 Buyer Contact Details</p>
       <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Name:</strong> ${buyer.name}</p>
       ${buyer.phone ? `<p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Phone / WhatsApp:</strong> ${buyer.phone}</p>` : ""}
       <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>Email:</strong> ${buyer.email}</p>
     </div>` +
    p("Next steps: Contact the buyer on WhatsApp or phone, agree on final details, craft the item, and deliver it directly to them.") +
    btn("View Request Details", `${FRONTEND}/custom-requests/${creq._id}`) +
    div() +
    sm("Deliver as per the agreed timeline to build your reputation on Banavoo. Happy crafting! 🌿");

  return layout(`Your bid was accepted — "${creq.title}"`, body);
}

// ─── 4. Bid rejected (request closed) → sent to non-accepted sellers ─────────
/**
 * @param {{ seller: object, creq: object }} opts
 */
export function bidRejectedToSeller({ seller, creq }) {
  const shopName = seller?.sellerProfile?.shopName || seller?.name;

  const body =
    h2("The request has been fulfilled") +
    p(`Hi <strong>${shopName}</strong>, the buyer chose another seller for the following custom request. Don't be discouraged — keep bidding on other requests!`) +
    infoBox([
      ["Request",  creq.title],
      ["Category", creq.category],
      ["Closed on", fmtDate(new Date())],
    ]) +
    btn("Browse Open Requests", `${FRONTEND}/seller/custom-requests`) +
    div() +
    sm("You received this because you placed a bid on this request. No further action is needed.");

  return layout(`Request "${creq.title}" has been closed`, body);
}

// Alias used in routes (same content, different naming convention)
export const requestClosedToOtherSellers = bidRejectedToSeller;

// ─── 5. Request cancelled by buyer → sent to every seller who bid ─────────────
/**
 * @param {{ seller: object, creq: object }} opts
 */
export function requestCancelledToSeller({ seller, creq }) {
  const shopName = seller?.sellerProfile?.shopName || seller?.name;

  const body =
    `<div style="text-align:center;margin-bottom:24px;">
       <span style="font-size:48px;">❌</span>
     </div>` +
    h2("Custom request cancelled") +
    p(`Hi <strong>${shopName}</strong>, the buyer has cancelled the following custom request. Your bid has been automatically voided — no further action is required.`) +
    infoBox([
      ["Request",      creq.title],
      ["Category",     creq.category],
      ["Your bid",     creq._bidPrice ? `₹${Number(creq._bidPrice).toLocaleString("en-IN")}` : "—"],
      ["Cancelled on", fmtDate(new Date())],
    ]) +
    `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:14px 16px;margin-bottom:20px;">
       <p style="margin:0;font-size:13px;color:#991b1b;">
         This request is now closed. There are plenty of other open requests waiting for your skills!
       </p>
     </div>` +
    btn("Browse Other Requests", `${FRONTEND}/seller/custom-requests`) +
    div() +
    sm("You received this because you placed a bid on this request.");

  return layout(`Request "${creq.title}" was cancelled`, body);
}

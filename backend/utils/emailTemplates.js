const FRONTEND = process.env.FRONTEND_URL || "https://banavoo.in";
const BRAND    = process.env.SMTP_FROM_NAME || "Banavoo";
const ACCENT   = "#059669";

// ─── Shared layout wrapper ────────────────────────────────────────────────────
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

        <!-- Header -->
        <tr>
          <td style="background:${ACCENT};padding:28px 32px;text-align:center;">
            <span style="font-size:22px;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">${BRAND}</span>
          </td>
        </tr>

        <!-- Body -->
        <tr><td style="padding:32px 32px 24px;">${bodyHtml}</td></tr>

        <!-- Footer -->
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

// ─── Shared helpers ───────────────────────────────────────────────────────────
function h2(text) {
  return `<h2 style="margin:0 0 12px;font-size:20px;font-weight:700;color:#111827;">${text}</h2>`;
}
function p(text) {
  return `<p style="margin:0 0 14px;font-size:15px;line-height:1.6;color:#374151;">${text}</p>`;
}
function btn(label, url) {
  return `<a href="${url}" style="display:inline-block;margin-top:8px;padding:12px 28px;background:${ACCENT};color:#ffffff;font-size:14px;font-weight:600;border-radius:10px;text-decoration:none;">${label}</a>`;
}
function badge(text, color = "#d1fae5", textColor = "#065f46") {
  return `<span style="display:inline-block;padding:4px 12px;border-radius:999px;background:${color};color:${textColor};font-size:12px;font-weight:600;">${text}</span>`;
}
function divider() {
  return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;"/>`;
}
function infoRow(label, value) {
  return `<tr>
    <td style="padding:8px 0;font-size:13px;color:#6b7280;width:40%;">${label}</td>
    <td style="padding:8px 0;font-size:13px;color:#111827;font-weight:600;">${value}</td>
  </tr>`;
}
function infoTable(rows) {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px;">
    <tbody style="background:#f9fafb;">${rows}</tbody>
  </table>`;
}
function itemsBlock(items) {
  const rows = items.map(it =>
    `<tr>
      <td style="padding:10px 14px;font-size:13px;color:#374151;border-bottom:1px solid #f3f4f6;">
        ${it.name}${it.variant ? ` <span style="color:#9ca3af;">(${it.variant})</span>` : ""}
      </td>
      <td style="padding:10px 14px;font-size:13px;color:#6b7280;border-bottom:1px solid #f3f4f6;text-align:center;">×${it.quantity}</td>
      <td style="padding:10px 14px;font-size:13px;font-weight:600;color:#111827;border-bottom:1px solid #f3f4f6;text-align:right;">
        Rs.${(it.price * it.quantity).toLocaleString("en-IN")}
      </td>
    </tr>`
  ).join("");
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;margin-bottom:20px;">
    <thead>
      <tr style="background:#f3f4f6;">
        <th style="padding:10px 14px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;">ITEM</th>
        <th style="padding:10px 14px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;">QTY</th>
        <th style="padding:10px 14px;text-align:right;font-size:12px;color:#6b7280;font-weight:600;">TOTAL</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function fmtAddr(a) {
  const parts = [a.line1, a.line2, a.city, a.state, a.pincode, a.country || "India"].filter(Boolean);
  return parts.join(", ");
}

function fmtDate(d) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
}

const STATUS_LABEL = {
  pending:          "Pending",
  confirmed:        "Confirmed",
  processing:       "Processing",
  shipped:          "Shipped",
  out_for_delivery: "Out for Delivery",
  delivered:        "Delivered",
  cancelled:        "Cancelled",
  return_requested: "Return Requested",
  returned:         "Returned",
};
const STATUS_COLOR = {
  pending:          ["#fef3c7","#92400e"],
  confirmed:        ["#dbeafe","#1e40af"],
  processing:       ["#ffedd5","#9a3412"],
  shipped:          ["#ede9fe","#5b21b6"],
  out_for_delivery: ["#e0e7ff","#3730a3"],
  delivered:        ["#d1fae5","#065f46"],
  cancelled:        ["#fee2e2","#991b1b"],
  return_requested: ["#fce7f3","#9d174d"],
  returned:         ["#f3f4f6","#374151"],
};

// ─────────────────────────────────────────────────────────────────────────────
// 1. WELCOME — after user registration
// ─────────────────────────────────────────────────────────────────────────────
export function welcomeEmail({ name }) {
  return {
    subject: `Welcome to ${BRAND} 🎉`,
    html: layout(`Welcome to ${BRAND}`,
      h2(`Hey ${name}, welcome aboard! 👋`) +
      p(`We're excited to have you on <strong>${BRAND}</strong> — your destination for handcrafted, artisan goods made with love.`) +
      p(`Start exploring thousands of unique handmade products, or set up your own shop and reach buyers across India.`) +
      divider() +
      `<div style="text-align:center;margin-top:8px;">` +
        btn("Shop Now", `${FRONTEND}/products`) +
        `&nbsp;&nbsp;` +
        `<a href="${FRONTEND}/become-seller" style="display:inline-block;margin-top:8px;padding:12px 28px;border:2px solid ${ACCENT};color:${ACCENT};font-size:14px;font-weight:600;border-radius:10px;text-decoration:none;">Become a Seller</a>` +
      `</div>`
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. SELLER ACTIVATED — after becomeSeller
// ─────────────────────────────────────────────────────────────────────────────
export function sellerActivatedEmail({ name, shopName }) {
  return {
    subject: `Your seller account is live — ${shopName}`,
    html: layout("Seller Account Activated",
      h2(`Congratulations, ${name}! 🎊`) +
      p(`Your seller account for <strong>${shopName}</strong> is now active. You can start listing products right away.`) +
      infoTable(
        infoRow("Shop Name", shopName) +
        infoRow("Status", badge("Active"))
      ) +
      p(`Here are a few tips to get your first sale:`) +
      `<ul style="margin:0 0 16px;padding-left:20px;font-size:14px;color:#374151;line-height:1.8;">
        <li>Upload clear, well-lit product photos</li>
        <li>Write detailed descriptions — materials, size, care instructions</li>
        <li>Respond to orders within 24 hours</li>
      </ul>` +
      `<div style="text-align:center;">` + btn("Go to Seller Dashboard", `${FRONTEND}/seller`) + `</div>`
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. ORDER PLACED — to buyer
// ─────────────────────────────────────────────────────────────────────────────
export function orderPlacedBuyerEmail({ name, order }) {
  const addr = order.shippingAddress;
  const eta  = order.estimatedDelivery ? fmtDate(order.estimatedDelivery) : "5–7 business days";

  return {
    subject: `Order confirmed #${order._id.toString().slice(-8).toUpperCase()} — ${BRAND}`,
    html: layout("Order Confirmed",
      h2("Your order is confirmed! ✅") +
      p(`Hi <strong>${name}</strong>, we've received your order and it's being processed by the seller.`) +
      infoTable(
        infoRow("Order ID",     `#${order._id.toString().slice(-8).toUpperCase()}`) +
        infoRow("Date",         fmtDate(order.createdAt || new Date())) +
        infoRow("Payment",      order.paymentMethod?.toUpperCase()) +
        infoRow("Est. Delivery", eta)
      ) +
      itemsBlock(order.items) +
      infoTable(
        infoRow("Items Total",   `Rs.${order.itemsTotal?.toLocaleString("en-IN")}`) +
        (order.shippingCharge > 0 ? infoRow("Shipping", `Rs.${order.shippingCharge?.toLocaleString("en-IN")}`) : "") +
        (order.platformFee > 0   ? infoRow("Platform Fee", `Rs.${order.platformFee?.toLocaleString("en-IN")}`) : "") +
        (order.discount > 0      ? infoRow("Discount",  `-Rs.${order.discount?.toLocaleString("en-IN")}`) : "") +
        infoRow("Grand Total",   `<span style="font-size:16px;color:${ACCENT};">Rs.${order.totalAmount?.toLocaleString("en-IN")}</span>`)
      ) +
      `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Delivery Address</p>
        <p style="margin:0;font-size:14px;color:#374151;">${addr.fullName} · ${addr.phone}<br/>${fmtAddr(addr)}</p>
      </div>` +
      `<div style="text-align:center;">` + btn("View Order", `${FRONTEND}/dashboard`) + `</div>`
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. NEW ORDER ALERT — to seller
// ─────────────────────────────────────────────────────────────────────────────
export function newOrderSellerEmail({ sellerName, shopName, order }) {
  const buyer = order.buyer;
  const addr  = order.shippingAddress;

  return {
    subject: `New order received #${order._id.toString().slice(-8).toUpperCase()} — ${shopName}`,
    html: layout("New Order Received",
      h2(`You have a new order! 🛍️`) +
      p(`Hi <strong>${sellerName}</strong>, someone just placed an order in your shop <strong>${shopName}</strong>. Please confirm and process it within 24 hours.`) +
      infoTable(
        infoRow("Order ID", `#${order._id.toString().slice(-8).toUpperCase()}`) +
        infoRow("Date",     fmtDate(order.createdAt || new Date())) +
        infoRow("Payment",  order.paymentMethod?.toUpperCase()) +
        infoRow("Total",    `Rs.${order.totalAmount?.toLocaleString("en-IN")}`)
      ) +
      itemsBlock(order.items) +
      `<div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;padding:14px 18px;margin-bottom:20px;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:600;color:#6b7280;text-transform:uppercase;">Buyer &amp; Delivery Info</p>
        <p style="margin:0 0 4px;font-size:14px;color:#374151;"><strong>${buyer?.name || addr.fullName}</strong>${buyer?.phone ? ` · ${buyer.phone}` : ""}</p>
        <p style="margin:0;font-size:14px;color:#6b7280;">${addr.fullName} · ${addr.phone}<br/>${fmtAddr(addr)}</p>
      </div>` +
      `<div style="text-align:center;">` + btn("Manage Order", `${FRONTEND}/seller`) + `</div>`
    ),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. ORDER STATUS UPDATE — to buyer
// ─────────────────────────────────────────────────────────────────────────────
export function orderStatusEmail({ name, order, newStatus, note }) {
  const [bgColor, txtColor] = STATUS_COLOR[newStatus] || ["#f3f4f6","#374151"];
  const label  = STATUS_LABEL[newStatus] || newStatus;
  const isShipped   = newStatus === "shipped" || newStatus === "out_for_delivery";
  const isDelivered = newStatus === "delivered";
  const isCancelled = newStatus === "cancelled";

  let statusIcon = "📦";
  if (isShipped)   statusIcon = "🚚";
  if (isDelivered) statusIcon = "✅";
  if (isCancelled) statusIcon = "❌";

  let extraBlock = "";
  if (isShipped && order.trackingNumber) {
    extraBlock = infoTable(
      infoRow("Courier",          order.courier || "—") +
      infoRow("Tracking Number",  order.trackingNumber)
    );
  }
  if (isDelivered) {
    extraBlock = p(`Your order has been delivered! We hope you love what you ordered. Please take a moment to leave a review for the seller.`);
  }
  if (isCancelled) {
    extraBlock = p(`Your order has been cancelled${note ? `: <em>${note}</em>` : "."}` +
      ` If you paid online, your refund will be initiated within 5–7 business days.`);
  }

  return {
    subject: `Order #${order._id.toString().slice(-8).toUpperCase()} is now ${label} ${statusIcon}`,
    html: layout(`Order ${label}`,
      h2(`Order status updated ${statusIcon}`) +
      p(`Hi <strong>${name}</strong>, here's the latest update on your order.`) +
      `<div style="text-align:center;margin:20px 0;">` +
        badge(label, bgColor, txtColor) +
      `</div>` +
      infoTable(
        infoRow("Order ID", `#${order._id.toString().slice(-8).toUpperCase()}`) +
        infoRow("Status",   label) +
        (order.estimatedDelivery && !isDelivered && !isCancelled
          ? infoRow("Est. Delivery", fmtDate(order.estimatedDelivery))
          : "")
      ) +
      extraBlock +
      `<div style="text-align:center;">` + btn("Track Order", `${FRONTEND}/dashboard`) + `</div>`
    ),
  };
}

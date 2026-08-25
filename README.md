# CraftBay Backend

Express + MongoDB REST API for the CraftBay handmade marketplace.

## Stack
- Node.js 18+ (ESM)
- Express 4
- MongoDB + Mongoose
- JWT authentication (httpOnly cookie)
- Cloudinary (image uploads)
- Razorpay (payments)
- Multer (file handling)

## Setup

1. `cp example.env .env` — fill in all values
2. `npm install`
3. `npm run dev`

## API Routes

| Route | Description |
|-------|-------------|
| `POST /api/auth/register` | Register user |
| `POST /api/auth/login` | Login |
| `GET  /api/auth/me` | Get current user |
| `PUT  /api/auth/become-seller` | Activate seller account |
| `GET  /api/products` | List products (public) |
| `GET  /api/products/:id` | Product detail (public) |
| `POST /api/products` | Create product (seller) |
| `PUT  /api/products/:id` | Update product (seller) |
| `GET  /api/products/my` | Seller'\''s own products |
| `POST /api/orders` | Place order (buyer) |
| `GET  /api/orders/my` | Buyer orders |
| `GET  /api/orders/seller` | Seller orders |
| `PUT  /api/orders/:id/status` | Update order status (seller) |
| `POST /api/delivery/quote` | Calculate shipping |
| `GET  /api/wishlist` | Get wishlist |
| `POST /api/wishlist/:productId` | Toggle wishlist item |

## Delivery Logic

Three modes supported:
- **platform** — CraftBay arranges courier pickup (?40 local / ?60 regional / ?80+ national; free on orders = ?999)
- **self_ship** — Seller ships independently
- **pickup** — Buyer collects from seller (free)

Platform fee: 2% of order value (min ?2, max ?50)

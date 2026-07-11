# CHILLZ — Lifestyle Venue Discovery App

Lagos & Port Harcourt's premier venue and event discovery platform.

## Stack
- **Frontend**: Next.js 15, TypeScript, Tailwind CSS, Framer Motion
- **Backend**: Supabase (PostgreSQL + PostGIS + Realtime + Auth + RLS)
- **Payments**: Paystack (wallet funding + vendor payouts)
- **Maps**: Google Places API + Mapbox
- **State**: Zustand + React Query

## Setup

```bash
npm install
cp .env.local .env.local  # Fill in your keys
npm run dev
```

## Environment Variables
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_PAYSTACK_PUBLIC_KEY=
PAYSTACK_SECRET_KEY=
NEXT_PUBLIC_GOOGLE_PLACES_API_KEY=
```

## Database Setup
Run `supabase/schema.sql` in your Supabase SQL editor.

## Architecture

### Money Flow (Ledger-based)
All balances are calculated from `ledger_entries`. Never stored directly.

1. User funds wallet → `PAYSTACK_INFLOW` debit, `USER_WALLET` credit
2. Booking created → `USER_WALLET` debit, `USER_RESERVED` credit
3. Receipt confirmed → `USER_RESERVED` debit, `VENDOR_PENDING` credit (95%), `CHILLZ_REVENUE` credit (5%)
4. Vendor withdraws → `VENDOR_PENDING` debit, `PAYSTACK_OUTFLOW` credit

### Dispute Flow
- User rejects receipt → vendor gets 3 attempts
- After 3 rejections: escalate to escrow (admin mediates in 8hrs) OR settle offline
- Refund on cancellation: 95% to user, 5% cancellation fee retained

### Pages
- `/` — Splash screen
- `/home` — Home feed (categories, trending events, featured)
- `/login` — Auth (email OTP + Google)
- `/category/[slug]` — Category listing with filters
- `/venue/[id]` — Venue detail + booking
- `/booking/[id]` — Booking detail + QR + receipt flow
- `/tickets` — All user bookings/tickets
- `/wallet` — Balance + transactions + fund
- `/search` — Global fuzzy search
- `/profile` — User profile
- `/admin` — Admin dashboard
- `/vendor` — Vendor dashboard
- `/vendor/scan` — QR check-in page

## Categories
Events, Bar & Lounge, Outdoorsy, Restaurant, Club, Hotel,
Car Rentals, Apartment Bookings, Let's Plan For You, Flight Booking (coming soon)

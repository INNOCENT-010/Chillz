-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- USERS
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'vendor', 'admin')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- USER PREFERENCES
CREATE TABLE user_preferences (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  category_views JSONB DEFAULT '{}',
  event_tag_affinity JSONB DEFAULT '{}',
  frequent_locations JSONB DEFAULT '[]',
  last_updated TIMESTAMPTZ DEFAULT NOW()
);

-- VENDORS
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  business_name TEXT NOT NULL,
  business_address TEXT NOT NULL,
  place_id TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  vendor_type TEXT NOT NULL CHECK (vendor_type IN ('venue', 'car_rental', 'apartment', 'event')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
  kyc_data JSONB DEFAULT '{}',
  bank_account JSONB,
  registration_link_token TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- VENUES
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  place_id TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  images TEXT[] DEFAULT '{}',
  filters TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX venues_location_idx ON venues USING GIST(location);
CREATE INDEX venues_category_idx ON venues(category);
CREATE INDEX venues_name_trgm ON venues USING GIN(name gin_trgm_ops);

-- EVENTS
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  description TEXT,
  cover_image TEXT,
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  is_outdoor BOOLEAN DEFAULT false,
  creator_type TEXT NOT NULL CHECK (creator_type IN ('admin', 'vendor')),
  created_by UUID REFERENCES users(id),
  vendor_id UUID REFERENCES vendors(id),
  venue_id UUID REFERENCES venues(id),
  place_id TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  ticket_price BIGINT NOT NULL DEFAULT 0,
  total_tickets INTEGER NOT NULL DEFAULT 0,
  tickets_sold INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX events_location_idx ON events USING GIST(location);
CREATE INDEX events_tags_idx ON events USING GIN(tags);
CREATE INDEX events_title_trgm ON events USING GIN(title gin_trgm_ops);

-- CAR LISTINGS
CREATE TABLE car_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  make TEXT NOT NULL,
  model TEXT NOT NULL,
  year INTEGER NOT NULL,
  images TEXT[] DEFAULT '{}',
  rental_types TEXT[] DEFAULT '{}',
  price_per_day BIGINT NOT NULL,
  is_available BOOLEAN DEFAULT true,
  features TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- APARTMENT LISTINGS
CREATE TABLE apartment_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID REFERENCES vendors(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  images TEXT[] DEFAULT '{}',
  apartment_type TEXT NOT NULL CHECK (apartment_type IN ('shortlet', 'weekend_getaway', 'extended_stay')),
  place_id TEXT NOT NULL,
  address TEXT NOT NULL,
  location GEOGRAPHY(POINT, 4326),
  price_per_night BIGINT NOT NULL,
  bedrooms INTEGER DEFAULT 1,
  bathrooms INTEGER DEFAULT 1,
  amenities TEXT[] DEFAULT '{}',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX apartments_location_idx ON apartment_listings USING GIST(location);

-- LEDGER
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  transaction_id UUID NOT NULL,
  account_type TEXT NOT NULL,
  account_id UUID NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
  amount BIGINT NOT NULL,
  reference TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX ledger_account_idx ON ledger_entries(account_type, account_id);
CREATE INDEX ledger_transaction_idx ON ledger_entries(transaction_id);
CREATE INDEX ledger_created_at_idx ON ledger_entries(created_at DESC);

CREATE OR REPLACE VIEW ledger_balances AS
SELECT account_type, account_id,
  SUM(CASE WHEN direction = 'CREDIT' THEN amount ELSE -amount END) AS balance
FROM ledger_entries GROUP BY account_type, account_id;

-- BOOKINGS
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  vendor_id UUID REFERENCES vendors(id),
  booking_type TEXT NOT NULL CHECK (booking_type IN ('venue', 'event', 'car_rental', 'apartment')),
  reference_id UUID NOT NULL,
  qr_code TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'disputed')),
  reserved_amount BIGINT NOT NULL,
  final_amount BIGINT,
  party_size INTEGER,
  check_in TIMESTAMPTZ,
  check_out TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX bookings_user_idx ON bookings(user_id);
CREATE INDEX bookings_vendor_idx ON bookings(vendor_id);
CREATE INDEX bookings_qr_idx ON bookings(qr_code);

-- RECEIPTS
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID UNIQUE REFERENCES bookings(id),
  vendor_id UUID REFERENCES vendors(id),
  user_id UUID REFERENCES users(id),
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal BIGINT NOT NULL DEFAULT 0,
  chillz_fee BIGINT NOT NULL DEFAULT 0,
  total BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','confirmed','rejected','disputed','settled_offline','escrow')),
  reject_count INTEGER DEFAULT 0,
  dispute_opened_at TIMESTAMPTZ,
  dispute_resolved_at TIMESTAMPTZ,
  settle_offline_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- REVIEWS
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  vendor_id UUID REFERENCES vendors(id),
  booking_id UUID UNIQUE REFERENCES bookings(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  vendor_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX reviews_vendor_idx ON reviews(vendor_id);

CREATE OR REPLACE VIEW vendor_ratings AS
SELECT vendor_id, AVG(rating)::NUMERIC(3,2) AS avg_rating, COUNT(*) AS total_reviews
FROM reviews GROUP BY vendor_id;

-- NOTIFICATIONS
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  reference_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "bookings_own" ON bookings FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "receipts_own" ON receipts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "notifications_own" ON notifications FOR ALL USING (auth.uid() = user_id);

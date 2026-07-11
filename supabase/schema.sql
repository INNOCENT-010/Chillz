-- Enable PostGIS for geo queries
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Users
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  google_id TEXT,
  location_lat FLOAT,
  location_lng FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vendors
CREATE TABLE vendors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  business_name TEXT NOT NULL,
  vendor_type TEXT NOT NULL,
  kyc_status TEXT DEFAULT 'pending',
  google_place_id TEXT,
  address TEXT,
  lat FLOAT,
  lng FLOAT,
  bank_account_number TEXT,
  bank_name TEXT,
  bank_code TEXT,
  payout_schedule TEXT DEFAULT 'daily',
  commission_rate FLOAT DEFAULT 0.05,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Venues
CREATE TABLE venues (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  google_place_id TEXT NOT NULL,
  address TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  location GEOGRAPHY(POINT,4326),
  images TEXT[] DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  filters TEXT[] DEFAULT '{}',
  rating FLOAT DEFAULT 0,
  review_count INT DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create PostGIS index for geo queries
CREATE INDEX venues_location_idx ON venues USING GIST(location);
CREATE INDEX venues_category_idx ON venues(category);
CREATE INDEX venues_active_idx ON venues(is_active);

-- Events
CREATE TABLE events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id UUID REFERENCES vendors(id),
  venue_id UUID REFERENCES venues(id),
  created_by_admin BOOLEAN DEFAULT false,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  category TEXT DEFAULT 'events',
  event_tags TEXT[] DEFAULT '{}',
  is_outdoor BOOLEAN DEFAULT false,
  google_place_id TEXT NOT NULL,
  address TEXT NOT NULL,
  lat FLOAT NOT NULL,
  lng FLOAT NOT NULL,
  location GEOGRAPHY(POINT,4326),
  images TEXT[] DEFAULT '{}',
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ NOT NULL,
  ticket_price FLOAT DEFAULT 0,
  is_featured BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX events_location_idx ON events USING GIST(location);
CREATE INDEX events_outdoor_idx ON events(is_outdoor);
CREATE INDEX events_tags_idx ON events USING GIN(event_tags);

-- Bookings
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  venue_id UUID REFERENCES venues(id),
  event_id UUID REFERENCES events(id),
  vendor_id UUID REFERENCES vendors(id) NOT NULL,
  status TEXT DEFAULT 'pending',
  reserved_amount FLOAT NOT NULL,
  final_amount FLOAT,
  qr_code_hash TEXT UNIQUE NOT NULL,
  checked_in_at TIMESTAMPTZ,
  receipt_sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  reject_count INT DEFAULT 0,
  booking_date TIMESTAMPTZ NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX bookings_user_idx ON bookings(user_id);
CREATE INDEX bookings_vendor_idx ON bookings(vendor_id);
CREATE INDEX bookings_qr_idx ON bookings(qr_code_hash);
CREATE INDEX bookings_status_idx ON bookings(status);

-- Receipts
CREATE TABLE receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID REFERENCES bookings(id) UNIQUE,
  line_items JSONB NOT NULL DEFAULT '[]',
  subtotal FLOAT NOT NULL,
  platform_fee FLOAT NOT NULL,
  total FLOAT NOT NULL,
  status TEXT DEFAULT 'draft',
  sent_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ledger (source of truth for all money)
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL,
  account_type TEXT NOT NULL,
  account_id TEXT NOT NULL,
  direction TEXT NOT NULL,
  amount FLOAT NOT NULL,
  reference_id TEXT,
  reference_type TEXT,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX ledger_account_idx ON ledger_entries(account_type, account_id);
CREATE INDEX ledger_transaction_idx ON ledger_entries(transaction_id);
CREATE INDEX ledger_created_idx ON ledger_entries(created_at DESC);

-- Reviews
CREATE TABLE reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  venue_id UUID REFERENCES venues(id),
  event_id UUID REFERENCES events(id),
  booking_id UUID REFERENCES bookings(id) UNIQUE,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  vendor_reply TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- User preferences (for personalization)
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE,
  category_views JSONB DEFAULT '{}',
  venue_views JSONB DEFAULT '{}',
  booking_history TEXT[] DEFAULT '{}',
  location_patterns JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notifications
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL,
  reference_id TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX notifications_user_idx ON notifications(user_id, is_read);

-- Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own data
CREATE POLICY "users_own_data" ON users FOR ALL USING (auth.uid() = id);
CREATE POLICY "users_own_bookings" ON bookings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_notifications" ON notifications FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "users_own_ledger" ON ledger_entries FOR SELECT USING (auth.uid()::text = account_id);

-- Venues and events are public readable
CREATE POLICY "venues_public_read" ON venues FOR SELECT USING (is_active = true);
CREATE POLICY "events_public_read" ON events FOR SELECT USING (is_active = true);

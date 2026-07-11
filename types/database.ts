export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type CategorySlug =
  | "events"
  | "bar-lounge"
  | "restaurant"
  | "club"
  | "hotel"
  | "outdoorsy"
  | "car-rentals"
  | "apartment-bookings"
  | "lets-plan"
  | "flight-booking";

export type BookingStatus =
  | "pending"
  | "confirmed"
  | "checked_in"
  | "receipt_sent"
  | "confirmed_by_user"
  | "rejected"
  | "disputed"
  | "escrow"
  | "settled_offline"
  | "cancelled"
  | "completed";

export type LedgerAccountType =
  | "USER_WALLET"
  | "USER_RESERVED"
  | "VENDOR_PENDING"
  | "VENDOR_AVAILABLE"
  | "CHILLZ_REVENUE"
  | "ESCROW"
  | "PAYSTACK_INFLOW"
  | "PAYSTACK_OUTFLOW";

export type LedgerDirection = "DEBIT" | "CREDIT";

export type VendorType =
  | "venue"
  | "car_rental"
  | "apartment"
  | "event_organizer";

export type KycStatus = "pending" | "approved" | "rejected";

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string | null;
          avatar_url: string | null;
          google_id: string | null;
          location_lat: number | null;
          location_lng: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["users"]["Row"], "id" | "created_at" | "updated_at">;
        Update: Partial<Database["public"]["Tables"]["users"]["Insert"]>;
      };
      vendors: {
        Row: {
          id: string;
          user_id: string;
          business_name: string;
          vendor_type: VendorType;
          kyc_status: KycStatus;
          google_place_id: string | null;
          address: string | null;
          lat: number | null;
          lng: number | null;
          bank_account_number: string | null;
          bank_name: string | null;
          bank_code: string | null;
          payout_schedule: "instant" | "daily" | "weekly";
          commission_rate: number;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["vendors"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["vendors"]["Insert"]>;
      };
      venues: {
        Row: {
          id: string;
          vendor_id: string;
          name: string;
          category: CategorySlug;
          description: string | null;
          google_place_id: string;
          address: string;
          lat: number;
          lng: number;
          images: string[];
          tags: string[];
          filters: string[];
          rating: number;
          review_count: number;
          is_active: boolean;
          is_featured: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["venues"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["venues"]["Insert"]>;
      };
      events: {
        Row: {
          id: string;
          vendor_id: string | null;
          venue_id: string | null;
          created_by_admin: boolean;
          title: string;
          description: string;
          category: CategorySlug;
          event_tags: string[];
          is_outdoor: boolean;
          google_place_id: string;
          address: string;
          lat: number;
          lng: number;
          images: string[];
          start_date: string;
          end_date: string;
          ticket_price: number;
          is_featured: boolean;
          is_active: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["events"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
      };
      bookings: {
        Row: {
          id: string;
          user_id: string;
          venue_id: string | null;
          event_id: string | null;
          vendor_id: string;
          status: BookingStatus;
          reserved_amount: number;
          final_amount: number | null;
          qr_code_hash: string;
          checked_in_at: string | null;
          receipt_sent_at: string | null;
          confirmed_at: string | null;
          reject_count: number;
          booking_date: string;
          notes: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["bookings"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["bookings"]["Insert"]>;
      };
      receipts: {
        Row: {
          id: string;
          booking_id: string;
          line_items: Json;
          subtotal: number;
          platform_fee: number;
          total: number;
          status: "draft" | "sent" | "confirmed" | "rejected" | "disputed";
          sent_at: string | null;
          confirmed_at: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["receipts"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["receipts"]["Insert"]>;
      };
      ledger_entries: {
        Row: {
          id: string;
          transaction_id: string;
          account_type: LedgerAccountType;
          account_id: string;
          direction: LedgerDirection;
          amount: number;
          reference_id: string | null;
          reference_type: string | null;
          note: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["ledger_entries"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["ledger_entries"]["Insert"]>;
      };
      reviews: {
        Row: {
          id: string;
          user_id: string;
          venue_id: string | null;
          event_id: string | null;
          booking_id: string;
          rating: number;
          comment: string | null;
          vendor_reply: string | null;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["reviews"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["reviews"]["Insert"]>;
      };
      user_preferences: {
        Row: {
          id: string;
          user_id: string;
          category_views: Json;
          venue_views: Json;
          booking_history: string[];
          location_patterns: Json;
          updated_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["user_preferences"]["Row"], "id">;
        Update: Partial<Database["public"]["Tables"]["user_preferences"]["Insert"]>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: string;
          reference_id: string | null;
          is_read: boolean;
          created_at: string;
        };
        Insert: Omit<Database["public"]["Tables"]["notifications"]["Row"], "id" | "created_at">;
        Update: Partial<Database["public"]["Tables"]["notifications"]["Insert"]>;
      };
    };
  };
}

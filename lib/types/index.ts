export type UserRole = 'user' | 'vendor' | 'admin'
export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended'
export type VendorType = 'venue' | 'car_rental' | 'apartment' | 'event'
export type CategoryType = 'events' | 'bar_lounge' | 'restaurant' | 'club' | 'hotel' | 'outdoorsy' | 'car_rental' | 'apartment' | 'lets_plan' | 'flight_booking'
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'disputed'
export type BookingType = 'venue' | 'event' | 'car_rental' | 'apartment'
export type ReceiptStatus = 'draft' | 'sent' | 'confirmed' | 'rejected' | 'disputed' | 'settled_offline' | 'escrow'
export type AccountType = 'USER_WALLET' | 'USER_RESERVED' | 'VENDOR_PENDING' | 'VENDOR_AVAILABLE' | 'CHILLZ_REVENUE' | 'ESCROW' | 'PAYSTACK_INFLOW' | 'PAYSTACK_OUTFLOW'
export type LedgerDirection = 'DEBIT' | 'CREDIT'
export type EventTag = 'seminar' | 'party' | 'fashion_show' | 'festival' | 'polo' | 'yacht_party' | 'art_show' | 'outdoor'
export type CarRentalType = 'airport_pickup' | 'event_rental' | 'standard_rental'
export type ApartmentType = 'shortlet' | 'weekend_getaway' | 'extended_stay'

export interface LedgerEntry {
  id: string
  transaction_id: string
  account_type: AccountType
  account_id: string
  direction: LedgerDirection
  amount: number
  reference: string
  note: string
  created_at: string
}

export interface Booking {
  id: string
  user_id: string
  vendor_id: string
  booking_type: BookingType
  reference_id: string
  qr_code: string
  status: BookingStatus
  reserved_amount: number
  final_amount?: number
  party_size?: number
  check_in?: string
  check_out?: string
  notes?: string
  created_at: string
}

export interface Receipt {
  id: string
  booking_id: string
  vendor_id: string
  user_id: string
  line_items: { name: string; quantity: number; unit_price: number; total: number }[]
  subtotal: number
  chillz_fee: number
  total: number
  status: ReceiptStatus
  reject_count: number
  dispute_opened_at?: string
  created_at: string
  updated_at: string
}

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { business_name, vendor_type, phone, email, password, venue } = await req.json();

    if (!business_name || !vendor_type || !email || !password || !venue) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: business_name,
        account_type: "vendor",
      },
    });

    if (authError) {
      if (authError.message.includes("already registered")) {
        return NextResponse.json({ error: "An account with this email already exists." }, { status: 400 });
      }
      throw authError;
    }

    const userId = authData.user.id;

    // 2. Create user record
    await supabaseAdmin.from("users").insert({
      id: userId,
      full_name: business_name,
      email,
      account_type: "vendor",
    });

    // 3. Create venue record (inactive until admin approves)
    const { data: venueRecord, error: venueError } = await supabaseAdmin
      .from("venues")
      .insert({
        name: venue.name,
        address: venue.formatted_address || venue.vicinity || "",
        google_place_id: venue.place_id || null,
        lat: venue.geometry?.location?.lat || null,
        lng: venue.geometry?.location?.lng || null,
        category: vendor_type,
        is_active: false,      // hidden until admin approves
        is_featured: false,
        kyc_status: "pending",
        filters: [],
        images: [],
        rating: 0,
        review_count: 0,
      })
      .select()
      .single();

    if (venueError) throw venueError;

    // 4. Create vendor record
    const { data: vendorRecord, error: vendorError } = await supabaseAdmin
      .from("vendors")
      .insert({
        user_id: userId,
        business_name,
        vendor_type,
        phone: phone || null,
        email,
        kyc_status: "pending",
        venue_id: venueRecord.id,
        is_active: false,
      })
      .select()
      .single();

    if (vendorError) throw vendorError;

    // 5. Update venue with vendor_id
    await supabaseAdmin
      .from("venues")
      .update({ vendor_id: vendorRecord.id })
      .eq("id", venueRecord.id);

    // 6. Notify admins
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title: "Application received",
      body: `Thanks for registering ${business_name} on Chillz. We'll review your venue and notify you once approved.`,
      type: "booking",
      is_read: false,
    });

    return NextResponse.json({ success: true, vendor_id: vendorRecord.id });

  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Vendor register error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const SEARCH_QUERIES = [
  { query: "bars in Lagos Nigeria",                    category: "bar-lounge" },
  { query: "nightclubs in Lagos Nigeria",              category: "club"       },
  { query: "restaurants in Lagos Nigeria",             category: "restaurant" },
  { query: "bars in Victoria Island Lagos",            category: "bar-lounge" },
  { query: "clubs in Lekki Lagos",                     category: "club"       },
  { query: "restaurants in Lekki Lagos",               category: "restaurant" },
  { query: "bars in Port Harcourt Nigeria",            category: "bar-lounge" },
  { query: "clubs in Port Harcourt Nigeria",           category: "club"       },
  { query: "restaurants in Port Harcourt",             category: "restaurant" },
  { query: "lounges in Abuja Nigeria",                 category: "bar-lounge" },
  { query: "hotels in Lagos Nigeria",                  category: "hotel"      },
  { query: "hotels in Victoria Island Lagos",          category: "hotel"      },
  { query: "hotels in Lekki Lagos",                    category: "hotel"      },
  { query: "hotels in Port Harcourt Nigeria",          category: "hotel"      },
  { query: "hotels in Abuja Nigeria",                  category: "hotel"      },
  { query: "luxury hotels Lagos",                      category: "hotel"      },
  { query: "boutique hotels Lagos Nigeria",            category: "hotel"      },
];

async function fetchPlaceDetails(placeId: string) {
  // Places API (New) — richer data, correct field names
  const fieldMask = [
    "id","displayName","formattedAddress","location",
    "photos","rating","userRatingCount","regularOpeningHours",
    "nationalPhoneNumber","websiteUri","types","shortFormattedAddress",
    "addressComponents","reviews","priceLevel",
    "editorialSummary","servesBeer","servesWine","servesCocktails",
    "dineIn","takeout","delivery","reservable",
    "accessibilityOptions",
  ].join(",");

  const url = `https://places.googleapis.com/v1/places/${placeId}`;
  const res = await fetch(url, {
    headers: {
      "X-Goog-Api-Key": GOOGLE_API_KEY,
      "X-Goog-FieldMask": fieldMask,
    },
  });
  const data = await res.json();
  if (data.error) {
    console.error("Place detail error:", placeId, data.error.status, data.error.message);
    return null;
  }
  return data;
}

async function searchPlaces(query: string) {
  const url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}`;
  const res = await fetch(url);
  const data = await res.json();
  return data.results || [];
}

function getPhotoUrl(photoName: string, maxWidth = 800) {
  // New API uses photo resource name like "places/xxx/photos/xxx"
  if (photoName.startsWith("places/")) {
    return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidth}&key=${GOOGLE_API_KEY}`;
  }
  // Fallback for old photo_reference format
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photo_reference=${photoName}&key=${GOOGLE_API_KEY}`;
}

function extractCity(addressComponents: any[]): string {
  if (!addressComponents) return "Lagos";
  // New API uses longText instead of long_name
  const locality = addressComponents.find((c: any) =>
    c.types?.includes("locality")
  );
  const adminArea = addressComponents.find((c: any) =>
    c.types?.includes("administrative_area_level_1")
  );
  return locality?.longText || locality?.long_name || adminArea?.longText || adminArea?.long_name || "Lagos";
}

function buildGoogleData(details: any) {
  return {
    types:                 details.types,
    rating:                details.rating,
    total_ratings:         details.userRatingCount,
    vicinity:              details.shortFormattedAddress,
    price_level:           details.priceLevel || null,
    editorial_summary:     details.editorialSummary?.text || null,
    serves_beer:           details.servesBeer || false,
    serves_wine:           details.servesWine || false,
    serves_cocktails:      details.servesCocktails || false,
    dine_in:               details.dineIn || false,
    takeout:               details.takeout || false,
    delivery:              details.delivery || false,
    reservable:            details.reservable || false,
    wheelchair_accessible: details.accessibilityOptions?.wheelchairAccessibleEntrance || false,
    reviews:               (details.reviews || []).slice(0, 5).map((r: any) => ({
      author: r.authorAttribution?.displayName,
      rating: r.rating,
      text:   r.text?.text,
      time:   r.relativePublishTimeDescription,
      avatar: r.authorAttribution?.photoUri,
    })),
  };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET || "chillz-admin-2024";
  if (authHeader !== `Bearer ${adminSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const isUpdate = new URL(req.url).searchParams.get("update") === "true";

  const results = {
    inserted: 0,
    skipped:  0,
    updated:  0,
    errors:   0,
    venues:   [] as string[],
  };

  // ── UPDATE MODE — re-fetch details for existing Google venues ──
  if (isUpdate) {
    const { data: existingVenues } = await (supabaseAdmin.from("venues") as any)
      .select("id, google_place_id, name")
      .eq("source", "google")
      .not("google_place_id", "is", null);

    console.log("UPDATE: found", existingVenues?.length, "venues to update");

    // Test one place detail fetch first
    if (existingVenues?.length > 0) {
      const testVenue = existingVenues[0];
      const testUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${testVenue.google_place_id}&fields=place_id,name,rating&key=${GOOGLE_API_KEY}`;
      const testRes = await fetch(testUrl);
      const testData = await testRes.json();
      console.log("PLACE DETAIL TEST:", testData.status, testData.error_message || "");
      if (testData.status !== "OK") {
        return NextResponse.json({
          error: `Place Details API error: ${testData.status} — ${testData.error_message || "check billing or API key restrictions"}`,
        });
      }
    }

    for (const venue of (existingVenues || [])) {
      try {
        const details = await fetchPlaceDetails(venue.google_place_id);
        if (!details) { 
          console.error("No details returned for:", venue.name, venue.google_place_id);
          results.errors++; 
          continue; 
        }

        const images = (details.photos || [])
          .slice(0, 6)
          .map((p: any) => getPhotoUrl(p.name));

        const { error: updateError } = await (supabaseAdmin.from("venues") as any)
          .update({
            rating:       details.rating || null,
            review_count: details.userRatingCount || 0,
            phone:        details.nationalPhoneNumber || null,
            website:      details.websiteUri || null,
            ...(images.length > 0 ? { images } : {}),
            google_data:  buildGoogleData(details),
          })
          .eq("id", venue.id);

        if (updateError) {
          console.error(`Update failed for ${venue.name}:`, updateError.message);
          results.errors++;
        } else {
          results.updated++;
          results.venues.push(venue.name);
        }

        await new Promise(r => setTimeout(r, 200));
      } catch (err: any) {
        console.error("Update error:", err.message);
        results.errors++;
      }
    }

    return NextResponse.json(results);
  }

  // ── SEED MODE — test Google API then insert new venues ──
  const testUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=bars+in+Lagos+Nigeria&key=${GOOGLE_API_KEY}`;
  const testRes = await fetch(testUrl);
  const testData = await testRes.json();
  console.log("GOOGLE TEST STATUS:", testData.status);
  if (testData.status !== "OK") {
    return NextResponse.json({
      error: `Google Places API error: ${testData.status} — ${testData.error_message || "check API key and billing"}`,
    });
  }

  for (const { query, category } of SEARCH_QUERIES) {
    try {
      const places = await searchPlaces(query);

      for (const place of places.slice(0, 10)) {
        try {
          const { data: existing } = await (supabaseAdmin.from("venues") as any)
            .select("id")
            .eq("google_place_id", place.place_id)
            .maybeSingle();

          if (existing) { results.skipped++; continue; }

          const details = await fetchPlaceDetails(place.place_id);
          if (!details) continue;

          const images = (details.photos || [])
            .slice(0, 6)
            .map((p: any) => getPhotoUrl(p.name));

          const openingHours: Record<string, any> = {};
          const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
          if (details.regularOpeningHours?.periods) {
            for (const period of details.regularOpeningHours.periods) {
              const dayName = days[period.open?.day ?? 0];
              if (dayName) {
                const openH = String(period.open?.hour ?? 0).padStart(2,"0");
                const openM = String(period.open?.minute ?? 0).padStart(2,"0");
                const closeH = String(period.close?.hour ?? 0).padStart(2,"0");
                const closeM = String(period.close?.minute ?? 0).padStart(2,"0");
                openingHours[dayName] = {
                  open:   `${openH}:${openM}`,
                  close:  `${closeH}:${closeM}`,
                  closed: false,
                };
              }
            }
          }

          const { error: insertError } = await (supabaseAdmin.from("venues") as any)
            .insert({
              name:             details.displayName?.text || details.name,
              address:          details.formattedAddress,
              category,
              lat:              details.location?.latitude || null,
              lng:              details.location?.longitude || null,
              images,
              rating:           details.rating || null,
              review_count:     details.userRatingCount || 0,
              phone:            details.nationalPhoneNumber || null,
              website:          details.websiteUri || null,
              opening_hours:    Object.keys(openingHours).length > 0 ? openingHours : null,
              is_active:        true,
              bookings_enabled: false,
              source:           "google",
              google_place_id:  details.id,
              google_data:      buildGoogleData(details),
              city:             extractCity(details.addressComponents),
              vendor_id:        null,
            });

          if (insertError) {
            console.error(`Failed to insert ${details.name}:`, insertError.message);
            results.errors++;
          } else {
            results.inserted++;
            results.venues.push(details.name);
          }

          await new Promise(r => setTimeout(r, 200));
        } catch (err: any) {
          console.error("Place error:", err.message);
          results.errors++;
        }
      }

      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.error("Query error:", err.message);
      results.errors++;
    }
  }

  return NextResponse.json(results);
}
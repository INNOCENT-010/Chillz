export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const GOOGLE_API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

const SEARCH_QUERIES = [
  // Lagos bars & lounges
  { query: "bars in Victoria Island Lagos Nigeria",    category: "bar-lounge" },
  { query: "bars in Lekki Lagos Nigeria",              category: "bar-lounge" },
  { query: "rooftop bars Lagos Nigeria",               category: "bar-lounge" },
  { query: "lounges in Ikeja Lagos Nigeria",           category: "bar-lounge" },
  { query: "sports bars Lagos Nigeria",                category: "bar-lounge" },
  // Lagos clubs
  { query: "nightclubs in Victoria Island Lagos",      category: "club"       },
  { query: "nightclubs in Lekki Lagos Nigeria",        category: "club"       },
  { query: "clubs in Ikeja Lagos Nigeria",             category: "club"       },
  // Lagos restaurants
  { query: "restaurants in Victoria Island Lagos",     category: "restaurant" },
  { query: "restaurants in Lekki Phase 1 Lagos",       category: "restaurant" },
  { query: "restaurants in Ikoyi Lagos Nigeria",       category: "restaurant" },
  { query: "fine dining restaurants Lagos Nigeria",    category: "restaurant" },
  { query: "Nigerian restaurants Lagos",               category: "restaurant" },
  // Port Harcourt
  { query: "bars in Port Harcourt Nigeria",            category: "bar-lounge" },
  { query: "lounges in Port Harcourt Nigeria",         category: "bar-lounge" },
  { query: "nightclubs Port Harcourt Nigeria",         category: "club"       },
  { query: "restaurants in Port Harcourt Nigeria",     category: "restaurant" },
  { query: "restaurants in GRA Port Harcourt",         category: "restaurant" },
  { query: "bars in GRA Port Harcourt Nigeria",        category: "bar-lounge" },
  // Abuja
  { query: "bars in Abuja Nigeria",                    category: "bar-lounge" },
  { query: "lounges in Wuse Abuja Nigeria",            category: "bar-lounge" },
  { query: "clubs in Abuja Nigeria",                   category: "club"       },
  { query: "restaurants in Wuse 2 Abuja Nigeria",      category: "restaurant" },
  { query: "restaurants in Maitama Abuja Nigeria",     category: "restaurant" },
  { query: "restaurants in Garki Abuja Nigeria",       category: "restaurant" },
  // Hotels
  { query: "hotels in Victoria Island Lagos Nigeria",  category: "hotel"      },
  { query: "hotels in Lekki Lagos Nigeria",            category: "hotel"      },
  { query: "hotels in Ikeja Lagos Nigeria",            category: "hotel"      },
  { query: "hotels in Port Harcourt Nigeria",          category: "hotel"      },
  { query: "hotels in GRA Port Harcourt Nigeria",      category: "hotel"      },
  { query: "hotels in Abuja Nigeria",                  category: "hotel"      },
  { query: "hotels in Maitama Abuja Nigeria",          category: "hotel"      },
  { query: "luxury hotels Lagos Nigeria",              category: "hotel"      },
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

function priceLevelToNumber(priceLevel: any): number | null {
  if (!priceLevel) return null;
  if (typeof priceLevel === "number") return priceLevel;
  const map: Record<string, number> = {
    "PRICE_LEVEL_FREE":           0,
    "PRICE_LEVEL_INEXPENSIVE":    1,
    "PRICE_LEVEL_MODERATE":       2,
    "PRICE_LEVEL_EXPENSIVE":      3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
  };
  return map[priceLevel] ?? null;
}

function buildGoogleData(details: any) {
  return {
    types:                 details.types,
    rating:                details.rating,
    total_ratings:         details.userRatingCount,
    vicinity:              details.shortFormattedAddress,
    price_level:           priceLevelToNumber(details.priceLevel),
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

// Build filterable tags from Google data so genre/vibe filters work
function buildGoogleFilters(details: any): string[] {
  const tags: string[] = [];
  if (details.servesCocktails) tags.push("Cocktails");
  if (details.servesBeer)      tags.push("Beer");
  if (details.servesWine)      tags.push("Wine");
  if (details.dineIn)          tags.push("Dine In");
  if (details.takeout)         tags.push("Takeout");
  if (details.delivery)        tags.push("Delivery");
  if (details.reservable)      tags.push("Reservations");
  if (details.accessibilityOptions?.wheelchairAccessibleEntrance) tags.push("Accessible");
  // Map Google types to Chillz vibe tags
  const types = (details.types || []) as string[];
  if (types.includes("night_club"))  tags.push("Live DJ");
  if (types.includes("bar"))         tags.push("Cocktails");
  if (types.includes("restaurant"))  tags.push("Dine In");
  return [...new Set(tags)]; // deduplicate
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
            filters:      buildGoogleFilters(details),
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
              filters:          buildGoogleFilters(details),
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
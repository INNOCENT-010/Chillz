import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const lat = req.nextUrl.searchParams.get("lat");
  const lng = req.nextUrl.searchParams.get("lng");

  if (!lat || !lng) {
    return NextResponse.json({ error: "lat and lng required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&result_type=locality|administrative_area_level_1&language=en`,
      { next: { revalidate: 0 } }
    );

    const data = await res.json();

    if (data.status === "REQUEST_DENIED") {
      console.error("Geocode error:", data.status, data.error_message);
      return NextResponse.json(
        { error: data.error_message || "API request denied" },
        { status: 403 }
      );
    }

    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json({ location: "Lagos, Nigeria" });
    }

    // Extract city and state from result components
    const result = data.results[0];
    const components = result.address_components || [];

    const city = components.find((c: any) =>
      c.types.includes("locality") || c.types.includes("sublocality")
    )?.long_name;

    const state = components.find((c: any) =>
      c.types.includes("administrative_area_level_1")
    )?.long_name;

    const location = city && state
      ? `${city}, ${state}`
      : city || state || result.formatted_address || "Lagos, Nigeria";

    return NextResponse.json({ location });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg, location: "Lagos, Nigeria" }, { status: 500 });
  }
}
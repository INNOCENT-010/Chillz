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
    // Full reverse geocode to get formatted address and place details
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en`,
      { next: { revalidate: 0 } }
    );

    const data = await res.json();

    if (data.status !== "OK" || !data.results?.length) {
      return NextResponse.json({
        formatted_address: `${parseFloat(lat).toFixed(6)}, ${parseFloat(lng).toFixed(6)}`,
        place_id: null,
        name: "Current Location",
      });
    }

    const result = data.results[0];
    const components = result.address_components || [];

    // Extract a readable name — try neighborhood, then locality
    const neighborhood = components.find((c: any) =>
      c.types.includes("neighborhood") ||
      c.types.includes("sublocality_level_1") ||
      c.types.includes("sublocality")
    )?.long_name;

    const city = components.find((c: any) =>
      c.types.includes("locality")
    )?.long_name;

    const name = neighborhood
      ? `${neighborhood}, ${city || ""}`
      : city || result.formatted_address;

    return NextResponse.json({
      place_id: result.place_id,
      name: name.trim(),
      formatted_address: result.formatted_address,
      lat: parseFloat(lat),
      lng: parseFloat(lng),
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({
      error: msg,
      formatted_address: `${parseFloat(lat!).toFixed(6)}, ${parseFloat(lng!).toFixed(6)}`,
      place_id: null,
      name: "Current Location",
    }, { status: 500 });
  }
}
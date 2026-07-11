import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const placeId = req.nextUrl.searchParams.get("place_id");
  if (!placeId) {
    return NextResponse.json({ error: "place_id required" }, { status: 400 });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=place_id,name,formatted_address,geometry,types,photos`,
      { next: { revalidate: 0 } }
    );

    const data = await res.json();

    if (data.status === "REQUEST_DENIED") {
      console.error("Places details error:", data.status, data.error_message);
      return NextResponse.json(
        { error: data.error_message || "API request denied" },
        { status: 403 }
      );
    }

    const result = data.result;
    if (!result) {
      return NextResponse.json({ error: "Place not found" }, { status: 404 });
    }

    return NextResponse.json({
      place_id:  result.place_id,
      name:      result.name,
      address:   result.formatted_address,
      lat:       result.geometry?.location?.lat,
      lng:       result.geometry?.location?.lng,
      types:     result.types || [],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
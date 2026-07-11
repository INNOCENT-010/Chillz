import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const input = req.nextUrl.searchParams.get("input");
  if (!input || input.length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API key not configured" }, { status: 500 });
  }

  try {
    // Use the NEW Places API autocomplete endpoint
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${apiKey}&components=country:ng&language=en&types=establishment|geocode`,
      { next: { revalidate: 0 } }
    );

    const data = await res.json();

    if (data.status === "REQUEST_DENIED") {
      console.error("Places API error:", data.status, data.error_message);
      return NextResponse.json(
        { error: data.error_message || "API request denied", predictions: [] },
        { status: 403 }
      );
    }

    return NextResponse.json({ predictions: data.predictions || [] });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Places autocomplete error:", msg);
    return NextResponse.json({ error: msg, predictions: [] }, { status: 500 });
  }
}
import { useState, useEffect, useRef } from "react";

export interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceDetail {
  place_id: string;
  name: string;
  formatted_address: string;
  lat: number;
  lng: number;
}

export function usePlacesAutocomplete(input: string, enabled = true) {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!input.trim() || input.length < 3 || !enabled) {
      setPredictions([]);
      return;
    }

    if (debounceRef.current) if (debounceRef.current) if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/places/autocomplete?input=${encodeURIComponent(input)}`
        );
        const data = await res.json();
        setPredictions(data.predictions || []);
      } catch {
        setPredictions([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [input, enabled]);

  return { predictions, loading };
}

export async function getPlaceDetails(placeId: string): Promise<PlaceDetail | null> {
  try {
    const res = await fetch(`/api/places/details?place_id=${placeId}`);
    const data = await res.json();

    // API route returns fields directly, not nested under result
    if (data.place_id) {
      return {
        place_id: data.place_id,
        name: data.name,
        formatted_address: data.address, // our API returns "address" not "formatted_address"
        lat: data.lat,
        lng: data.lng,
      };
    }
    return null;
  } catch {
    return null;
  }
}
export function parsePriceLevel(priceLevel: any): number | null {
  if (!priceLevel) return null;
  if (typeof priceLevel === "number") return priceLevel > 0 ? priceLevel : null;
  const map: Record<string, number> = {
    "PRICE_LEVEL_INEXPENSIVE":    1,
    "PRICE_LEVEL_MODERATE":       2,
    "PRICE_LEVEL_EXPENSIVE":      3,
    "PRICE_LEVEL_VERY_EXPENSIVE": 4,
  };
  return map[priceLevel] ?? null;
}

export function priceLevelLabel(priceLevel: any): string | null {
  const n = parsePriceLevel(priceLevel);
  return n ? "₦".repeat(n) : null;
}
// ── Fuzzy name similarity (Dice coefficient) ──────────────────────────────

export function nameSimilarity(a: string, b: string): number {
  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/).sort().join(" ");

  const na = normalize(a);
  const nb = normalize(b);

  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigrams = (str: string) => {
    const bg = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) bg.add(str.slice(i, i + 2));
    return bg;
  };

  const setA = bigrams(na);
  const setB = bigrams(nb);
  let intersection = 0;
  setA.forEach((bg) => { if (setB.has(bg)) intersection++; });

  return (2 * intersection) / (setA.size + setB.size);
}

// ── 24-hour hold check ────────────────────────────────────────────────────

export function isWithin24Hours(isoTimestamp: string): boolean {
  const linked = new Date(isoTimestamp).getTime();
  const now = Date.now();
  return now - linked < 24 * 60 * 60 * 1000;
}

// ── OTP generator ─────────────────────────────────────────────────────────

export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
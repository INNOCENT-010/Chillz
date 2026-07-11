/**
 * WAT (West Africa Time) utilities
 * WAT = UTC+1, no daylight saving time.
 * All "Open Now" logic across CHILLZ uses this — never new Date() directly.
 */

export function getWATNow(): Date {
  const nowUTC    = new Date();
  const watOffset = 60 * 60 * 1000; // UTC+1 in ms
  return new Date(nowUTC.getTime() + watOffset);
}

export function getWATMinutesFromMidnight(): number {
  const wat = getWATNow();
  return wat.getUTCHours() * 60 + wat.getUTCMinutes();
}

export function getWATDayName(): string {
  const days = ["sunday","monday","tuesday","wednesday","thursday","friday","saturday"];
  return days[getWATNow().getUTCDay()];
}

/**
 * Parses a time string "HH:MM" into total minutes from midnight.
 */
function parseTime(t: string): number {
  if (!t) return -1;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

/**
 * Checks if a venue is open right now based on its opening_hours object.
 * opening_hours shape: { monday: { open: "09:00", close: "22:00", closed: false }, ... }
 * Always uses WAT regardless of browser/server timezone.
 */
export function isOpenNowWAT(openingHours: Record<string, any> | null | undefined): boolean {
  if (!openingHours) return true; // no hours set — assume open

  const todayKey   = getWATDayName();
  const todayHours = openingHours[todayKey];

  if (!todayHours)          return false; // no entry for today = closed
  if (todayHours.closed)    return false;

  // Support multiple field name variants
  const open  = todayHours.open  || todayHours.openTime  || todayHours.opens  || "";
  const close = todayHours.close || todayHours.closeTime || todayHours.closes || "";

  if (!open || !close) return true; // hours entry exists but times empty = assume open

  const openTotal  = parseTime(open);
  let   closeTotal = parseTime(close);

  if (openTotal < 0 || closeTotal < 0) return true;

  // Handle past-midnight (e.g. bar opens 22:00, closes 04:00 next day)
  if (closeTotal < openTotal) closeTotal += 24 * 60;

  const nowTotal = getWATMinutesFromMidnight();

  // Also handle past-midnight check when current WAT time is in early morning
  const nowAdjusted = nowTotal < openTotal ? nowTotal + 24 * 60 : nowTotal;

  return nowAdjusted >= openTotal && nowAdjusted <= closeTotal;
}
export function getWATDayNameTitleCase(): string {
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  return days[getWATNow().getUTCDay()];
}
/**
 * Returns a human-readable "Opens at X" or "Closes at X" string for display.
 */
export function getOpenStatusLabel(openingHours: Record<string, any> | null | undefined): {
  isOpen: boolean;
  label:  string;
} {
  if (!openingHours) return { isOpen: true, label: "Open" };

  const todayKey   = getWATDayName();
  const todayHours = openingHours[todayKey];

  if (!todayHours || todayHours.closed) return { isOpen: false, label: "Closed today" };

  const open  = todayHours.open  || todayHours.openTime  || "";
  const close = todayHours.close || todayHours.closeTime || "";
  const isOpen = isOpenNowWAT(openingHours);

  if (isOpen) {
    return {
      isOpen: true,
      label: close ? `Open · Closes ${formatDisplayTime(close)}` : "Open now",
    };
  } else {
    return {
      isOpen: false,
      label: open ? `Closed · Opens ${formatDisplayTime(open)}` : "Closed",
    };
  }
}

function formatDisplayTime(time: string): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const hour   = h % 12 || 12;
  return m > 0 ? `${hour}:${String(m).padStart(2,"0")}${period}` : `${hour}${period}`;
}
const PARIS_TIME_ZONE = "Europe/Paris";

export function isParisMarketOpen(date = new Date()) {
  const parts = new Intl.DateTimeFormat("fr-FR", {
    timeZone: PARIS_TIME_ZONE,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const weekday = parts.find((part) => part.type === "weekday")?.value;
  const hour = Number(
    parts.find((part) => part.type === "hour")?.value
  );
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value
  );

  // Samedi et dimanche
  if (weekday === "sam." || weekday === "dim.") {
    return false;
  }

  const minutes = hour * 60 + minute;

  // Séance normale : 9h00 → 17h35
  return minutes >= 9 * 60 && minutes <= 17 * 60 + 35;
}
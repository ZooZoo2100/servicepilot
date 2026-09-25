/** Calendar arithmetic deliberately uses Oslo's date, not the server's timezone. */
export function workshopDate(now: Date, offset = 0) {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Oslo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const calendar = new Date(`${day}T12:00:00Z`);
  calendar.setUTCDate(calendar.getUTCDate() + offset);
  return calendar.toISOString().slice(0, 10);
}

import { workshopSettings } from "../shared/workshop.js";
/** ISO machine dates, calculated from the Danish workshop's local calendar. */
export function workshopDate(now: Date, offset = 0) {
  const parts = new Intl.DateTimeFormat(workshopSettings.locale, {
    timeZone: workshopSettings.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const calendar = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  calendar.setUTCDate(calendar.getUTCDate() + offset);
  return calendar.toISOString().slice(0, 10);
}

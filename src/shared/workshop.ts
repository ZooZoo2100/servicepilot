/** Fictional Danish workshop configuration, shared by UI and controlled tools. */
export const workshopSettings = {
  name: "Varde Motorværksted",
  location: "Hedehusene, Denmark",
  locale: "da-DK",
  timezone: "Europe/Copenhagen",
  currency: "DKK",
} as const;
export function formatPrice(amount: number, currency = workshopSettings.currency) {
  return `${new Intl.NumberFormat(workshopSettings.locale).format(amount)} ${currency}`;
}
export function formatDate(date: string) {
  return new Intl.DateTimeFormat(workshopSettings.locale, {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: workshopSettings.timezone,
  }).format(new Date(`${date}T12:00:00Z`));
}

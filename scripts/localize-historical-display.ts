/** Presentation-only translation. Never overwrite or re-score a recorded run. */
export function localizeHistoricalDisplay(value: unknown): unknown {
  if (typeof value === "string")
    return value.replaceAll("Motorverksted", "Motorværksted")
      .replaceAll("Europe/Oslo", "Europe/Copenhagen")
      .replaceAll("Verkstedveien 14, fictional Oslo workshop", "Hedehusene, Denmark — fictional workshop")
      .replaceAll("Verkstedveien 14", "Hedehusene, Denmark")
      .replaceAll("Oslo", "Hedehusene")
      .replace(/NOK ([\d,]+)/g, (_, amount: string) => `${Number(amount.replaceAll(",", "")).toLocaleString("da-DK")} DKK`)
      .replaceAll("NOK", "DKK").replaceAll("2,490", "2.490");
  if (Array.isArray(value)) return value.map(localizeHistoricalDisplay);
  if (value && typeof value === "object") {
    const result = Object.fromEntries(Object.entries(value).map(([k,v]) => [k,localizeHistoricalDisplay(v)]));
    if ("price" in result && "minutes" in result) result.currency = "DKK";
    return result;
  }
  return value;
}

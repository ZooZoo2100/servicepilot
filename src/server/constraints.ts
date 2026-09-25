import type { Vehicle } from "../shared/domain.js";
/** Conservative evidence checks. These do not claim general natural-language understanding. */
export function normalized(text: string) {
  return text.toLowerCase().replace(/[’‘]/g, "'");
}
export function positiveClause(text: string) {
  const t = normalized(text);
  const correction = t.match(/(?:i meant|use|rather than|instead use)\s+(.+)$/);
  if (correction && /not\b/.test(t.slice(0, correction.index)))
    return correction[1];
  return t;
}
export function requestConstraints(text: string, vehicles: Vehicle[]) {
  const t = positiveClause(text);
  const matches = vehicles.filter((v) =>
    [v.model, v.registration, v.id].some((s) => t.includes(s.toLowerCase())),
  );
  const dates = [...new Set(t.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [])];
  const ambiguousDate =
    dates.length > 1 ||
    (/\b(next|this|coming|following)\s+(mon|tues|wednes|thurs|fri|satur|sun)day\b|\b\d{1,2}\/\d{1,2}(?:\/\d{2,4})?\b/i.test(
      t,
    ) &&
      dates.length !== 1);
  // Explicit vehicle reference that is not one of the owned records must not use the sole-vehicle fallback.
  const reference = t.match(
    /\b(?:for|on|with)\s+(?:my |the |our )?([a-z][a-z0-9]*(?:\s+[a-z0-9]+){0,2})/i,
  )?.[1];
  const generic =
    reference &&
    /^(car|vehicle|routine|annual|maintenance|service|tyres?|tires?|brakes?|battery|charging|diagnostic|tomorrow|today|an? |the |my |\d)/.test(
      reference,
    );
  const unknownVehicle = matches.length === 0 && !!reference && !generic;
  const withdraw =
    /\b(?:never\s?mind|changed my mind|forget it|withdraw)\b|\b(?:don't|do not|never|stop)\s+(?:the\s+)?(?:book(?:ing)?|cancel(?:lation)?|reschedul\w*|mov(?:e|ing)|chang\w*)\b/.test(
      t,
    );
  return { matches, ambiguousDate, unknownVehicle, withdraw };
}

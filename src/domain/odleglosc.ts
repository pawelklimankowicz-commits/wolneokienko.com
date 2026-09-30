/** Odległość po powierzchni Ziemi (haversine), w kilometrach. Ten sam wzór liczy SQL w src/serwer/zapytania.ts. */
export function odlegloscKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (x: number) => (x * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/** Centrum Poznania (Stary Rynek) — gdy przeglądarka nie poda lokalizacji. */
export const POZNAN = { lat: 52.4083, lon: 16.934 };

/** Kolory awatara usługodawcy wyliczone z identyfikatora — stałe dla danego salonu. */
const PALETA: [string, string][] = [
  ["#C8184A", "#5B1231"], ["#6B3A5E", "#2E1A2A"], ["#2A7A83", "#123F45"], ["#3E4C5E", "#161D26"],
  ["#C98A3A", "#6E4310"], ["#3F8F5A", "#16402A"], ["#4F5BA6", "#1E2560"], ["#7A3E8E", "#35163F"],
];
export function koloryDla(id: string): [string, string] {
  let h = 0;
  for (const z of id) h = (h * 31 + z.charCodeAt(0)) >>> 0;
  return PALETA[h % PALETA.length];
}

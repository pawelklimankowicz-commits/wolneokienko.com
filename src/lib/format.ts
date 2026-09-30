const zl = new Intl.NumberFormat("pl-PL", { maximumFractionDigits: 0 });
const zlGr = new Intl.NumberFormat("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 13000 → „130 zł”. */
export const zlote = (gr: number) => `${zl.format(gr / 100)} zł`;
/** 39216 → „392,16 zł”. */
export const zloteGr = (gr: number) => `${zlGr.format(gr / 100)} zł`;
/** Cena z cennika: 13000 → „130 zł”, 15050 → „150,50 zł” (grosze tylko, gdy są). */
export const cena = (gr: number) => (gr % 100 === 0 ? zlote(gr) : zloteGr(gr));
/** 1.2 → „1,2 km”. */
export const km = (x: number) => `${x.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} km`;
/** 4.9 → „4,9”. */
export const ocena = (x: number) => x.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
/** Polska odmiana: 1 salon, 2–4 salony, 5+ salonów (12–14 też „salonów”). */
export function odmiana(n: number, jeden: string, kilka: string, wiele: string): string {
  if (n === 1) return jeden;
  const j = n % 10;
  const d = n % 100;
  return j >= 2 && j <= 4 && (d < 12 || d > 14) ? kilka : wiele;
}
/** 600 → „10:00”. */
export const mmss = (sek: number) =>
  `${String(Math.floor(Math.max(sek, 0) / 60)).padStart(2, "0")}:${String(Math.max(sek, 0) % 60).padStart(2, "0")}`;
/** „8:40” → 520 (minuty od północy). */
export const minutyGodziny = (godzina: string) => {
  const [h, m] = godzina.split(":").map(Number);
  return h * 60 + (m || 0);
};

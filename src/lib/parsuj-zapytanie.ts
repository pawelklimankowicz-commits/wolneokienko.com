// =====================================================================
// Rozbiór zapytania wpisanego zwykłym językiem („hybryda dziś po 16,
// do 150 zł”) na usługę, termin i limit ceny.
//
// To wersja regułowa na start — działa bez sieci i bez kosztów. Docelowo
// trudniejsze przypadki dostanie model AI, a ten moduł zostanie pierwszym,
// darmowym przybliżeniem i siatką bezpieczeństwa.
// =====================================================================

import { znajdzUslugi, type Usluga } from "@/domain/katalog-uslug";

export type Kiedy = "teraz" | "dzis" | "jutro" | "weekend";

export interface RozbiorZapytania {
  uslugi: Usluga[];
  kiedy: Kiedy | null;
  /** Najwcześniejsza godzina, np. 16 z „po 16”. */
  odGodziny: number | null;
  /** Limit ceny w złotych, np. 150 z „do 150 zł”. */
  limitZl: number | null;
  /** Liczba osób, np. 4 z „dla 4 osób” albo „we czworo” (escape room, kręgle, sauna). */
  osoby: number | null;
}

const LICZEBNIKI: Record<string, number> = {
  dwoje: 2, dwojga: 2, dwoch: 2, dwie: 2, troje: 3, trojga: 3, trzech: 3, czworo: 4, czworga: 4, czterech: 4,
  piecioro: 5, pieciu: 5, szescioro: 6, szesciu: 6, siedmioro: 7, osmioro: 8,
};

const bezOgonkow = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l");

export function parsujZapytanie(tekst: string): RozbiorZapytania {
  const t = bezOgonkow(tekst);

  let kiedy: Kiedy | null = null;
  if (/\bteraz\b|\bzaraz\b|\bod reki\b/.test(t)) kiedy = "teraz";
  else if (/\bdzis\b|\bdzisiaj\b/.test(t)) kiedy = "dzis";
  else if (/\bjutro\b/.test(t)) kiedy = "jutro";
  else if (/\bweekend\b|\bsobot|\bniedziel/.test(t)) kiedy = "weekend";

  const godzina = t.match(/\b(?:po|od|okolo|na)\s*(\d{1,2})(?:[:.]\d{2})?\b/);
  const odGodziny = godzina && Number(godzina[1]) <= 23 ? Number(godzina[1]) : null;

  const cena = t.match(/\bdo\s*(\d{2,4})\s*(?:zl|pln)?\b/);
  const limitZl = cena ? Number(cena[1]) : null;

  const osobyLiczba = t.match(/\b(\d{1,2})\s*(?:os\b|os\.|osob|osoby|osoba)/);
  const osobySlowo = t.match(/\b(?:we|dla)\s+([a-z]+)\b/);
  const osoby = osobyLiczba
    ? Number(osobyLiczba[1]) || null
    : osobySlowo && LICZEBNIKI[osobySlowo[1]]
      ? LICZEBNIKI[osobySlowo[1]]
      : null;

  // Szukamy usługi po słowach, żeby „dziś po 16” nie zasłaniało „hybryda”.
  const slowa = t.replace(/[^a-z0-9: ]/g, " ").split(/\s+/).filter((s) => s.length >= 3);
  const znalezione = new Map<string, Usluga>();
  for (const u of znajdzUslugi(tekst)) znalezione.set(u.kod, u);
  if (znalezione.size === 0) {
    for (const s of slowa) for (const u of znajdzUslugi(s)) znalezione.set(u.kod, u);
  }

  return { uslugi: [...znalezione.values()], kiedy, odGodziny, limitZl, osoby };
}

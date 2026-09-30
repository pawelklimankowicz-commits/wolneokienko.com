// =====================================================================
// Czas w zapytaniach: okno, w którym klientka chce wizyty, i godziny,
// które proponujemy salonowi do oferty jednym dotknięciem.
// Liczone w strefie urządzenia (w Polsce: Europe/Warsaw).
// =====================================================================

export type Kiedy = "teraz" | "dzis" | "jutro" | "weekend";

export interface Okno {
  od: Date;
  do: Date;
}

const MIN_MS = 60 * 1000;
const GODZINA_MS = 60 * MIN_MS;

function dzienOGodzinie(baza: Date, przesuniecieDni: number, godzina: number): Date {
  const d = new Date(baza);
  d.setDate(d.getDate() + przesuniecieDni);
  d.setHours(godzina, 0, 0, 0);
  return d;
}

/** Zamiana „dziś po 16” na przedział czasu. Koniec dnia pracy: 21:00. */
export function oknoZapytania(kiedy: Kiedy, odGodziny: number | null, teraz: Date): Okno {
  if (kiedy === "teraz") return { od: teraz, do: new Date(teraz.getTime() + 2 * GODZINA_MS) };
  if (kiedy === "dzis") {
    const od = new Date(Math.max(teraz.getTime(), odGodziny !== null ? dzienOGodzinie(teraz, 0, odGodziny).getTime() : 0));
    const koniec = dzienOGodzinie(teraz, 0, 21);
    return { od, do: koniec > od ? koniec : new Date(od.getTime() + 2 * GODZINA_MS) };
  }
  if (kiedy === "jutro") return { od: dzienOGodzinie(teraz, 1, odGodziny ?? 8), do: dzienOGodzinie(teraz, 1, 21) };
  // weekend: najbliższa sobota (w weekend: dziś) do niedzieli 20:00
  const dzienTygodnia = teraz.getDay(); // 0 = niedziela, 6 = sobota
  const doSoboty = dzienTygodnia === 6 || dzienTygodnia === 0 ? 0 : 6 - dzienTygodnia;
  const doNiedzieli = dzienTygodnia === 0 ? 0 : doSoboty + 1;
  const start = dzienOGodzinie(teraz, doSoboty, odGodziny ?? 9);
  return { od: start > teraz ? start : teraz, do: dzienOGodzinie(teraz, doNiedzieli, 20) };
}

/**
 * Godziny do oferty jednym dotknięciem: co 15 minut w oknie klientki,
 * najwcześniej 20 minut od teraz (dojazd), tak żeby usługa zmieściła się
 * przed końcem okna. Najwyżej `ile` propozycji, rozłożonych po oknie.
 */
export function proponowaneTerminy(okno: Okno, teraz: Date, czasUslugiMin: number, ile = 4, zajete: Okno[] = []): Date[] {
  const krok = 15 * MIN_MS;
  const start = Math.ceil(Math.max(okno.od.getTime(), teraz.getTime() + 20 * MIN_MS) / krok) * krok;
  const ostatni = okno.do.getTime() - Math.min(czasUslugiMin, 120) * MIN_MS;
  const wszystkie: number[] = [];
  for (let t = start; t <= ostatni && wszystkie.length < 200; t += krok) if (!kolidujeZ(zajete, new Date(t), czasUslugiMin)) wszystkie.push(t);
  if (wszystkie.length <= ile) return wszystkie.map((t) => new Date(t));
  // pierwsze dwa jak najwcześniej, reszta rozłożona do końca okna
  const wybrane = new Set([wszystkie[0], wszystkie[1]]);
  for (let i = 1; wybrane.size < ile; i++) wybrane.add(wszystkie[Math.round((i * (wszystkie.length - 1)) / (ile - 2))]);
  return [...wybrane].sort((a, b) => a - b).map((t) => new Date(t));
}

/** { dzien: „dziś” | „jutro” | „sob.”, godzina: „16:30” } — dzień i godzina osobno, do składu w kartach. */
export function terminCzesci(termin: Date, teraz: Date): { dzien: string; godzina: string } {
  const godzina = `${termin.getHours()}:${String(termin.getMinutes()).padStart(2, "0")}`;
  const polnoc = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const roznica = Math.round((polnoc(termin) - polnoc(teraz)) / (24 * GODZINA_MS));
  const dzien = roznica === 0 ? "dziś" : roznica === 1 ? "jutro" : ["niedz.", "pon.", "wt.", "śr.", "czw.", "pt.", "sob."][termin.getDay()];
  return { dzien, godzina };
}

/** Czy wizyta od `termin` przez `czasMin` minut nachodzi na któryś z zajętych przedziałów. */
export function kolidujeZ(zajete: Okno[], termin: Date, czasMin: number): boolean {
  const koniec = termin.getTime() + czasMin * MIN_MS;
  return zajete.some((p) => p.od.getTime() < koniec && termin.getTime() < p.do.getTime());
}

/** „dziś 16:30”, „jutro 9:15”, „sob. 11:00”. */
export function terminCzytelny(termin: Date, teraz: Date): string {
  const { dzien, godzina } = terminCzesci(termin, teraz);
  return `${dzien} ${godzina}`;
}

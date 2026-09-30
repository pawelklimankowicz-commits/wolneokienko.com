// =====================================================================
// Import cennika z innego miejsca: tekst wklejony albo odczytany ze zdjęcia,
// tabela z pliku eksportu (CSV, XLSX). Rozpoznajemy nazwę, cenę i czas,
// dopasowujemy do katalogu branży salonu, a salon zatwierdza każdą pozycję.
// Nic nie trafia do cennika bez zatwierdzenia — import tylko wypełnia edytor.
// Listy klientów nie importujemy (RODO) — patrz docs/DECYZJE.md, § 12.
// =====================================================================

import { KATALOG_USLUG, normalizuj, uslugiBranzy, type Branza, type Usluga } from "./katalog-uslug";
import { LIMITY_CENNIKA } from "./rejestracja-salonu";

export interface WierszImportu {
  /** tekst źródłowy, pokazywany salonowi przy zatwierdzaniu */
  zrodlo: string;
  nazwa: string;
  cenaGr: number | null;
  czasMin: number | null;
  /** imiona z kolumny „pracownik” (tylko import z pliku) */
  pracownicy: string[];
  /** nagłówek sekcji cennika nad wierszem, np. „Manicure” nad „Hybryda” */
  sekcja: string | null;
}

export interface PropozycjaImportu extends WierszImportu {
  uslugaKod: string | null;
  /** nazwa albo synonim z katalogu występuje w tekście w całości */
  pewne: boolean;
}

export interface PozycjaZImportu {
  uslugaKod: string;
  cenaGr: number;
  czasMin: number;
}

export interface PracownikZImportu {
  imie: string;
  uslugi: string[];
}

// ── liczby, ceny, czas ────────────────────────────────────────────────

const LICZBA = String.raw`\d{1,3}(?:[ \u00a0]\d{3})+|\d+`;
const KWOTA = new RegExp(String.raw`(?:(?:od|from)\s*)?(${LICZBA})(?:[.,](\d{1,2}))?(?:\s*[-–]\s*(?:${LICZBA})(?:[.,]\d{1,2})?)?\s*(?:zł|zl|pln|,-)`, "i");
const KWOTA_PRZED = new RegExp(String.raw`(?:zł|zl|pln)\s*(${LICZBA})(?:[.,](\d{1,2}))?`, "i");
const CZAS_GODZINY = /(\d+(?:[.,]\d+)?)\s*(?:h|g|godz\.?|godzin[ay]?|godzina)(?![a-ząćęłńóśźż])(?:\s*(\d{1,2})\s*(?:min\.?|minut|m)(?![a-ząćęłńóśźż]))?/i;
const CZAS_MINUTY = /(\d{1,3})\s*(?:min\.?|minut[ay]?|['′])(?![a-ząćęłńóśźż])/i;
const CZAS_ZEGAR = /\b(\d{1,2}):([0-5]\d)\s*(?:h|godz\.?)?(?![\d:])/i;

const naGrosze = (calkowite: string, ulamek?: string) => Number(calkowite.replace(/[ \u00a0]/g, "")) * 100 + (ulamek ? Number(ulamek.padEnd(2, "0")) : 0);
const wLimicieCeny = (gr: number) => gr >= LIMITY_CENNIKA.minCenaGr && gr <= LIMITY_CENNIKA.maksCenaGr;
const wLimicieCzasu = (min: number) => min >= LIMITY_CENNIKA.minCzasMin && min <= LIMITY_CENNIKA.maksCzasMin;

/** Czas usługi z tekstu: „60 min”, „1 h 30 min”, „1,5 h”, „1:30”, „90'”. Zwraca też tekst bez tego fragmentu. */
export function wyciagnijCzas(tekst: string): { czasMin: number | null; reszta: string } {
  const g = CZAS_GODZINY.exec(tekst);
  if (g) {
    const min = Math.round(Number(g[1].replace(",", ".")) * 60) + (g[2] ? Number(g[2]) : 0);
    if (wLimicieCzasu(min)) return { czasMin: min, reszta: tekst.replace(g[0], " ") };
  }
  const m = CZAS_MINUTY.exec(tekst);
  if (m && wLimicieCzasu(Number(m[1]))) return { czasMin: Number(m[1]), reszta: tekst.replace(m[0], " ") };
  const z = CZAS_ZEGAR.exec(tekst);
  if (z) {
    const min = Number(z[1]) * 60 + Number(z[2]);
    if (wLimicieCzasu(min)) return { czasMin: min, reszta: tekst.replace(z[0], " ") };
  }
  return { czasMin: null, reszta: tekst };
}

/**
 * Cena z tekstu: najpierw kwota z walutą („120 zł”, „od 99,50 zł”, „120–150 zł” → dolna),
 * a bez waluty ostatnia liczba w wierszu („Hybryda ........ 120”). Zwraca też tekst bez ceny.
 */
export function wyciagnijCene(tekst: string): { cenaGr: number | null; reszta: string } {
  for (const wzor of [KWOTA, KWOTA_PRZED]) {
    const k = wzor.exec(tekst);
    if (k) {
      const gr = naGrosze(k[1], k[2]);
      if (wLimicieCeny(gr)) return { cenaGr: gr, reszta: tekst.replace(k[0], " ") };
    }
  }
  // bez waluty: liczba na końcu wiersza, od 10 zł (niżej to raczej „1:1” albo numer)
  const liczby = [...tekst.matchAll(new RegExp(String.raw`(?:^|[^\d.,:])(${LICZBA})(?:[.,](\d{1,2}))?(?:\s*[-–]\s*\d+(?:[.,]\d{1,2})?)?\s*$`, "g"))];
  const ostatnia = liczby.at(-1);
  if (ostatnia) {
    const gr = naGrosze(ostatnia[1], ostatnia[2]);
    if (gr >= 1000 && wLimicieCeny(gr)) return { cenaGr: gr, reszta: tekst.slice(0, ostatnia.index) + (ostatnia[0].match(/^[^\d]/)?.[0] ?? "") };
  }
  return { cenaGr: null, reszta: tekst };
}

/** Cena z komórki tabeli: „120”, „120,00 zł”, „120.5”, „1 200”. */
export function cenaZKomorki(komorka: string): number | null {
  const t = komorka.trim();
  if (!t) return null;
  const k = /^(?:od\s*)?(\d{1,3}(?:[ \u00a0]\d{3})+|\d+)(?:[.,](\d{1,2}))?\s*(?:zł|zl|pln)?$/i.exec(t);
  if (k) {
    const gr = naGrosze(k[1], k[2]);
    return wLimicieCeny(gr) ? gr : null;
  }
  return wyciagnijCene(t).cenaGr;
}

/** Czas z komórki tabeli: „60”, „1:30”, „1h 30min”, a z Excela ułamek doby („0.0625” = 1:30). */
export function czasZKomorki(komorka: string): number | null {
  const t = komorka.trim().replace(",", ".");
  if (!t) return null;
  if (/^\d+$/.test(t)) return wLimicieCzasu(Number(t)) ? Number(t) : null;
  if (/^0?\.\d+$/.test(t)) {
    const min = Math.round(Number(t) * 24 * 60);
    return wLimicieCzasu(min) ? min : null;
  }
  return wyciagnijCzas(komorka).czasMin;
}

/** Nazwa bez kropek prowadzących, wypunktowań, dwukropków i zbędnych spacji. */
function oczyscNazwe(tekst: string): string {
  return tekst
    .replace(/[.…·_]{2,}|-{2,}|\s[-–—|:]\s|[|]/g, " ")
    .replace(/^[\s•*▪◦·\-–—>]+/, "")
    .replace(/\b(?:cena|od|price)\s*$/i, "")
    .replace(/[\s:;,.+\-–—]+$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── tekst ──────────────────────────────────────────────────────────────

/**
 * Wiersze cennika z tekstu (wklejonego albo odczytanego ze zdjęcia). Wiersz bez ceny
 * to nagłówek sekcji — chyba że następny wiersz ma samą cenę (OCR rozdziela kolumny),
 * wtedy łączymy je w jedną pozycję.
 */
export function wierszeZTekstu(tekst: string): WierszImportu[] {
  const linie = tekst
    .split(/\r?\n/)
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter((l) => l.length > 0);
  const wynik: WierszImportu[] = [];
  let sekcja: string | null = null;
  for (let i = 0; i < linie.length; i++) {
    const linia = linie[i];
    const { czasMin, reszta } = wyciagnijCzas(linia);
    const { cenaGr, reszta: bezCeny } = wyciagnijCene(reszta);
    const nazwa = oczyscNazwe(bezCeny);
    if (cenaGr === null) {
      // nazwa teraz, cena w następnym wierszu
      const nastepna = linie[i + 1];
      if (nazwa && nastepna) {
        const n = wyciagnijCzas(nastepna);
        const c = wyciagnijCene(n.reszta);
        if (c.cenaGr !== null && !/[a-ząćęłńóśźż]{3,}/i.test(oczyscNazwe(c.reszta).replace(/\b(?:zł|zl|pln|od|min)\b/gi, ""))) {
          wynik.push({ zrodlo: `${linia} ${nastepna}`, nazwa, cenaGr: c.cenaGr, czasMin: czasMin ?? n.czasMin, pracownicy: [], sekcja });
          i++;
          continue;
        }
      }
      if (nazwa && nazwa.length <= 60 && /[a-ząćęłńóśźż]/i.test(nazwa)) sekcja = nazwa;
      continue;
    }
    if (!nazwa || !/[a-ząćęłńóśźż]{2,}/i.test(nazwa)) continue;
    wynik.push({ zrodlo: linia, nazwa, cenaGr, czasMin, pracownicy: [], sekcja });
  }
  return wynik;
}

// ── tabela z pliku ─────────────────────────────────────────────────────

type Kolumny = { nazwa: number; cena: number; czas: number; pracownik: number; kategoria: number };

const NAGLOWKI: [keyof Kolumny, RegExp][] = [
  ["pracownik", /pracownik|specjalist|stylist|staff|employee|wykonawc|wykonuj/],
  ["cena", /cena|price|kwota|koszt|brutto|\bpln\b|\bzl\b|stawka/],
  ["czas", /czas|duration|dlugosc|\bmin|\btime\b|trwa/],
  ["kategoria", /kategori|category|grupa|dzial/],
  ["nazwa", /usluga|nazwa|service|zabieg|\bname\b|pozycja|oferta/],
];

function rozpoznajNaglowek(wiersz: string[]): Kolumny | null {
  const k: Kolumny = { nazwa: -1, cena: -1, czas: -1, pracownik: -1, kategoria: -1 };
  wiersz.forEach((komorka, i) => {
    const n = normalizuj(komorka);
    if (!n || n.length > 40) return;
    for (const [pole, wzor] of NAGLOWKI) {
      if (k[pole] === -1 && wzor.test(n)) {
        k[pole] = i;
        return;
      }
    }
  });
  return k.nazwa !== -1 && (k.cena !== -1 || k.czas !== -1) ? k : null;
}

/**
 * Wiersze cennika z tabeli (eksport z innego systemu). Kolumny rozpoznajemy po nagłówku
 * w jednym z pierwszych wierszy; bez nagłówka każdy wiersz czytamy jak linię tekstu.
 */
export function wierszeZTabeli(tabela: string[][]): WierszImportu[] {
  const indeks = tabela.slice(0, 5).findIndex((w) => rozpoznajNaglowek(w) !== null);
  if (indeks === -1) return wierszeZTekstu(tabela.map((w) => w.filter(Boolean).join(" ")).join("\n"));
  const k = rozpoznajNaglowek(tabela[indeks])!;
  const komorka = (w: string[], i: number) => (i >= 0 ? (w[i] ?? "").trim() : "");
  const wynik: WierszImportu[] = [];
  for (const w of tabela.slice(indeks + 1)) {
    const nazwa = oczyscNazwe(komorka(w, k.nazwa));
    if (!nazwa || !/[a-ząćęłńóśźż]{2,}/i.test(nazwa)) continue;
    const pracownik = komorka(w, k.pracownik);
    wynik.push({
      // tylko rozpoznane kolumny — inne dane z pliku (np. klientów) nie trafiają nawet na ekran
      zrodlo: [komorka(w, k.nazwa), komorka(w, k.cena), komorka(w, k.czas), pracownik].filter(Boolean).join(" · "),
      nazwa,
      cenaGr: cenaZKomorki(komorka(w, k.cena)),
      czasMin: czasZKomorki(komorka(w, k.czas)),
      pracownicy: pracownik ? pracownik.split(/\s*[,;/]\s*|\s+i\s+/).map(imiePracownika).filter((x): x is string => x !== null) : [],
      sekcja: komorka(w, k.kategoria) || null,
    });
  }
  return wynik;
}

/**
 * Do aplikacji trafia tylko imię (albo pseudonim) pracownika — tyle wystarczy klientce
 * i tyle wymaga minimalizacja danych. „Anna Kowalska” → „Anna”.
 */
export function imiePracownika(tekst: string): string | null {
  const imie = tekst.trim().split(/\s+/)[0]?.replace(/[^A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż-]/g, "") ?? "";
  if (imie.length < 2 || imie.length > 30) return null;
  return imie[0].toUpperCase() + imie.slice(1).toLowerCase();
}

// ── dopasowanie do katalogu ────────────────────────────────────────────

const doRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const slowa = (s: string) => normalizuj(s).replace(/[^a-z0-9:]+/g, " ").trim().split(" ").filter(Boolean);

/** To samo słowo z polską końcówką: „rzęs”/„rzęsy”, „brody”/„broda”, „strzyżenie”/„strzyżenia”. */
function toSamoSlowo(a: string, b: string): boolean {
  if (a === b) return true;
  const krotsze = Math.min(a.length, b.length);
  if (krotsze < 4) return false;
  const n = Math.min(5, krotsze - 1);
  return a.slice(0, n) === b.slice(0, n);
}

/**
 * Najlepsza usługa z podanej listy dla nazwy z cennika. Liczy się, ile słów nazwy
 * z katalogu jest w tekście (z polskimi końcówkami) albo synonim spoza nazwy wpisany
 * w całości („hybryda”, „2D”) — co większe, a drugie tylko w połowie, żeby synonim
 * „hybrydy” nie wygrał z pełną nazwą „Zdjęcie hybrydy”. Pewne: pokryte co najmniej
 * 60% nazwy albo synonim od 4 liter. Salon i tak zatwierdza każdą pozycję.
 */
export function dopasujUsluge(nazwa: string, dozwolone: Usluga[]): { usluga: Usluga; pewne: boolean } | null {
  const tekst = slowa(nazwa);
  const t = ` ${tekst.join(" ")} `;
  let najlepsza: { usluga: Usluga; wynik: number; pewne: boolean } | null = null;
  for (const u of dozwolone) {
    const nazwaUslugi = slowa(u.nazwa).filter((w) => w.length >= 3);
    const pokryte = nazwaUslugi.filter((w) => tekst.some((x) => toSamoSlowo(w, x))).reduce((n, w) => n + w.length, 0);
    const calosc = nazwaUslugi.reduce((n, w) => n + w.length, 0) || 1;
    let synonimy = 0;
    let pewnySynonim = false;
    for (const s of u.synonimy) {
      const sl = slowa(s);
      if (!sl.length || sl.every((w) => nazwaUslugi.includes(w))) continue;
      if (new RegExp(`[^a-z0-9]${doRegex(sl.join(" "))}[a-z]{0,3}[^a-z0-9]`).test(t)) {
        synonimy = Math.max(synonimy, sl.join(" ").length);
        if (sl.join(" ").length >= 4) pewnySynonim = true;
      }
    }
    const wynik = Math.max(pokryte, synonimy) + Math.min(pokryte, synonimy) / 2;
    if (wynik >= 5 && (!najlepsza || wynik > najlepsza.wynik)) najlepsza = { usluga: u, wynik, pewne: pokryte / calosc >= 0.6 || pewnySynonim };
  }
  return najlepsza ? { usluga: najlepsza.usluga, pewne: najlepsza.pewne } : null;
}

/**
 * Każdy wiersz z propozycją usługi z katalogu branży salonu. Nagłówek sekcji pomaga tylko
 * wtedy, gdy razem z nazwą daje pewne trafienie („Manicure” + „Klasyczny”) — sam nagłówek
 * „Paznokcie” nie zrobi z „Bonu podarunkowego” usługi paznokci.
 */
export function dopasuj(wiersze: WierszImportu[], branza: Branza): PropozycjaImportu[] {
  const dozwolone = uslugiBranzy(branza);
  return wiersze.map((w) => {
    const sama = dopasujUsluge(w.nazwa, dozwolone);
    const zSekcja = w.sekcja && !sama?.pewne ? dopasujUsluge(`${w.sekcja} ${w.nazwa}`, dozwolone) : null;
    const d = zSekcja?.pewne ? zSekcja : sama;
    return { ...w, uslugaKod: d?.usluga.kod ?? null, pewne: d?.pewne ?? false };
  });
}

/**
 * Zatwierdzone propozycje → pozycje cennika. Kilka wierszy na tę samą usługę (warianty,
 * różni pracownicy) daje jedną pozycję z najniższą ceną — w cenniku podajemy cenę „od”.
 */
export function pozycjeZImportu(propozycje: PropozycjaImportu[]): { pozycje: PozycjaZImportu[]; pracownicy: PracownikZImportu[] } {
  const pozycje = new Map<string, PozycjaZImportu>();
  const pracownicy = new Map<string, Set<string>>();
  for (const p of propozycje) {
    if (!p.uslugaKod || p.cenaGr === null) continue;
    const typowy = KATALOG_USLUG.find((u) => u.kod === p.uslugaKod)?.typowyCzasMin ?? 60;
    const byla = pozycje.get(p.uslugaKod);
    if (!byla || p.cenaGr < byla.cenaGr) pozycje.set(p.uslugaKod, { uslugaKod: p.uslugaKod, cenaGr: p.cenaGr, czasMin: p.czasMin ?? byla?.czasMin ?? typowy });
    for (const imie of p.pracownicy) pracownicy.set(imie, new Set([...(pracownicy.get(imie) ?? []), p.uslugaKod]));
  }
  return {
    pozycje: [...pozycje.values()],
    pracownicy: [...pracownicy.entries()].map(([imie, uslugi]) => ({ imie, uslugi: [...uslugi].sort() })),
  };
}

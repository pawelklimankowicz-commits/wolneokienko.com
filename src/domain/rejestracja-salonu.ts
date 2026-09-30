// =====================================================================
// Rejestracja usługodawcy: dane firmy i cennik.
//
// Czyste reguły, wspólne dla formularza w aplikacji (błędy od razu przy
// polu) i dla serwera (ostateczne sprawdzenie przed zapisem).
//
// Zasady szczególne (docs/DECYZJE.md):
//  • zdrowie — numer wpisu do rejestru (RPWDL) albo prawa wykonywania zawodu;
//  • toksyna botulinowa — tylko gdy zabieg wykonuje lekarz (deklaracja);
//  • wypełniacze — deklaracja, kto wykonuje zabieg i z jakimi kwalifikacjami.
// Cennik obejmuje usługi jednej, głównej branży usługodawcy.
// =====================================================================

import { normalizujTelefon } from "../lib/telefon";
import { BRANZE, KATALOG_USLUG, branzaUslugi, opisBranzy, type Branza } from "./katalog-uslug";
import type { Pracownik, StanKalendarza } from "./profil-salonu";

export interface DaneSalonu {
  nazwa: string;
  nip: string;
  /** ulica z numerem budynku (i lokalu) */
  ulica: string;
  kodPocztowy: string;
  miasto: string;
  branza: Branza;
  /** telefon do usługodawcy, dla klientek z rezerwacją */
  telefon: string;
  /** adres do faktur prowizyjnych i spraw konta */
  email: string;
  /** zdrowie: numer księgi rejestrowej RPWDL albo prawa wykonywania zawodu */
  numerRejestru?: string;
}

export interface PozycjaCennika {
  usluga: string;
  /** cena „od”, w groszach */
  cenaGr: number;
  czasMin: number;
  wykonujeLekarz?: boolean;
  deklaracja?: string;
}

/** Salon zalogowanego usługodawcy — tak, jak zwraca go API. */
export interface SalonKonta extends DaneSalonu {
  id: string;
  /** jak adres zrozumiała mapa — do potwierdzenia przez usługodawcę */
  adresZMapy: string | null;
  przyjmujeZapytania: boolean;
  /** pierwsze włączenie przyjmowania zapytań — start miesiąca próbnego */
  aktywowanyAt: string | null;
  /** zablokowany przez operatora albo wstrzymany za zaległą fakturę */
  wstrzymany: boolean;
  /** wizyty z aplikacji, które się odbyły — do promocji startowej */
  wizytyZrealizowane: number;
  cennik: PozycjaCennika[];
  /** profil dla klientek: opis, logo, zdjęcia, pracownicy (src/domain/profil-salonu.ts) */
  opis: string | null;
  logoUrl: string | null;
  zdjecia: { id: string; url: string }[];
  pracownicy: Pracownik[];
  /** podłączony kalendarz salonu — tylko stan, bez tajnego adresu */
  kalendarz: StanKalendarza | null;
}

export type BledyDanych = Partial<Record<keyof DaneSalonu, string>>;

/** Czas do doby — hotel dla zwierząt liczy się na doby. */
export const LIMITY_CENNIKA = { maksPozycji: 80, minCenaGr: 100, maksCenaGr: 10_000_00, minCzasMin: 5, maksCzasMin: 24 * 60 } as const;

const WAGI_NIP = [6, 5, 7, 2, 3, 4, 5, 6, 7];

export const tylkoCyfry = (tekst: string) => tekst.replace(/\D/g, "");

/** NIP: 10 cyfr z poprawną sumą kontrolną (myślniki i spacje dozwolone, prefiks PL też). */
export function poprawnyNip(tekst: string): boolean {
  const nip = tylkoCyfry(tekst.replace(/^\s*PL/i, ""));
  if (!/^\d{10}$/.test(nip) || /^0+$/.test(nip)) return false;
  const suma = WAGI_NIP.reduce((s, w, i) => s + w * Number(nip[i]), 0) % 11;
  return suma !== 10 && suma === Number(nip[9]);
}

/** „60838” albo „60 838” → „60-838”; inaczej bez zmian. */
export function normalizujKodPocztowy(tekst: string): string {
  const c = tylkoCyfry(tekst);
  return c.length === 5 ? `${c.slice(0, 2)}-${c.slice(2)}` : tekst.trim();
}

/** Dane po oczyszczeniu: przycięte napisy, NIP z samych cyfr, kod pocztowy i telefon w jednym zapisie. */
export function oczyscDane(d: DaneSalonu): DaneSalonu {
  return {
    nazwa: d.nazwa.trim().replace(/\s+/g, " "),
    nip: tylkoCyfry(d.nip.replace(/^\s*PL/i, "")),
    ulica: d.ulica.trim().replace(/\s+/g, " "),
    kodPocztowy: normalizujKodPocztowy(d.kodPocztowy),
    miasto: d.miasto.trim().replace(/\s+/g, " "),
    branza: d.branza,
    telefon: normalizujTelefon(d.telefon) ?? d.telefon.trim(),
    email: d.email.trim().toLowerCase(),
    ...(d.numerRejestru?.trim() ? { numerRejestru: d.numerRejestru.trim() } : {}),
  };
}

export function walidujDaneSalonu(surowe: DaneSalonu): BledyDanych {
  const d = oczyscDane(surowe);
  const b: BledyDanych = {};
  if (d.nazwa.length < 2 || d.nazwa.length > 80) b.nazwa = "Podaj nazwę, pod którą znają Cię klientki (2–80 znaków).";
  if (!poprawnyNip(d.nip)) b.nip = "To nie jest poprawny NIP. Sprawdź 10 cyfr.";
  if (d.ulica.length < 3 || d.ulica.length > 100 || !/\d/.test(d.ulica)) b.ulica = "Podaj ulicę z numerem, np. Dąbrowskiego 12/3.";
  if (!/^\d{2}-\d{3}$/.test(d.kodPocztowy)) b.kodPocztowy = "Kod pocztowy w formacie 60-838.";
  if (d.miasto.length < 2 || d.miasto.length > 60) b.miasto = "Podaj miejscowość.";
  if (!BRANZE.some((x) => x.id === d.branza)) b.branza = "Wybierz branżę.";
  if (!normalizujTelefon(d.telefon)) b.telefon = "Podaj polski numer telefonu, np. 600 123 123.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email) || d.email.length > 120) b.email = "Podaj adres e-mail — wyślemy na niego faktury.";
  if (BRANZE.find((x) => x.id === d.branza)?.medyczna) {
    const n = d.numerRejestru ?? "";
    if (n.length < 3 || n.length > 40) b.numerRejestru = "Podaj numer księgi rejestrowej RPWDL albo numer prawa wykonywania zawodu.";
  }
  return b;
}

export interface BledyCennika {
  /** błąd całego cennika (np. pusty) */
  ogolny?: string;
  /** błędy pozycji, po kodzie usługi */
  pozycje: Record<string, string>;
}

export function walidujCennik(branza: Branza, pozycje: PozycjaCennika[]): BledyCennika {
  const b: BledyCennika = { pozycje: {} };
  const L = LIMITY_CENNIKA;
  if (pozycje.length === 0) b.ogolny = "Wybierz co najmniej jedną usługę i podaj cenę.";
  if (pozycje.length > L.maksPozycji) b.ogolny = `Najwyżej ${L.maksPozycji} usług w cenniku.`;
  const widziane = new Set<string>();
  for (const p of pozycje) {
    const u = KATALOG_USLUG.find((x) => x.kod === p.usluga);
    if (!u || branzaUslugi(u) !== branza) {
      b.pozycje[p.usluga] = `Tej usługi nie ma w branży ${opisBranzy(branza).nazwa.toLowerCase()}.`;
      continue;
    }
    if (widziane.has(p.usluga)) {
      b.pozycje[p.usluga] = "Ta usługa jest w cenniku dwa razy.";
      continue;
    }
    widziane.add(p.usluga);
    if (!Number.isInteger(p.cenaGr) || p.cenaGr < L.minCenaGr || p.cenaGr > L.maksCenaGr) {
      b.pozycje[p.usluga] = "Podaj cenę od 1 do 10 000 zł.";
    } else if (!Number.isInteger(p.czasMin) || p.czasMin < L.minCzasMin || p.czasMin > L.maksCzasMin) {
      b.pozycje[p.usluga] = "Podaj czas od 5 minut do 24 godzin.";
    } else if (u.wymagaLekarza && !p.wykonujeLekarz) {
      b.pozycje[p.usluga] = "Ten zabieg może wykonywać tylko lekarz — potwierdź to, żeby go dodać.";
    } else if (u.wymagaDeklaracjiKwalifikacji && ((p.deklaracja ?? "").trim().length < 10 || (p.deklaracja ?? "").length > 300)) {
      b.pozycje[p.usluga] = "Napisz, kto wykonuje zabieg i jakie ma kwalifikacje (10–300 znaków).";
    }
  }
  return b;
}

export const bezBledow = (b: BledyDanych | BledyCennika) =>
  "pozycje" in b ? !b.ogolny && Object.keys(b.pozycje).length === 0 : Object.keys(b).length === 0;

/** „130” / „130,50” / „130.5” → 13000 / 13050 / 13050 groszy; null, gdy to nie kwota. */
export function zlotowkiNaGrosze(tekst: string): number | null {
  const t = tekst.trim().replace(/\s|zł/g, "").replace(",", ".");
  if (!/^\d{1,6}(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(Number(t) * 100);
}

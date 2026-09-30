// =====================================================================
// Prowizja Wolnego Okienka od salonu.
//
// DECYZJA WŁAŚCICIELA (30.09.2026): 20% + VAT od KAŻDEJ wizyty z aplikacji,
// nie tylko od pierwszej. Uzasadnienie: wypełniamy wolne terminy, a nie
// prowadzimy salonowi całego kalendarza jak Booksy (abonament + Boost).
//
// Promocja startowa: miesiąc próbny bez prowizji i 5 pierwszych klientek
// bez prowizji. Jak te dwa warunki się łączą, jest parametrem
// (`liczDarmoweWizytyOd`), bo właściciel tego jeszcze nie przesądził.
//
// Wszystkie kwoty w GROSZACH (liczby całkowite) — bez błędów zaokrągleń
// na liczbach zmiennoprzecinkowych.
// =====================================================================

/** Stawka prowizji netto od wartości wizyty. */
export const STAWKA_PROWIZJI = 0.2;
/** VAT doliczany do prowizji (faktura Wolnego Okienka dla salonu). */
export const STAWKA_VAT = 0.23;

export interface PromocjaStartowa {
  /** Długość miesiąca próbnego w dniach, liczona od aktywacji salonu. */
  dniProbne: number;
  /** Ile zrealizowanych wizyt jest bez prowizji. */
  darmoweWizyty: number;
  /**
   * "aktywacji" — darmowe wizyty liczą się od początku (miesiąc próbny
   *   i pierwsze 5 wizyt nakładają się; wygrywa to, co trwa dłużej);
   * "konca_proby" — 5 darmowych wizyt przysługuje DODATKOWO po miesiącu próbnym.
   */
  liczDarmoweWizytyOd: "aktywacji" | "konca_proby";
}

export const PROMOCJA_STARTOWA: PromocjaStartowa = {
  dniProbne: 30,
  darmoweWizyty: 5,
  liczDarmoweWizytyOd: "aktywacji",
};

export interface SalonDoPromocji {
  /** Chwila aktywacji salonu w aplikacji. */
  aktywowanyAt: Date;
  /** Liczba wizyt zrealizowanych PRZED tą wizytą (od aktywacji). */
  wizytyPrzed: number;
  /** Liczba wizyt zrealizowanych przed tą wizytą, ale już PO miesiącu próbnym. */
  wizytyPrzedPoProbie: number;
}

const DZIEN_MS = 24 * 60 * 60 * 1000;

/** Czy wizyta w chwili `terminWizyty` jest zwolniona z prowizji w ramach promocji. */
export function czyZwolnionaPromocja(
  salon: SalonDoPromocji,
  terminWizyty: Date,
  promocja: PromocjaStartowa = PROMOCJA_STARTOWA,
): boolean {
  const koniecProby = salon.aktywowanyAt.getTime() + promocja.dniProbne * DZIEN_MS;
  if (terminWizyty.getTime() < koniecProby) return true;
  const wykorzystane =
    promocja.liczDarmoweWizytyOd === "aktywacji" ? salon.wizytyPrzed : salon.wizytyPrzedPoProbie;
  return wykorzystane < promocja.darmoweWizyty;
}

export interface Prowizja {
  nettoGr: number;
  vatGr: number;
  bruttoGr: number;
}

export const PROWIZJA_ZERO: Prowizja = { nettoGr: 0, vatGr: 0, bruttoGr: 0 };

/** Prowizja 20% + VAT od podstawy (wartość wizyty albo przepadły zadatek). */
export function prowizjaOd(podstawaGr: number): Prowizja {
  if (!Number.isInteger(podstawaGr) || podstawaGr < 0) {
    throw new Error(`Podstawa prowizji musi być nieujemną liczbą groszy, jest: ${podstawaGr}`);
  }
  const nettoGr = Math.round(podstawaGr * STAWKA_PROWIZJI);
  const vatGr = Math.round(nettoGr * STAWKA_VAT);
  return { nettoGr, vatGr, bruttoGr: nettoGr + vatGr };
}

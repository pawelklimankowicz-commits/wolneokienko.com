// =====================================================================
// Prowizja Wolnego Okienka od salonu.
//
// DECYZJA WŁAŚCICIELA (30.09.2026): 20% + VAT od KAŻDEJ wizyty z aplikacji,
// nie tylko od pierwszej. Uzasadnienie: wypełniamy wolne terminy, a nie
// prowadzimy salonowi całego kalendarza jak Booksy (abonament + Boost).
// Dotyczy wszystkich branż, także zdrowia; nikt nie płaci abonamentu.
//
// Promocja startowa: miesiąc próbny, w którym 5 pierwszych klientek jest
// bez prowizji. Darmowe wizyty nie przechodzą na czas po miesiącu próbnym
// (decyzja właściciela z 30.09.2026).
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
  /** Ile pierwszych wizyt w miesiącu próbnym jest bez prowizji. */
  darmoweWizyty: number;
}

export const PROMOCJA_STARTOWA: PromocjaStartowa = {
  dniProbne: 30,
  darmoweWizyty: 5,
};

export interface SalonDoPromocji {
  /** Chwila aktywacji salonu w aplikacji. */
  aktywowanyAt: Date;
  /** Liczba wizyt z aplikacji zrealizowanych PRZED tą wizytą (od aktywacji). */
  wizytyPrzed: number;
}

const DZIEN_MS = 24 * 60 * 60 * 1000;

/**
 * Wizyta jest bez prowizji, jeśli wypada w miesiącu próbnym i jest jedną
 * z 5 pierwszych wizyt salonu z aplikacji.
 */
export function czyZwolnionaPromocja(
  salon: SalonDoPromocji,
  terminWizyty: Date,
  promocja: PromocjaStartowa = PROMOCJA_STARTOWA,
): boolean {
  const koniecProby = salon.aktywowanyAt.getTime() + promocja.dniProbne * DZIEN_MS;
  return terminWizyty.getTime() < koniecProby && salon.wizytyPrzed < promocja.darmoweWizyty;
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

// =====================================================================
// Rozliczenie rezerwacji po terminie wizyty.
//
// FAZA 1 — BEZ ZADATKU (decyzja właściciela z 30.09.2026): klientka płaci
// całą kwotę w salonie, a prowizja 20% + VAT trafia w całości na miesięczną
// fakturę salonu (KSeF). `zadatekGr` = 0 i żadne pieniądze klientki nie
// przechodzą przez aplikację.
//
// Zadatek wróci w późniejszych fazach. Moduł już go obsługuje:
//  • nieobecność bez odwołania — zadatek przepada, 20% + VAT dla nas, reszta
//    dla salonu (art. 394 § 1 Kodeksu cywilnego);
//  • odwołanie przez klientkę — PARAMETR `przyOdwolaniuKlientki`, domyślnie
//    zwrot: umowa zawarta przez aplikację to umowa na odległość, konsumentka
//    ma 14 dni na odstąpienie (art. 27 ustawy o prawach konsumenta), a zapis
//    gorszy niż ustawa jest nieważny (art. 7). Szczegóły: docs/DECYZJE.md.
// =====================================================================

import { PROWIZJA_ZERO, prowizjaOd, type Prowizja } from "./prowizja";

export type WynikRezerwacji =
  | "zrealizowana"
  | "nieobecnosc"
  | "odwolana_przez_klientke"
  | "odwolana_przez_salon";

export interface ParametryZadatku {
  przyOdwolaniuKlientki: "zwrot" | "przepada";
}

export const PARAMETRY_ZADATKU: ParametryZadatku = {
  przyOdwolaniuKlientki: "zwrot",
};

/** Czy aplikacja pobiera zadatek. Faza 1: nie. */
export const POBIERAMY_ZADATEK = false;

export interface DaneRozliczenia {
  wynik: WynikRezerwacji;
  /** Cena wizyty z oferty salonu (podstawa prowizji przy wizycie zrealizowanej). */
  cenaWizytyGr: number;
  /** Czy wizyta jest zwolniona z prowizji w ramach promocji startowej. */
  zwolnionaPromocja: boolean;
  /** Zadatek wpłacony przez klientkę. W fazie 1 zawsze 0. */
  zadatekGr?: number;
}

export interface Rozliczenie {
  /** Prowizja Wolnego Okienka (faktura dla salonu przez KSeF). */
  prowizja: Prowizja;
  /** Ile z zadatku idzie do salonu. */
  wyplataDlaSalonuGr: number;
  /** Ile z zadatku wraca do klientki. */
  zwrotDlaKlientkiGr: number;
  /** Ile klientka płaci w salonie (tylko przy wizycie zrealizowanej). */
  doplataWSalonieGr: number;
  /** Część prowizji, której nie pokrył zadatek — trafia na fakturę miesięczną salonu. */
  doFakturyGr: number;
  /** Wynik obniża wskaźnik niezawodności tej strony. */
  obnizaWskaznik: "klientka" | "salon" | null;
}

function sprawdzGrosze(nazwa: string, wartosc: number): void {
  if (!Number.isInteger(wartosc) || wartosc < 0) {
    throw new Error(`${nazwa} musi być nieujemną liczbą groszy, jest: ${wartosc}`);
  }
}

/** Zadatek potrącony o prowizję; niedobór prowizji idzie na fakturę miesięczną. */
function potracProwizje(zadatekGr: number, prowizja: Prowizja) {
  const zZadatku = Math.min(zadatekGr, prowizja.bruttoGr);
  return {
    wyplataDlaSalonuGr: zadatekGr - zZadatku,
    doFakturyGr: prowizja.bruttoGr - zZadatku,
  };
}

export function rozliczRezerwacje(
  dane: DaneRozliczenia,
  parametry: ParametryZadatku = PARAMETRY_ZADATKU,
): Rozliczenie {
  const zadatekGr = dane.zadatekGr ?? 0;
  sprawdzGrosze("Zadatek", zadatekGr);
  sprawdzGrosze("Cena wizyty", dane.cenaWizytyGr);
  if (zadatekGr > dane.cenaWizytyGr) {
    throw new Error("Zadatek nie może być wyższy niż cena wizyty.");
  }

  const zwrotCalosci: Rozliczenie = {
    prowizja: PROWIZJA_ZERO,
    wyplataDlaSalonuGr: 0,
    zwrotDlaKlientkiGr: zadatekGr,
    doplataWSalonieGr: 0,
    doFakturyGr: 0,
    obnizaWskaznik: null,
  };

  const przepadek = (): Rozliczenie => {
    const prowizja = dane.zwolnionaPromocja ? PROWIZJA_ZERO : prowizjaOd(zadatekGr);
    return {
      prowizja,
      ...potracProwizje(zadatekGr, prowizja),
      zwrotDlaKlientkiGr: 0,
      doplataWSalonieGr: 0,
      obnizaWskaznik: "klientka",
    };
  };

  switch (dane.wynik) {
    case "zrealizowana": {
      const prowizja = dane.zwolnionaPromocja ? PROWIZJA_ZERO : prowizjaOd(dane.cenaWizytyGr);
      return {
        prowizja,
        ...potracProwizje(zadatekGr, prowizja),
        zwrotDlaKlientkiGr: 0,
        doplataWSalonieGr: dane.cenaWizytyGr - zadatekGr,
        obnizaWskaznik: null,
      };
    }
    case "nieobecnosc":
      return przepadek();
    case "odwolana_przez_klientke":
      return parametry.przyOdwolaniuKlientki === "przepada" ? przepadek() : zwrotCalosci;
    case "odwolana_przez_salon":
      return { ...zwrotCalosci, obnizaWskaznik: "salon" };
  }
}

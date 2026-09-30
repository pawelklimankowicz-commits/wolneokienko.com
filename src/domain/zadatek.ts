// =====================================================================
// Rozliczenie zadatku po wizycie.
//
// Klientka płaci zadatek przy wyborze oferty (BLIK, przez operatora
// płatności z podziałem płatności). Po terminie wizyty rezerwacja ma jeden
// z czterech wyników; ten moduł mówi, kto ile dostaje.
//
// ⚠️ ODWOŁANIE PRZEZ KLIENTKĘ — decyzja w toku (docs/DECYZJE.md, pkt 4).
// Właściciel chce, żeby zadatek przepadał także przy odwołaniu. Analiza
// prawna wskazuje, że przy umowie zawartej przez aplikację (na odległość)
// konsumentka może odstąpić w 14 dni (art. 27 ustawy o prawach konsumenta),
// a postanowienie odbierające jej zwrot jest nieważne (art. 7 tej ustawy).
// Dlatego polityka jest PARAMETREM `przyOdwolaniuKlientki`, a domyślna
// wartość w PARAMETRY_ZADATKU to zwrot. Nieobecność bez odwołania to
// niewykonanie umowy — tu zadatek przepada (art. 394 § 1 Kodeksu cywilnego).
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

export interface DaneRozliczenia {
  wynik: WynikRezerwacji;
  /** Zadatek wpłacony przez klientkę. */
  zadatekGr: number;
  /** Cena wizyty z oferty salonu (podstawa prowizji przy wizycie zrealizowanej). */
  cenaWizytyGr: number;
  /** Czy wizyta jest zwolniona z prowizji w ramach promocji startowej. */
  zwolnionaPromocja: boolean;
}

export interface Rozliczenie {
  /** Prowizja Wolnego Okienka (faktura dla salonu przez KSeF). */
  prowizja: Prowizja;
  /** Ile z zadatku idzie do salonu. */
  wyplataDlaSalonuGr: number;
  /** Ile z zadatku wraca do klientki. */
  zwrotDlaKlientkiGr: number;
  /** Ile klientka dopłaca w salonie (tylko przy wizycie zrealizowanej). */
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

export function rozliczZadatek(
  dane: DaneRozliczenia,
  parametry: ParametryZadatku = PARAMETRY_ZADATKU,
): Rozliczenie {
  sprawdzGrosze("Zadatek", dane.zadatekGr);
  sprawdzGrosze("Cena wizyty", dane.cenaWizytyGr);
  if (dane.zadatekGr > dane.cenaWizytyGr) {
    throw new Error("Zadatek nie może być wyższy niż cena wizyty.");
  }

  const zwrotCalosci: Rozliczenie = {
    prowizja: PROWIZJA_ZERO,
    wyplataDlaSalonuGr: 0,
    zwrotDlaKlientkiGr: dane.zadatekGr,
    doplataWSalonieGr: 0,
    doFakturyGr: 0,
    obnizaWskaznik: null,
  };

  const przepadek = (): Rozliczenie => {
    const prowizja = dane.zwolnionaPromocja ? PROWIZJA_ZERO : prowizjaOd(dane.zadatekGr);
    return {
      prowizja,
      ...potracProwizje(dane.zadatekGr, prowizja),
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
        ...potracProwizje(dane.zadatekGr, prowizja),
        zwrotDlaKlientkiGr: 0,
        doplataWSalonieGr: dane.cenaWizytyGr - dane.zadatekGr,
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

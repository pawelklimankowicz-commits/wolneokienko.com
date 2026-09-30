// Dane, które API wysyła do ekranów (i które podgląd bez serwera udaje).
// Czas zawsze jako ISO 8601, kwoty w groszach.

/** Oferta wiąże salon jeszcze tyle minut po końcu zbierania ofert (regulamin, § 6 i § 3). */
export const WAZNOSC_OFERTY_PO_ZBIERANIU_MIN = 15;

export type StatusZapytania = "otwarte" | "zarezerwowane" | "bez_ofert" | "anulowane" | "wygasle";
export type TrybZapytania = "zbieram" | "pierwsza";

export interface NoweZapytanie {
  uslugaKod: string;
  oknoOd: string;
  oknoDo: string;
  lat: number;
  lon: number;
  limitGr: number | null;
  tryb: TrybZapytania;
  liczbaOsob: number | null;
  /** opis wpisany przez klientkę; przy usługach medycznych nie jest zapisywany ani wysyłany */
  tresc: string;
  /** wyraźna zgoda na przekazanie rodzaju wizyty medycznej (art. 9 RODO) */
  zgodaZdrowie: boolean;
}

export interface OfertaNaZywo {
  id: string;
  salonId: string;
  salonNazwa: string;
  /** dzielnica albo miejscowość z adresu na mapie */
  okolica: string;
  odlegloscKm: number | null;
  termin: string;
  cenaGr: number;
  kolory: [string, string];
}

export interface StanZapytania {
  id: string;
  status: StatusZapytania;
  uslugaKod: string;
  /** koniec zbierania ofert */
  zbieranieDo: string;
  liczbaWykonawcow: number;
  oferty: OfertaNaZywo[];
  /** rezerwacja, gdy klientka przyjęła ofertę (albo tryb „pierwsza pasująca” zrobił to za nią) */
  rezerwacjaId: string | null;
}

export type StatusWizyty = "potwierdzona" | "do_potwierdzenia" | "zakonczona" | "odwolana_przez_klientke" | "odwolana_przez_salon" | "nieobecnosc";

export interface WizytaWidok {
  id: string;
  salonNazwa: string;
  adres: string;
  /** telefon salonu — widoczny dopiero po rezerwacji */
  telefon: string | null;
  uslugaKod: string;
  termin: string;
  cenaGr: number;
  kolory: [string, string];
  status: StatusWizyty;
}

export interface ZapytanieDlaSalonu {
  id: string;
  uslugaKod: string;
  oknoOd: string;
  oknoDo: string;
  limitGr: number | null;
  liczbaOsob: number | null;
  odlegloscKm: number | null;
  /** opis klientki — nigdy przy usługach medycznych */
  tresc: string | null;
  zbieranieDo: string;
  /** cena „od” i czas z cennika salonu */
  mojaCenaGr: number | null;
  czasMin: number;
  mojaOferta: { termin: string; cenaGr: number; status: "zlozona" | "potwierdzona" | "wygasla" | "odrzucona" | "wybrana" } | null;
  odmowa: boolean;
}

export interface WizytaSalonu {
  id: string;
  uslugaKod: string;
  termin: string;
  cenaGr: number;
  telefonKlientki: string;
  status: StatusWizyty;
}

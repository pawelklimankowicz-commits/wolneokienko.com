// Wspólne typy klienta API i komunikaty błędów po polsku (dla wersji HTTP i podglądu).
import type { BledyCennika, BledyDanych, DaneSalonu, PozycjaCennika, SalonKonta } from "../domain/rejestracja-salonu";
import type { NoweZapytanie, StanZapytania, WizytaSalonu, WizytaWidok, ZapytanieDlaSalonu } from "../domain/widoki";
import { odmiana } from "./format";

export type Rola = "klientka" | "salon" | "operator";

export interface Konto {
  id: string;
  rola: Rola;
  telefon: string;
}

export type Wynik<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      komunikat: string;
      /** ile sekund do możliwego ponownego wysłania kodu */
      ponowZaSek?: number;
      /** ten kod już nie przejdzie — trzeba zamówić nowy */
      nowyKod?: boolean;
      /** błędy pól formularza firmy */
      pola?: BledyDanych;
      /** błędy cennika */
      cennik?: BledyCennika;
    };

export type OdpowiedzPoWizycie = "bylam" | "nie_bylam" | "salon_odwolal";

export interface KlientApi {
  podglad: boolean;
  // logowanie
  ja(): Promise<Konto | null>;
  wyslijKod(telefon: string): Promise<Wynik<{ telefon: string }>>;
  /** logowanie = akceptacja regulaminu i polityki prywatności (tekst przy przycisku) */
  zaloguj(telefon: string, kod: string, rola?: "klientka" | "salon"): Promise<Wynik<{ konto: Konto }>>;
  wyloguj(): Promise<void>;
  // usługodawca: rejestracja
  mojSalon(): Promise<SalonKonta | null>;
  zapiszSalon(dane: DaneSalonu, akceptujeRegulamin: boolean): Promise<Wynik<{ salon: SalonKonta }>>;
  zapiszCennik(pozycje: PozycjaCennika[]): Promise<Wynik<{ salon: SalonKonta }>>;
  ustawPrzyjmowanie(wlaczone: boolean): Promise<Wynik<{ salon: SalonKonta }>>;
  // klientka: zapytania, oferty, wizyty
  wyslijZapytanie(dane: NoweZapytanie): Promise<Wynik<{ zapytanie: StanZapytania }>>;
  stanZapytania(id: string): Promise<StanZapytania | null>;
  anulujZapytanie(id: string): Promise<void>;
  przyjmijOferte(ofertaId: string): Promise<Wynik<{ wizyta: WizytaWidok }>>;
  mojeWizyty(): Promise<WizytaWidok[]>;
  odwolajWizyte(id: string): Promise<Wynik<object>>;
  potwierdzWizyte(id: string, odpowiedz: OdpowiedzPoWizycie): Promise<Wynik<object>>;
  // usługodawca: skrzynka
  skrzynkaSalonu(): Promise<ZapytanieDlaSalonu[]>;
  zlozOferte(zapytanieId: string, termin: string, cenaGr: number): Promise<Wynik<{ przyjeta: boolean }>>;
  odmowZapytania(zapytanieId: string): Promise<Wynik<object>>;
  wizytySalonu(): Promise<WizytaSalonu[]>;
}

export interface BladApi {
  blad?: string;
  ponowZaSek?: number;
  pozostaloProb?: number;
  pola?: BledyDanych;
  cennik?: BledyCennika;
  /** zapytanie: które pole jest złe */
  pole?: string;
  /** blokada po nieobecnościach: do kiedy */
  doKiedy?: string;
}

/** 20 → „20 s”, 840 → „14 min”. */
export const czasCzekania = (sek: number) => (sek < 60 ? `${sek} s` : `${Math.ceil(sek / 60)} min`);

const dataKrotka = new Intl.DateTimeFormat("pl-PL", { day: "numeric", month: "long" });

const POLE_ZAPYTANIA: Record<string, string> = {
  okno: "Wybierz termin w ciągu najbliższych 8 dni.",
  lokalizacja: "Nie znamy Twojej lokalizacji. Na razie działamy w Polsce.",
  limit: "Limit ceny: od 1 do 10 000 zł.",
  liczbaOsob: "Liczba osób: od 1 do 50.",
  tresc: "Opis może mieć najwyżej 300 znaków.",
  uslugaKod: "Wybierz usługę z listy.",
};

export function komunikatBledu(b: BladApi): { komunikat: string; nowyKod?: boolean; ponowZaSek?: number; pola?: BledyDanych; cennik?: BledyCennika } {
  switch (b.blad) {
    case "zle_dane":
      if (b.pole) return { komunikat: POLE_ZAPYTANIA[b.pole] ?? "Sprawdź zapytanie i spróbuj ponownie." };
      return { komunikat: b.cennik?.ogolny ?? "Popraw zaznaczone pola.", pola: b.pola, cennik: b.cennik };
    case "brak_akceptacji":
      return { komunikat: "Zaakceptuj regulamin, żeby przejść dalej." };
    case "nip_zajety":
      return { komunikat: "Firma z tym NIP-em jest już zarejestrowana. Jeśli to Twoja firma, napisz do nas — pomożemy odzyskać dostęp." };
    case "adres_nieznaleziony":
      return { komunikat: "Nie znaleźliśmy tego adresu na mapie. Sprawdź ulicę, numer i miejscowość.", pola: { ulica: "Nie znaleźliśmy tego adresu na mapie." } };
    case "brak_cennika":
      return { komunikat: "Najpierw dodaj cennik — bez niego nie dopasujemy zapytań." };
    case "wstrzymany":
      return { komunikat: "Przyjmowanie zapytań jest wstrzymane. Napisz do nas, wyjaśnimy dlaczego." };
    case "brak_salonu":
      return { komunikat: "Najpierw podaj dane firmy." };
    case "niezalogowany":
      return { komunikat: "Sesja wygasła. Zaloguj się ponownie." };
    case "zly_numer":
      return { komunikat: "To nie wygląda na polski numer komórki. Wpisz 9 cyfr, np. 600 123 123." };
    case "za_czesto":
      return { komunikat: `Kod już wysłaliśmy. Kolejny możesz zamówić za ${czasCzekania(b.ponowZaSek ?? 30)}.`, ponowZaSek: b.ponowZaSek };
    case "przeciazenie":
      return { komunikat: "Mamy teraz bardzo dużo logowań. Spróbuj za kilka minut." };
    case "blad_bramki":
      return { komunikat: "Nie udało się wysłać SMS-a. Spróbuj za chwilę." };
    case "zly_kod": {
      const n = b.pozostaloProb ?? 0;
      if (n === 0) return { komunikat: "Nieprawidłowy kod. To była ostatnia próba — zamów nowy kod.", nowyKod: true };
      return { komunikat: `Nieprawidłowy kod. ${odmiana(n, "Została", "Zostały", "Zostało")} ${n} ${odmiana(n, "próba", "próby", "prób")}.` };
    }
    case "wygasl":
      return { komunikat: "Kod wygasł. Zamów nowy.", nowyKod: true };
    case "za_duzo_prob":
      return { komunikat: "Za dużo prób. Zamów nowy kod.", nowyKod: true };
    case "brak_kodu":
      return { komunikat: "Ten kod jest już nieważny. Zamów nowy.", nowyKod: true };
    // zapytania i oferty
    case "brak_zgody":
      return { komunikat: "Zaznacz zgodę na przekazanie rodzaju wizyty gabinetom." };
    case "zablokowana":
      return {
        komunikat: b.doKiedy
          ? `Po 3 nieobecnościach możesz znów wysyłać zapytania od ${dataKrotka.format(new Date(b.doKiedy))}. Jeśli to pomyłka, napisz do nas.`
          : "Wysyłanie zapytań jest wstrzymane. Napisz do nas, wyjaśnimy dlaczego.",
      };
    case "za_duzo_otwartych":
      return { komunikat: "Masz już 3 otwarte zapytania. Poczekaj na oferty albo anuluj jedno z nich." };
    case "za_duzo_na_dobe":
      return { komunikat: "Dziś wysłałaś już bardzo dużo zapytań. Spróbuj jutro." };
    case "nieaktualna":
      return { komunikat: "Ta oferta jest już nieaktualna. Wybierz inną." };
    case "termin_zajety":
      return { komunikat: "Ten termin właśnie zajęła inna osoba. Wybierz inną ofertę." };
    case "nieaktualne":
      return { komunikat: "To jest już nieaktualne — odśwież listę." };
    case "zly_termin":
      return { komunikat: "Wybierz godzinę w oknie klientki, co najmniej 10 minut od teraz." };
    case "zla_cena":
      return { komunikat: "Podaj cenę od 1 do 10 000 zł." };
    case "powyzej_limitu":
      return { komunikat: "Cena przekracza limit, który podała klientka." };
    default:
      return { komunikat: "Coś poszło nie tak. Spróbuj ponownie." };
  }
}

export const BRAK_SIECI = { ok: false as const, komunikat: "Brak połączenia z internetem. Spróbuj ponownie." };

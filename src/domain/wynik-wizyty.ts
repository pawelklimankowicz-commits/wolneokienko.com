// =====================================================================
// Ustalenie, czy wizyta się odbyła — podstawa prowizji w fazie 1.
//
// Bez zadatku pieniądze klientki nie przechodzą przez aplikację, więc
// o prowizji decyduje to, co zgłoszą salon i klientka. Salon ma interes,
// żeby zgłosić „nieobecność” (nie płaci prowizji), dlatego po terminie
// wizyty pytamy też klientkę:
//  • salon potwierdza wizytę → wizyta zrealizowana;
//  • klientka potwierdza, a salon zgłasza coś innego → spór dla operatora;
//  • zgłoszenie jednej strony bez sprzeciwu drugiej przez 48 h → staje się
//    ostateczne;
//  • cisza obu stron przez 48 h → przyjmujemy, że wizyta się odbyła
//    (salon miał czas zgłosić nieobecność).
// =====================================================================

import type { WynikRezerwacji } from "./rozliczenie";

export type PotwierdzenieKlientki = "bylam" | "nie_bylam" | "salon_odwolal";

export interface ZgloszeniaWizyty {
  zgloszenieSalonu: WynikRezerwacji | null;
  potwierdzenieKlientki: PotwierdzenieKlientki | null;
  /** Ile godzin minęło od terminu wizyty. */
  godzinPoTerminie: number;
}

export type Ustalenie = WynikRezerwacji | "spor" | "czekamy";

export const GODZIN_NA_SPRZECIW = 48;

/** Co twierdzi klientka, w języku wyników rezerwacji. */
function wersjaKlientki(p: PotwierdzenieKlientki): WynikRezerwacji {
  if (p === "bylam") return "zrealizowana";
  if (p === "salon_odwolal") return "odwolana_przez_salon";
  return "nieobecnosc";
}

export function ustalWynikWizyty(z: ZgloszeniaWizyty): Ustalenie {
  const { zgloszenieSalonu: salon, potwierdzenieKlientki: klientka } = z;
  const minalCzas = z.godzinPoTerminie >= GODZIN_NA_SPRZECIW;

  // Salon sam przyznaje, że wizyta się odbyła — nie ma o co się spierać.
  if (salon === "zrealizowana") return "zrealizowana";

  if (klientka !== null) {
    const wKlientki = wersjaKlientki(klientka);
    if (salon === null) return minalCzas ? wKlientki : wKlientki === "zrealizowana" ? "zrealizowana" : "czekamy";
    if (salon === wKlientki) return salon;
    // Klientka mówi „nie byłam”, salon — że sama odwołała: obie wersje zwalniają z prowizji.
    if (wKlientki === "nieobecnosc" && salon === "odwolana_przez_klientke") return salon;
    return "spor";
  }

  if (salon !== null) return minalCzas ? salon : "czekamy";
  return minalCzas ? "zrealizowana" : "czekamy";
}

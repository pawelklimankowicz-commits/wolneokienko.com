// =====================================================================
// PRZYKŁADOWE DANE do podglądu wyglądu aplikacji.
// Salony są fikcyjne; w aplikacji nad danymi wisi etykieta „przykładowe dane”.
// Po podłączeniu Supabase ten plik zastąpią zapytania do bazy.
// =====================================================================

import type { Kategoria } from "@/domain/katalog-uslug";

export interface Salon {
  id: string;
  nazwa: string;
  dzielnica: string;
  adres: string;
  ocena: number;
  opinie: number;
  km: number;
  /** Dwa kolory okładki (w miejscu zdjęcia salonu). */
  okladka: [string, string];
}

export interface Okienko {
  id: string;
  salonId: string;
  uslugaKod: string;
  usluga: string;
  dzien: "dziś" | "jutro";
  godzina: string;
  cenaGr: number;
}

export interface Oferta {
  id: string;
  salonId: string;
  godzina: string;
  cenaGr: number;
  /** Po ilu sekundach od wysłania zapytania oferta się pojawia (symulacja). */
  poSek: number;
}

export type StatusWizyty = "potwierdzona" | "do_potwierdzenia" | "zakonczona" | "odwolana_przez_salon";

export interface Wizyta {
  id: string;
  salonId: string;
  usluga: string;
  miesiac: string;
  dzien: number;
  godzina: string;
  cenaGr: number;
  status: StatusWizyty;
}

export const SALONY: Salon[] = [
  { id: "lakier", nazwa: "Studio Lakier", dzielnica: "Jeżyce", adres: "ul. Dąbrowskiego, Poznań", ocena: 4.9, opinie: 88, km: 1.2, okladka: ["#C8184A", "#5B1231"] },
  { id: "ola", nazwa: "Nails by Ola", dzielnica: "Wilda", adres: "ul. Górna Wilda, Poznań", ocena: 4.8, opinie: 214, km: 2.4, okladka: ["#E8A0B4", "#8E2F52"] },
  { id: "dlonie", nazwa: "Pracownia Dłoni", dzielnica: "Jeżyce", adres: "ul. Kraszewskiego, Poznań", ocena: 4.7, opinie: 51, km: 0.8, okladka: ["#D9B8A6", "#6E4A3C"] },
  { id: "atelier", nazwa: "Rzęsy i Brwi Atelier", dzielnica: "Stare Miasto", adres: "ul. Wrocławska, Poznań", ocena: 4.9, opinie: 132, km: 1.9, okladka: ["#3B2A4A", "#A45C8A"] },
  { id: "lazarz", nazwa: "Barber Łazarz", dzielnica: "Łazarz", adres: "ul. Głogowska, Poznań", ocena: 4.8, opinie: 301, km: 2.9, okladka: ["#2B2F36", "#8C6A4F"] },
  { id: "wenus", nazwa: "Salon Wenus", dzielnica: "Grunwald", adres: "ul. Grunwaldzka, Poznań", ocena: 4.6, opinie: 77, km: 3.4, okladka: ["#A9C6B8", "#2F5D4E"] },
];

export const salon = (id: string) => SALONY.find((s) => s.id === id)!;

export const OKIENKA: Okienko[] = [
  { id: "o1", salonId: "dlonie", uslugaKod: "manicure_hybrydowy", usluga: "Manicure hybrydowy", dzien: "dziś", godzina: "16:00", cenaGr: 14500 },
  { id: "o2", salonId: "lakier", uslugaKod: "manicure_hybrydowy", usluga: "Manicure hybrydowy", dzien: "dziś", godzina: "16:30", cenaGr: 13000 },
  { id: "o3", salonId: "lazarz", uslugaKod: "strzyzenie_meskie", usluga: "Strzyżenie męskie", dzien: "dziś", godzina: "15:45", cenaGr: 7000 },
  { id: "o4", salonId: "atelier", uslugaKod: "laminacja_brwi", usluga: "Laminacja brwi", dzien: "dziś", godzina: "17:15", cenaGr: 12000 },
  { id: "o5", salonId: "ola", uslugaKod: "przedluzanie_paznokci_zel", usluga: "Przedłużanie paznokci żelem", dzien: "dziś", godzina: "18:00", cenaGr: 18000 },
  { id: "o6", salonId: "wenus", uslugaKod: "masaz_relaksacyjny", usluga: "Masaż relaksacyjny", dzien: "jutro", godzina: "10:00", cenaGr: 16000 },
];

export const OFERTY_DO_ZAPYTANIA: Oferta[] = [
  { id: "f1", salonId: "lakier", godzina: "16:30", cenaGr: 13000, poSek: 3 },
  { id: "f2", salonId: "ola", godzina: "17:15", cenaGr: 12000, poSek: 6 },
  { id: "f3", salonId: "dlonie", godzina: "16:00", cenaGr: 14500, poSek: 9 },
];

export const WIZYTY: Wizyta[] = [
  { id: "w1", salonId: "lakier", usluga: "Manicure hybrydowy", miesiac: "Październik", dzien: 1, godzina: "16:30", cenaGr: 13000, status: "potwierdzona" },
  { id: "w2", salonId: "ola", usluga: "Pedicure hybrydowy", miesiac: "Wrzesień", dzien: 28, godzina: "18:00", cenaGr: 15000, status: "do_potwierdzenia" },
  { id: "w3", salonId: "dlonie", usluga: "Manicure japoński", miesiac: "Wrzesień", dzien: 12, godzina: "11:00", cenaGr: 9000, status: "zakonczona" },
  { id: "w4", salonId: "wenus", usluga: "Masaż relaksacyjny", miesiac: "Wrzesień", dzien: 2, godzina: "19:00", cenaGr: 16000, status: "odwolana_przez_salon" },
];

export interface KategoriaNaStarcie {
  kategoria: Kategoria;
  etykieta: string;
  kolory: [string, string];
  zapytanie: string;
}

export const KATEGORIE: KategoriaNaStarcie[] = [
  { kategoria: "paznokcie", etykieta: "Paznokcie", kolory: ["#C8184A", "#7A0F32"], zapytanie: "hybryda dziś" },
  { kategoria: "rzesy", etykieta: "Rzęsy", kolory: ["#6B3A5E", "#2E1A2A"], zapytanie: "rzęsy 1:1 dziś" },
  { kategoria: "brwi", etykieta: "Brwi", kolory: ["#B36A4E", "#5C2E22"], zapytanie: "henna brwi dziś" },
  { kategoria: "fryzjer", etykieta: "Fryzjer", kolory: ["#D08A9E", "#8A3A56"], zapytanie: "strzyżenie damskie dziś" },
  { kategoria: "barber", etykieta: "Barber", kolory: ["#3E4550", "#1B1E23"], zapytanie: "barber dziś" },
  { kategoria: "masaz", etykieta: "Masaż", kolory: ["#5E8C7A", "#234437"], zapytanie: "masaż relaksacyjny jutro" },
  { kategoria: "makijaz", etykieta: "Makijaż", kolory: ["#E0A45C", "#8A5418"], zapytanie: "makijaż okolicznościowy dziś" },
  { kategoria: "kosmetologia", etykieta: "Twarz", kolory: ["#9A7FB8", "#4A3566"], zapytanie: "oczyszczanie wodorowe jutro" },
];

/** Kandydaci do planu fal w podglądzie: 22 salony w okolicy Jeżyc. */
export const KANDYDACI_PODGLAD = Array.from({ length: 22 }, (_, i) => ({
  id: `p${i}`,
  odlegloscKm: 0.3 + i * 0.16,
  wskaznikOdpowiedzi: 0.35 + ((i * 37) % 60) / 100,
  przyjmujeZapytania: i % 7 !== 3,
  maUsluge: true,
}));

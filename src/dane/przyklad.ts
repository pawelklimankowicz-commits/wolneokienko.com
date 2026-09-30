// =====================================================================
// PRZYKŁADOWE DANE do podglądu wyglądu aplikacji.
// Wszystkie miejsca są fikcyjne; w aplikacji nad danymi wisi etykieta
// „przykładowe dane”. Po podłączeniu Supabase ten plik zastąpią zapytania
// do bazy.
// =====================================================================

import { KATALOG_USLUG, KATEGORIE_KATALOGU, branzaUslugi, type Branza, type Kategoria, type Usluga } from "@/domain/katalog-uslug";

/** Usługodawca: salon, gabinet, warsztat, obiekt sportowy albo fachowiec. */
export interface Salon {
  id: string;
  nazwa: string;
  branza: Branza;
  /** Kategorie usług, które wykonuje (oferty przychodzą tylko od pasujących). */
  kategorie: Kategoria[];
  dzielnica: string;
  adres: string;
  ocena: number;
  opinie: number;
  km: number;
  /** Dwa kolory okładki (w miejscu zdjęcia, które usługodawca doda przy rejestracji). */
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

const s = (
  id: string,
  nazwa: string,
  branza: Branza,
  kategorie: Kategoria[],
  dzielnica: string,
  ulica: string,
  ocena: number,
  opinie: number,
  km: number,
  okladka: [string, string],
): Salon => ({ id, nazwa, branza, kategorie, dzielnica, adres: ulica.startsWith("ul.") || ulica.startsWith("os.") ? `${ulica}, Poznań` : ulica, ocena, opinie, km, okladka });

export const SALONY: Salon[] = [
  // uroda
  s("lakier", "Studio Lakier", "uroda", ["paznokcie"], "Jeżyce", "ul. Dąbrowskiego", 4.9, 88, 1.2, ["#C8184A", "#5B1231"]),
  s("ola", "Nails by Ola", "uroda", ["paznokcie"], "Wilda", "ul. Górna Wilda", 4.8, 214, 2.4, ["#E8A0B4", "#8E2F52"]),
  s("dlonie", "Pracownia Dłoni", "uroda", ["paznokcie"], "Jeżyce", "ul. Kraszewskiego", 4.7, 51, 0.8, ["#D9B8A6", "#6E4A3C"]),
  s("atelier", "Rzęsy i Brwi Atelier", "uroda", ["rzesy", "brwi", "makijaz", "makijaz_permanentny", "kosmetologia"], "Stare Miasto", "ul. Wrocławska", 4.9, 132, 1.9, ["#3B2A4A", "#A45C8A"]),
  s("lazarz", "Barber Łazarz", "uroda", ["barber", "fryzjer"], "Łazarz", "ul. Głogowska", 4.8, 301, 2.9, ["#2B2F36", "#8C6A4F"]),
  s("ink", "Ink Studio", "uroda", ["tatuaz"], "Stare Miasto", "ul. Wodna", 4.9, 158, 1.8, ["#3A3340", "#8A2B4E"]),
  s("wenus", "Salon Wenus", "uroda", ["masaz", "spa", "kosmetologia", "depilacja", "fryzjer", "podologia", "medycyna_estetyczna"], "Grunwald", "ul. Grunwaldzka", 4.6, 77, 3.4, ["#A9C6B8", "#2F5D4E"]),
  // zdrowie
  s("usmiech", "Gabinet Stomatologiczny Uśmiech", "zdrowie", ["stomatologia"], "Jeżyce", "ul. Szamarzewskiego", 4.9, 412, 0.9, ["#2A7A83", "#123F45"]),
  s("medica", "Przychodnia Medica", "zdrowie", ["lekarz", "diagnostyka"], "Grunwald", "ul. Bukowska", 4.7, 268, 2.2, ["#4E8FA0", "#1B4452"]),
  s("bialy", "Gabinet Dentystyczny Biały", "zdrowie", ["stomatologia"], "Wilda", "ul. Wierzbięcice", 4.8, 187, 2.1, ["#3C8C95", "#164A50"]),
  s("diagnostyka", "Centrum Diagnostyki Wilda", "zdrowie", ["diagnostyka"], "Wilda", "ul. Traugutta", 4.7, 144, 2.5, ["#4A83A0", "#183D52"]),
  s("rownowaga", "Gabinet Psychologiczny Równowaga", "zdrowie", ["psychologia"], "Stare Miasto", "ul. Święty Marcin", 4.9, 76, 1.6, ["#6A97A8", "#24485A"]),
  s("fizjoruch", "Fizjo Ruch", "zdrowie", ["fizjoterapia"], "Wilda", "ul. Hetmańska", 4.9, 190, 3.1, ["#5FA39A", "#1F4E47"]),
  // auto
  s("wulkan", "Wulkanizacja Grunwald", "auto", ["opony"], "Grunwald", "ul. Marcelińska", 4.8, 356, 2.6, ["#3E4C5E", "#161D26"]),
  s("serwis60", "Auto Serwis 60", "auto", ["serwis", "opony"], "Jeżyce", "ul. Polna", 4.6, 142, 1.4, ["#56657A", "#222B38"]),
  s("blysk", "Detailing Błysk", "auto", ["myjnia"], "Łazarz", "ul. Kolejowa", 4.9, 98, 2.8, ["#6B7F99", "#28323F"]),
  // zwierzęta
  s("psieloki", "Groomer Psie Loki", "zwierzeta", ["groomer"], "Jeżyce", "ul. Słowackiego", 4.9, 176, 1.1, ["#C98A3A", "#6E4310"]),
  s("zwierzyniec", "Lecznica Zwierzyniec", "zwierzeta", ["weterynarz"], "Sołacz", "ul. Wojska Polskiego", 4.8, 233, 2.7, ["#B8793E", "#5A3413"]),
  s("kudlaty", "Salon Kudłaty", "zwierzeta", ["groomer"], "Winogrady", "os. Wichrowe Wzgórze", 4.7, 64, 3.9, ["#D9A15B", "#7C4E14"]),
  // sport
  s("padel", "Padel Club Poznań", "sport", ["korty"], "Grunwald", "ul. Reymonta", 4.8, 310, 2.9, ["#3F8F5A", "#16402A"]),
  s("korty", "Korty Golęcin", "sport", ["korty"], "Golęcin", "ul. Golęcińska", 4.7, 205, 3.3, ["#5A9E6C", "#1F4A2E"]),
  s("forma", "Studio Forma", "sport", ["trener"], "Jeżyce", "ul. Kochanowskiego", 4.9, 121, 0.7, ["#6BAE7B", "#2A5A37"]),
  // nauka
  s("start", "Szkoła Jazdy Start", "nauka", ["jazda"], "Jeżyce", "ul. Dąbrowskiego", 4.8, 402, 1.3, ["#4F5BA6", "#1E2560"]),
  s("liczby", "Korepetycje Liczby", "nauka", ["korepetycje"], "Online", "zajęcia zdalne", 4.9, 87, 0, ["#6671C0", "#2B326F"]),
  s("english", "English Corner", "nauka", ["korepetycje"], "Stare Miasto", "ul. Półwiejska", 4.8, 143, 1.7, ["#7A84CF", "#353D80"]),
  // dom
  s("czysto", "Czysto Poznań", "dom", ["sprzatanie"], "Cały Poznań", "dojazd do klienta", 4.8, 298, 0, ["#5E7F8C", "#253C45"]),
  s("raczka", "Złota Rączka Marek", "dom", ["zlota_raczka"], "Cały Poznań", "dojazd do klienta", 4.9, 156, 0, ["#6F8E99", "#2E4852"]),
  s("hydro", "Hydraulik 24", "dom", ["hydraulik"], "Cały Poznań", "dojazd do klienta", 4.7, 211, 0, ["#4F7280", "#1C3640"]),
];

export const salon = (id: string) => SALONY.find((x) => x.id === id)!;

/** Orientacyjne ceny do generowania ofert w podglądzie (grosze). */
export const CENA_BAZOWA: Record<string, number> = {
  manicure_hybrydowy: 13000, przedluzanie_paznokci_zel: 18000, pedicure_hybrydowy: 15000, strzyzenie_damskie: 12000,
  strzyzenie_meskie: 7000, rzesy_1_1: 16000, laminacja_brwi: 12000, masaz_relaksacyjny: 16000, toksyna_botulinowa: 90000,
  tatuaz_maly: 30000, przeglad_stomatologiczny: 20000, higienizacja: 30000, leczenie_zeba: 35000,
  konsultacja_internistyczna: 22000, konsultacja_dermatologiczna: 25000, konsultacja_ortopedyczna: 25000,
  konsultacja_ginekologiczna: 25000, konsultacja_kardiologiczna: 25000, usg_jamy_brzusznej: 25000,
  rezonans_magnetyczny: 80000, wizyta_fizjoterapeutyczna: 18000, konsultacja_psychologiczna: 20000, wymiana_opon: 12000,
  wymiana_oleju: 25000, mycie_reczne: 15000, strzyzenie_psa: 14000, kapiel_psa: 8000, wizyta_weterynaryjna: 12000,
  kort_padel: 12000, kort_tenis: 9000, squash: 7000, trening_personalny: 15000, zajecia_jogi: 5000,
  jazda_doszkalajaca: 13000, korepetycje_matematyka: 9000, lekcja_angielskiego: 9000, sprzatanie_mieszkania: 22000,
  zlota_raczka: 12000, hydraulik: 15000,
};

const okno = (id: string, salonId: string, uslugaKod: string, dzien: "dziś" | "jutro", godzina: string): Okienko => {
  const u = KATALOG_USLUG.find((x) => x.kod === uslugaKod)!;
  return { id, salonId, uslugaKod, usluga: u.nazwa, dzien, godzina, cenaGr: CENA_BAZOWA[uslugaKod] ?? 15000 };
};

export const OKIENKA: Okienko[] = [
  okno("o1", "dlonie", "manicure_hybrydowy", "dziś", "16:00"),
  okno("o2", "lakier", "manicure_hybrydowy", "dziś", "16:30"),
  okno("o3", "lazarz", "strzyzenie_meskie", "dziś", "15:45"),
  okno("o4", "atelier", "laminacja_brwi", "dziś", "17:15"),
  okno("o5", "ola", "przedluzanie_paznokci_zel", "dziś", "18:00"),
  okno("o6", "wenus", "masaz_relaksacyjny", "jutro", "10:00"),
  okno("o7", "usmiech", "higienizacja", "dziś", "17:30"),
  okno("o8", "medica", "konsultacja_dermatologiczna", "jutro", "8:40"),
  okno("o9", "fizjoruch", "wizyta_fizjoterapeutyczna", "dziś", "19:00"),
  okno("o10", "wulkan", "wymiana_opon", "dziś", "15:30"),
  okno("o11", "blysk", "mycie_reczne", "jutro", "9:00"),
  okno("o12", "psieloki", "strzyzenie_psa", "jutro", "11:00"),
  okno("o13", "zwierzyniec", "wizyta_weterynaryjna", "dziś", "18:30"),
  okno("o14", "padel", "kort_padel", "dziś", "20:00"),
  okno("o15", "forma", "trening_personalny", "dziś", "18:00"),
  okno("o16", "start", "jazda_doszkalajaca", "jutro", "7:00"),
  okno("o17", "liczby", "korepetycje_matematyka", "dziś", "18:00"),
  okno("o18", "czysto", "sprzatanie_mieszkania", "jutro", "9:00"),
  okno("o19", "hydro", "hydraulik", "dziś", "17:00"),
];

/**
 * Oferty w odpowiedzi na zapytanie (symulacja): do trzech usługodawców
 * z branży tej usługi, godziny w oknie klienta, ceny wokół ceny orientacyjnej.
 */
export function ofertyDla(usluga: Usluga, odGodziny: number | null): Oferta[] {
  const branza = branzaUslugi(usluga);
  const wykonujacy = SALONY.filter((x) => x.kategorie.includes(usluga.kategoria));
  const h = Math.min(Math.max(odGodziny ?? 16, 7), 20);
  const godziny = [`${h}:30`, `${h + 1}:15`, `${h}:00`];
  const mnozniki = [1, 0.92, 1.12];
  const baza = CENA_BAZOWA[usluga.kod] ?? 15000;
  return (wykonujacy.length > 0 ? wykonujacy : SALONY.filter((x) => x.branza === branza))
    .slice(0, 3)
    .map((x, i) => ({
      id: `f-${x.id}`,
      salonId: x.id,
      godzina: godziny[i],
      cenaGr: Math.round((baza * mnozniki[i]) / 500) * 500,
      poSek: 3 * (i + 1),
    }));
}

export const WIZYTY: Wizyta[] = [
  { id: "w1", salonId: "lakier", usluga: "Manicure hybrydowy", miesiac: "Październik", dzien: 1, godzina: "16:30", cenaGr: 13000, status: "potwierdzona" },
  { id: "w2", salonId: "wulkan", usluga: "Wymiana opon (4 koła)", miesiac: "Październik", dzien: 3, godzina: "9:15", cenaGr: 12000, status: "potwierdzona" },
  { id: "w3", salonId: "ola", usluga: "Pedicure hybrydowy", miesiac: "Wrzesień", dzien: 28, godzina: "18:00", cenaGr: 15000, status: "do_potwierdzenia" },
  { id: "w4", salonId: "usmiech", usluga: "Przegląd stomatologiczny", miesiac: "Wrzesień", dzien: 15, godzina: "8:30", cenaGr: 20000, status: "zakonczona" },
  { id: "w5", salonId: "wenus", usluga: "Masaż relaksacyjny", miesiac: "Wrzesień", dzien: 2, godzina: "19:00", cenaGr: 16000, status: "odwolana_przez_salon" },
];

/** Kolory kółek kategorii na starcie, wg branży. */
const KOLORY_BRANZ: Record<Branza, [string, string][]> = {
  uroda: [["#C8184A", "#7A0F32"], ["#6B3A5E", "#2E1A2A"], ["#B36A4E", "#5C2E22"], ["#D08A9E", "#8A3A56"], ["#3E4550", "#1B1E23"]],
  zdrowie: [["#2A7A83", "#123F45"], ["#4E8FA0", "#1B4452"], ["#5FA39A", "#1F4E47"]],
  auto: [["#3E4C5E", "#161D26"], ["#56657A", "#222B38"], ["#6B7F99", "#28323F"]],
  zwierzeta: [["#C98A3A", "#6E4310"], ["#B8793E", "#5A3413"]],
  sport: [["#3F8F5A", "#16402A"], ["#5A9E6C", "#1F4A2E"]],
  nauka: [["#4F5BA6", "#1E2560"], ["#6671C0", "#2B326F"]],
  dom: [["#5E7F8C", "#253C45"], ["#6F8E99", "#2E4852"], ["#4F7280", "#1C3640"]],
};

/** Zapytanie wstawiane po kliknięciu kategorii na starcie. */
const ZAPYTANIE_KATEGORII: Partial<Record<Kategoria, string>> = {
  paznokcie: "hybryda dziś", rzesy: "rzęsy 1:1 dziś", brwi: "henna brwi dziś", fryzjer: "strzyżenie damskie dziś",
  barber: "barber dziś", masaz: "masaż relaksacyjny jutro", makijaz: "makijaż okolicznościowy dziś",
  kosmetologia: "oczyszczanie wodorowe jutro", depilacja: "depilacja woskiem dziś", tatuaz: "mały tatuaż jutro",
  medycyna_estetyczna: "toksyna jutro", stomatologia: "dentysta jutro rano", lekarz: "dermatolog jutro",
  diagnostyka: "usg dziś", fizjoterapia: "fizjoterapeuta dziś", psychologia: "psycholog jutro",
  opony: "wymiana opon dziś", serwis: "wymiana oleju jutro", myjnia: "myjnia dziś", groomer: "groomer jutro",
  weterynarz: "weterynarz dziś", korty: "kort do padla dziś po 19", trener: "trener dziś", jazda: "jazda doszkalająca jutro",
  korepetycje: "korepetycje matematyka dziś", sprzatanie: "sprzątanie jutro", zlota_raczka: "złota rączka dziś",
  hydraulik: "hydraulik dziś",
};

const KATEGORIE_NA_STARCIE_KOLEJNOSC: Kategoria[] = [
  "paznokcie", "rzesy", "brwi", "fryzjer", "barber", "masaz", "makijaz", "kosmetologia", "tatuaz",
  "stomatologia", "lekarz", "diagnostyka", "fizjoterapia", "psychologia",
  "opony", "serwis", "myjnia", "groomer", "weterynarz", "korty", "trener", "jazda", "korepetycje",
  "sprzatanie", "zlota_raczka", "hydraulik",
];

export interface KategoriaNaStarcie {
  kategoria: Kategoria;
  branza: Branza;
  etykieta: string;
  kolory: [string, string];
  zapytanie: string;
}

export const KATEGORIE: KategoriaNaStarcie[] = (() => {
  const licznik: Partial<Record<Branza, number>> = {};
  return KATEGORIE_NA_STARCIE_KOLEJNOSC.map((k) => {
    const { branza, nazwa } = KATEGORIE_KATALOGU[k];
    const i = licznik[branza] ?? 0;
    licznik[branza] = i + 1;
    const kolory = KOLORY_BRANZ[branza][i % KOLORY_BRANZ[branza].length];
    return { kategoria: k, branza, etykieta: nazwa, kolory, zapytanie: ZAPYTANIE_KATEGORII[k] ?? nazwa.toLowerCase() };
  });
})();

/** Kandydaci do planu fal w podglądzie: 22 usługodawców w okolicy Jeżyc. */
export const KANDYDACI_PODGLAD = Array.from({ length: 22 }, (_, i) => ({
  id: `p${i}`,
  odlegloscKm: 0.3 + i * 0.16,
  wskaznikOdpowiedzi: 0.35 + ((i * 37) % 60) / 100,
  przyjmujeZapytania: i % 7 !== 3,
  maUsluge: true,
}));

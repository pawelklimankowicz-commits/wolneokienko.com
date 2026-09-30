// =====================================================================
// Katalog usług wszystkich branż.
//
// DECYZJA WŁAŚCICIELA (30.09.2026): aplikacja obsługuje od razu wszystkie
// branże z wolnymi okienkami, nie tylko beauty. Fazy określają już tylko
// zasięg geograficzny i kolejność pozyskiwania usługodawców.
//
// Zasady szczególne:
//  • BRANŻA MEDYCZNA (zdrowie): informacje podmiotów leczniczych nie mogą
//    mieć cech reklamy (art. 14 ustawy o działalności leczniczej) — bez
//    promocji i płatnych wyróżnień, neutralna kolejność ofert. Zapytanie
//    zdradza informację o zdrowiu (art. 9 RODO), więc wymaga wyraźnej zgody.
//  • Toksyna botulinowa (lek na receptę) i wypełniacze: nazwa ogólna, bez
//    promocji, deklaracja, kto wykonuje zabieg.
//  • Weterynarz: bez promocji (etyka zawodowa lekarzy weterynarii).
//
// `synonimy` służą do dopasowania tego, co wpisze klient („hybryda”,
// „dentysta”, „opony”); w interfejsie zawsze pokazujemy `nazwa`.
// =====================================================================

export type Branza = "uroda" | "zdrowie" | "auto" | "zwierzeta" | "sport" | "nauka" | "dom";

export type Kategoria =
  // uroda
  | "paznokcie" | "fryzjer" | "barber" | "rzesy" | "brwi" | "makijaz" | "makijaz_permanentny"
  | "kosmetologia" | "depilacja" | "masaz" | "spa" | "podologia" | "medycyna_estetyczna" | "tatuaz"
  // zdrowie
  | "stomatologia" | "lekarz" | "diagnostyka" | "fizjoterapia" | "psychologia"
  // auto
  | "opony" | "serwis" | "myjnia"
  // zwierzęta
  | "groomer" | "weterynarz"
  // sport
  | "korty" | "trener"
  // nauka
  | "jazda" | "korepetycje"
  // dom
  | "sprzatanie" | "zlota_raczka" | "hydraulik";

export interface OpisBranzy {
  id: Branza;
  nazwa: string;
  /** Dopełniacz l.poj. i l.mn. wykonawcy: „do 1 salonu”, „do 12 salonów”. */
  wykonawcaDop: [string, string];
  /** Branża medyczna: zgoda na dane o zdrowiu, bez promocji, neutralna kolejność. */
  medyczna: boolean;
  /** Przykład zapytania pokazywany w polu na starcie. */
  przyklad: string;
}

export const BRANZE: OpisBranzy[] = [
  { id: "uroda", nazwa: "Uroda", wykonawcaDop: ["salonu", "salonów"], medyczna: false, przyklad: "hybryda dziś po 16, do 150 zł" },
  { id: "zdrowie", nazwa: "Zdrowie", wykonawcaDop: ["gabinetu", "gabinetów"], medyczna: true, przyklad: "dentysta jutro rano" },
  { id: "auto", nazwa: "Auto", wykonawcaDop: ["warsztatu", "warsztatów"], medyczna: false, przyklad: "wymiana opon dziś po 15" },
  { id: "zwierzeta", nazwa: "Zwierzęta", wykonawcaDop: ["miejsca", "miejsc"], medyczna: false, przyklad: "groomer w weekend" },
  { id: "sport", nazwa: "Sport", wykonawcaDop: ["obiektu", "obiektów"], medyczna: false, przyklad: "kort do padla dziś po 19" },
  { id: "nauka", nazwa: "Nauka", wykonawcaDop: ["osoby", "osób"], medyczna: false, przyklad: "jazda doszkalająca jutro" },
  { id: "dom", nazwa: "Dom", wykonawcaDop: ["fachowca", "fachowców"], medyczna: false, przyklad: "hydraulik dziś" },
];

export const KATEGORIE_KATALOGU: Record<Kategoria, { branza: Branza; nazwa: string }> = {
  paznokcie: { branza: "uroda", nazwa: "Paznokcie" },
  fryzjer: { branza: "uroda", nazwa: "Fryzjer" },
  barber: { branza: "uroda", nazwa: "Barber" },
  rzesy: { branza: "uroda", nazwa: "Rzęsy" },
  brwi: { branza: "uroda", nazwa: "Brwi" },
  makijaz: { branza: "uroda", nazwa: "Makijaż" },
  makijaz_permanentny: { branza: "uroda", nazwa: "Makijaż permanentny" },
  kosmetologia: { branza: "uroda", nazwa: "Twarz" },
  depilacja: { branza: "uroda", nazwa: "Depilacja" },
  masaz: { branza: "uroda", nazwa: "Masaż" },
  spa: { branza: "uroda", nazwa: "SPA" },
  podologia: { branza: "uroda", nazwa: "Podologia" },
  medycyna_estetyczna: { branza: "uroda", nazwa: "Medycyna estetyczna" },
  tatuaz: { branza: "uroda", nazwa: "Tatuaż" },
  stomatologia: { branza: "zdrowie", nazwa: "Dentysta" },
  lekarz: { branza: "zdrowie", nazwa: "Lekarz" },
  diagnostyka: { branza: "zdrowie", nazwa: "Badania" },
  fizjoterapia: { branza: "zdrowie", nazwa: "Fizjoterapia" },
  psychologia: { branza: "zdrowie", nazwa: "Psycholog" },
  opony: { branza: "auto", nazwa: "Opony" },
  serwis: { branza: "auto", nazwa: "Serwis" },
  myjnia: { branza: "auto", nazwa: "Myjnia" },
  groomer: { branza: "zwierzeta", nazwa: "Groomer" },
  weterynarz: { branza: "zwierzeta", nazwa: "Weterynarz" },
  korty: { branza: "sport", nazwa: "Korty" },
  trener: { branza: "sport", nazwa: "Trener i joga" },
  jazda: { branza: "nauka", nazwa: "Nauka jazdy" },
  korepetycje: { branza: "nauka", nazwa: "Korepetycje" },
  sprzatanie: { branza: "dom", nazwa: "Sprzątanie" },
  zlota_raczka: { branza: "dom", nazwa: "Złota rączka" },
  hydraulik: { branza: "dom", nazwa: "Hydraulik" },
};

export interface Usluga {
  kod: string;
  nazwa: string;
  kategoria: Kategoria;
  typowyCzasMin: number;
  synonimy: string[];
  /** Bez promocji, rabatów i płatnych wyróżnień. */
  bezPromocji?: boolean;
  /** Wykonawca musi zadeklarować, że zabieg wykonuje lekarz. */
  wymagaLekarza?: boolean;
  /** Wykonawca musi zadeklarować kwalifikacje osoby wykonującej. */
  wymagaDeklaracjiKwalifikacji?: boolean;
}

type Flagi = Pick<Usluga, "bezPromocji" | "wymagaLekarza" | "wymagaDeklaracjiKwalifikacji">;
const u = (kod: string, nazwa: string, kategoria: Kategoria, typowyCzasMin: number, synonimy: string[], flagi: Flagi = {}): Usluga => ({
  kod,
  nazwa,
  kategoria,
  typowyCzasMin,
  synonimy,
  ...flagi,
  ...(KATEGORIE_KATALOGU[kategoria].branza === "zdrowie" ? { bezPromocji: true } : {}),
});

export const KATALOG_USLUG: Usluga[] = [
  // ── Uroda ───────────────────────────────────────────────────────────
  u("manicure_klasyczny", "Manicure klasyczny", "paznokcie", 45, ["manicure", "manicur"]),
  u("manicure_hybrydowy", "Manicure hybrydowy", "paznokcie", 60, ["hybryda", "hybrydy", "lakier hybrydowy"]),
  u("manicure_japonski", "Manicure japoński", "paznokcie", 45, ["japoński", "japonski"]),
  u("przedluzanie_paznokci_zel", "Przedłużanie paznokci żelem", "paznokcie", 120, ["żel", "zel", "przedłużanie", "tipsy"]),
  u("uzupelnienie_zelu", "Uzupełnienie żelu", "paznokcie", 90, ["uzupełnienie", "uzupelnienie"]),
  u("zdjecie_hybrydy", "Zdjęcie hybrydy lub żelu", "paznokcie", 20, ["zdjęcie", "usunięcie hybrydy"]),
  u("pedicure_klasyczny", "Pedicure klasyczny", "paznokcie", 60, ["pedicure", "pedikiur"]),
  u("pedicure_hybrydowy", "Pedicure hybrydowy", "paznokcie", 75, ["hybryda stopy", "pedicure hybryda"]),
  u("strzyzenie_damskie", "Strzyżenie damskie", "fryzjer", 60, ["fryzjer", "ścięcie", "strzyżenie"]),
  u("koloryzacja", "Koloryzacja", "fryzjer", 150, ["farbowanie", "kolor"]),
  u("modelowanie", "Modelowanie", "fryzjer", 45, ["układanie", "modelowanie włosów"]),
  u("keratynowe_prostowanie", "Keratynowe prostowanie", "fryzjer", 180, ["keratyna"]),
  u("strzyzenie_meskie", "Strzyżenie męskie", "barber", 40, ["barber", "strzyżenie męskie"]),
  u("broda", "Strzyżenie i konturowanie brody", "barber", 30, ["broda", "zarost"]),
  u("rzesy_1_1", "Przedłużanie rzęs 1:1", "rzesy", 120, ["rzęsy", "rzesy", "1:1"]),
  u("rzesy_objetosciowe", "Przedłużanie rzęs objętościowe", "rzesy", 150, ["objętościowe", "2d", "3d"]),
  u("lifting_rzes", "Lifting i laminacja rzęs", "rzesy", 60, ["lifting rzęs", "laminacja rzęs"]),
  u("henna_regulacja_brwi", "Henna i regulacja brwi", "brwi", 30, ["brwi", "henna"]),
  u("laminacja_brwi", "Laminacja brwi", "brwi", 45, ["laminacja brwi"]),
  u("makijaz_okolicznosciowy", "Makijaż okolicznościowy", "makijaz", 60, ["makijaż", "makeup"]),
  u("makijaz_slubny", "Makijaż ślubny", "makijaz", 90, ["ślubny"]),
  u("pmu_brwi", "Makijaż permanentny brwi", "makijaz_permanentny", 150, ["permanentny brwi", "pmu"]),
  u("pmu_usta", "Makijaż permanentny ust", "makijaz_permanentny", 150, ["permanentny usta"]),
  u("oczyszczanie_wodorowe", "Oczyszczanie wodorowe", "kosmetologia", 60, ["oczyszczanie", "wodorowe"]),
  u("peeling_kawitacyjny", "Peeling kawitacyjny", "kosmetologia", 45, ["kawitacja"]),
  u("mezoterapia_mikroiglowa", "Mezoterapia mikroigłowa", "kosmetologia", 60, ["dermapen", "mikroigłowa"]),
  u("depilacja_woskiem", "Depilacja woskiem", "depilacja", 30, ["wosk", "woskowanie"]),
  u("depilacja_pasta_cukrowa", "Depilacja pastą cukrową", "depilacja", 30, ["pasta cukrowa", "sugaring"]),
  u("depilacja_laserowa", "Depilacja laserowa", "depilacja", 30, ["laser"]),
  u("masaz_relaksacyjny", "Masaż relaksacyjny", "masaz", 60, ["masaż", "masaz"]),
  u("masaz_klasyczny", "Masaż klasyczny", "masaz", 60, ["masaż klasyczny"]),
  u("rytual_spa", "Rytuał SPA", "spa", 90, ["spa"]),
  u("pedicure_podologiczny", "Pedicure podologiczny", "podologia", 60, ["podolog", "wrastający paznokieć"]),
  u("toksyna_botulinowa", "Zabieg z toksyną botulinową", "medycyna_estetyczna", 30, ["botoks", "botox", "toksyna"], { bezPromocji: true, wymagaLekarza: true }),
  u("wypelniacz_kwas_hialuronowy", "Wypełnianie kwasem hialuronowym", "medycyna_estetyczna", 45, ["kwas hialuronowy", "wypełniacz", "usta kwas"], { bezPromocji: true, wymagaDeklaracjiKwalifikacji: true }),
  u("tatuaz_maly", "Mały tatuaż", "tatuaz", 90, ["tatuaż", "tatuaz", "tattoo"]),
  u("piercing", "Piercing", "tatuaz", 30, ["kolczyk", "przekłucie"]),

  // ── Zdrowie (medyczne: zawsze bez promocji) ─────────────────────────
  u("przeglad_stomatologiczny", "Przegląd stomatologiczny", "stomatologia", 30, ["dentysta", "stomatolog", "przegląd zębów"]),
  u("higienizacja", "Higienizacja (skaling i piaskowanie)", "stomatologia", 60, ["skaling", "piaskowanie", "higienizacja", "kamień"]),
  u("leczenie_zeba", "Leczenie zęba (wypełnienie)", "stomatologia", 45, ["plomba", "ubytek", "wypełnienie zęba", "ból zęba"]),
  u("konsultacja_internistyczna", "Konsultacja internistyczna", "lekarz", 20, ["internista", "lekarz rodzinny", "lekarz"]),
  u("konsultacja_dermatologiczna", "Konsultacja dermatologiczna", "lekarz", 20, ["dermatolog"]),
  u("konsultacja_ortopedyczna", "Konsultacja ortopedyczna", "lekarz", 20, ["ortopeda"]),
  u("konsultacja_ginekologiczna", "Konsultacja ginekologiczna", "lekarz", 20, ["ginekolog"]),
  u("konsultacja_kardiologiczna", "Konsultacja kardiologiczna", "lekarz", 20, ["kardiolog"]),
  u("usg_jamy_brzusznej", "USG jamy brzusznej", "diagnostyka", 20, ["usg"]),
  u("rezonans_magnetyczny", "Rezonans magnetyczny", "diagnostyka", 40, ["rezonans", "mri"]),
  u("wizyta_fizjoterapeutyczna", "Wizyta fizjoterapeutyczna", "fizjoterapia", 50, ["fizjo", "fizjoterapeuta", "rehabilitacja"]),
  u("konsultacja_psychologiczna", "Konsultacja psychologiczna", "psychologia", 50, ["psycholog", "psychoterapeuta", "psychoterapia"]),

  // ── Auto ────────────────────────────────────────────────────────────
  u("wymiana_opon", "Wymiana opon (4 koła)", "opony", 45, ["opony", "wulkanizacja", "wymiana kół"]),
  u("wymiana_oleju", "Wymiana oleju", "serwis", 45, ["olej", "serwis auta"]),
  u("mycie_reczne", "Mycie ręczne auta", "myjnia", 60, ["myjnia", "mycie auta", "detailing"]),

  // ── Zwierzęta ───────────────────────────────────────────────────────
  u("strzyzenie_psa", "Strzyżenie psa", "groomer", 90, ["groomer", "psi fryzjer", "strzyżenie psa"]),
  u("kapiel_psa", "Kąpiel psa", "groomer", 45, ["kąpiel psa"]),
  u("wizyta_weterynaryjna", "Wizyta u weterynarza", "weterynarz", 30, ["weterynarz", "wet"], { bezPromocji: true }),

  // ── Sport ───────────────────────────────────────────────────────────
  u("kort_padel", "Kort do padla, 60 min", "korty", 60, ["padel", "padla"]),
  u("kort_tenis", "Kort tenisowy, 60 min", "korty", 60, ["tenis", "kort tenisowy"]),
  u("squash", "Squash, 60 min", "korty", 60, ["squash"]),
  u("trening_personalny", "Trening personalny", "trener", 60, ["trener", "trening"]),
  u("zajecia_jogi", "Zajęcia jogi", "trener", 60, ["joga", "yoga"]),

  // ── Nauka ───────────────────────────────────────────────────────────
  u("jazda_doszkalajaca", "Jazda doszkalająca, 60 min", "jazda", 60, ["nauka jazdy", "jazda", "instruktor"]),
  u("korepetycje_matematyka", "Korepetycje z matematyki", "korepetycje", 60, ["matematyka", "korepetycje"]),
  u("lekcja_angielskiego", "Lekcja angielskiego", "korepetycje", 60, ["angielski"]),

  // ── Dom ─────────────────────────────────────────────────────────────
  u("sprzatanie_mieszkania", "Sprzątanie mieszkania", "sprzatanie", 180, ["sprzątanie", "sprzatanie", "sprzątaczka"]),
  u("zlota_raczka", "Złota rączka, 1 h", "zlota_raczka", 60, ["złota rączka", "montaż", "naprawa"]),
  u("hydraulik", "Wizyta hydraulika", "hydraulik", 60, ["hydraulik", "cieknie", "kran"]),
];

export const branzaUslugi = (usluga: Usluga): Branza => KATEGORIE_KATALOGU[usluga.kategoria].branza;
export const opisBranzy = (b: Branza): OpisBranzy => BRANZE.find((x) => x.id === b)!;
export const czyMedyczna = (usluga: Usluga): boolean => opisBranzy(branzaUslugi(usluga)).medyczna;
export const uslugiBranzy = (b: Branza): Usluga[] => KATALOG_USLUG.filter((x) => branzaUslugi(x) === b);

const normalizuj = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .trim();

/** Usługi, których nazwa albo synonim pasuje do wpisanego tekstu (bez polskich znaków i wielkości liter). */
export function znajdzUslugi(tekst: string): Usluga[] {
  const t = normalizuj(tekst);
  if (!t) return [];
  return KATALOG_USLUG.filter((x) =>
    [x.nazwa, ...x.synonimy].some((s) => {
      const n = normalizuj(s);
      return t.includes(n) || n.includes(t);
    }),
  );
}

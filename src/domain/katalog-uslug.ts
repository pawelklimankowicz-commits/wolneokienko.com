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

export type Branza = "uroda" | "zdrowie" | "auto" | "zwierzeta" | "sport" | "nauka" | "dom" | "czas_wolny";

export type Kategoria =
  // uroda
  | "paznokcie" | "fryzjer" | "barber" | "rzesy" | "brwi" | "makijaz" | "makijaz_permanentny"
  | "kosmetologia" | "depilacja" | "masaz" | "spa" | "podologia" | "medycyna_estetyczna" | "tatuaz" | "opalanie"
  // zdrowie
  | "stomatologia" | "lekarz" | "diagnostyka" | "fizjoterapia" | "psychologia" | "dietetyka" | "logopedia"
  // auto
  | "opony" | "serwis" | "myjnia" | "detailing" | "przeglad"
  // zwierzęta
  | "groomer" | "weterynarz" | "opieka_zwierzat" | "szkolenie_psow"
  // sport
  | "korty" | "trener"
  // nauka
  | "jazda" | "korepetycje" | "muzyka" | "plywanie"
  // dom
  | "sprzatanie" | "zlota_raczka" | "hydraulik" | "slusarz" | "elektryk" | "serwis_agd"
  // czas wolny
  | "escape_room" | "kregle" | "sauna" | "gokarty";

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
  { id: "czas_wolny", nazwa: "Czas wolny", wykonawcaDop: ["miejsca", "miejsc"], medyczna: false, przyklad: "escape room dziś po 18 dla 4 osób" },
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
  opalanie: { branza: "uroda", nazwa: "Opalanie" },
  stomatologia: { branza: "zdrowie", nazwa: "Dentysta" },
  lekarz: { branza: "zdrowie", nazwa: "Lekarz" },
  diagnostyka: { branza: "zdrowie", nazwa: "Badania" },
  fizjoterapia: { branza: "zdrowie", nazwa: "Fizjoterapia" },
  psychologia: { branza: "zdrowie", nazwa: "Psycholog" },
  dietetyka: { branza: "zdrowie", nazwa: "Dietetyk" },
  logopedia: { branza: "zdrowie", nazwa: "Logopeda" },
  opony: { branza: "auto", nazwa: "Opony" },
  serwis: { branza: "auto", nazwa: "Serwis" },
  myjnia: { branza: "auto", nazwa: "Myjnia" },
  detailing: { branza: "auto", nazwa: "Detailing" },
  przeglad: { branza: "auto", nazwa: "Przegląd techniczny" },
  groomer: { branza: "zwierzeta", nazwa: "Groomer" },
  weterynarz: { branza: "zwierzeta", nazwa: "Weterynarz" },
  opieka_zwierzat: { branza: "zwierzeta", nazwa: "Opieka i hotel" },
  szkolenie_psow: { branza: "zwierzeta", nazwa: "Szkolenie psa" },
  korty: { branza: "sport", nazwa: "Korty" },
  trener: { branza: "sport", nazwa: "Trener i joga" },
  jazda: { branza: "nauka", nazwa: "Nauka jazdy" },
  korepetycje: { branza: "nauka", nazwa: "Korepetycje" },
  muzyka: { branza: "nauka", nazwa: "Lekcje muzyki" },
  plywanie: { branza: "nauka", nazwa: "Nauka pływania" },
  sprzatanie: { branza: "dom", nazwa: "Sprzątanie" },
  zlota_raczka: { branza: "dom", nazwa: "Złota rączka" },
  hydraulik: { branza: "dom", nazwa: "Hydraulik" },
  slusarz: { branza: "dom", nazwa: "Ślusarz" },
  elektryk: { branza: "dom", nazwa: "Elektryk" },
  serwis_agd: { branza: "dom", nazwa: "Serwis AGD" },
  escape_room: { branza: "czas_wolny", nazwa: "Escape room" },
  kregle: { branza: "czas_wolny", nazwa: "Kręgle i bilard" },
  sauna: { branza: "czas_wolny", nazwa: "Sauna i balia" },
  gokarty: { branza: "czas_wolny", nazwa: "Gokarty" },
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
  u("manicure_meski", "Manicure męski", "paznokcie", 40, ["manicure męski", "manicure dla mężczyzn"]),
  u("strzyzenie_damskie", "Strzyżenie damskie", "fryzjer", 60, ["fryzjer", "ścięcie", "strzyżenie"]),
  u("koloryzacja", "Koloryzacja", "fryzjer", 150, ["farbowanie", "kolor"]),
  u("modelowanie", "Modelowanie", "fryzjer", 45, ["układanie", "modelowanie włosów"]),
  u("keratynowe_prostowanie", "Keratynowe prostowanie", "fryzjer", 180, ["keratyna"]),
  u("balayage", "Balayage i refleksy", "fryzjer", 180, ["balayage", "baleyage", "ombre", "refleksy", "pasemka"]),
  u("przedluzanie_wlosow", "Przedłużanie włosów", "fryzjer", 180, ["przedłużanie włosów", "doczepy", "zagęszczanie włosów"]),
  u("strzyzenie_dzieciece", "Strzyżenie dziecięce", "fryzjer", 30, ["strzyżenie dziecka", "fryzjer dla dziecka", "fryzjer dziecięcy"]),
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
  u("masaz_kobido", "Masaż twarzy Kobido", "masaz", 60, ["kobido", "masaż twarzy"]),
  u("drenaz_limfatyczny", "Drenaż limfatyczny", "masaz", 60, ["drenaż", "drenaz", "limfatyczny"]),
  u("rytual_spa", "Rytuał SPA", "spa", 90, ["spa"]),
  u("pedicure_podologiczny", "Pedicure podologiczny", "podologia", 60, ["podolog", "wrastający paznokieć"]),
  u("toksyna_botulinowa", "Zabieg z toksyną botulinową", "medycyna_estetyczna", 30, ["botoks", "botox", "toksyna"], { bezPromocji: true, wymagaLekarza: true }),
  u("wypelniacz_kwas_hialuronowy", "Wypełnianie kwasem hialuronowym", "medycyna_estetyczna", 45, ["kwas hialuronowy", "wypełniacz", "usta kwas"], { bezPromocji: true, wymagaDeklaracjiKwalifikacji: true }),
  u("tatuaz_maly", "Mały tatuaż", "tatuaz", 90, ["tatuaż", "tatuaz", "tattoo"]),
  u("piercing", "Piercing", "tatuaz", 30, ["kolczyk", "przekłucie"]),
  u("opalanie_natryskowe", "Opalanie natryskowe", "opalanie", 30, ["opalanie", "natryskowe", "spray tan", "opalenizna"]),

  // ── Zdrowie (medyczne: zawsze bez promocji) ─────────────────────────
  u("przeglad_stomatologiczny", "Przegląd stomatologiczny", "stomatologia", 30, ["dentysta", "stomatolog", "przegląd zębów"]),
  u("higienizacja", "Higienizacja (skaling i piaskowanie)", "stomatologia", 60, ["skaling", "piaskowanie", "higienizacja", "kamień"]),
  u("leczenie_zeba", "Leczenie zęba (wypełnienie)", "stomatologia", 45, ["plomba", "ubytek", "wypełnienie zęba", "ból zęba"]),
  u("wybielanie_zebow", "Wybielanie zębów", "stomatologia", 60, ["wybielanie", "wybielanie zębów"]),
  u("konsultacja_ortodontyczna", "Konsultacja ortodontyczna", "stomatologia", 30, ["ortodonta", "aparat na zęby", "aparat ortodontyczny"]),
  u("ekstrakcja_zeba", "Usunięcie zęba", "stomatologia", 30, ["ekstrakcja", "usunięcie zęba", "wyrwanie zęba", "ósemka"]),
  u("przeglad_zebow_dziecka", "Przegląd zębów dziecka", "stomatologia", 30, ["dentysta dla dziecka", "dentysta dziecięcy", "zęby dziecka", "stomatolog dziecięcy"]),
  u("konsultacja_internistyczna", "Konsultacja internistyczna", "lekarz", 20, ["internista", "lekarz rodzinny", "lekarz"]),
  u("konsultacja_dermatologiczna", "Konsultacja dermatologiczna", "lekarz", 20, ["dermatolog"]),
  u("konsultacja_ortopedyczna", "Konsultacja ortopedyczna", "lekarz", 20, ["ortopeda"]),
  u("konsultacja_ginekologiczna", "Konsultacja ginekologiczna", "lekarz", 20, ["ginekolog"]),
  u("konsultacja_kardiologiczna", "Konsultacja kardiologiczna", "lekarz", 20, ["kardiolog"]),
  u("konsultacja_pediatryczna", "Konsultacja pediatryczna", "lekarz", 20, ["pediatra", "lekarz dziecięcy", "lekarz dla dziecka"]),
  u("konsultacja_okulistyczna", "Konsultacja okulistyczna", "lekarz", 30, ["okulista", "badanie wzroku", "dno oka"]),
  u("konsultacja_laryngologiczna", "Konsultacja laryngologiczna", "lekarz", 20, ["laryngolog", "uszy nos gardło"]),
  u("konsultacja_endokrynologiczna", "Konsultacja endokrynologiczna", "lekarz", 30, ["endokrynolog", "tarczyca"]),
  u("konsultacja_urologiczna", "Konsultacja urologiczna", "lekarz", 20, ["urolog"]),
  u("konsultacja_neurologiczna", "Konsultacja neurologiczna", "lekarz", 30, ["neurolog"]),
  u("konsultacja_psychiatryczna", "Konsultacja psychiatryczna", "lekarz", 45, ["psychiatra"]),
  u("usg_jamy_brzusznej", "USG jamy brzusznej", "diagnostyka", 20, ["usg"]),
  u("rezonans_magnetyczny", "Rezonans magnetyczny", "diagnostyka", 40, ["rezonans", "mri"]),
  u("wizyta_fizjoterapeutyczna", "Wizyta fizjoterapeutyczna", "fizjoterapia", 50, ["fizjo", "fizjoterapeuta", "rehabilitacja"]),
  u("terapia_manualna", "Terapia manualna", "fizjoterapia", 50, ["terapia manualna", "terapeuta manualny"]),
  u("wizyta_osteopatyczna", "Wizyta osteopatyczna", "fizjoterapia", 60, ["osteopata", "osteopatia"]),
  u("fala_uderzeniowa", "Fala uderzeniowa", "fizjoterapia", 20, ["fala uderzeniowa", "shockwave"]),
  u("konsultacja_psychologiczna", "Konsultacja psychologiczna", "psychologia", 50, ["psycholog"]),
  u("sesja_psychoterapii", "Sesja psychoterapii", "psychologia", 50, ["psychoterapeuta", "psychoterapia", "terapeuta"]),
  u("konsultacja_dietetyczna", "Konsultacja dietetyczna", "dietetyka", 60, ["dietetyk", "dietetyczka", "dieta"]),
  u("terapia_logopedyczna", "Terapia logopedyczna", "logopedia", 45, ["logopeda", "logopedyczna", "wymowa"]),

  // ── Auto ────────────────────────────────────────────────────────────
  u("wymiana_opon", "Wymiana opon (4 koła)", "opony", 45, ["opony", "wulkanizacja", "wymiana kół"]),
  u("wymiana_oleju", "Wymiana oleju", "serwis", 45, ["olej", "serwis auta"]),
  u("serwis_klimatyzacji", "Serwis klimatyzacji", "serwis", 60, ["klimatyzacja", "klima", "odgrzybianie"]),
  u("geometria_kol", "Geometria kół", "serwis", 45, ["geometria", "zbieżność", "ustawienie kół"]),
  u("diagnostyka_komputerowa", "Diagnostyka komputerowa auta", "serwis", 30, ["diagnostyka komputerowa", "check engine", "kontrolka silnika"]),
  u("mycie_reczne", "Mycie ręczne auta", "myjnia", 60, ["myjnia", "mycie auta"]),
  u("czyszczenie_wnetrza_auta", "Czyszczenie wnętrza auta", "detailing", 120, ["detailing", "czyszczenie wnętrza", "pranie tapicerki auta"]),
  u("polerowanie_lakieru", "Polerowanie lakieru", "detailing", 240, ["polerowanie", "korekta lakieru"]),
  u("powloka_ceramiczna", "Powłoka ceramiczna", "detailing", 480, ["powłoka ceramiczna", "ceramika na lakier"]),
  u("badanie_techniczne", "Przegląd techniczny (stacja kontroli)", "przeglad", 30, ["przegląd techniczny", "przegląd auta", "badanie techniczne", "stacja kontroli"]),

  // ── Zwierzęta ───────────────────────────────────────────────────────
  u("strzyzenie_psa", "Strzyżenie psa", "groomer", 90, ["groomer", "psi fryzjer", "strzyżenie psa"]),
  u("kapiel_psa", "Kąpiel psa", "groomer", 45, ["kąpiel psa"]),
  u("wizyta_weterynaryjna", "Wizyta u weterynarza", "weterynarz", 30, ["weterynarz", "wet"], { bezPromocji: true }),
  u("szczepienie_zwierzecia", "Szczepienie psa lub kota", "weterynarz", 20, ["szczepienie psa", "szczepienie kota", "szczepienie"], { bezPromocji: true }),
  u("opieka_dzienna_psa", "Opieka dzienna nad psem", "opieka_zwierzat", 480, ["opieka nad psem", "przedszkole dla psa", "dogsitter", "psia niania"]),
  u("hotel_dla_zwierzat", "Hotel dla psa lub kota, doba", "opieka_zwierzat", 1440, ["hotel dla psa", "hotel dla kota", "hotel dla zwierząt"]),
  u("trening_posluszenstwa", "Trening posłuszeństwa psa", "szkolenie_psow", 60, ["szkolenie psa", "tresura", "posłuszeństwo"]),
  u("konsultacja_behawiorysty", "Konsultacja behawiorysty", "szkolenie_psow", 90, ["behawiorysta", "behawiorystka"]),

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
  u("lekcja_niemieckiego", "Lekcja niemieckiego", "korepetycje", 60, ["niemiecki"]),
  u("lekcja_hiszpanskiego", "Lekcja hiszpańskiego", "korepetycje", 60, ["hiszpański", "hiszpanski"]),
  u("egzamin_osmoklasisty", "Przygotowanie do egzaminu ósmoklasisty", "korepetycje", 60, ["egzamin ósmoklasisty", "ósmoklasista", "osmoklasisty"]),
  u("przygotowanie_matura", "Przygotowanie do matury", "korepetycje", 60, ["matura", "maturalny", "maturalne"]),
  u("lekcja_gitary", "Lekcja gry na gitarze", "muzyka", 45, ["gitara", "gitary", "gitarze"]),
  u("lekcja_pianina", "Lekcja gry na pianinie", "muzyka", 45, ["pianino", "fortepian", "pianinie"]),
  u("nauka_plywania", "Nauka pływania", "plywanie", 45, ["pływanie", "plywanie", "nauka pływania", "basen"]),

  // ── Dom ─────────────────────────────────────────────────────────────
  u("sprzatanie_mieszkania", "Sprzątanie mieszkania", "sprzatanie", 180, ["sprzątanie", "sprzatanie", "sprzątaczka"]),
  u("zlota_raczka", "Złota rączka, 1 h", "zlota_raczka", 60, ["złota rączka", "montaż", "naprawa"]),
  u("hydraulik", "Wizyta hydraulika", "hydraulik", 60, ["hydraulik", "cieknie", "kran"]),
  u("mycie_okien", "Mycie okien", "sprzatanie", 120, ["mycie okien", "okna"]),
  u("pranie_tapicerki", "Pranie tapicerki i dywanów", "sprzatanie", 90, ["pranie tapicerki", "pranie kanapy", "pranie dywanu"]),
  u("otwarcie_drzwi", "Awaryjne otwarcie drzwi", "slusarz", 30, ["ślusarz", "slusarz", "otwarcie drzwi", "zatrzaśnięte drzwi", "zgubione klucze"]),
  u("wymiana_zamka", "Wymiana zamka", "slusarz", 60, ["wymiana zamka", "wkładka", "zamek"]),
  u("wizyta_elektryka", "Wizyta elektryka", "elektryk", 60, ["elektryk", "gniazdko", "instalacja elektryczna", "bezpiecznik"]),
  u("naprawa_agd", "Naprawa pralki, zmywarki lub lodówki", "serwis_agd", 60, ["pralka", "zmywarka", "lodówka", "serwis agd", "naprawa agd"]),

  // ── Czas wolny ──────────────────────────────────────────────────────
  u("escape_room", "Escape room, 60 min", "escape_room", 60, ["escape room", "escape", "pokój zagadek"]),
  u("tor_kregle", "Tor do kręgli, 60 min", "kregle", 60, ["kręgle", "kregle", "kręgielnia"]),
  u("stol_bilard", "Stół bilardowy, 60 min", "kregle", 60, ["bilard", "snooker"]),
  u("sauna_prywatna", "Prywatna sauna lub balia, 2 h", "sauna", 120, ["sauna", "balia", "jacuzzi", "gorąca beczka"]),
  u("gokarty", "Gokarty, sesja", "gokarty", 15, ["gokarty", "gokart", "karting"]),
];

export const branzaUslugi = (usluga: Usluga): Branza => KATEGORIE_KATALOGU[usluga.kategoria].branza;
export const opisBranzy = (b: Branza): OpisBranzy => BRANZE.find((x) => x.id === b)!;
export const czyMedyczna = (usluga: Usluga): boolean => opisBranzy(branzaUslugi(usluga)).medyczna;
export const uslugiBranzy = (b: Branza): Usluga[] => KATALOG_USLUG.filter((x) => branzaUslugi(x) === b);

export const normalizuj = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .trim();

/**
 * Usługi, których nazwa albo synonim pasuje do wpisanego tekstu (bez polskich
 * znaków i wielkości liter). Najpierw najbardziej konkretne trafienia: wygrywa
 * dłuższy pasujący synonim, więc „przedłużanie włosów” trafia do fryzjera,
 * a nie do „przedłużania” paznokci, a „fizjoterapeuta” nie do „terapeuty”.
 */
export function znajdzUslugi(tekst: string): Usluga[] {
  const t = normalizuj(tekst);
  if (!t) return [];
  const trafienia: { usluga: Usluga; waga: number; i: number }[] = [];
  KATALOG_USLUG.forEach((x, i) => {
    let waga = 0;
    for (const s of [x.nazwa, ...x.synonimy]) {
      const n = normalizuj(s);
      // całe słowo z katalogu w tekście liczy się pełną długością, a początek wpisywanego słowa połową
      if (t.includes(n)) waga = Math.max(waga, n.length);
      else if (n.includes(t)) waga = Math.max(waga, t.length / 2);
    }
    if (waga > 0) trafienia.push({ usluga: x, waga, i });
  });
  return trafienia.sort((a, b) => b.waga - a.waga || a.i - b.i).map((x) => x.usluga);
}

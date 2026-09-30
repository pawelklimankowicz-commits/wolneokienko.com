// =====================================================================
// Katalog usług beauty.
//
// Faza 1: paznokcie. Faza 2: wszystkie usługi salonu beauty, łącznie
// z toksyną botulinową i wypełniaczami, jeśli salon ma je w ofercie
// (decyzja właściciela z 30.09.2026).
//
// Zasady dla zabiegów iniekcyjnych (docs/DECYZJE.md, pkt 5):
//  • toksyna botulinowa to lek na receptę — nazwa ogólna zamiast marki,
//    bez promocji i płatnych wyróżnień (reklama leków Rx do publicznej
//    wiadomości jest zakazana, Prawo farmaceutyczne), salon deklaruje,
//    że zabieg wykonuje lekarz;
//  • wypełniacze z kwasem hialuronowym to wyroby medyczne — bez promocji,
//    salon deklaruje kwalifikacje osoby wykonującej.
//
// `synonimy` służą do dopasowania tego, co klientka wpisze („hybryda”,
// „botoks”); w interfejsie zawsze pokazujemy `nazwa`.
// =====================================================================

export type Kategoria =
  | "paznokcie"
  | "fryzjer"
  | "barber"
  | "rzesy"
  | "brwi"
  | "makijaz"
  | "makijaz_permanentny"
  | "kosmetologia"
  | "depilacja"
  | "masaz"
  | "spa"
  | "podologia"
  | "medycyna_estetyczna";

export interface Usluga {
  kod: string;
  nazwa: string;
  kategoria: Kategoria;
  faza: 1 | 2;
  typowyCzasMin: number;
  synonimy: string[];
  /** Bez promocji, rabatów i płatnych wyróżnień. */
  bezPromocji?: boolean;
  /** Salon musi zadeklarować, że zabieg wykonuje lekarz. */
  wymagaLekarza?: boolean;
  /** Salon musi zadeklarować kwalifikacje osoby wykonującej. */
  wymagaDeklaracjiKwalifikacji?: boolean;
}

const u = (
  kod: string,
  nazwa: string,
  kategoria: Kategoria,
  faza: 1 | 2,
  typowyCzasMin: number,
  synonimy: string[],
  flagi: Pick<Usluga, "bezPromocji" | "wymagaLekarza" | "wymagaDeklaracjiKwalifikacji"> = {},
): Usluga => ({ kod, nazwa, kategoria, faza, typowyCzasMin, synonimy, ...flagi });

export const KATALOG_USLUG: Usluga[] = [
  // ── Faza 1: paznokcie ───────────────────────────────────────────────
  u("manicure_klasyczny", "Manicure klasyczny", "paznokcie", 1, 45, ["manicure", "manicur"]),
  u("manicure_hybrydowy", "Manicure hybrydowy", "paznokcie", 1, 60, ["hybryda", "hybrydy", "lakier hybrydowy"]),
  u("manicure_japonski", "Manicure japoński", "paznokcie", 1, 45, ["japoński", "japonski"]),
  u("przedluzanie_paznokci_zel", "Przedłużanie paznokci żelem", "paznokcie", 1, 120, ["żel", "zel", "przedłużanie", "tipsy"]),
  u("uzupelnienie_zelu", "Uzupełnienie żelu", "paznokcie", 1, 90, ["uzupełnienie", "uzupelnienie"]),
  u("zdjecie_hybrydy", "Zdjęcie hybrydy lub żelu", "paznokcie", 1, 20, ["zdjęcie", "usunięcie hybrydy"]),
  u("pedicure_klasyczny", "Pedicure klasyczny", "paznokcie", 1, 60, ["pedicure", "pedikiur"]),
  u("pedicure_hybrydowy", "Pedicure hybrydowy", "paznokcie", 1, 75, ["hybryda stopy", "pedicure hybryda"]),

  // ── Faza 2: pozostałe usługi salonu beauty ──────────────────────────
  u("strzyzenie_damskie", "Strzyżenie damskie", "fryzjer", 2, 60, ["fryzjer", "ścięcie", "strzyżenie"]),
  u("koloryzacja", "Koloryzacja", "fryzjer", 2, 150, ["farbowanie", "kolor"]),
  u("modelowanie", "Modelowanie", "fryzjer", 2, 45, ["układanie", "modelowanie włosów"]),
  u("keratynowe_prostowanie", "Keratynowe prostowanie", "fryzjer", 2, 180, ["keratyna"]),
  u("strzyzenie_meskie", "Strzyżenie męskie", "barber", 2, 40, ["barber", "strzyżenie męskie"]),
  u("broda", "Strzyżenie i konturowanie brody", "barber", 2, 30, ["broda", "zarost"]),
  u("rzesy_1_1", "Przedłużanie rzęs 1:1", "rzesy", 2, 120, ["rzęsy", "rzesy", "1:1"]),
  u("rzesy_objetosciowe", "Przedłużanie rzęs objętościowe", "rzesy", 2, 150, ["objętościowe", "2d", "3d"]),
  u("lifting_rzes", "Lifting i laminacja rzęs", "rzesy", 2, 60, ["lifting rzęs", "laminacja rzęs"]),
  u("henna_regulacja_brwi", "Henna i regulacja brwi", "brwi", 2, 30, ["brwi", "henna"]),
  u("laminacja_brwi", "Laminacja brwi", "brwi", 2, 45, ["laminacja brwi"]),
  u("makijaz_okolicznosciowy", "Makijaż okolicznościowy", "makijaz", 2, 60, ["makijaż", "makeup"]),
  u("makijaz_slubny", "Makijaż ślubny", "makijaz", 2, 90, ["ślubny"]),
  u("pmu_brwi", "Makijaż permanentny brwi", "makijaz_permanentny", 2, 150, ["permanentny brwi", "pmu"]),
  u("pmu_usta", "Makijaż permanentny ust", "makijaz_permanentny", 2, 150, ["permanentny usta"]),
  u("oczyszczanie_wodorowe", "Oczyszczanie wodorowe", "kosmetologia", 2, 60, ["oczyszczanie", "wodorowe"]),
  u("peeling_kawitacyjny", "Peeling kawitacyjny", "kosmetologia", 2, 45, ["kawitacja"]),
  u("mezoterapia_mikroiglowa", "Mezoterapia mikroigłowa", "kosmetologia", 2, 60, ["dermapen", "mikroigłowa"]),
  u("depilacja_woskiem", "Depilacja woskiem", "depilacja", 2, 30, ["wosk", "woskowanie"]),
  u("depilacja_pasta_cukrowa", "Depilacja pastą cukrową", "depilacja", 2, 30, ["pasta cukrowa", "sugaring"]),
  u("depilacja_laserowa", "Depilacja laserowa", "depilacja", 2, 30, ["laser"]),
  u("masaz_relaksacyjny", "Masaż relaksacyjny", "masaz", 2, 60, ["masaż", "masaz"]),
  u("masaz_klasyczny", "Masaż klasyczny", "masaz", 2, 60, ["masaż klasyczny"]),
  u("rytual_spa", "Rytuał SPA", "spa", 2, 90, ["spa"]),
  u("pedicure_podologiczny", "Pedicure podologiczny", "podologia", 2, 60, ["podolog", "wrastający paznokieć"]),
  u(
    "toksyna_botulinowa",
    "Zabieg z toksyną botulinową",
    "medycyna_estetyczna",
    2,
    30,
    ["botoks", "botox", "toksyna"],
    { bezPromocji: true, wymagaLekarza: true },
  ),
  u(
    "wypelniacz_kwas_hialuronowy",
    "Wypełnianie kwasem hialuronowym",
    "medycyna_estetyczna",
    2,
    45,
    ["kwas hialuronowy", "wypełniacz", "usta kwas"],
    { bezPromocji: true, wymagaDeklaracjiKwalifikacji: true },
  ),
];

const normalizuj = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .trim();

/** Usługi, których nazwa albo synonim pasuje do wpisanego tekstu (bez polskich znaków i wielkości liter). */
export function znajdzUslugi(tekst: string, faza: 1 | 2 = 2): Usluga[] {
  const t = normalizuj(tekst);
  if (!t) return [];
  return KATALOG_USLUG.filter(
    (x) =>
      x.faza <= faza &&
      [x.nazwa, ...x.synonimy].some((s) => {
        const n = normalizuj(s);
        return t.includes(n) || n.includes(t);
      }),
  );
}

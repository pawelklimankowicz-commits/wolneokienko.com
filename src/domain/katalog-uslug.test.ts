import {
  BRANZE,
  KATALOG_USLUG,
  KATEGORIE_KATALOGU,
  branzaUslugi,
  czyMedyczna,
  uslugiBranzy,
  znajdzUslugi,
  type Kategoria,
} from "./katalog-uslug";

const kody = (tekst: string) => znajdzUslugi(tekst).map((u) => u.kod);

describe("katalog usług", () => {
  it("ma unikalne kody", () => {
    const k = KATALOG_USLUG.map((u) => u.kod);
    expect(new Set(k).size).toBe(k.length);
  });

  it("każda branża ma usługi, a każda kategoria należy do istniejącej branży", () => {
    for (const b of BRANZE) expect(uslugiBranzy(b.id).length).toBeGreaterThan(0);
    const ids = new Set(BRANZE.map((b) => b.id));
    for (const k of Object.keys(KATEGORIE_KATALOGU) as Kategoria[]) expect(ids.has(KATEGORIE_KATALOGU[k].branza)).toBe(true);
  });

  it("usługi medyczne są zawsze bez promocji", () => {
    const medyczne = KATALOG_USLUG.filter(czyMedyczna);
    expect(medyczne.length).toBeGreaterThan(0);
    expect(medyczne.every((u) => u.bezPromocji)).toBe(true);
    expect(medyczne.every((u) => branzaUslugi(u) === "zdrowie")).toBe(true);
  });

  it("zabiegi iniekcyjne: bez promocji; toksyna wymaga lekarza i nie ma marki w nazwie", () => {
    const toksyna = KATALOG_USLUG.find((u) => u.kod === "toksyna_botulinowa");
    const kwas = KATALOG_USLUG.find((u) => u.kod === "wypelniacz_kwas_hialuronowy");
    expect(toksyna).toMatchObject({ bezPromocji: true, wymagaLekarza: true });
    expect(kwas).toMatchObject({ bezPromocji: true, wymagaDeklaracjiKwalifikacji: true });
    expect(toksyna?.nazwa.toLowerCase()).not.toContain("botox");
  });
});

describe("znajdzUslugi", () => {
  it("rozpoznaje potoczne nazwy we wszystkich branżach", () => {
    expect(kody("hybryda dziś po 16")).toContain("manicure_hybrydowy");
    expect(kody("dentysta")).toContain("przeglad_stomatologiczny");
    expect(kody("opony")).toContain("wymiana_opon");
    expect(kody("groomer")).toContain("strzyzenie_psa");
    expect(kody("padel")).toContain("kort_padel");
    expect(kody("hydraulik")).toContain("hydraulik");
    expect(kody("botoks")).toEqual(["toksyna_botulinowa"]);
  });

  it("ignoruje polskie znaki i wielkość liter", () => {
    expect(kody("PRZEDLUZANIE")).toContain("przedluzanie_paznokci_zel");
    expect(kody("sprzatanie")).toContain("sprzatanie_mieszkania");
  });

  it("pusty tekst nie zwraca niczego", () => {
    expect(znajdzUslugi("   ")).toEqual([]);
  });
});

import { KATALOG_USLUG, znajdzUslugi } from "./katalog-uslug";

describe("katalog usług", () => {
  it("ma unikalne kody", () => {
    const kody = KATALOG_USLUG.map((u) => u.kod);
    expect(new Set(kody).size).toBe(kody.length);
  });

  it("w fazie 1 zawiera tylko paznokcie", () => {
    const faza1 = KATALOG_USLUG.filter((u) => u.faza === 1);
    expect(faza1.length).toBeGreaterThan(0);
    expect(faza1.every((u) => u.kategoria === "paznokcie")).toBe(true);
  });

  it("zabiegi iniekcyjne są w fazie 2, bez promocji; toksyna wymaga lekarza", () => {
    const toksyna = KATALOG_USLUG.find((u) => u.kod === "toksyna_botulinowa");
    const kwas = KATALOG_USLUG.find((u) => u.kod === "wypelniacz_kwas_hialuronowy");
    expect(toksyna).toMatchObject({ faza: 2, bezPromocji: true, wymagaLekarza: true });
    expect(kwas).toMatchObject({ faza: 2, bezPromocji: true, wymagaDeklaracjiKwalifikacji: true });
    expect(toksyna?.nazwa.toLowerCase()).not.toContain("botox");
  });
});

describe("znajdzUslugi", () => {
  it("rozpoznaje potoczną nazwę w zapytaniu klientki", () => {
    expect(znajdzUslugi("hybryda dziś po 16", 1).map((u) => u.kod)).toContain("manicure_hybrydowy");
  });

  it("ignoruje polskie znaki i wielkość liter", () => {
    expect(znajdzUslugi("PRZEDLUZANIE", 1).map((u) => u.kod)).toContain("przedluzanie_paznokci_zel");
  });

  it("w fazie 1 nie zwraca usług z fazy 2", () => {
    expect(znajdzUslugi("botoks", 1)).toEqual([]);
    expect(znajdzUslugi("botoks", 2).map((u) => u.kod)).toEqual(["toksyna_botulinowa"]);
  });

  it("pusty tekst nie zwraca niczego", () => {
    expect(znajdzUslugi("   ")).toEqual([]);
  });
});

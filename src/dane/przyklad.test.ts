import { KATALOG_USLUG, KATEGORIE_KATALOGU, type Kategoria } from "@/domain/katalog-uslug";
import { KATEGORIE, SALONY, ofertyDla, salon } from "./przyklad";

describe("dane podglądu", () => {
  it("na starcie są wszystkie kategorie katalogu, każda raz", () => {
    const naStarcie = KATEGORIE.map((k) => k.kategoria);
    expect(new Set(naStarcie).size).toBe(naStarcie.length);
    expect([...naStarcie].sort()).toEqual((Object.keys(KATEGORIE_KATALOGU) as Kategoria[]).sort());
  });

  it("każda kategoria katalogu ma w podglądzie co najmniej jednego wykonawcę", () => {
    for (const k of Object.keys(KATEGORIE_KATALOGU) as Kategoria[]) {
      expect(SALONY.some((x) => x.kategorie.includes(k)), k).toBe(true);
    }
  });

  it("oferty przychodzą tylko od wykonawców tej kategorii", () => {
    for (const u of KATALOG_USLUG) {
      const oferty = ofertyDla(u, 16);
      expect(oferty.length, u.kod).toBeGreaterThan(0);
      expect(oferty.every((o) => salon(o.salonId).kategorie.includes(u.kategoria)), u.kod).toBe(true);
    }
  });
});

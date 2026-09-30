import { rozliczZadatek, type DaneRozliczenia } from "./zadatek";

const baza: DaneRozliczenia = {
  wynik: "zrealizowana",
  zadatekGr: 5000, // 50 zł
  cenaWizytyGr: 15000, // 150 zł
  zwolnionaPromocja: false,
};

describe("rozliczZadatek", () => {
  it("wizyta zrealizowana: prowizja 20% + VAT od ceny wizyty potrącona z zadatku", () => {
    const r = rozliczZadatek(baza);
    expect(r.prowizja.bruttoGr).toBe(3690); // 30 zł + 6,90 zł VAT
    expect(r.wyplataDlaSalonuGr).toBe(1310); // 50 zł − 36,90 zł
    expect(r.doplataWSalonieGr).toBe(10000); // 150 zł − 50 zł zadatku
    expect(r.zwrotDlaKlientkiGr).toBe(0);
    expect(r.doFakturyGr).toBe(0);
  });

  it("gdy zadatek nie pokrywa prowizji, reszta idzie na fakturę miesięczną", () => {
    const r = rozliczZadatek({ ...baza, zadatekGr: 2000 });
    expect(r.wyplataDlaSalonuGr).toBe(0);
    expect(r.doFakturyGr).toBe(1690); // 36,90 zł − 20 zł
  });

  it("nieobecność bez odwołania: zadatek przepada, 20% + VAT dla nas, reszta dla salonu", () => {
    const r = rozliczZadatek({ ...baza, wynik: "nieobecnosc" });
    expect(r.prowizja.bruttoGr).toBe(1230); // 10 zł + 2,30 zł VAT
    expect(r.wyplataDlaSalonuGr).toBe(3770);
    expect(r.zwrotDlaKlientkiGr).toBe(0);
    expect(r.obnizaWskaznik).toBe("klientka");
  });

  it("odwołanie przez klientkę przy domyślnej polityce: pełny zwrot, bez prowizji", () => {
    const r = rozliczZadatek({ ...baza, wynik: "odwolana_przez_klientke" });
    expect(r.zwrotDlaKlientkiGr).toBe(5000);
    expect(r.prowizja.bruttoGr).toBe(0);
    expect(r.wyplataDlaSalonuGr).toBe(0);
  });

  it("odwołanie przez klientkę przy polityce „przepada” rozlicza się jak nieobecność", () => {
    const r = rozliczZadatek({ ...baza, wynik: "odwolana_przez_klientke" }, { przyOdwolaniuKlientki: "przepada" });
    expect(r.zwrotDlaKlientkiGr).toBe(0);
    expect(r.wyplataDlaSalonuGr).toBe(3770);
  });

  it("odwołanie przez salon: pełny zwrot i obniżenie wskaźnika salonu", () => {
    const r = rozliczZadatek({ ...baza, wynik: "odwolana_przez_salon" });
    expect(r.zwrotDlaKlientkiGr).toBe(5000);
    expect(r.obnizaWskaznik).toBe("salon");
  });

  it("promocja startowa: salon dostaje cały zadatek, bez prowizji", () => {
    const r = rozliczZadatek({ ...baza, zwolnionaPromocja: true });
    expect(r.prowizja.bruttoGr).toBe(0);
    expect(r.wyplataDlaSalonuGr).toBe(5000);
  });

  it("zadatek nie może przekroczyć ceny wizyty", () => {
    expect(() => rozliczZadatek({ ...baza, zadatekGr: 20000 })).toThrow();
  });
});

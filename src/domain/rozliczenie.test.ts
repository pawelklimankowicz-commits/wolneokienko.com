import { rozliczRezerwacje, type DaneRozliczenia } from "./rozliczenie";

describe("rozliczRezerwacje — faza 1, bez zadatku", () => {
  const baza: DaneRozliczenia = { wynik: "zrealizowana", cenaWizytyGr: 15000, zwolnionaPromocja: false };

  it("wizyta zrealizowana: klientka płaci całość w salonie, prowizja w całości na fakturę", () => {
    const r = rozliczRezerwacje(baza);
    expect(r.prowizja.bruttoGr).toBe(3690); // 30 zł + 6,90 zł VAT
    expect(r.doFakturyGr).toBe(3690);
    expect(r.doplataWSalonieGr).toBe(15000);
    expect(r.wyplataDlaSalonuGr).toBe(0);
    expect(r.zwrotDlaKlientkiGr).toBe(0);
  });

  it("nieobecność: bez prowizji, obniża wskaźnik klientki", () => {
    const r = rozliczRezerwacje({ ...baza, wynik: "nieobecnosc" });
    expect(r.prowizja.bruttoGr).toBe(0);
    expect(r.doFakturyGr).toBe(0);
    expect(r.obnizaWskaznik).toBe("klientka");
  });

  it("odwołanie przez klientkę albo salon: bez prowizji", () => {
    expect(rozliczRezerwacje({ ...baza, wynik: "odwolana_przez_klientke" }).doFakturyGr).toBe(0);
    const salon = rozliczRezerwacje({ ...baza, wynik: "odwolana_przez_salon" });
    expect(salon.doFakturyGr).toBe(0);
    expect(salon.obnizaWskaznik).toBe("salon");
  });

  it("promocja startowa: wizyta bez prowizji", () => {
    expect(rozliczRezerwacje({ ...baza, zwolnionaPromocja: true }).doFakturyGr).toBe(0);
  });
});

describe("rozliczRezerwacje — późniejsze fazy, z zadatkiem", () => {
  const baza: DaneRozliczenia = { wynik: "zrealizowana", zadatekGr: 5000, cenaWizytyGr: 15000, zwolnionaPromocja: false };

  it("prowizja potrącona z zadatku, klientka dopłaca resztę w salonie", () => {
    const r = rozliczRezerwacje(baza);
    expect(r.wyplataDlaSalonuGr).toBe(1310); // 50 zł − 36,90 zł
    expect(r.doplataWSalonieGr).toBe(10000);
    expect(r.doFakturyGr).toBe(0);
  });

  it("zadatek mniejszy niż prowizja: reszta na fakturę", () => {
    const r = rozliczRezerwacje({ ...baza, zadatekGr: 2000 });
    expect(r.wyplataDlaSalonuGr).toBe(0);
    expect(r.doFakturyGr).toBe(1690);
  });

  it("nieobecność: zadatek przepada, 20% + VAT dla nas, reszta dla salonu", () => {
    const r = rozliczRezerwacje({ ...baza, wynik: "nieobecnosc" });
    expect(r.prowizja.bruttoGr).toBe(1230);
    expect(r.wyplataDlaSalonuGr).toBe(3770);
  });

  it("odwołanie przez klientkę: domyślnie zwrot, przy polityce „przepada” jak nieobecność", () => {
    const dane = { ...baza, wynik: "odwolana_przez_klientke" as const };
    expect(rozliczRezerwacje(dane).zwrotDlaKlientkiGr).toBe(5000);
    expect(rozliczRezerwacje(dane, { przyOdwolaniuKlientki: "przepada" }).wyplataDlaSalonuGr).toBe(3770);
  });

  it("zadatek nie może przekroczyć ceny wizyty", () => {
    expect(() => rozliczRezerwacje({ ...baza, zadatekGr: 20000 })).toThrow();
  });
});

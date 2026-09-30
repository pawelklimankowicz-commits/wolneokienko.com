import { czyZwolnionaPromocja, prowizjaOd, PROMOCJA_STARTOWA } from "./prowizja";

const dzien = (n: number) => new Date(Date.UTC(2026, 10, 1) + n * 24 * 60 * 60 * 1000);

describe("prowizjaOd", () => {
  it("liczy 20% netto i 23% VAT od prowizji", () => {
    // wizyta 150 zł → 30 zł netto + 6,90 zł VAT = 36,90 zł
    expect(prowizjaOd(15000)).toEqual({ nettoGr: 3000, vatGr: 690, bruttoGr: 3690 });
  });

  it("zaokrągla do pełnego grosza", () => {
    // 99,99 zł → 19,998 zł ≈ 20,00 zł netto; VAT 4,60 zł
    expect(prowizjaOd(9999)).toEqual({ nettoGr: 2000, vatGr: 460, bruttoGr: 2460 });
  });

  it("odrzuca ujemne i ułamkowe kwoty", () => {
    expect(() => prowizjaOd(-1)).toThrow();
    expect(() => prowizjaOd(10.5)).toThrow();
  });
});

describe("czyZwolnionaPromocja", () => {
  const salon = { aktywowanyAt: dzien(0), wizytyPrzed: 0, wizytyPrzedPoProbie: 0 };

  it("w miesiącu próbnym każda wizyta jest bez prowizji", () => {
    expect(czyZwolnionaPromocja({ ...salon, wizytyPrzed: 40 }, dzien(29))).toBe(true);
  });

  it("po miesiącu próbnym (liczenie od aktywacji) darmowe są tylko wizyty do piątej", () => {
    expect(czyZwolnionaPromocja({ ...salon, wizytyPrzed: 3 }, dzien(31))).toBe(true);
    expect(czyZwolnionaPromocja({ ...salon, wizytyPrzed: 5 }, dzien(31))).toBe(false);
  });

  it("wariant „od końca próby”: 5 darmowych wizyt dodatkowo po miesiącu próbnym", () => {
    const kolejno = { ...PROMOCJA_STARTOWA, liczDarmoweWizytyOd: "konca_proby" as const };
    const poProbie = { ...salon, wizytyPrzed: 40, wizytyPrzedPoProbie: 4 };
    expect(czyZwolnionaPromocja(poProbie, dzien(35), kolejno)).toBe(true);
    expect(czyZwolnionaPromocja({ ...poProbie, wizytyPrzedPoProbie: 5 }, dzien(35), kolejno)).toBe(false);
  });
});

import { czyZwolnionaPromocja, prowizjaOd } from "./prowizja";

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
  const aktywowanyAt = dzien(0);

  it("w miesiącu próbnym 5 pierwszych wizyt jest bez prowizji", () => {
    expect(czyZwolnionaPromocja({ aktywowanyAt, wizytyPrzed: 0 }, dzien(2))).toBe(true);
    expect(czyZwolnionaPromocja({ aktywowanyAt, wizytyPrzed: 4 }, dzien(20))).toBe(true);
  });

  it("szósta wizyta w miesiącu próbnym jest już z prowizją", () => {
    expect(czyZwolnionaPromocja({ aktywowanyAt, wizytyPrzed: 5 }, dzien(20))).toBe(false);
  });

  it("po miesiącu próbnym niewykorzystane darmowe wizyty przepadają", () => {
    expect(czyZwolnionaPromocja({ aktywowanyAt, wizytyPrzed: 1 }, dzien(31))).toBe(false);
  });
});

import { grupujNumer, normalizujTelefon, telefonCzytelny, telefonDlaSmsapi } from "./telefon";

describe("normalizujTelefon", () => {
  it("przyjmuje typowe zapisy polskiego numeru", () => {
    for (const zapis of ["600123123", "600 123 123", "600-123-123", "+48 600 123 123", "0048600123123", "48600123123", "(+48) 600.123.123"]) {
      expect(normalizujTelefon(zapis)).toBe("+48600123123");
    }
  });

  it("numer zaczynający się od 48 bez kierunkowego to nadal 9 cyfr", () => {
    expect(normalizujTelefon("481234567")).toBe("+48481234567");
  });

  it("odrzuca numery zagraniczne, za krótkie, za długie i z literami", () => {
    for (const zapis of ["+49 1512 3456789", "60012312", "6001231234", "060012312", "600 12a 123", ""]) {
      expect(normalizujTelefon(zapis)).toBeNull();
    }
  });

  it("SMSAPI dostaje numer bez plusa", () => {
    expect(telefonDlaSmsapi("+48600123123")).toBe("48600123123");
  });
});

describe("zapis numeru na ekranie", () => {
  it("numer międzynarodowy w grupach", () => {
    expect(telefonCzytelny("+48503090523")).toBe("+48 503 090 523");
  });

  it("pole numeru grupuje cyfry, zdejmuje 48 z wklejonego numeru i ucina nadmiar", () => {
    expect(grupujNumer("503")).toBe("503");
    expect(grupujNumer("5030")).toBe("503 0");
    expect(grupujNumer("503090523")).toBe("503 090 523");
    expect(grupujNumer("+48 503-090-523")).toBe("503 090 523");
    expect(grupujNumer("5030905231234")).toBe("503 090 523");
  });
});

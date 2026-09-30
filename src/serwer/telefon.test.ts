import { normalizujTelefon, telefonDlaSmsapi } from "./telefon";

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

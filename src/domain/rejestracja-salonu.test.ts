import {
  bezBledow,
  normalizujKodPocztowy,
  oczyscDane,
  poprawnyNip,
  walidujCennik,
  walidujDaneSalonu,
  zlotowkiNaGrosze,
  type DaneSalonu,
} from "./rejestracja-salonu";

const DANE: DaneSalonu = {
  nazwa: "Studio Paznokci Jeżyce",
  nip: "526-025-09-95",
  ulica: "Dąbrowskiego 12/3",
  kodPocztowy: "60838",
  miasto: "Poznań",
  branza: "uroda",
  telefon: "600 123 123",
  email: "Studio@Example.PL ",
};

describe("NIP", () => {
  it("sprawdza sumę kontrolną", () => {
    expect(poprawnyNip("5260250995")).toBe(true);
    expect(poprawnyNip("526-025-09-95")).toBe(true);
    expect(poprawnyNip("PL 526 025 09 95")).toBe(true);
    expect(poprawnyNip("5260250994")).toBe(false);
    expect(poprawnyNip("526025099")).toBe(false);
    expect(poprawnyNip("0000000000")).toBe(false);
  });
});

describe("dane salonu", () => {
  it("poprawne dane przechodzą i są czyszczone", () => {
    expect(walidujDaneSalonu(DANE)).toEqual({});
    expect(oczyscDane(DANE)).toMatchObject({ nip: "5260250995", kodPocztowy: "60-838", telefon: "+48600123123", email: "studio@example.pl" });
    expect(normalizujKodPocztowy("60 838")).toBe("60-838");
  });

  it("każde złe pole ma własny komunikat", () => {
    const b = walidujDaneSalonu({ ...DANE, nazwa: "S", nip: "123", ulica: "Dąbrowskiego", kodPocztowy: "6083", telefon: "12", email: "studio" });
    expect(Object.keys(b).sort()).toEqual(["email", "kodPocztowy", "nazwa", "nip", "telefon", "ulica"]);
  });

  it("gabinet medyczny podaje numer rejestru", () => {
    expect(walidujDaneSalonu({ ...DANE, branza: "zdrowie" })).toHaveProperty("numerRejestru");
    expect(walidujDaneSalonu({ ...DANE, branza: "zdrowie", numerRejestru: "000000012345" })).toEqual({});
  });
});

describe("cennik", () => {
  it("usługi z branży salonu, z ceną i czasem", () => {
    const b = walidujCennik("uroda", [
      { usluga: "manicure_hybrydowy", cenaGr: 13000, czasMin: 60 },
      { usluga: "strzyzenie_damskie", cenaGr: 12000, czasMin: 45 },
    ]);
    expect(bezBledow(b)).toBe(true);
  });

  it("pusty cennik, usługa z innej branży, dubel, zła cena i czas", () => {
    expect(walidujCennik("uroda", []).ogolny).toBeTruthy();
    const b = walidujCennik("uroda", [
      { usluga: "wymiana_opon", cenaGr: 10000, czasMin: 30 },
      { usluga: "manicure_hybrydowy", cenaGr: 13000, czasMin: 60 },
      { usluga: "manicure_hybrydowy", cenaGr: 14000, czasMin: 60 },
      { usluga: "manicure_klasyczny", cenaGr: 50, czasMin: 45 },
      { usluga: "manicure_japonski", cenaGr: 9000, czasMin: 2 },
    ]);
    expect(Object.keys(b.pozycje).sort()).toEqual(["manicure_hybrydowy", "manicure_japonski", "manicure_klasyczny", "wymiana_opon"]);
  });

  it("toksyna botulinowa tylko z lekarzem, wypełniacz z deklaracją kwalifikacji", () => {
    const bez = walidujCennik("uroda", [
      { usluga: "toksyna_botulinowa", cenaGr: 90000, czasMin: 30 },
      { usluga: "wypelniacz_kwas_hialuronowy", cenaGr: 120000, czasMin: 45, deklaracja: "ja" },
    ]);
    expect(bez.pozycje.toksyna_botulinowa).toMatch(/lekarz/);
    expect(bez.pozycje.wypelniacz_kwas_hialuronowy).toMatch(/kwalifikacje/);
    const z = walidujCennik("uroda", [
      { usluga: "toksyna_botulinowa", cenaGr: 90000, czasMin: 30, wykonujeLekarz: true },
      { usluga: "wypelniacz_kwas_hialuronowy", cenaGr: 120000, czasMin: 45, deklaracja: "lek. med. Anna Nowak, PWZ 1234567" },
    ]);
    expect(bezBledow(z)).toBe(true);
  });

  it("kwoty wpisane w złotych", () => {
    expect(zlotowkiNaGrosze("130")).toBe(13000);
    expect(zlotowkiNaGrosze("130,50")).toBe(13050);
    expect(zlotowkiNaGrosze("1 200 zł")).toBe(120000);
    expect(zlotowkiNaGrosze("12,345")).toBeNull();
    expect(zlotowkiNaGrosze("abc")).toBeNull();
  });
});

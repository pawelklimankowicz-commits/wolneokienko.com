import { ustalWynikWizyty } from "./wynik-wizyty";

describe("ustalWynikWizyty", () => {
  it("salon potwierdza wizytę: zrealizowana od razu", () => {
    expect(ustalWynikWizyty({ zgloszenieSalonu: "zrealizowana", potwierdzenieKlientki: null, godzinPoTerminie: 1 })).toBe("zrealizowana");
  });

  it("klientka potwierdza wizytę: zrealizowana od razu, jeśli salon milczy", () => {
    expect(ustalWynikWizyty({ zgloszenieSalonu: null, potwierdzenieKlientki: "bylam", godzinPoTerminie: 1 })).toBe("zrealizowana");
  });

  it("salon zgłasza nieobecność, a klientka twierdzi, że była: spór", () => {
    expect(ustalWynikWizyty({ zgloszenieSalonu: "nieobecnosc", potwierdzenieKlientki: "bylam", godzinPoTerminie: 5 })).toBe("spor");
  });

  it("nieobecność zgłoszona przez salon staje się ostateczna po 48 h bez sprzeciwu", () => {
    const z = { zgloszenieSalonu: "nieobecnosc" as const, potwierdzenieKlientki: null };
    expect(ustalWynikWizyty({ ...z, godzinPoTerminie: 10 })).toBe("czekamy");
    expect(ustalWynikWizyty({ ...z, godzinPoTerminie: 48 })).toBe("nieobecnosc");
  });

  it("obie strony zgodne co do nieobecności: nieobecność od razu", () => {
    expect(ustalWynikWizyty({ zgloszenieSalonu: "nieobecnosc", potwierdzenieKlientki: "nie_bylam", godzinPoTerminie: 2 })).toBe("nieobecnosc");
  });

  it("klientka: „salon odwołał”, salon milczy: po 48 h odwołanie przez salon", () => {
    const z = { zgloszenieSalonu: null, potwierdzenieKlientki: "salon_odwolal" as const };
    expect(ustalWynikWizyty({ ...z, godzinPoTerminie: 3 })).toBe("czekamy");
    expect(ustalWynikWizyty({ ...z, godzinPoTerminie: 49 })).toBe("odwolana_przez_salon");
  });

  it("klientka: „salon odwołał”, salon: „nieobecność”: spór", () => {
    expect(ustalWynikWizyty({ zgloszenieSalonu: "nieobecnosc", potwierdzenieKlientki: "salon_odwolal", godzinPoTerminie: 3 })).toBe("spor");
  });

  it("klientka: „nie byłam”, salon: „klientka odwołała”: odwołanie przez klientkę", () => {
    expect(
      ustalWynikWizyty({ zgloszenieSalonu: "odwolana_przez_klientke", potwierdzenieKlientki: "nie_bylam", godzinPoTerminie: 3 }),
    ).toBe("odwolana_przez_klientke");
  });

  it("cisza obu stron: po 48 h przyjmujemy, że wizyta się odbyła", () => {
    const z = { zgloszenieSalonu: null, potwierdzenieKlientki: null };
    expect(ustalWynikWizyty({ ...z, godzinPoTerminie: 47 })).toBe("czekamy");
    expect(ustalWynikWizyty({ ...z, godzinPoTerminie: 48 })).toBe("zrealizowana");
  });
});

import { odmiana } from "./format";
import { parsujZapytanie } from "./parsuj-zapytanie";

describe("parsujZapytanie", () => {
  it("rozpoznaje usługę, dzień, godzinę i limit ceny", () => {
    const r = parsujZapytanie("hybryda dziś po 16, do 150 zł");
    expect(r.uslugi.map((u) => u.kod)).toContain("manicure_hybrydowy");
    expect(r.kiedy).toBe("dzis");
    expect(r.odGodziny).toBe(16);
    expect(r.limitZl).toBe(150);
  });

  it("radzi sobie bez polskich znaków i z innym szykiem", () => {
    const r = parsujZapytanie("jutro rano rzesy 1:1 do 200");
    expect(r.kiedy).toBe("jutro");
    expect(r.limitZl).toBe(200);
    expect(r.uslugi.map((u) => u.kod)).toContain("rzesy_1_1");
  });

  it("„teraz” i brak limitu", () => {
    const r = parsujZapytanie("barber teraz");
    expect(r.kiedy).toBe("teraz");
    expect(r.limitZl).toBeNull();
    expect(r.uslugi.map((u) => u.kod)).toContain("strzyzenie_meskie");
  });

  it("pusty tekst nie rozpoznaje niczego", () => {
    expect(parsujZapytanie("")).toEqual({ uslugi: [], kiedy: null, odGodziny: null, limitZl: null });
  });
});


describe("odmiana", () => {
  const s = (n: number) => `${n} ${odmiana(n, "salon", "salony", "salonów")}`;
  it("odmienia liczebniki po polsku", () => {
    expect([1, 2, 4, 5, 12, 14, 15, 22, 25].map(s)).toEqual([
      "1 salon", "2 salony", "4 salony", "5 salonów", "12 salonów", "14 salonów", "15 salonów", "22 salony", "25 salonów",
    ]);
  });
});

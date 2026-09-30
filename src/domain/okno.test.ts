import { odlegloscKm } from "./odleglosc";
import { kolidujeZ, oknoZapytania, proponowaneTerminy, terminCzytelny } from "./okno";

// środa 1.10.2026, 14:07 czasu lokalnego testu
const T = new Date(2026, 9, 1, 14, 7);
const g = (d: Date) => `${d.getDate()}.${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;

describe("okno zapytania", () => {
  it("teraz: najbliższe 2 godziny", () => {
    const o = oknoZapytania("teraz", null, T);
    expect([g(o.od), g(o.do)]).toEqual(["1.10 14:07", "1.10 16:07"]);
  });
  it("dziś po 16 do 21; dziś bez godziny od teraz", () => {
    expect([g(oknoZapytania("dzis", 16, T).od), g(oknoZapytania("dzis", 16, T).do)]).toEqual(["1.10 16:00", "1.10 21:00"]);
    expect(g(oknoZapytania("dzis", null, T).od)).toBe("1.10 14:07");
    expect(g(oknoZapytania("dzis", 10, T).od)).toBe("1.10 14:07");
  });
  it("dziś wieczorem po 21: dwie godziny od teraz", () => {
    const o = oknoZapytania("dzis", null, new Date(2026, 9, 1, 21, 30));
    expect(g(o.do)).toBe("1.10 23:30");
  });
  it("jutro od 8 albo od podanej godziny", () => {
    expect(g(oknoZapytania("jutro", null, T).od)).toBe("2.10 8:00");
    expect(g(oknoZapytania("jutro", 17, T).od)).toBe("2.10 17:00");
  });
  it("weekend: od soboty do niedzieli 20:00", () => {
    const o = oknoZapytania("weekend", null, T);
    expect([g(o.od), g(o.do)]).toEqual(["3.10 9:00", "4.10 20:00"]);
    const wNiedziele = oknoZapytania("weekend", null, new Date(2026, 9, 4, 12, 0));
    expect([g(wNiedziele.od), g(wNiedziele.do)]).toEqual(["4.10 12:00", "4.10 20:00"]);
  });
});

describe("proponowane terminy", () => {
  it("co 15 minut, najwcześniej 20 minut od teraz, z miejscem na usługę przed końcem okna", () => {
    const t = proponowaneTerminy(oknoZapytania("dzis", null, T), T, 60, 4).map(g);
    expect(t[0]).toBe("1.10 14:30");
    expect(t[1]).toBe("1.10 14:45");
    expect(t.at(-1)).toBe("1.10 20:00");
    expect(t).toHaveLength(4);
  });
  it("krótkie okno daje tyle terminów, ile się mieści", () => {
    const t = proponowaneTerminy({ od: new Date(2026, 9, 1, 16, 0), do: new Date(2026, 9, 1, 17, 30) }, T, 60);
    expect(t.map(g)).toEqual(["1.10 16:00", "1.10 16:15", "1.10 16:30"]);
  });
  it("pomija godziny, w których usługa wpadłaby na zajęty termin z kalendarza", () => {
    const okno = { od: new Date(2026, 9, 1, 16, 0), do: new Date(2026, 9, 1, 19, 0) };
    const zajete = [{ od: new Date(2026, 9, 1, 16, 30), do: new Date(2026, 9, 1, 17, 30) }];
    const t = proponowaneTerminy(okno, T, 45, 20, zajete).map(g);
    // 16:00 skończyłoby się 16:45 — koliduje; pierwsze wolne 17:30
    expect(t).toEqual(["1.10 17:30", "1.10 17:45", "1.10 18:00", "1.10 18:15"]);
    expect(kolidujeZ(zajete, new Date(2026, 9, 1, 15, 45), 45)).toBe(false);
    expect(kolidujeZ(zajete, new Date(2026, 9, 1, 15, 50), 45)).toBe(true);
  });
  it("czytelny zapis terminu", () => {
    expect(terminCzytelny(new Date(2026, 9, 1, 16, 30), T)).toBe("dziś 16:30");
    expect(terminCzytelny(new Date(2026, 9, 2, 9, 5), T)).toBe("jutro 9:05");
    expect(terminCzytelny(new Date(2026, 9, 3, 11, 0), T)).toBe("sob. 11:00");
  });
});

describe("odległość", () => {
  it("Stary Rynek → Rynek Jeżycki to ok. 1,7 km", () => {
    const km = odlegloscKm({ lat: 52.4083, lon: 16.934 }, { lat: 52.4109, lon: 16.9106 });
    expect(km).toBeGreaterThan(1.5);
    expect(km).toBeLessThan(1.8);
  });
});

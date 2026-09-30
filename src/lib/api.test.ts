import { apiPodglad, czasCzekania, komunikatBledu } from "./api";

describe("komunikaty logowania", () => {
  it("odmiana liczby prób", () => {
    expect(komunikatBledu({ blad: "zly_kod", pozostaloProb: 4 }).komunikat).toBe("Nieprawidłowy kod. Zostały 4 próby.");
    expect(komunikatBledu({ blad: "zly_kod", pozostaloProb: 1 }).komunikat).toBe("Nieprawidłowy kod. Została 1 próba.");
    expect(komunikatBledu({ blad: "zly_kod", pozostaloProb: 0 })).toMatchObject({ nowyKod: true });
  });

  it("czekanie w sekundach albo minutach", () => {
    expect(czasCzekania(20)).toBe("20 s");
    expect(czasCzekania(840)).toBe("14 min");
    expect(komunikatBledu({ blad: "za_czesto", ponowZaSek: 20 })).toEqual({
      komunikat: "Kod już wysłaliśmy. Kolejny możesz zamówić za 20 s.",
      ponowZaSek: 20,
    });
  });

  it("wygasły lub zużyty kod wymaga nowego, nieznany błąd ma ogólny komunikat", () => {
    for (const blad of ["wygasl", "za_duzo_prob", "brak_kodu"]) expect(komunikatBledu({ blad }).nowyKod).toBe(true);
    expect(komunikatBledu({ blad: "cos" }).komunikat).toMatch(/Spróbuj ponownie/);
  });
});

describe("podgląd bez serwera", () => {
  it("kod 123456 loguje, zły kod zużywa próby", async () => {
    const a = apiPodglad();
    expect(await a.wyslijKod("600 123 12")).toMatchObject({ ok: false });
    expect(await a.wyslijKod("600 123 123")).toEqual({ ok: true, telefon: "+48600123123" });
    expect(await a.zaloguj("+48600123123", "000000")).toMatchObject({ ok: false, komunikat: expect.stringMatching(/Zostały 4 próby/) });
    expect(await a.zaloguj("+48600123123", "123456")).toMatchObject({ ok: true, konto: { rola: "klientka" } });
    expect(await a.ja()).toMatchObject({ telefon: "+48600123123" });
    await a.wyloguj();
    expect(await a.ja()).toBeNull();
  });
});

describe("podgląd: zapytanie na żywo", () => {
  afterEach(() => vi.useRealTimers());

  it("oferty napływają, przyjęcie robi wizytę, druga próba jest nieaktualna", async () => {
    vi.useFakeTimers({ now: new Date(2026, 9, 5, 10, 0) });
    const a = apiPodglad();
    const wyslane = a.wyslijZapytanie({
      uslugaKod: "manicure_hybrydowy",
      oknoOd: new Date(2026, 9, 5, 16, 0).toISOString(),
      oknoDo: new Date(2026, 9, 5, 21, 0).toISOString(),
      lat: 52.4,
      lon: 16.93,
      limitGr: null,
      tryb: "zbieram",
      liczbaOsob: null,
      tresc: "",
      zgodaZdrowie: false,
    });
    await vi.advanceTimersByTimeAsync(700);
    const w = await wyslane;
    if (!w.ok) throw new Error(w.komunikat);
    expect(w.zapytanie).toMatchObject({ status: "otwarte", oferty: [] });
    expect(w.zapytanie.liczbaWykonawcow).toBeGreaterThan(0);

    await vi.advanceTimersByTimeAsync(10_000);
    const stan = await a.stanZapytania(w.zapytanie.id);
    expect(stan!.oferty.length).toBeGreaterThan(0);
    const o = stan!.oferty[0];
    expect(new Date(o.termin).getHours()).toBeGreaterThanOrEqual(16);

    const przyjecie = a.przyjmijOferte(o.id);
    await vi.advanceTimersByTimeAsync(500);
    const p = await przyjecie;
    expect(p).toMatchObject({ ok: true, wizyta: { status: "potwierdzona", cenaGr: o.cenaGr, termin: o.termin } });
    expect((await a.stanZapytania(w.zapytanie.id))!.status).toBe("zarezerwowane");
    expect((await a.mojeWizyty())[0].termin).toBe(o.termin);

    const ponownie = a.przyjmijOferte(o.id);
    await vi.advanceTimersByTimeAsync(500);
    expect(await ponownie).toMatchObject({ ok: false, komunikat: expect.stringMatching(/nieaktualna/) });
  });
});

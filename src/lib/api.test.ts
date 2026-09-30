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

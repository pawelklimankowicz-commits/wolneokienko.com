import { ADRES_SMSAPI, BladBramkiSms, bramkaSmsapi } from "./bramka-sms";

function atrapaFetch(status: number, cialo: unknown) {
  const wywolania: { url: string; init: RequestInit }[] = [];
  const f = (async (url: string, init: RequestInit) => {
    wywolania.push({ url, init });
    return new Response(JSON.stringify(cialo), { status });
  }) as unknown as typeof fetch;
  return { f, wywolania };
}

describe("bramkaSmsapi", () => {
  it("wysyła numer bez plusa, treść i nadawcę, z tokenem w nagłówku", async () => {
    const { f, wywolania } = atrapaFetch(200, { count: 1, list: [{ id: "1" }] });
    await bramkaSmsapi({ token: "T", nadawca: "Okienko", fetch: f }).wyslij("+48600123123", "Kod 123456");
    expect(wywolania).toHaveLength(1);
    expect(wywolania[0].url).toBe(ADRES_SMSAPI);
    expect((wywolania[0].init.headers as Record<string, string>).Authorization).toBe("Bearer T");
    const cialo = wywolania[0].init.body as URLSearchParams;
    expect(cialo.get("to")).toBe("48600123123");
    expect(cialo.get("message")).toBe("Kod 123456");
    expect(cialo.get("from")).toBe("Okienko");
    expect(cialo.get("format")).toBe("json");
  });

  it("bez podanego nadawcy wysyła jako WolneOkno, nigdy jako domyślny „Prometheus” konta", async () => {
    const { f, wywolania } = atrapaFetch(200, { count: 1 });
    await bramkaSmsapi({ token: "T", fetch: f }).wyslij("+48600123123", "x");
    expect((wywolania[0].init.body as URLSearchParams).get("from")).toBe("WolneOkno");
  });

  it("błąd w treści odpowiedzi HTTP 200 to błąd", async () => {
    const { f } = atrapaFetch(200, { error: 13, message: "No correct phone numbers" });
    const wynik = bramkaSmsapi({ token: "T", fetch: f }).wyslij("+48600123123", "x");
    await expect(wynik).rejects.toBeInstanceOf(BladBramkiSms);
    await expect(wynik).rejects.toMatchObject({ kod: 13 });
  });

  it("status HTTP inny niż 2xx to błąd", async () => {
    const { f } = atrapaFetch(401, { error: 101, message: "Authorization failed" });
    await expect(bramkaSmsapi({ token: "zly", fetch: f }).wyslij("+48600123123", "x")).rejects.toThrow(/Authorization failed/);
  });
});

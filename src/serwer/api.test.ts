// API logowania od strony przeglądarki: żądania HTTP → odpowiedzi i ciasteczka.
import type { PGlite } from "@electric-sql/pglite";
import { CIASTECZKO_SESJI, utworzApi } from "./api";
import { bazaTestowa } from "./baza-testowa";
import type { BramkaSms } from "./bramka-sms";

let pglite: PGlite;
let api: ReturnType<typeof utworzApi>;
const wyslane: string[] = [];
const sms: BramkaSms = { wyslij: async (_t, tresc) => void wyslane.push(tresc.slice(0, 6)) };
let zegar = new Date("2026-10-01T10:00:00Z");

beforeAll(async () => {
  const t = await bazaTestowa();
  pglite = t.pglite;
  api = utworzApi({
    baza: t.baza,
    sms,
    geokoder: { znajdz: async (a) => ({ lat: 52.41, lon: 16.91, opis: `${a.ulica}, ${a.miasto}` }) },
    pieprz: "p",
    bezpieczneCiasteczka: true,
    teraz: () => zegar,
  });
}, 30_000);
afterAll(() => pglite.close());

const post = (sciezka: string, cialo: unknown, naglowki: Record<string, string> = {}) =>
  api(
    new Request(`https://wolneokienko.com${sciezka}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...naglowki },
      body: JSON.stringify(cialo),
    }),
    "203.0.113.5",
  );
const get = (sciezka: string, naglowki: Record<string, string> = {}) => api(new Request(`https://wolneokienko.com${sciezka}`, { headers: naglowki }));
const ciasteczkoZ = (r: Response) => r.headers.get("Set-Cookie") ?? "";
const tokenZ = (r: Response) => ciasteczkoZ(r).match(new RegExp(`${CIASTECZKO_SESJI}=([^;]*)`))?.[1] ?? "";

describe("API logowania", () => {
  it("pełna ścieżka: kod → sesja w ciasteczku → /api/ja → wylogowanie", async () => {
    const kod = await post("/api/logowanie/kod", { telefon: "600 111 222" });
    expect(kod.status).toBe(200);
    expect(await kod.json()).toMatchObject({ telefon: "+48600111222" });

    const bezAkceptacji = await post("/api/logowanie/sprawdz", { telefon: "600111222", kod: wyslane.at(-1) });
    expect(await bezAkceptacji.json()).toEqual({ blad: "brak_akceptacji" });

    const zly = await post("/api/logowanie/sprawdz", { telefon: "600111222", kod: wyslane.at(-1) === "000000" ? "111111" : "000000", akceptujeRegulamin: true });
    expect(zly.status).toBe(400);
    expect(await zly.json()).toEqual({ blad: "zly_kod", pozostaloProb: 4 });

    const ok = await post("/api/logowanie/sprawdz", { telefon: "600111222", kod: wyslane.at(-1), akceptujeRegulamin: true });
    expect(ok.status).toBe(200);
    const { konto, nowe } = await ok.json();
    expect(konto).toMatchObject({ rola: "klientka", telefon: "+48600111222" });
    expect(nowe).toBe(true);
    const c = ciasteczkoZ(ok);
    expect(c).toMatch(/HttpOnly/);
    expect(c).toMatch(/Secure/);
    expect(c).toMatch(/SameSite=Lax/);
    expect(c).toMatch(/Max-Age=7776000/);
    const token = tokenZ(ok);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);

    const ja = await get("/api/ja", { Cookie: `inne=1; ${CIASTECZKO_SESJI}=${token}` });
    expect(await ja.json()).toEqual({ konto });
    // aplikacja mobilna może podać token w nagłówku
    expect(await (await get("/api/ja", { Authorization: `Bearer ${token}` })).json()).toEqual({ konto });

    const wyj = await post("/api/wyloguj", {}, { Cookie: `${CIASTECZKO_SESJI}=${token}` });
    expect(ciasteczkoZ(wyj)).toMatch(/Max-Age=0/);
    expect(await (await get("/api/ja", { Cookie: `${CIASTECZKO_SESJI}=${token}` })).json()).toEqual({ konto: null });
  });

  it("bez ciasteczka nie ma konta i nie ma czego czyścić", async () => {
    const r = await get("/api/ja");
    expect(await r.json()).toEqual({ konto: null });
    expect(r.headers.get("Set-Cookie")).toBeNull();
  });

  it("za szybki drugi kod: 429 z Retry-After", async () => {
    zegar = new Date("2026-10-02T10:00:00Z");
    expect((await post("/api/logowanie/kod", { telefon: "600111333" })).status).toBe(200);
    zegar = new Date("2026-10-02T10:00:10Z");
    const r = await post("/api/logowanie/kod", { telefon: "600111333" });
    expect(r.status).toBe(429);
    expect(r.headers.get("Retry-After")).toBe("20");
    expect(await r.json()).toEqual({ blad: "za_czesto", ponowZaSek: 20 });
  });

  it("zły numer, zły format i obcy Content-Type", async () => {
    expect((await post("/api/logowanie/kod", { telefon: "123" })).status).toBe(400);
    expect((await post("/api/logowanie/kod", [1, 2])).status).toBe(400);
    const formularz = await api(
      new Request("https://wolneokienko.com/api/logowanie/kod", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: "telefon=600111444",
      }),
    );
    expect(formularz.status).toBe(415);
  });

  it("konta operatora nie da się założyć z aplikacji", async () => {
    expect(await (await post("/api/logowanie/sprawdz", { telefon: "600111555", kod: "123456", rola: "operator", akceptujeRegulamin: true })).json()).toEqual({
      blad: "zla_rola",
    });
  });

  it("nieznany adres to 404", async () => {
    expect((await get("/api/cokolwiek")).status).toBe(404);
  });

  it("usługodawca: logowanie jako salon, dane firmy, cennik, przyjmowanie zapytań", async () => {
    zegar = new Date("2026-10-03T10:00:00Z");
    expect((await get("/api/salon")).status).toBe(401);

    await post("/api/logowanie/kod", { telefon: "600222333" });
    const log = await post("/api/logowanie/sprawdz", { telefon: "600222333", kod: wyslane.at(-1), rola: "salon", akceptujeRegulamin: true });
    expect((await log.json()).konto.rola).toBe("salon");
    const Cookie = `${CIASTECZKO_SESJI}=${tokenZ(log)}`;
    expect(await (await get("/api/salon", { Cookie })).json()).toEqual({ salon: null });

    const dane = { nazwa: "Studio Jeżyce", nip: "526-025-09-95", ulica: "Dąbrowskiego 12", kodPocztowy: "60-838", miasto: "Poznań", branza: "uroda", telefon: "600222333", email: "a@b.pl" };
    expect(await (await post("/api/salon", { dane }, { Cookie })).json()).toEqual({ blad: "brak_akceptacji" });
    const zle = await post("/api/salon", { dane: { ...dane, nip: "1" }, akceptujeRegulamin: true }, { Cookie });
    expect(await zle.json()).toMatchObject({ blad: "zle_dane", pola: { nip: expect.any(String) } });
    const salon = await post("/api/salon", { dane, akceptujeRegulamin: true }, { Cookie });
    expect(salon.status).toBe(200);
    expect((await salon.json()).salon).toMatchObject({ nazwa: "Studio Jeżyce", nip: "5260250995", adresZMapy: "Dąbrowskiego 12, Poznań" });

    expect((await post("/api/salon/przyjmowanie", { wlaczone: true }, { Cookie })).status).toBe(409);
    const cennik = await post("/api/salon/cennik", { pozycje: [{ usluga: "manicure_hybrydowy", cenaGr: 13000, czasMin: 60 }] }, { Cookie });
    expect((await cennik.json()).salon.cennik).toHaveLength(1);
    const wl = await post("/api/salon/przyjmowanie", { wlaczone: true }, { Cookie });
    expect((await wl.json()).salon).toMatchObject({ przyjmujeZapytania: true, aktywowanyAt: "2026-10-03T10:00:00.000Z" });

    // cudzy salon jest niedostępny: inne konto widzi tylko swój (tu: brak)
    await post("/api/logowanie/kod", { telefon: "600222444" });
    const inne = await post("/api/logowanie/sprawdz", { telefon: "600222444", kod: wyslane.at(-1), akceptujeRegulamin: true });
    expect(await (await get("/api/salon", { Cookie: `${CIASTECZKO_SESJI}=${tokenZ(inne)}` })).json()).toEqual({ salon: null });
  });
});

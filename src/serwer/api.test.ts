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
let kalendarzIcs = "";
const pobraniaKalendarza: string[] = [];

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
    fetch: (async (url: string) => {
      pobraniaKalendarza.push(String(url));
      return new Response(kalendarzIcs, { status: 200, headers: { "Content-Type": "text/calendar" } });
    }) as typeof fetch,
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

  it("zapytanie → skrzynka salonu → oferta → oferty na żywo → rezerwacja, przez HTTP", async () => {
    zegar = new Date("2026-10-04T10:00:00Z");
    const zaloguj = async (telefon: string, rola: "klientka" | "salon") => {
      await post("/api/logowanie/kod", { telefon });
      const r = await post("/api/logowanie/sprawdz", { telefon, kod: wyslane.at(-1), rola, akceptujeRegulamin: true });
      return `${CIASTECZKO_SESJI}=${tokenZ(r)}`;
    };
    const salonC = await zaloguj("600333111", "salon");
    await post("/api/salon", { dane: { nazwa: "Studio Łazarz", nip: "774-000-14-54", ulica: "Głogowska 1", kodPocztowy: "60-111", miasto: "Poznań", branza: "uroda", telefon: "600333111", email: "l@b.pl" }, akceptujeRegulamin: true }, { Cookie: salonC });
    await post("/api/salon/cennik", { pozycje: [{ usluga: "manicure_hybrydowy", cenaGr: 12000, czasMin: 60 }] }, { Cookie: salonC });
    await post("/api/salon/przyjmowanie", { wlaczone: true }, { Cookie: salonC });

    const klientkaC = await zaloguj("600333222", "klientka");
    const noweR = await post(
      "/api/zapytania",
      {
        uslugaKod: "manicure_hybrydowy", oknoOd: "2026-10-04T13:00:00Z", oknoDo: "2026-10-04T18:00:00Z", lat: 52.4083, lon: 16.934,
        limitGr: 15000, tryb: "zbieram", liczbaOsob: null, tresc: "", zgodaZdrowie: false,
      },
      { Cookie: klientkaC },
    );
    expect(noweR.status).toBe(200);
    const { zapytanie } = await noweR.json();
    // salon z poprzedniego testu też jest w zasięgu i ma manicure
    expect(zapytanie).toMatchObject({ status: "otwarte", liczbaWykonawcow: 2 });

    const skrzynka = await (await get("/api/salon/zapytania", { Cookie: salonC })).json();
    expect(skrzynka.zapytania).toHaveLength(1);
    const oferta = await post(`/api/salon/zapytania/${zapytanie.id}/oferta`, { termin: "2026-10-04T14:30:00Z", cenaGr: 13000 }, { Cookie: salonC });
    expect(await oferta.json()).toEqual({ ok: true, przyjeta: false });

    const stan = await (await get(`/api/zapytania/${zapytanie.id}`, { Cookie: klientkaC })).json();
    expect(stan.zapytanie.oferty).toHaveLength(1);
    // salon nie podejrzy zapytania klientki, a zły identyfikator to 404
    expect((await get(`/api/zapytania/${zapytanie.id}`, { Cookie: salonC })).status).toBe(404);
    expect((await get("/api/zapytania/nie-uuid", { Cookie: klientkaC })).status).toBe(404);

    const rez = await post(`/api/oferty/${stan.zapytanie.oferty[0].id}/przyjmij`, {}, { Cookie: klientkaC });
    expect(rez.status).toBe(200);
    expect((await rez.json()).wizyta).toMatchObject({ salonNazwa: "Studio Łazarz", telefon: "+48600333111", status: "potwierdzona" });
    expect((await (await get("/api/wizyty", { Cookie: klientkaC })).json()).wizyty).toHaveLength(1);
    expect((await (await get("/api/salon/wizyty", { Cookie: salonC })).json()).wizyty[0]).toMatchObject({ telefonKlientki: "+48600333222" });
    expect((await post(`/api/oferty/${stan.zapytanie.oferty[0].id}/przyjmij`, {}, { Cookie: klientkaC })).status).toBe(409);
  });
});

describe("profil usługodawcy i narzędzia importu", () => {
  // najmniejszy „JPEG”: nagłówek FF D8 FF i wypełnienie — serwer sprawdza rodzaj po bajtach
  const jpeg = (rozmiar: number) => {
    const b = new Uint8Array(rozmiar).fill(7);
    b.set([0xff, 0xd8, 0xff, 0xe0]);
    return b;
  };
  const b64 = (b: Uint8Array) => Buffer.from(b).toString("base64");

  it("opis, logo, zdjęcia, pracownicy w ofercie, kalendarz — przez HTTP", async () => {
    zegar = new Date("2026-10-06T08:00:00Z");
    const zaloguj = async (telefon: string, rola: "klientka" | "salon") => {
      await post("/api/logowanie/kod", { telefon });
      const r = await post("/api/logowanie/sprawdz", { telefon, kod: wyslane.at(-1), rola, akceptujeRegulamin: true });
      return `${CIASTECZKO_SESJI}=${tokenZ(r)}`;
    };
    const C = await zaloguj("600444111", "salon");
    await post("/api/salon", { dane: { nazwa: "Pracownia Wilda", nip: "779-000-00-66", ulica: "Górna Wilda 5", kodPocztowy: "61-001", miasto: "Poznań", branza: "uroda", telefon: "600444111", email: "w@b.pl" }, akceptujeRegulamin: true }, { Cookie: C });
    await post("/api/salon/cennik", { pozycje: [{ usluga: "manicure_hybrydowy", cenaGr: 11000, czasMin: 60 }, { usluga: "pedicure_hybrydowy", cenaGr: 14000, czasMin: 75 }] }, { Cookie: C });
    await post("/api/salon/przyjmowanie", { wlaczone: true }, { Cookie: C });

    // opis
    expect((await post("/api/salon/opis", { opis: "x".repeat(601) }, { Cookie: C })).status).toBe(400);
    const opis = await (await post("/api/salon/opis", { opis: "  Hybrydy i pedicure na Wildzie.\n\n\n\nParking za rogiem.  " }, { Cookie: C })).json();
    expect(opis.salon.opis).toBe("Hybrydy i pedicure na Wildzie.\n\nParking za rogiem.");

    // zdjęcia: bez oświadczenia nie, SVG nie, duży plik (≈ 500 kB) tak, logo zastępuje logo
    expect(await (await post("/api/salon/zdjecia", { rodzaj: "zdjecie", dane: b64(jpeg(2000)), oswiadczenie: false }, { Cookie: C })).json()).toEqual({ blad: "brak_oswiadczenia" });
    const svg = b64(new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg">${" ".repeat(200)}<script>alert(1)</script></svg>`));
    expect(await (await post("/api/salon/zdjecia", { rodzaj: "zdjecie", dane: svg, oswiadczenie: true }, { Cookie: C })).json()).toEqual({ blad: "zly_plik" });
    const duze = await post("/api/salon/zdjecia", { rodzaj: "zdjecie", dane: b64(jpeg(500_000)), oswiadczenie: true }, { Cookie: C });
    expect(duze.status).toBe(200);
    expect((await post("/api/salon/zdjecia", { rodzaj: "zdjecie", dane: b64(jpeg(700_000)), oswiadczenie: true }, { Cookie: C })).status).toBe(413);
    await post("/api/salon/zdjecia", { rodzaj: "logo", dane: b64(jpeg(300)), oswiadczenie: true }, { Cookie: C });
    const poLogo = (await (await post("/api/salon/zdjecia", { rodzaj: "logo", dane: b64(jpeg(400)), oswiadczenie: true }, { Cookie: C })).json()).salon;
    expect(poLogo.zdjecia).toHaveLength(1);
    expect(poLogo.logoUrl).toMatch(/^\/api\/zdjecia\/[0-9a-f-]{36}$/);
    const plik = await get(poLogo.logoUrl);
    expect(plik.headers.get("Content-Type")).toBe("image/jpeg");
    expect(plik.headers.get("Cache-Control")).toMatch(/immutable/);
    expect((await plik.arrayBuffer()).byteLength).toBe(400);

    // pracownicy: zła usługa i powtórzone imię odrzucone; potem lista zapisana
    const zlaUsluga = await post("/api/salon/pracownicy", { pracownicy: [{ imie: "Ania", uslugi: ["wymiana_opon"] }] }, { Cookie: C });
    expect(await zlaUsluga.json()).toMatchObject({ blad: "zle_dane", komunikat: expect.stringMatching(/spoza katalogu/) });
    expect((await post("/api/salon/pracownicy", { pracownicy: [{ imie: "Ania", uslugi: [] }, { imie: "ania", uslugi: [] }] }, { Cookie: C })).status).toBe(400);
    const zespol = await post("/api/salon/pracownicy", { pracownicy: [{ imie: "Ania", uslugi: ["manicure_hybrydowy"] }, { imie: "Ola", uslugi: ["pedicure_hybrydowy", "manicure_hybrydowy"] }] }, { Cookie: C });
    expect((await zespol.json()).salon.pracownicy).toEqual([
      { imie: "Ania", uslugi: ["manicure_hybrydowy"] },
      { imie: "Ola", uslugi: ["manicure_hybrydowy", "pedicure_hybrydowy"] },
    ]);

    // kalendarz: zły host od razu odrzucony, Google podłączony; adres w bazie zaszyfrowany
    expect(await (await post("/api/salon/kalendarz", { adres: "https://evil.example.com/cal.ics" }, { Cookie: C })).json()).toEqual({ blad: "niedozwolony_host" });
    kalendarzIcs = [
      "BEGIN:VCALENDAR", "BEGIN:VEVENT", "UID:1", "SUMMARY:Pani Kowalska — hybryda",
      "DTSTART:20261006T110000Z", "DTEND:20261006T120000Z", "END:VEVENT", "END:VCALENDAR",
    ].join("\r\n");
    const adres = "https://calendar.google.com/calendar/ical/studio%40gmail.com/private-abc123/basic.ics";
    const kal = await (await post("/api/salon/kalendarz", { adres }, { Cookie: C })).json();
    expect(kal.salon.kalendarz).toMatchObject({ host: "calendar.google.com", zajeteBloki: 1, blad: null });
    expect(JSON.stringify(kal)).not.toMatch(/private-abc123|Kowalska/);
    const zapis = await pglite.query<{ adres_szyfr: string; zajete: unknown }>("select adres_szyfr, zajete from public.kalendarze_salonow");
    expect(zapis.rows[0].adres_szyfr).not.toMatch(/google|abc123/);
    expect(JSON.stringify(zapis.rows[0].zajete)).not.toMatch(/Kowalska/);

    // zapytanie klientki: skrzynka pokazuje zajętość w oknie, oferta z imieniem pracownika
    const K = await zaloguj("600444222", "klientka");
    const { zapytanie } = await (
      await post("/api/zapytania", { uslugaKod: "manicure_hybrydowy", oknoOd: "2026-10-06T10:00:00Z", oknoDo: "2026-10-06T16:00:00Z", lat: 52.395, lon: 16.93, limitGr: null, tryb: "zbieram", liczbaOsob: null, tresc: "", zgodaZdrowie: false }, { Cookie: K })
    ).json();
    const skrzynka = (await (await get("/api/salon/zapytania", { Cookie: C })).json()).zapytania.find((z: { id: string }) => z.id === zapytanie.id);
    expect(skrzynka.zajete).toEqual([{ od: "2026-10-06T11:00:00.000Z", do: "2026-10-06T12:00:00.000Z" }]);
    expect(await (await post(`/api/salon/zapytania/${zapytanie.id}/oferta`, { termin: "2026-10-06T13:00:00Z", cenaGr: 11000, pracownik: "Kasia" }, { Cookie: C })).json()).toEqual({ blad: "zly_pracownik" });
    await post(`/api/salon/zapytania/${zapytanie.id}/oferta`, { termin: "2026-10-06T13:00:00Z", cenaGr: 11000, pracownik: "Ola" }, { Cookie: C });
    const oferty = (await (await get(`/api/zapytania/${zapytanie.id}`, { Cookie: K })).json()).zapytanie.oferty;
    const odOli = oferty.find((o: { salonNazwa: string }) => o.salonNazwa === "Pracownia Wilda");
    expect(odOli).toMatchObject({ pracownik: "Ola", logoUrl: poLogo.logoUrl });
    const wizyta = (await (await post(`/api/oferty/${odOli.id}/przyjmij`, {}, { Cookie: K })).json()).wizyta;
    expect(wizyta).toMatchObject({ pracownik: "Ola", salonId: expect.any(String), logoUrl: poLogo.logoUrl });

    // profil publiczny: opis, zdjęcia, pracownicy, cennik — bez NIP-u i telefonu
    const profil = (await (await get(`/api/salony/${odOli.salonId}`)).json()).salon;
    expect(profil).toMatchObject({ nazwa: "Pracownia Wilda", pracownicy: ["Ania", "Ola"], cennik: [{ uslugaKod: "manicure_hybrydowy", cenaGr: 11000 }, { uslugaKod: "pedicure_hybrydowy", cenaGr: 14000 }] });
    expect(profil.zdjecia).toHaveLength(1);
    expect(JSON.stringify(profil)).not.toMatch(/7790000066|600444111/);

    // odświeżenie kalendarza najwyżej co 10 minut; odłączenie usuwa adres
    const ile = pobraniaKalendarza.length;
    await get("/api/salon/zapytania", { Cookie: C });
    expect(pobraniaKalendarza.length).toBe(ile);
    zegar = new Date("2026-10-06T08:11:00Z");
    await get("/api/salon/zapytania", { Cookie: C });
    expect(pobraniaKalendarza.length).toBe(ile + 1);
    expect((await (await post("/api/salon/kalendarz/odlacz", {}, { Cookie: C })).json()).salon.kalendarz).toBeNull();
    expect((await pglite.query("select 1 from public.kalendarze_salonow")).rows).toHaveLength(0);
  });
});

// Logowanie kodem SMS i sesje — na prawdziwym schemacie (PGlite z migracjami).
import type { PGlite } from "@electric-sql/pglite";
import type { Baza } from "./baza";
import { bazaTestowa } from "./baza-testowa";
import { BladBramkiSms, type BramkaSms } from "./bramka-sms";
import { PARAMETRY_KODOW, ponowZaSek, sprawdzKod, trescSms, wyslijKod } from "./kody-sms";
import { sesjaZTokenu, utworzSesje, wyloguj } from "./sesje";

const PIEPRZ = "pieprz-testowy";
const T0 = new Date("2026-10-01T10:00:00Z");
const po = (sek: number) => new Date(T0.getTime() + sek * 1000);

let pglite: PGlite;
let baza: Baza;

/** Atrapa bramki: zapamiętuje wysłane kody zamiast wysyłać SMS-y. */
function bramka() {
  const wyslane: { telefon: string; tresc: string }[] = [];
  const sms: BramkaSms = { wyslij: async (telefon, tresc) => void wyslane.push({ telefon, tresc }) };
  const ostatniKod = () => wyslane.at(-1)!.tresc.slice(0, 6);
  return { sms, wyslane, ostatniKod };
}

// każdy test na własnym numerze, więc wspólna baza wystarcza
let nr = 0;
const nowyNumer = () => `600 000 ${String(++nr).padStart(3, "0")}`;

beforeAll(async () => {
  ({ pglite, baza } = await bazaTestowa());
}, 30_000);
afterAll(() => pglite.close());

describe("kod SMS", () => {
  it("treść mieści się w jednym SMS-ie bez polskich znaków i nie ma linku (SMSAPI by ją odrzuciło)", () => {
    const tresc = trescSms("012345");
    expect(tresc.length).toBeLessThanOrEqual(160);
    expect(tresc).toMatch(/^[\x20-\x7E]+$/);
    expect(tresc.startsWith("012345 ")).toBe(true);
    expect(tresc).not.toMatch(/https?:|www\.|\.(com|pl|app)\b/i);
  });

  it("wysyła kod, a poprawny kod zakłada konto klientki", async () => {
    const { sms, wyslane, ostatniKod } = bramka();
    const tel = nowyNumer();
    const w = await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: T0 });
    expect(w).toMatchObject({ ok: true, telefon: expect.stringMatching(/^\+48600000\d{3}$/) });
    expect(wyslane).toHaveLength(1);

    // w bazie jest skrót, nie kod
    const [wiersz] = await baza<{ kod_skrot: string }>("select kod_skrot from public.kody_sms where telefon = $1", [w.ok && w.telefon]);
    expect(wiersz.kod_skrot).toMatch(/^[0-9a-f]{64}$/);
    expect(wiersz.kod_skrot).not.toContain(ostatniKod());

    const s = await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: ostatniKod(), teraz: po(60) });
    expect(s).toMatchObject({ ok: true, rola: "klientka", nowe: true });
    const [klientka] = await baza<{ telefon: string }>("select telefon from public.klientki where id = $1", [s.ok && s.kontoId]);
    expect(klientka.telefon).toBe(w.ok && w.telefon);

    // kod jest jednorazowy
    expect(await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: ostatniKod(), teraz: po(61) })).toEqual({ ok: false, powod: "brak_kodu" });

    // drugie logowanie trafia w to samo konto
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: po(120) });
    const s2 = await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: ostatniKod(), teraz: po(130) });
    expect(s2).toMatchObject({ ok: true, nowe: false, kontoId: s.ok && s.kontoId });
  });

  it("zły numer nie wysyła nic", async () => {
    const { sms, wyslane } = bramka();
    expect(await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: "+49 151 234", teraz: T0 })).toEqual({ ok: false, powod: "zly_numer" });
    expect(wyslane).toHaveLength(0);
  });

  it("5 prób, potem koniec — nawet z dobrym kodem", async () => {
    const { sms, ostatniKod } = bramka();
    const tel = nowyNumer();
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: T0 });
    const zly = ostatniKod() === "000000" ? "111111" : "000000";
    for (let i = 1; i <= PARAMETRY_KODOW.maksProb; i++) {
      expect(await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: zly, teraz: po(i) })).toEqual({
        ok: false,
        powod: "zly_kod",
        pozostaloProb: PARAMETRY_KODOW.maksProb - i,
      });
    }
    expect(await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: ostatniKod(), teraz: po(10) })).toEqual({
      ok: false,
      powod: "za_duzo_prob",
    });
  });

  it("kod wygasa po 5 minutach", async () => {
    const { sms, ostatniKod } = bramka();
    const tel = nowyNumer();
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: T0 });
    expect(await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: ostatniKod(), teraz: po(5 * 60) })).toEqual({ ok: false, powod: "wygasl" });
  });

  it("liczy się tylko najnowszy kod", async () => {
    const { sms, ostatniKod } = bramka();
    const tel = nowyNumer();
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: T0 });
    const pierwszy = ostatniKod();
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: po(40) });
    const drugi = ostatniKod();
    if (pierwszy !== drugi) {
      expect(await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: pierwszy, teraz: po(50) })).toMatchObject({ ok: false, powod: "zly_kod" });
    }
    expect(await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: drugi, teraz: po(51) })).toMatchObject({ ok: true });
  });

  it("kod z innym pieprzem nie przejdzie", async () => {
    const { sms, ostatniKod } = bramka();
    const tel = nowyNumer();
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: T0 });
    expect(await sprawdzKod({ baza, pieprz: "inny", telefon: tel, kod: ostatniKod(), teraz: po(5) })).toMatchObject({ ok: false, powod: "zly_kod" });
  });

  it("limity wysyłki: 30 s odstępu, 3 kody na 15 minut", async () => {
    const { sms, wyslane } = bramka();
    const tel = nowyNumer();
    const wyslij = (sek: number) => wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: po(sek) });
    expect((await wyslij(0)).ok).toBe(true);
    expect(await wyslij(10)).toEqual({ ok: false, powod: "za_czesto", ponowZaSek: 20 });
    expect((await wyslij(30)).ok).toBe(true);
    expect((await wyslij(60)).ok).toBe(true);
    // czwarty w oknie: czekamy, aż pierwszy (z sekundy 0) wypadnie z 15 minut
    expect(await wyslij(100)).toEqual({ ok: false, powod: "za_czesto", ponowZaSek: 15 * 60 - 100 });
    expect((await wyslij(15 * 60)).ok).toBe(true);
    // odrzucone próby nic nie wysłały i nie zostały w bazie
    expect(wyslane).toHaveLength(4);
    const [{ n }] = await baza<{ n: number }>("select count(*)::int as n from public.kody_sms where telefon = $1", [`+48${tel.replace(/\s/g, "")}`]);
    expect(n).toBe(4);
  });

  it("limit dobowy: 10 kodów na dobę", () => {
    const wczesniej = Array.from({ length: 10 }, (_, i) => po(i * 20 * 60));
    const teraz = po(10 * 20 * 60);
    // najstarszy (T0) wypada z doby po 24 h
    expect(ponowZaSek(wczesniej, teraz)).toBe(24 * 60 * 60 - 10 * 20 * 60);
    expect(ponowZaSek(wczesniej.slice(1), teraz)).toBe(0);
  });

  it("błąd bramki: klientka dostaje komunikat, a kod nie zużywa limitu", async () => {
    const tel = nowyNumer();
    const zepsuta: BramkaSms = {
      wyslij: async () => {
        throw new BladBramkiSms("brak punktów", 103);
      },
    };
    const blad = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await wyslijKod({ baza, sms: zepsuta, pieprz: PIEPRZ, telefon: tel, teraz: T0 })).toEqual({ ok: false, powod: "blad_bramki" });
    blad.mockRestore();
    const { sms } = bramka();
    expect((await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: po(1) })).ok).toBe(true);
  });

  it("usługodawca zakłada konto salonu, a istniejącej roli nie zmieniamy", async () => {
    const { sms, ostatniKod } = bramka();
    const tel = nowyNumer();
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: T0 });
    const s = await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: ostatniKod(), rola: "salon", teraz: po(5) });
    expect(s).toMatchObject({ ok: true, rola: "salon", nowe: true });
    const [{ n }] = await baza<{ n: number }>("select count(*)::int as n from public.klientki where id = $1", [s.ok && s.kontoId]);
    expect(n).toBe(0);

    // właścicielka salonu umawia się też jako klientka: konto to samo, rola bez zmian, dochodzi profil klientki
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: po(60) });
    const s2 = await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: ostatniKod(), rola: "klientka", teraz: po(70) });
    expect(s2).toMatchObject({ ok: true, rola: "salon", nowe: false });
    const [{ m }] = await baza<{ m: number }>("select count(*)::int as m from public.klientki where id = $1", [s.ok && s.kontoId]);
    expect(m).toBe(1);
  });
});

describe("sesje", () => {
  async function zalogowana() {
    const { sms, ostatniKod } = bramka();
    const tel = nowyNumer();
    await wyslijKod({ baza, sms, pieprz: PIEPRZ, telefon: tel, teraz: T0 });
    const s = await sprawdzKod({ baza, pieprz: PIEPRZ, telefon: tel, kod: ostatniKod(), teraz: po(5) });
    if (!s.ok) throw new Error("logowanie nie wyszło");
    return s.kontoId;
  }

  it("token otwiera sesję, baza trzyma tylko skrót, wylogowanie ją zamyka", async () => {
    const kontoId = await zalogowana();
    const { token } = await utworzSesje({ baza, kontoId, teraz: T0 });
    const [w] = await baza<{ token_skrot: string }>("select token_skrot from public.sesje where konto_id = $1", [kontoId]);
    expect(w.token_skrot).not.toBe(token);
    expect(await sesjaZTokenu({ baza, token, teraz: po(60) })).toEqual({ kontoId, rola: "klientka" });
    await wyloguj({ baza, token, teraz: po(120) });
    expect(await sesjaZTokenu({ baza, token, teraz: po(121) })).toBeNull();
  });

  it("sesja wygasa po 90 dniach bez użycia, a każde użycie ją przedłuża", async () => {
    const kontoId = await zalogowana();
    const { token } = await utworzSesje({ baza, kontoId, teraz: T0 });
    const dni = (d: number) => po(d * 24 * 60 * 60);
    expect(await sesjaZTokenu({ baza, token, teraz: dni(80) })).not.toBeNull();
    expect(await sesjaZTokenu({ baza, token, teraz: dni(160) })).not.toBeNull();
    expect(await sesjaZTokenu({ baza, token, teraz: dni(251) })).toBeNull();
  });

  it("nieznany albo zniekształcony token to brak sesji", async () => {
    expect(await sesjaZTokenu({ baza, token: "x".repeat(43), teraz: T0 })).toBeNull();
    expect(await sesjaZTokenu({ baza, token: "'; drop table sesje; --", teraz: T0 })).toBeNull();
  });
});

// Rejestracja usługodawcy na prawdziwym schemacie (PGlite z migracjami).
import type { PGlite } from "@electric-sql/pglite";
import type { DaneSalonu } from "../domain/rejestracja-salonu";
import type { Baza } from "./baza";
import { bazaTestowa } from "./baza-testowa";
import type { Geokoder } from "./geokoder";
import { mojSalon, ustawPrzyjmowanie, zapiszCennik, zapiszSalon } from "./salony";

let pglite: PGlite;
let baza: Baza;
const zapytaniaMapy: string[] = [];
const geokoder: Geokoder = {
  znajdz: async (a) => {
    zapytaniaMapy.push(a.ulica);
    return a.ulica.startsWith("Nieistniejąca") ? null : { lat: 52.41, lon: 16.91, opis: `${a.ulica}, Jeżyce, ${a.miasto}` };
  },
};
const T = new Date("2026-10-05T09:00:00Z");

const DANE: DaneSalonu = {
  nazwa: "Studio Paznokci Jeżyce",
  nip: "5260250995",
  ulica: "Dąbrowskiego 12/3",
  kodPocztowy: "60-838",
  miasto: "Poznań",
  branza: "uroda",
  telefon: "600 123 123",
  email: "studio@example.pl",
};

let nr = 0;
async function noweKonto(rola: "klientka" | "salon" = "klientka") {
  const [{ id }] = await baza<{ id: string }>("insert into public.konta (telefon, rola) values ($1, $2) returning id", [
    `+48700000${String(++nr).padStart(3, "0")}`,
    rola,
  ]);
  if (rola === "klientka") await baza("insert into public.klientki (id) values ($1)", [id]);
  return id;
}

beforeAll(async () => {
  ({ pglite, baza } = await bazaTestowa());
}, 30_000);
afterAll(() => pglite.close());

describe("rejestracja usługodawcy", () => {
  it("zakłada salon z akceptacją regulaminu, punktem na mapie i zmienia rolę konta", async () => {
    const kontoId = await noweKonto("klientka");
    expect(await zapiszSalon({ baza, geokoder, kontoId, dane: DANE, akceptujeRegulamin: false, teraz: T })).toEqual({
      ok: false,
      blad: "brak_akceptacji",
    });
    const w = await zapiszSalon({ baza, geokoder, kontoId, dane: DANE, akceptujeRegulamin: true, teraz: T });
    expect(w).toMatchObject({
      ok: true,
      salon: { nazwa: "Studio Paznokci Jeżyce", telefon: "+48600123123", adresZMapy: "Dąbrowskiego 12/3, Jeżyce, Poznań", przyjmujeZapytania: false, aktywowanyAt: null, cennik: [] },
    });
    const [konto] = await baza<{ rola: string }>("select rola from public.konta where id = $1", [kontoId]);
    expect(konto.rola).toBe("salon");
    const [s] = await baza<{ regulamin_wersja: string; lokalizacja: string; adres: string }>(
      "select regulamin_wersja, lokalizacja, adres from public.salony where wlasciciel_id = $1",
      [kontoId],
    );
    expect(s).toEqual({ regulamin_wersja: "2026-10-01", lokalizacja: "POINT(16.91 52.41)", adres: "Dąbrowskiego 12/3, 60-838 Poznań" });
  });

  it("poprawka danych bez zmiany adresu nie pyta mapy; ten sam NIP u kogoś innego jest zajęty", async () => {
    const kontoId = await noweKonto("salon");
    const dane = { ...DANE, nip: "7740001454", nazwa: "Barber Wilda" };
    await zapiszSalon({ baza, geokoder, kontoId, dane, akceptujeRegulamin: true, teraz: T });
    const przed = zapytaniaMapy.length;
    const w = await zapiszSalon({ baza, geokoder, kontoId, dane: { ...dane, nazwa: "Barber Wilda 2" }, akceptujeRegulamin: false, teraz: T });
    expect(w).toMatchObject({ ok: true, salon: { nazwa: "Barber Wilda 2" } });
    expect(zapytaniaMapy.length).toBe(przed);

    const inne = await noweKonto("salon");
    expect(await zapiszSalon({ baza, geokoder, kontoId: inne, dane, akceptujeRegulamin: true, teraz: T })).toEqual({ ok: false, blad: "nip_zajety" });
  });

  it("złe dane i nieznaleziony adres", async () => {
    const kontoId = await noweKonto();
    const zle = await zapiszSalon({ baza, geokoder, kontoId, dane: { ...DANE, nip: "123" }, akceptujeRegulamin: true, teraz: T });
    expect(zle).toMatchObject({ ok: false, blad: "zle_dane", pola: { nip: expect.any(String) } });
    const adres = await zapiszSalon({ baza, geokoder, kontoId, dane: { ...DANE, nip: "1132191233", ulica: "Nieistniejąca 1" }, akceptujeRegulamin: true, teraz: T });
    expect(adres).toEqual({ ok: false, blad: "adres_nieznaleziony" });
  });

  it("cennik: zapis, zmiana i usunięcie pozycji w jednym kroku", async () => {
    const kontoId = await noweKonto();
    expect(await zapiszCennik({ baza, kontoId, pozycje: [] })).toEqual({ ok: false, blad: "brak_salonu" });
    await zapiszSalon({ baza, geokoder, kontoId, dane: { ...DANE, nip: "5213017228" }, akceptujeRegulamin: true, teraz: T });

    const w1 = await zapiszCennik({
      baza,
      kontoId,
      pozycje: [
        { usluga: "manicure_hybrydowy", cenaGr: 13000, czasMin: 60 },
        { usluga: "pedicure_hybrydowy", cenaGr: 15000, czasMin: 75 },
        { usluga: "toksyna_botulinowa", cenaGr: 90000, czasMin: 30, wykonujeLekarz: true },
      ],
    });
    expect(w1.ok && w1.salon.cennik.map((p) => p.usluga)).toEqual(["manicure_hybrydowy", "pedicure_hybrydowy", "toksyna_botulinowa"]);

    const w2 = await zapiszCennik({ baza, kontoId, pozycje: [{ usluga: "manicure_hybrydowy", cenaGr: 14000, czasMin: 60 }] });
    expect(w2.ok && w2.salon.cennik).toEqual([{ usluga: "manicure_hybrydowy", cenaGr: 14000, czasMin: 60 }]);

    const zle = await zapiszCennik({ baza, kontoId, pozycje: [{ usluga: "wymiana_opon", cenaGr: 10000, czasMin: 45 }] });
    expect(zle).toMatchObject({ ok: false, blad: "zle_dane", cennik: { pozycje: { wymiana_opon: expect.any(String) } } });
  });

  it("przyjmowanie zapytań wymaga cennika, a pierwsze włączenie zaczyna miesiąc próbny", async () => {
    const kontoId = await noweKonto();
    await zapiszSalon({ baza, geokoder, kontoId, dane: { ...DANE, nip: "9542583988" }, akceptujeRegulamin: true, teraz: T });
    expect(await ustawPrzyjmowanie({ baza, kontoId, wlaczone: true, teraz: T })).toEqual({ ok: false, blad: "brak_cennika" });
    await zapiszCennik({ baza, kontoId, pozycje: [{ usluga: "manicure_hybrydowy", cenaGr: 13000, czasMin: 60 }] });

    const w = await ustawPrzyjmowanie({ baza, kontoId, wlaczone: true, teraz: T });
    expect(w).toMatchObject({ ok: true, salon: { przyjmujeZapytania: true, aktywowanyAt: T.toISOString() } });
    await ustawPrzyjmowanie({ baza, kontoId, wlaczone: false, teraz: new Date("2026-10-06T09:00:00Z") });
    const pozniej = await ustawPrzyjmowanie({ baza, kontoId, wlaczone: true, teraz: new Date("2026-10-07T09:00:00Z") });
    expect(pozniej.ok && pozniej.salon.aktywowanyAt).toBe(T.toISOString());

    await baza("update public.salony set wstrzymany_za_zaleglosc_at = now() where wlasciciel_id = $1", [kontoId]);
    await ustawPrzyjmowanie({ baza, kontoId, wlaczone: false });
    expect(await ustawPrzyjmowanie({ baza, kontoId, wlaczone: true })).toEqual({ ok: false, blad: "wstrzymany" });
    expect((await mojSalon(baza, kontoId))?.wstrzymany).toBe(true);
  });
});

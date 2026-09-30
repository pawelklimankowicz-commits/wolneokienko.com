// Zapytania i oferty na żywo — pełny przepływ na prawdziwym schemacie (PGlite z migracjami).
import type { PGlite } from "@electric-sql/pglite";
import type { NoweZapytanie } from "../domain/widoki";
import type { Baza } from "./baza";
import { bazaTestowa } from "./baza-testowa";
import type { Geokoder } from "./geokoder";
import { ustawPrzyjmowanie, zapiszCennik, zapiszSalon } from "./salony";
import { odmowZapytania, wizytySalonu, zapytaniaSalonu, zlozOferte } from "./skrzynka";
import {
  anulujZapytanie,
  odwolajWizyte,
  okolica,
  potwierdzWizyte,
  przyjmijOferte,
  stanZapytania,
  wizytyKlientki,
  wyslijZapytanie,
  zakonczPrzeterminowane,
} from "./zapytania";

let pglite: PGlite;
let baza: Baza;
const T = new Date("2026-10-01T12:00:00Z");
const po = (min: number) => new Date(T.getTime() + min * 60 * 1000);
const CENTRUM = { lat: 52.4083, lon: 16.934 };

// geokoder testowy: „Ulica <lat> <lon>” → punkt
const geokoder: Geokoder = {
  znajdz: async (a) => {
    const [lat, lon] = a.ulica.split(" ").slice(1, 3).map(Number);
    return { lat, lon, opis: `${a.ulica}, Jeżyce, ${a.miasto}` };
  },
};

let nr = 0;
async function konto(rola: "klientka" | "salon") {
  const [{ id }] = await baza<{ id: string }>("insert into public.konta (telefon, rola) values ($1, $2) returning id", [
    `+48511000${String(++nr).padStart(3, "0")}`,
    rola,
  ]);
  if (rola === "klientka") await baza("insert into public.klientki (id) values ($1)", [id]);
  return id;
}

/** Kolejne poprawne NIP-y (suma kontrolna), różne od używanych w innych testach. */
let nip = 0;
function nastepnyNip(): string {
  for (;;) {
    const baza9 = String(810000000 + ++nip * 7919).padStart(9, "0");
    const suma = [6, 5, 7, 2, 3, 4, 5, 6, 7].reduce((a, w, i) => a + w * Number(baza9[i]), 0) % 11;
    if (suma !== 10) return baza9 + suma;
  }
}
/** Salon w punkcie (lat, lon) z usługą w cenniku i włączonym przyjmowaniem zapytań. */
async function salon(lat: number, lon: number, cennik: { usluga: string; cenaGr: number; czasMin: number }[] = [{ usluga: "manicure_hybrydowy", cenaGr: 12000, czasMin: 60 }]) {
  const kontoId = await konto("salon");
  const w = await zapiszSalon({
    baza,
    geokoder,
    kontoId,
    akceptujeRegulamin: true,
    teraz: T,
    dane: {
      nazwa: `Salon ${nip + 1}`,
      nip: nastepnyNip(),
      ulica: `Ulica ${lat} ${lon} 1`,
      kodPocztowy: "60-838",
      miasto: "Poznań",
      branza: cennik.some((c) => c.usluga.startsWith("konsultacja")) ? "zdrowie" : "uroda",
      telefon: "600 100 200",
      email: "s@example.pl",
      ...(cennik.some((c) => c.usluga.startsWith("konsultacja")) ? { numerRejestru: "000000012345" } : {}),
    },
  });
  if (!w.ok) throw new Error(`salon: ${JSON.stringify(w)}`);
  await zapiszCennik({ baza, kontoId, pozycje: cennik });
  await ustawPrzyjmowanie({ baza, kontoId, wlaczone: true, teraz: T });
  return { kontoId, salonId: w.salon.id };
}

const zapytanie = (z: Partial<NoweZapytanie> = {}): NoweZapytanie => ({
  uslugaKod: "manicure_hybrydowy",
  oknoOd: po(60).toISOString(),
  oknoDo: po(480).toISOString(),
  ...CENTRUM,
  limitGr: 15000,
  tryb: "zbieram",
  liczbaOsob: null,
  tresc: "hybryda, krótkie paznokcie",
  zgodaZdrowie: false,
  ...z,
});

beforeAll(async () => {
  ({ pglite, baza } = await bazaTestowa());
}, 30_000);
afterAll(() => pglite.close());

describe("zapytania na żywo", () => {
  let salony: { kontoId: string; salonId: string }[];
  let daleki: { kontoId: string };
  let bezUslugi: { kontoId: string };
  let drogi: { kontoId: string };

  beforeAll(async () => {
    // 7 salonów w promieniu ok. 2 km, jeden w Warszawie, jeden bez manicure, jeden z ceną „od” powyżej limitu
    salony = [];
    for (let i = 0; i < 7; i++) salony.push(await salon(CENTRUM.lat + 0.002 * i, CENTRUM.lon + 0.002 * i));
    daleki = await salon(52.2297, 21.0122);
    bezUslugi = await salon(CENTRUM.lat, CENTRUM.lon + 0.001, [{ usluga: "strzyzenie_damskie", cenaGr: 10000, czasMin: 45 }]);
    drogi = await salon(CENTRUM.lat + 0.001, CENTRUM.lon, [{ usluga: "manicure_hybrydowy", cenaGr: 25000, czasMin: 60 }]);
  }, 60_000);

  it("rozsyła falami tylko do salonów z usługą, w zasięgu i w limicie ceny", async () => {
    const kl = await konto("klientka");
    const w = await wyslijZapytanie({ baza, kontoId: kl, dane: zapytanie(), teraz: T });
    expect(w.ok).toBe(true);
    if (!w.ok) return;
    expect(w.zapytanie).toMatchObject({ status: "otwarte", liczbaWykonawcow: 7, oferty: [] });
    const fale = await baza<{ fala: number; n: number }>("select fala, count(*)::int as n from public.rozeslania where zapytanie_id = $1 group by fala order by fala", [w.zapytanie.id]);
    expect(fale).toEqual([{ fala: 1, n: 5 }, { fala: 2, n: 2 }]);

    // pierwsza fala widzi zapytanie od razu, druga po 3 minutach; daleki, bez usługi i drogi — wcale
    const widzi = async (kontoId: string, teraz: Date) => ((await zapytaniaSalonu({ baza, kontoId, teraz })) ?? []).some((z) => z.id === w.zapytanie.id);
    const [fala1, fala2] = [[] as string[], [] as string[]];
    for (const s of salony) (await widzi(s.kontoId, T) ? fala1 : fala2).push(s.kontoId);
    expect(fala1).toHaveLength(5);
    expect(await widzi(fala2[0], po(3))).toBe(true);
    for (const s of [daleki, bezUslugi, drogi]) expect(await widzi(s.kontoId, po(5))).toBe(false);
  });

  it("oferta: walidacja terminu i ceny, a klientka widzi ją na żywo; przyjęcie tworzy rezerwację", async () => {
    const kl = await konto("klientka");
    const w = await wyslijZapytanie({ baza, kontoId: kl, dane: zapytanie(), teraz: T });
    if (!w.ok) throw new Error();
    const [a, b] = salony;
    const skrzynka = (await zapytaniaSalonu({ baza, kontoId: a.kontoId, teraz: po(1) }))!.find((z) => z.id === w.zapytanie.id)!;
    expect(skrzynka).toMatchObject({ mojaCenaGr: 12000, czasMin: 60, limitGr: 15000, tresc: "hybryda, krótkie paznokcie", mojaOferta: null });

    expect(await zlozOferte({ baza, kontoId: a.kontoId, zapytanieId: w.zapytanie.id, termin: po(30).toISOString(), cenaGr: 13000, teraz: po(1) })).toEqual({ ok: false, blad: "zly_termin" });
    expect(await zlozOferte({ baza, kontoId: a.kontoId, zapytanieId: w.zapytanie.id, termin: po(120).toISOString(), cenaGr: 16000, teraz: po(1) })).toEqual({ ok: false, blad: "powyzej_limitu" });
    expect(await zlozOferte({ baza, kontoId: a.kontoId, zapytanieId: w.zapytanie.id, termin: po(120).toISOString(), cenaGr: 13000, teraz: po(1) })).toEqual({ ok: true, przyjeta: false });
    expect(await zlozOferte({ baza, kontoId: b.kontoId, zapytanieId: w.zapytanie.id, termin: po(90).toISOString(), cenaGr: 14000, teraz: po(2) })).toEqual({ ok: true, przyjeta: false });

    const stan = (await stanZapytania({ baza, kontoId: kl, zapytanieId: w.zapytanie.id, teraz: po(2) }))!;
    expect(stan.oferty.map((o) => o.cenaGr)).toEqual([14000, 13000]); // od najwcześniejszego terminu
    expect(stan.oferty[0]).toMatchObject({ okolica: "Jeżyce", salonNazwa: expect.stringMatching(/^Salon/) });
    expect(stan.oferty[0].odlegloscKm).toBeLessThan(1);
    // cudze zapytanie jest niewidoczne
    expect(await stanZapytania({ baza, kontoId: a.kontoId, zapytanieId: w.zapytanie.id, teraz: po(2) })).toBeNull();

    const przyjecie = await przyjmijOferte({ baza, kontoId: kl, ofertaId: stan.oferty[1].id, teraz: po(3) });
    expect(przyjecie).toMatchObject({ ok: true, wizyta: { status: "potwierdzona", cenaGr: 13000, telefon: "+48600100200", uslugaKod: "manicure_hybrydowy" } });
    // druga oferta już nie przejdzie
    expect(await przyjmijOferte({ baza, kontoId: kl, ofertaId: stan.oferty[0].id, teraz: po(3) })).toEqual({ ok: false, blad: "nieaktualna" });
    const po_rezerwacji = (await stanZapytania({ baza, kontoId: kl, zapytanieId: w.zapytanie.id, teraz: po(3) }))!;
    expect(po_rezerwacji).toMatchObject({ status: "zarezerwowane", oferty: [], rezerwacjaId: expect.any(String) });

    // salon widzi wizytę z numerem klientki; skrzynka salonu B pokazuje, że oferta wygasła
    const wizyty = (await wizytySalonu({ baza, kontoId: a.kontoId, teraz: po(3) }))!;
    expect(wizyty.find((x) => x.id === po_rezerwacji.rezerwacjaId)).toMatchObject({ status: "potwierdzona", telefonKlientki: expect.stringMatching(/^\+48511/) });
    const [wlasna] = await wizytyKlientki({ baza, kontoId: kl, teraz: po(3) });
    expect(wlasna.id).toBe(po_rezerwacji.rezerwacjaId);
  });

  it("ten sam termin salonu nie może trafić do dwóch klientek", async () => {
    const [, , c] = salony;
    const [k1, k2] = [await konto("klientka"), await konto("klientka")];
    const z1 = await wyslijZapytanie({ baza, kontoId: k1, dane: zapytanie(), teraz: T });
    const z2 = await wyslijZapytanie({ baza, kontoId: k2, dane: zapytanie(), teraz: T });
    if (!z1.ok || !z2.ok) throw new Error();
    await zlozOferte({ baza, kontoId: c.kontoId, zapytanieId: z1.zapytanie.id, termin: po(240).toISOString(), cenaGr: 12000, teraz: po(4) });
    await zlozOferte({ baza, kontoId: c.kontoId, zapytanieId: z2.zapytanie.id, termin: po(270).toISOString(), cenaGr: 12000, teraz: po(4) });
    const o1 = (await stanZapytania({ baza, kontoId: k1, zapytanieId: z1.zapytanie.id, teraz: po(4) }))!.oferty[0];
    const o2 = (await stanZapytania({ baza, kontoId: k2, zapytanieId: z2.zapytanie.id, teraz: po(4) }))!.oferty[0];
    expect((await przyjmijOferte({ baza, kontoId: k1, ofertaId: o1.id, teraz: po(5) })).ok).toBe(true);
    // oferta na 30 minut później nachodzi na tę wizytę (60 min) — wygasła przy rezerwacji
    expect((await stanZapytania({ baza, kontoId: k2, zapytanieId: z2.zapytanie.id, teraz: po(5) }))!.oferty).toEqual([]);
    expect((await przyjmijOferte({ baza, kontoId: k2, ofertaId: o2.id, teraz: po(5) })).ok).toBe(false);
  });

  it("tryb „biorę pierwszą pasującą”: pierwsza oferta od razu staje się rezerwacją", async () => {
    const kl = await konto("klientka");
    const w = await wyslijZapytanie({ baza, kontoId: kl, dane: zapytanie({ tryb: "pierwsza" }), teraz: T });
    if (!w.ok) throw new Error();
    const [, , , d] = salony;
    expect(await zlozOferte({ baza, kontoId: d.kontoId, zapytanieId: w.zapytanie.id, termin: po(360).toISOString(), cenaGr: 12000, teraz: po(1) })).toEqual({ ok: true, przyjeta: true });
    expect((await stanZapytania({ baza, kontoId: kl, zapytanieId: w.zapytanie.id, teraz: po(1) }))!.status).toBe("zarezerwowane");
  });

  it("„nie mam czasu”, anulowanie i wygaśnięcie; wskaźnik odpowiedzi rośnie za odpowiedź, spada za milczenie", async () => {
    const kl = await konto("klientka");
    const w = await wyslijZapytanie({ baza, kontoId: kl, dane: zapytanie(), teraz: po(10) });
    if (!w.ok) throw new Error();
    const wskaznik = async (kontoId: string) =>
      Number((await baza<{ w: string }>("select wskaznik_odpowiedzi as w from public.salony where wlasciciel_id = $1", [kontoId]))[0].w);
    const [, , , , e, f] = salony;
    const przedE = await wskaznik(e.kontoId);
    const widziF = ((await zapytaniaSalonu({ baza, kontoId: f.kontoId, teraz: po(20) })) ?? []).some((z) => z.id === w.zapytanie.id);
    expect(await odmowZapytania({ baza, kontoId: e.kontoId, zapytanieId: w.zapytanie.id, teraz: po(11) })).toBe(true);
    expect(await wskaznik(e.kontoId)).toBeGreaterThan(przedE);

    const przedF = await wskaznik(f.kontoId);
    await zakonczPrzeterminowane(baza, po(10 + 10 + 16));
    expect((await stanZapytania({ baza, kontoId: kl, zapytanieId: w.zapytanie.id, teraz: po(40) }))!.status).toBe("bez_ofert");
    if (widziF) expect(await wskaznik(f.kontoId)).toBeLessThan(przedF);
    // drugi przebieg niczego nie liczy podwójnie
    const poPierwszym = await wskaznik(f.kontoId);
    await zakonczPrzeterminowane(baza, po(60));
    expect(await wskaznik(f.kontoId)).toBe(poPierwszym);

    const w2 = await wyslijZapytanie({ baza, kontoId: kl, dane: zapytanie(), teraz: po(40) });
    if (!w2.ok) throw new Error();
    expect(await anulujZapytanie({ baza, kontoId: kl, zapytanieId: w2.zapytanie.id })).toBe(true);
    expect(await anulujZapytanie({ baza, kontoId: kl, zapytanieId: w2.zapytanie.id })).toBe(false);
  });

  it("zapytania medyczne: bez zgody nie wychodzą, a opis nie trafia do bazy ani do gabinetu", async () => {
    const gab = await salon(CENTRUM.lat, CENTRUM.lon - 0.003, [{ usluga: "konsultacja_dermatologiczna", cenaGr: 25000, czasMin: 20 }]);
    const kl = await konto("klientka");
    const dane = zapytanie({ uslugaKod: "konsultacja_dermatologiczna", limitGr: null, tresc: "wysypka od tygodnia" });
    expect(await wyslijZapytanie({ baza, kontoId: kl, dane, teraz: T })).toEqual({ ok: false, blad: "brak_zgody" });
    const w = await wyslijZapytanie({ baza, kontoId: kl, dane: { ...dane, zgodaZdrowie: true }, teraz: T });
    if (!w.ok) throw new Error();
    const [z] = await baza<{ tresc: string | null; zgoda: unknown }>("select tresc, zgoda_dane_zdrowotne_at as zgoda from public.zapytania where id = $1", [w.zapytanie.id]);
    expect(z.tresc).toBeNull();
    expect(z.zgoda).not.toBeNull();
    const wSkrzynce = (await zapytaniaSalonu({ baza, kontoId: gab.kontoId, teraz: T }))!.find((x) => x.id === w.zapytanie.id)!;
    expect(wSkrzynce.tresc).toBeNull();
  });

  it("limity: najwyżej 3 otwarte zapytania; blokada po 3 nieobecnościach w roku", async () => {
    const kl = await konto("klientka");
    for (let i = 0; i < 3; i++) expect((await wyslijZapytanie({ baza, kontoId: kl, dane: zapytanie(), teraz: T })).ok).toBe(true);
    expect(await wyslijZapytanie({ baza, kontoId: kl, dane: zapytanie(), teraz: T })).toEqual({ ok: false, blad: "za_duzo_otwartych" });

    const k2 = await konto("klientka");
    const [g] = salony.slice(6);
    for (const dni of [100, 60, 20]) {
      const zz = await wyslijZapytanie({ baza, kontoId: k2, dane: zapytanie(), teraz: T });
      if (!zz.ok) throw new Error(JSON.stringify(zz));
      await zlozOferte({ baza, kontoId: g.kontoId, zapytanieId: zz.zapytanie.id, termin: po(400 - dni).toISOString(), cenaGr: 12000, teraz: po(3) });
      const o = (await stanZapytania({ baza, kontoId: k2, zapytanieId: zz.zapytanie.id, teraz: po(3) }))!.oferty[0];
      const p = await przyjmijOferte({ baza, kontoId: k2, ofertaId: o.id, teraz: po(3) });
      if (!p.ok) throw new Error(JSON.stringify(p));
      await baza("update public.rezerwacje set wynik = 'nieobecnosc', termin = $2::timestamptz where id = $1", [p.wizyta.id, new Date(T.getTime() - dni * 86400000).toISOString()]);
    }
    const zablokowana = await wyslijZapytanie({ baza, kontoId: k2, dane: zapytanie(), teraz: T });
    expect(zablokowana).toMatchObject({ ok: false, blad: "zablokowana", doKiedy: new Date(T.getTime() - 20 * 86400000 + 90 * 86400000).toISOString() });
  });

  it("odwołanie wizyty przed terminem i odpowiedź klientki po terminie", async () => {
    const kl = await konto("klientka");
    const [, b] = salony;
    const w = await wyslijZapytanie({ baza, kontoId: kl, dane: zapytanie({ oknoOd: po(24 * 60).toISOString(), oknoDo: po(24 * 60 + 300).toISOString() }), teraz: T });
    if (!w.ok) throw new Error();
    await zlozOferte({ baza, kontoId: b.kontoId, zapytanieId: w.zapytanie.id, termin: po(24 * 60 + 60).toISOString(), cenaGr: 12000, teraz: po(1) });
    const o = (await stanZapytania({ baza, kontoId: kl, zapytanieId: w.zapytanie.id, teraz: po(1) }))!.oferty[0];
    const p = await przyjmijOferte({ baza, kontoId: kl, ofertaId: o.id, teraz: po(2) });
    if (!p.ok) throw new Error();
    expect(await potwierdzWizyte({ baza, kontoId: kl, rezerwacjaId: p.wizyta.id, odpowiedz: "bylam", teraz: po(3) })).toBe(false); // przed terminem nie
    expect(await odwolajWizyte({ baza, kontoId: kl, rezerwacjaId: p.wizyta.id, teraz: po(10) })).toBe(true);
    const [wiz] = await wizytyKlientki({ baza, kontoId: kl, teraz: po(10) });
    expect(wiz.status).toBe("odwolana_przez_klientke");
  });
});

describe("okolica z adresu na mapie", () => {
  it("dzielnica, a bez niej miasto", () => {
    expect(okolica("Jana Henryka Dąbrowskiego 12, Jeżyce, Poznań", "Poznań")).toBe("Jeżyce");
    expect(okolica("Rynek 1, Swarzędz", "Swarzędz")).toBe("Swarzędz");
    expect(okolica(null, "Poznań")).toBe("Poznań");
  });
});

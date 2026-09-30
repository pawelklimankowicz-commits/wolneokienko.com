// API logowania: jedna funkcja Request → Response (standard Fetch), więc ten
// sam kod obsłuży serwer deweloperski Vite (src/serwer/vite-api.ts)
// i Cloudflare Workers / Pages Functions na produkcji.
//
//   POST /api/logowanie/kod      { telefon }                 → wysyła SMS z kodem
//   POST /api/logowanie/sprawdz  { telefon, kod, rola? }     → sesja w ciasteczku
//   GET  /api/ja                                             → zalogowane konto albo null
//   POST /api/wyloguj
//   GET  /api/salon                                          → salon zalogowanego usługodawcy
//   POST /api/salon              { dane, akceptujeRegulamin } → załóż / popraw dane firmy
//   POST /api/salon/cennik       { pozycje }                 → zapisz cały cennik
//   POST /api/salon/przyjmowanie { wlaczone }                → przyjmuję zapytania: tak / nie
//   GET  /api/salon/zapytania                                → zapytania z okolicy (skrzynka salonu)
//   POST /api/salon/zapytania/:id/oferta { termin, cenaGr }  → oferta jednym dotknięciem
//   POST /api/salon/zapytania/:id/odmowa                     → „nie mam czasu”
//   GET  /api/salon/wizyty                                   → nadchodzące wizyty salonu
//   POST /api/zapytania          { NoweZapytanie }           → wyślij zapytanie (rozesłanie falami)
//   GET  /api/zapytania/:id                                  → stan z ofertami na żywo
//   POST /api/zapytania/:id/anuluj
//   POST /api/oferty/:id/przyjmij                            → rezerwacja
//   GET  /api/wizyty                                         → wizyty klientki
//   POST /api/wizyty/:id/odwolaj
//   POST /api/wizyty/:id/potwierdz { odpowiedz }             → po terminie: byłam / nie byłam / salon odwołał
//
// Sesja w ciasteczku HttpOnly (JavaScript strony go nie widzi). Ochrona przed
// CSRF: POST przyjmuje tylko JSON — przeglądarka nie wyśle go z obcej strony
// bez zgody CORS, której nie dajemy — plus SameSite=Lax.

import { WERSJE_DOKUMENTOW } from "../domain/dokumenty";
import type { DaneSalonu, PozycjaCennika } from "../domain/rejestracja-salonu";
import { czas, type Baza } from "./baza";
import type { BramkaSms } from "./bramka-sms";
import type { Geokoder } from "./geokoder";
import { sprawdzKod, wyslijKod, type Rola } from "./kody-sms";
import { mojSalon, ustawPrzyjmowanie, zapiszCennik, zapiszSalon } from "./salony";
import { odmowZapytania, wizytySalonu, zapytaniaSalonu, zlozOferte } from "./skrzynka";
import {
  anulujZapytanie,
  odwolajWizyte,
  potwierdzWizyte,
  przyjmijOferte,
  stanZapytania,
  wizytyKlientki,
  wyslijZapytanie,
  zakonczPrzeterminowane,
} from "./zapytania";
import type { NoweZapytanie } from "../domain/widoki";
import { PARAMETRY_SESJI, sesjaZTokenu, utworzSesje, wyloguj, type SesjaKonta } from "./sesje";

export interface ZaleznosciApi {
  baza: Baza;
  sms: BramkaSms;
  geokoder: Geokoder;
  /** KODY_SMS_PIEPRZ */
  pieprz: string;
  /** false tylko lokalnie po http:// — przeglądarka nie zapisze ciasteczka Secure bez HTTPS */
  bezpieczneCiasteczka: boolean;
  teraz?: () => Date;
}

export const CIASTECZKO_SESJI = "wo_sesja";
const MAKS_CIALO = 32 * 1024;
/** Role, które można założyć samemu. Operatora nadajemy ręcznie w bazie. */
const ROLE_Z_APLIKACJI: Rola[] = ["klientka", "salon"];

const json = (status: number, cialo: unknown, naglowki: Record<string, string> = {}) =>
  new Response(JSON.stringify(cialo), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...naglowki },
  });

function tokenZZadania(zadanie: Request): string | null {
  const naglowek = zadanie.headers.get("Authorization");
  if (naglowek?.startsWith("Bearer ")) return naglowek.slice(7).trim();
  for (const czesc of (zadanie.headers.get("Cookie") ?? "").split(";")) {
    const [nazwa, ...reszta] = czesc.trim().split("=");
    if (nazwa === CIASTECZKO_SESJI) return reszta.join("=") || null;
  }
  return null;
}

async function cialoJson(zadanie: Request): Promise<Record<string, unknown> | null> {
  const tekst = await zadanie.text();
  if (tekst.length > MAKS_CIALO) return null;
  try {
    const wartosc: unknown = JSON.parse(tekst);
    return wartosc && typeof wartosc === "object" && !Array.isArray(wartosc) ? (wartosc as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

const napis = (x: unknown) => (typeof x === "string" ? x : "");
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
/** Dopasowanie ścieżki z identyfikatorem, np. `trasa(pathname, "/api/zapytania/:id/anuluj")` → id albo null. */
function trasa(pathname: string, wzor: string): string | null {
  const m = pathname.match(new RegExp(`^${wzor.replace(":id", `(${UUID})`)}$`));
  return m ? m[1] : null;
}

function noweZapytanie(x: Record<string, unknown>): NoweZapytanie {
  const liczbaLubNull = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    uslugaKod: napis(x.uslugaKod),
    oknoOd: napis(x.oknoOd),
    oknoDo: napis(x.oknoDo),
    lat: typeof x.lat === "number" ? x.lat : NaN,
    lon: typeof x.lon === "number" ? x.lon : NaN,
    limitGr: liczbaLubNull(x.limitGr),
    tryb: x.tryb === "pierwsza" ? "pierwsza" : "zbieram",
    liczbaOsob: liczbaLubNull(x.liczbaOsob),
    tresc: napis(x.tresc),
    zgodaZdrowie: x.zgodaZdrowie === true,
  };
}
const liczba = (x: unknown) => (typeof x === "number" ? x : NaN);

function daneSalonu(x: unknown): DaneSalonu {
  const o = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    nazwa: napis(o.nazwa),
    nip: napis(o.nip),
    ulica: napis(o.ulica),
    kodPocztowy: napis(o.kodPocztowy),
    miasto: napis(o.miasto),
    branza: napis(o.branza) as DaneSalonu["branza"],
    telefon: napis(o.telefon),
    email: napis(o.email),
    ...(typeof o.numerRejestru === "string" ? { numerRejestru: o.numerRejestru } : {}),
  };
}

function pozycjeCennika(x: unknown): PozycjaCennika[] | null {
  if (!Array.isArray(x) || x.length > 200) return null;
  return x.map((p) => {
    const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
    return {
      usluga: napis(o.usluga),
      cenaGr: liczba(o.cenaGr),
      czasMin: liczba(o.czasMin),
      ...(o.wykonujeLekarz === true ? { wykonujeLekarz: true } : {}),
      ...(typeof o.deklaracja === "string" ? { deklaracja: o.deklaracja } : {}),
    };
  });
}

export function utworzApi(z: ZaleznosciApi) {
  const teraz = () => z.teraz?.() ?? new Date();

  const ciasteczko = (token: string, maxAgeSek: number) =>
    [`${CIASTECZKO_SESJI}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSek}`, ...(z.bezpieczneCiasteczka ? ["Secure"] : [])].join(
      "; ",
    );
  const maxAgeSesji = PARAMETRY_SESJI.waznoscDni * 24 * 60 * 60;

  async function zalogowany(zadanie: Request): Promise<SesjaKonta | null> {
    const token = tokenZZadania(zadanie);
    return token ? sesjaZTokenu({ baza: z.baza, token, teraz: teraz() }) : null;
  }

  /** `ip` podaje adapter: na Cloudflare nagłówek CF-Connecting-IP, lokalnie adres gniazda. */
  return async function obsluz(zadanie: Request, ip?: string | null): Promise<Response> {
    const { pathname } = new URL(zadanie.url);
    const metoda = zadanie.method.toUpperCase();

    if (metoda === "POST" && !(zadanie.headers.get("Content-Type") ?? "").startsWith("application/json")) {
      return json(415, { blad: "zly_format" });
    }

    if (pathname === "/api/logowanie/kod" && metoda === "POST") {
      const cialo = await cialoJson(zadanie);
      if (!cialo) return json(400, { blad: "zly_format" });
      const w = await wyslijKod({ baza: z.baza, sms: z.sms, pieprz: z.pieprz, telefon: napis(cialo.telefon), ip, teraz: teraz() });
      if (w.ok) return json(200, { telefon: w.telefon, wygasaAt: w.wygasaAt.toISOString() });
      if (w.powod === "zly_numer") return json(400, { blad: w.powod });
      if (w.powod === "za_czesto") return json(429, { blad: w.powod, ponowZaSek: w.ponowZaSek }, { "Retry-After": String(w.ponowZaSek) });
      if (w.powod === "przeciazenie") return json(503, { blad: w.powod });
      return json(502, { blad: w.powod });
    }

    if (pathname === "/api/logowanie/sprawdz" && metoda === "POST") {
      const cialo = await cialoJson(zadanie);
      if (!cialo) return json(400, { blad: "zly_format" });
      const rola = (cialo.rola ?? "klientka") as Rola;
      if (!ROLE_Z_APLIKACJI.includes(rola)) return json(400, { blad: "zla_rola" });
      if (cialo.akceptujeRegulamin !== true) return json(400, { blad: "brak_akceptacji" });
      const s = await sprawdzKod({ baza: z.baza, pieprz: z.pieprz, telefon: napis(cialo.telefon), kod: napis(cialo.kod), rola, teraz: teraz() });
      if (!s.ok) {
        const pozostalo = s.powod === "zly_kod" ? { pozostaloProb: s.pozostaloProb } : {};
        return json(s.powod === "za_duzo_prob" ? 429 : 400, { blad: s.powod, ...pozostalo });
      }
      // logowanie = akceptacja regulaminu i polityki prywatności w bieżącej wersji
      await z.baza(
        "update public.konta set regulamin_wersja = $2, regulamin_zaakceptowany_at = $3::timestamptz where id = $1 and regulamin_wersja is distinct from $2",
        [s.kontoId, WERSJE_DOKUMENTOW.regulaminKlientki, czas(teraz())],
      );
      const { token } = await utworzSesje({ baza: z.baza, kontoId: s.kontoId, teraz: teraz() });
      return json(200, { konto: { id: s.kontoId, rola: s.rola, telefon: s.telefon }, nowe: s.nowe }, { "Set-Cookie": ciasteczko(token, maxAgeSesji) });
    }

    if (pathname === "/api/ja" && metoda === "GET") {
      const token = tokenZZadania(zadanie);
      const sesja = token ? await sesjaZTokenu({ baza: z.baza, token, teraz: teraz() }) : null;
      if (!sesja) return json(200, { konto: null }, token ? { "Set-Cookie": ciasteczko("", 0) } : {});
      // sesja w bazie właśnie się przedłużyła — ciasteczko też
      return json(200, { konto: { id: sesja.kontoId, rola: sesja.rola, telefon: sesja.telefon } }, { "Set-Cookie": ciasteczko(token!, maxAgeSesji) });
    }

    if (pathname === "/api/wyloguj" && metoda === "POST") {
      const token = tokenZZadania(zadanie);
      if (token) await wyloguj({ baza: z.baza, token, teraz: teraz() });
      return json(200, { ok: true }, { "Set-Cookie": ciasteczko("", 0) });
    }

    if (pathname === "/api/salon" || pathname.startsWith("/api/salon/")) {
      const sesja = await zalogowany(zadanie);
      if (!sesja) return json(401, { blad: "niezalogowany" });
      const kontoId = sesja.kontoId;

      if (pathname === "/api/salon" && metoda === "GET") return json(200, { salon: await mojSalon(z.baza, kontoId) });

      const cialo = metoda === "POST" ? await cialoJson(zadanie) : null;
      if (metoda === "POST" && !cialo) return json(400, { blad: "zly_format" });

      if (pathname === "/api/salon" && cialo) {
        const w = await zapiszSalon({
          baza: z.baza,
          geokoder: z.geokoder,
          kontoId,
          dane: daneSalonu(cialo.dane),
          akceptujeRegulamin: cialo.akceptujeRegulamin === true,
          teraz: teraz(),
        });
        if (w.ok) return json(200, { salon: w.salon });
        return json(w.blad === "nip_zajety" ? 409 : 400, w.blad === "zle_dane" ? { blad: w.blad, pola: w.pola } : { blad: w.blad });
      }
      if (pathname === "/api/salon/cennik" && cialo) {
        const pozycje = pozycjeCennika(cialo.pozycje);
        if (!pozycje) return json(400, { blad: "zly_format" });
        const w = await zapiszCennik({ baza: z.baza, kontoId, pozycje });
        if (w.ok) return json(200, { salon: w.salon });
        return json(w.blad === "brak_salonu" ? 404 : 400, w.blad === "zle_dane" ? { blad: w.blad, cennik: w.cennik } : { blad: w.blad });
      }
      if (pathname === "/api/salon/zapytania" && metoda === "GET") {
        await zakonczPrzeterminowane(z.baza, teraz());
        const lista = await zapytaniaSalonu({ baza: z.baza, kontoId, teraz: teraz() });
        return lista ? json(200, { zapytania: lista }) : json(404, { blad: "brak_salonu" });
      }
      if (pathname === "/api/salon/wizyty" && metoda === "GET") {
        const lista = await wizytySalonu({ baza: z.baza, kontoId, teraz: teraz() });
        return lista ? json(200, { wizyty: lista }) : json(404, { blad: "brak_salonu" });
      }
      const doOferty = trasa(pathname, "/api/salon/zapytania/:id/oferta");
      if (doOferty && cialo) {
        const w = await zlozOferte({ baza: z.baza, kontoId, zapytanieId: doOferty, termin: napis(cialo.termin), cenaGr: liczba(cialo.cenaGr), teraz: teraz() });
        return w.ok ? json(200, w) : json(w.blad === "nieaktualne" || w.blad === "brak_salonu" ? 409 : 400, { blad: w.blad });
      }
      const doOdmowy = trasa(pathname, "/api/salon/zapytania/:id/odmowa");
      if (doOdmowy && cialo) {
        return (await odmowZapytania({ baza: z.baza, kontoId, zapytanieId: doOdmowy, teraz: teraz() })) ? json(200, { ok: true }) : json(409, { blad: "nieaktualne" });
      }
      if (pathname === "/api/salon/przyjmowanie" && cialo) {
        const w = await ustawPrzyjmowanie({ baza: z.baza, kontoId, wlaczone: cialo.wlaczone === true, teraz: teraz() });
        if (w.ok) return json(200, { salon: w.salon });
        return json(w.blad === "brak_salonu" ? 404 : 409, { blad: w.blad });
      }
    }

    // ── Zapytania, oferty i wizyty klientki ──
    if (pathname === "/api/zapytania" || pathname.startsWith("/api/zapytania/") || pathname.startsWith("/api/oferty/") || pathname === "/api/wizyty" || pathname.startsWith("/api/wizyty/")) {
      const sesja = await zalogowany(zadanie);
      if (!sesja) return json(401, { blad: "niezalogowany" });
      const kontoId = sesja.kontoId;
      const cialo = metoda === "POST" ? await cialoJson(zadanie) : null;
      if (metoda === "POST" && !cialo) return json(400, { blad: "zly_format" });

      if (pathname === "/api/zapytania" && cialo) {
        await zakonczPrzeterminowane(z.baza, teraz());
        const w = await wyslijZapytanie({ baza: z.baza, kontoId, dane: noweZapytanie(cialo), teraz: teraz() });
        if (w.ok) return json(200, { zapytanie: w.zapytanie });
        return json(w.blad === "zle_dane" || w.blad === "brak_zgody" ? 400 : 429, w);
      }
      const stanId = trasa(pathname, "/api/zapytania/:id");
      if (stanId && metoda === "GET") {
        await zakonczPrzeterminowane(z.baza, teraz());
        const stan = await stanZapytania({ baza: z.baza, kontoId, zapytanieId: stanId, teraz: teraz() });
        return stan ? json(200, { zapytanie: stan }) : json(404, { blad: "nie_ma" });
      }
      const anulujId = trasa(pathname, "/api/zapytania/:id/anuluj");
      if (anulujId && cialo) {
        return (await anulujZapytanie({ baza: z.baza, kontoId, zapytanieId: anulujId })) ? json(200, { ok: true }) : json(409, { blad: "nieaktualne" });
      }
      const ofertaId = trasa(pathname, "/api/oferty/:id/przyjmij");
      if (ofertaId && cialo) {
        const w = await przyjmijOferte({ baza: z.baza, kontoId, ofertaId, teraz: teraz() });
        return w.ok ? json(200, { wizyta: w.wizyta }) : json(409, { blad: w.blad });
      }
      if (pathname === "/api/wizyty" && metoda === "GET") return json(200, { wizyty: await wizytyKlientki({ baza: z.baza, kontoId, teraz: teraz() }) });
      const odwolajId = trasa(pathname, "/api/wizyty/:id/odwolaj");
      if (odwolajId && cialo) {
        return (await odwolajWizyte({ baza: z.baza, kontoId, rezerwacjaId: odwolajId, teraz: teraz() })) ? json(200, { ok: true }) : json(409, { blad: "nieaktualne" });
      }
      const potwierdzId = trasa(pathname, "/api/wizyty/:id/potwierdz");
      if (potwierdzId && cialo) {
        const odp = cialo.odpowiedz;
        if (odp !== "bylam" && odp !== "nie_bylam" && odp !== "salon_odwolal") return json(400, { blad: "zly_format" });
        const ok = await potwierdzWizyte({ baza: z.baza, kontoId, rezerwacjaId: potwierdzId, odpowiedz: odp, teraz: teraz() });
        return ok ? json(200, { ok: true }) : json(409, { blad: "nieaktualne" });
      }
    }

    return json(404, { blad: "nie_ma" });
  };
}

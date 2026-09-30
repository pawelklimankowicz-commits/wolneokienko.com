// API logowania: jedna funkcja Request → Response (standard Fetch), więc ten
// sam kod obsłuży serwer deweloperski Vite (src/serwer/vite-api.ts)
// i Cloudflare Workers / Pages Functions na produkcji.
//
//   POST /api/logowanie/kod      { telefon }                 → wysyła SMS z kodem
//   POST /api/logowanie/sprawdz  { telefon, kod, rola? }     → sesja w ciasteczku
//   GET  /api/ja                                             → zalogowane konto albo null
//   POST /api/wyloguj
//
// Sesja w ciasteczku HttpOnly (JavaScript strony go nie widzi). Ochrona przed
// CSRF: POST przyjmuje tylko JSON — przeglądarka nie wyśle go z obcej strony
// bez zgody CORS, której nie dajemy — plus SameSite=Lax.

import type { Baza } from "./baza";
import type { BramkaSms } from "./bramka-sms";
import { sprawdzKod, wyslijKod, type Rola } from "./kody-sms";
import { PARAMETRY_SESJI, sesjaZTokenu, utworzSesje, wyloguj } from "./sesje";

export interface ZaleznosciApi {
  baza: Baza;
  sms: BramkaSms;
  /** KODY_SMS_PIEPRZ */
  pieprz: string;
  /** false tylko lokalnie po http:// — przeglądarka nie zapisze ciasteczka Secure bez HTTPS */
  bezpieczneCiasteczka: boolean;
  teraz?: () => Date;
}

export const CIASTECZKO_SESJI = "wo_sesja";
const MAKS_CIALO = 2048;
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

export function utworzApi(z: ZaleznosciApi) {
  const teraz = () => z.teraz?.() ?? new Date();

  const ciasteczko = (token: string, maxAgeSek: number) =>
    [`${CIASTECZKO_SESJI}=${token}`, "Path=/", "HttpOnly", "SameSite=Lax", `Max-Age=${maxAgeSek}`, ...(z.bezpieczneCiasteczka ? ["Secure"] : [])].join(
      "; ",
    );
  const maxAgeSesji = PARAMETRY_SESJI.waznoscDni * 24 * 60 * 60;

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
      const s = await sprawdzKod({ baza: z.baza, pieprz: z.pieprz, telefon: napis(cialo.telefon), kod: napis(cialo.kod), rola, teraz: teraz() });
      if (!s.ok) {
        const pozostalo = s.powod === "zly_kod" ? { pozostaloProb: s.pozostaloProb } : {};
        return json(s.powod === "za_duzo_prob" ? 429 : 400, { blad: s.powod, ...pozostalo });
      }
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

    return json(404, { blad: "nie_ma" });
  };
}

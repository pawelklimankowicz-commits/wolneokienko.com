// Klient API logowania dla aplikacji. Dwie wersje:
//  - http    — prawdziwe API (/api/…, src/serwer/api.ts), sesja w ciasteczku;
//  - podgląd — w pamięci przeglądarki, bez SMS-ów (kod 123456); budowana przez
//              `npm run build:podglad` do podglądu aplikacji bez serwera.
import { odmiana } from "./format";

export type Rola = "klientka" | "salon" | "operator";

export interface Konto {
  id: string;
  rola: Rola;
  telefon: string;
}

export type Wynik<T> =
  | ({ ok: true } & T)
  | {
      ok: false;
      komunikat: string;
      /** ile sekund do możliwego ponownego wysłania kodu */
      ponowZaSek?: number;
      /** ten kod już nie przejdzie — trzeba zamówić nowy */
      nowyKod?: boolean;
    };

export interface KlientApi {
  podglad: boolean;
  ja(): Promise<Konto | null>;
  wyslijKod(telefon: string): Promise<Wynik<{ telefon: string }>>;
  zaloguj(telefon: string, kod: string): Promise<Wynik<{ konto: Konto }>>;
  wyloguj(): Promise<void>;
}

interface BladApi {
  blad?: string;
  ponowZaSek?: number;
  pozostaloProb?: number;
}

/** 20 → „20 s”, 840 → „14 min”. */
export const czasCzekania = (sek: number) => (sek < 60 ? `${sek} s` : `${Math.ceil(sek / 60)} min`);

export function komunikatBledu(b: BladApi): { komunikat: string; nowyKod?: boolean; ponowZaSek?: number } {
  switch (b.blad) {
    case "zly_numer":
      return { komunikat: "To nie wygląda na polski numer komórki. Wpisz 9 cyfr, np. 600 123 123." };
    case "za_czesto":
      return { komunikat: `Kod już wysłaliśmy. Kolejny możesz zamówić za ${czasCzekania(b.ponowZaSek ?? 30)}.`, ponowZaSek: b.ponowZaSek };
    case "przeciazenie":
      return { komunikat: "Mamy teraz bardzo dużo logowań. Spróbuj za kilka minut." };
    case "blad_bramki":
      return { komunikat: "Nie udało się wysłać SMS-a. Spróbuj za chwilę." };
    case "zly_kod": {
      const n = b.pozostaloProb ?? 0;
      if (n === 0) return { komunikat: "Nieprawidłowy kod. To była ostatnia próba — zamów nowy kod.", nowyKod: true };
      return { komunikat: `Nieprawidłowy kod. ${odmiana(n, "Została", "Zostały", "Zostało")} ${n} ${odmiana(n, "próba", "próby", "prób")}.` };
    }
    case "wygasl":
      return { komunikat: "Kod wygasł. Zamów nowy.", nowyKod: true };
    case "za_duzo_prob":
      return { komunikat: "Za dużo prób. Zamów nowy kod.", nowyKod: true };
    case "brak_kodu":
      return { komunikat: "Ten kod jest już nieważny. Zamów nowy.", nowyKod: true };
    default:
      return { komunikat: "Coś poszło nie tak. Spróbuj ponownie." };
  }
}

const BRAK_SIECI = { ok: false as const, komunikat: "Brak połączenia z internetem. Spróbuj ponownie." };

async function zadanie(sciezka: string, cialo?: unknown): Promise<{ status: number; dane: Record<string, unknown> } | null> {
  try {
    const r = await fetch(sciezka, {
      method: cialo === undefined ? "GET" : "POST",
      credentials: "same-origin",
      headers: cialo === undefined ? {} : { "Content-Type": "application/json" },
      body: cialo === undefined ? undefined : JSON.stringify(cialo),
    });
    const dane = await r.json().catch(() => ({}));
    return { status: r.status, dane };
  } catch {
    return null;
  }
}

export function apiHttp(): KlientApi {
  return {
    podglad: false,
    async ja() {
      const r = await zadanie("/api/ja");
      return r?.status === 200 ? ((r.dane.konto as Konto | null) ?? null) : null;
    },
    async wyslijKod(telefon) {
      const r = await zadanie("/api/logowanie/kod", { telefon });
      if (!r) return BRAK_SIECI;
      return r.status === 200 ? { ok: true, telefon: String(r.dane.telefon) } : { ok: false, ...komunikatBledu(r.dane) };
    },
    async zaloguj(telefon, kod) {
      const r = await zadanie("/api/logowanie/sprawdz", { telefon, kod });
      if (!r) return BRAK_SIECI;
      return r.status === 200 ? { ok: true, konto: r.dane.konto as Konto } : { ok: false, ...komunikatBledu(r.dane) };
    },
    async wyloguj() {
      await zadanie("/api/wyloguj", {});
    },
  };
}

/** Podgląd bez serwera: to samo zachowanie ekranu, kod zawsze 123456. */
export function apiPodglad(): KlientApi {
  const KOD = "123456";
  const chwila = () => new Promise((r) => setTimeout(r, 450));
  let konto: Konto | null = null;
  let proby = 5;
  return {
    podglad: true,
    async ja() {
      return konto;
    },
    async wyslijKod(telefon) {
      await chwila();
      const cyfry = telefon.replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
      if (!/^[1-9]\d{8}$/.test(cyfry)) return { ok: false, ...komunikatBledu({ blad: "zly_numer" }) };
      proby = 5;
      return { ok: true, telefon: `+48${cyfry}` };
    },
    async zaloguj(telefon, kod) {
      await chwila();
      if (kod !== KOD) return { ok: false, ...komunikatBledu(--proby > 0 ? { blad: "zly_kod", pozostaloProb: proby } : { blad: "za_duzo_prob" }) };
      konto = { id: "podglad", rola: "klientka", telefon };
      return { ok: true, konto };
    },
    async wyloguj() {
      konto = null;
    },
  };
}

export const api: KlientApi = import.meta.env.MODE === "podglad" ? apiPodglad() : apiHttp();

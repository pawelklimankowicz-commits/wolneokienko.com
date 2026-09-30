// Klient API logowania dla aplikacji. Dwie wersje:
//  - http    — prawdziwe API (/api/…, src/serwer/api.ts), sesja w ciasteczku;
//  - podgląd — w pamięci przeglądarki, bez SMS-ów (kod 123456); budowana przez
//              `npm run build:podglad` do podglądu aplikacji bez serwera.
import type { BledyCennika, BledyDanych, DaneSalonu, PozycjaCennika, SalonKonta } from "../domain/rejestracja-salonu";
import { bezBledow, oczyscDane, walidujCennik, walidujDaneSalonu } from "../domain/rejestracja-salonu";
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
      /** błędy pól formularza firmy */
      pola?: BledyDanych;
      /** błędy cennika */
      cennik?: BledyCennika;
    };

export interface KlientApi {
  podglad: boolean;
  ja(): Promise<Konto | null>;
  wyslijKod(telefon: string): Promise<Wynik<{ telefon: string }>>;
  /** logowanie = akceptacja regulaminu i polityki prywatności (tekst przy przycisku) */
  zaloguj(telefon: string, kod: string, rola?: "klientka" | "salon"): Promise<Wynik<{ konto: Konto }>>;
  wyloguj(): Promise<void>;
  mojSalon(): Promise<SalonKonta | null>;
  zapiszSalon(dane: DaneSalonu, akceptujeRegulamin: boolean): Promise<Wynik<{ salon: SalonKonta }>>;
  zapiszCennik(pozycje: PozycjaCennika[]): Promise<Wynik<{ salon: SalonKonta }>>;
  ustawPrzyjmowanie(wlaczone: boolean): Promise<Wynik<{ salon: SalonKonta }>>;
}

interface BladApi {
  blad?: string;
  ponowZaSek?: number;
  pozostaloProb?: number;
  pola?: BledyDanych;
  cennik?: BledyCennika;
}

/** 20 → „20 s”, 840 → „14 min”. */
export const czasCzekania = (sek: number) => (sek < 60 ? `${sek} s` : `${Math.ceil(sek / 60)} min`);

export function komunikatBledu(b: BladApi): { komunikat: string; nowyKod?: boolean; ponowZaSek?: number; pola?: BledyDanych; cennik?: BledyCennika } {
  switch (b.blad) {
    case "zle_dane":
      return { komunikat: b.cennik?.ogolny ?? "Popraw zaznaczone pola.", pola: b.pola, cennik: b.cennik };
    case "brak_akceptacji":
      return { komunikat: "Zaakceptuj regulamin, żeby przejść dalej." };
    case "nip_zajety":
      return { komunikat: "Firma z tym NIP-em jest już zarejestrowana. Jeśli to Twoja firma, napisz do nas — pomożemy odzyskać dostęp." };
    case "adres_nieznaleziony":
      return { komunikat: "Nie znaleźliśmy tego adresu na mapie. Sprawdź ulicę, numer i miejscowość.", pola: { ulica: "Nie znaleźliśmy tego adresu na mapie." } };
    case "brak_cennika":
      return { komunikat: "Najpierw dodaj cennik — bez niego nie dopasujemy zapytań." };
    case "wstrzymany":
      return { komunikat: "Przyjmowanie zapytań jest wstrzymane. Napisz do nas, wyjaśnimy dlaczego." };
    case "brak_salonu":
      return { komunikat: "Najpierw podaj dane firmy." };
    case "niezalogowany":
      return { komunikat: "Sesja wygasła. Zaloguj się ponownie." };
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
    async zaloguj(telefon, kod, rola = "klientka") {
      const r = await zadanie("/api/logowanie/sprawdz", { telefon, kod, rola, akceptujeRegulamin: true });
      if (!r) return BRAK_SIECI;
      return r.status === 200 ? { ok: true, konto: r.dane.konto as Konto } : { ok: false, ...komunikatBledu(r.dane) };
    },
    async wyloguj() {
      await zadanie("/api/wyloguj", {});
    },
    async mojSalon() {
      const r = await zadanie("/api/salon");
      return r?.status === 200 ? ((r.dane.salon as SalonKonta | null) ?? null) : null;
    },
    zapiszSalon: (dane, akceptujeRegulamin) => zapisSalonu("/api/salon", { dane, akceptujeRegulamin }),
    zapiszCennik: (pozycje) => zapisSalonu("/api/salon/cennik", { pozycje }),
    ustawPrzyjmowanie: (wlaczone) => zapisSalonu("/api/salon/przyjmowanie", { wlaczone }),
  };
}

async function zapisSalonu(sciezka: string, cialo: unknown): Promise<Wynik<{ salon: SalonKonta }>> {
  const r = await zadanie(sciezka, cialo);
  if (!r) return BRAK_SIECI;
  return r.status === 200 ? { ok: true, salon: r.dane.salon as SalonKonta } : { ok: false, ...komunikatBledu(r.dane) };
}

/**
 * Podgląd bez serwera: to samo zachowanie ekranów, kod zawsze 123456.
 * Dane firmy i cennik sprawdzają te same reguły co serwer; adres „znajduje się” zawsze.
 */
export function apiPodglad(): KlientApi {
  const KOD = "123456";
  const chwila = () => new Promise((r) => setTimeout(r, 450));
  let konto: Konto | null = null;
  let salon: SalonKonta | null = null;
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
    async zaloguj(telefon, kod, rola = "klientka") {
      await chwila();
      if (kod !== KOD) return { ok: false, ...komunikatBledu(--proby > 0 ? { blad: "zly_kod", pozostaloProb: proby } : { blad: "za_duzo_prob" }) };
      konto = { id: "podglad", rola, telefon };
      return { ok: true, konto };
    },
    async wyloguj() {
      konto = null;
      salon = null;
    },
    async mojSalon() {
      return salon;
    },
    async zapiszSalon(dane, akceptujeRegulamin) {
      await chwila();
      const pola = walidujDaneSalonu(dane);
      if (!bezBledow(pola)) return { ok: false, ...komunikatBledu({ blad: "zle_dane", pola }) };
      if (!salon && !akceptujeRegulamin) return { ok: false, ...komunikatBledu({ blad: "brak_akceptacji" }) };
      const d = oczyscDane(dane);
      salon = {
        id: "podglad",
        przyjmujeZapytania: false,
        aktywowanyAt: null,
        wstrzymany: false,
        wizytyZrealizowane: 0,
        cennik: [],
        ...salon,
        ...d,
        adresZMapy: `${d.ulica}, ${d.miasto}`,
      };
      if (konto) konto = { ...konto, rola: "salon" };
      return { ok: true, salon };
    },
    async zapiszCennik(pozycje) {
      await chwila();
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      const cennik = walidujCennik(salon.branza, pozycje);
      if (!bezBledow(cennik)) return { ok: false, ...komunikatBledu({ blad: "zle_dane", cennik }) };
      salon = { ...salon, cennik: [...pozycje].sort((a, b) => a.usluga.localeCompare(b.usluga)) };
      return { ok: true, salon };
    },
    async ustawPrzyjmowanie(wlaczone) {
      await chwila();
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      if (wlaczone && !salon.cennik.length) return { ok: false, ...komunikatBledu({ blad: "brak_cennika" }) };
      salon = { ...salon, przyjmujeZapytania: wlaczone, aktywowanyAt: salon.aktywowanyAt ?? (wlaczone ? new Date().toISOString() : null) };
      return { ok: true, salon };
    },
  };
}

export const api: KlientApi = import.meta.env.MODE === "podglad" ? apiPodglad() : apiHttp();

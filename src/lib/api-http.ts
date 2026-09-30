// Prawdziwe API (/api/…, src/serwer/api.ts), sesja w ciasteczku HttpOnly.
import type { SalonKonta } from "../domain/rejestracja-salonu";
import type { StanZapytania, WizytaSalonu, WizytaWidok, ZapytanieDlaSalonu } from "../domain/widoki";
import { BRAK_SIECI, komunikatBledu, type KlientApi, type Konto, type Wynik } from "./api-typy";

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

/** POST, który zwraca `klucz` z odpowiedzi albo komunikat błędu. */
async function wynik<K extends string, T>(sciezka: string, cialo: unknown, klucz: K): Promise<Wynik<Record<K, T>>> {
  const r = await zadanie(sciezka, cialo);
  if (!r) return BRAK_SIECI;
  if (r.status !== 200) return { ok: false, ...komunikatBledu(r.dane) };
  return { ok: true, [klucz]: r.dane[klucz] } as { ok: true } & Record<K, T>;
}

async function bezDanych(sciezka: string, cialo: unknown = {}): Promise<Wynik<object>> {
  const r = await zadanie(sciezka, cialo);
  if (!r) return BRAK_SIECI;
  return r.status === 200 ? { ok: true } : { ok: false, ...komunikatBledu(r.dane) };
}

async function lista<T>(sciezka: string, klucz: string): Promise<T[]> {
  const r = await zadanie(sciezka);
  return r?.status === 200 ? ((r.dane[klucz] as T[]) ?? []) : [];
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
    zaloguj: (telefon, kod, rola = "klientka") => wynik<"konto", Konto>("/api/logowanie/sprawdz", { telefon, kod, rola, akceptujeRegulamin: true }, "konto"),
    async wyloguj() {
      await zadanie("/api/wyloguj", {});
    },
    async mojSalon() {
      const r = await zadanie("/api/salon");
      return r?.status === 200 ? ((r.dane.salon as SalonKonta | null) ?? null) : null;
    },
    zapiszSalon: (dane, akceptujeRegulamin) => wynik<"salon", SalonKonta>("/api/salon", { dane, akceptujeRegulamin }, "salon"),
    zapiszCennik: (pozycje) => wynik<"salon", SalonKonta>("/api/salon/cennik", { pozycje }, "salon"),
    ustawPrzyjmowanie: (wlaczone) => wynik<"salon", SalonKonta>("/api/salon/przyjmowanie", { wlaczone }, "salon"),

    wyslijZapytanie: (dane) => wynik<"zapytanie", StanZapytania>("/api/zapytania", dane, "zapytanie"),
    async stanZapytania(id) {
      const r = await zadanie(`/api/zapytania/${id}`);
      return r?.status === 200 ? (r.dane.zapytanie as StanZapytania) : null;
    },
    async anulujZapytanie(id) {
      await zadanie(`/api/zapytania/${id}/anuluj`, {});
    },
    przyjmijOferte: (ofertaId) => wynik<"wizyta", WizytaWidok>(`/api/oferty/${ofertaId}/przyjmij`, {}, "wizyta"),
    mojeWizyty: () => lista<WizytaWidok>("/api/wizyty", "wizyty"),
    odwolajWizyte: (id) => bezDanych(`/api/wizyty/${id}/odwolaj`),
    potwierdzWizyte: (id, odpowiedz) => bezDanych(`/api/wizyty/${id}/potwierdz`, { odpowiedz }),

    skrzynkaSalonu: () => lista<ZapytanieDlaSalonu>("/api/salon/zapytania", "zapytania"),
    async zlozOferte(zapytanieId, termin, cenaGr) {
      const r = await zadanie(`/api/salon/zapytania/${zapytanieId}/oferta`, { termin, cenaGr });
      if (!r) return BRAK_SIECI;
      return r.status === 200 ? { ok: true, przyjeta: r.dane.przyjeta === true } : { ok: false, ...komunikatBledu(r.dane) };
    },
    odmowZapytania: (zapytanieId) => bezDanych(`/api/salon/zapytania/${zapytanieId}/odmowa`),
    wizytySalonu: () => lista<WizytaSalonu>("/api/salon/wizyty", "wizyty"),
  };
}

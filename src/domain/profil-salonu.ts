// Profil usługodawcy widoczny dla klientek: opis, logo, zdjęcia, pracownicy.
// Te same reguły sprawdza aplikacja (formularz) i serwer (src/serwer/profil.ts).

import { uslugiBranzy, type Branza } from "./katalog-uslug";

export const LIMITY_PROFILU = {
  maksOpis: 600,
  maksZdjec: 6,
  /** po zmniejszeniu w przeglądarce; w bazie limit 600 000 bajtów */
  maksBajtowZdjecia: 600_000,
  maksPracownikow: 30,
} as const;

export interface Pracownik {
  /** samo imię albo pseudonim — nazwiska nie potrzebujemy */
  imie: string;
  /** kody usług z katalogu, które ta osoba wykonuje */
  uslugi: string[];
}

export interface StanKalendarza {
  /** np. calendar.google.com — sam adres jest tajny i go nie pokazujemy */
  host: string;
  pobranoAt: string | null;
  blad: string | null;
  /** ile zajętych przedziałów w najbliższych dniach */
  zajeteBloki: number;
}

/** Profil salonu, który klientka może obejrzeć przy ofercie. */
export interface ProfilPubliczny {
  id: string;
  nazwa: string;
  opis: string | null;
  adres: string;
  logoUrl: string | null;
  zdjecia: string[];
  pracownicy: string[];
  cennik: { uslugaKod: string; cenaGr: number }[];
}

export const adresZdjecia = (id: string) => `/api/zdjecia/${id}`;

/** Rodzaj obrazu po pierwszych bajtach pliku (nie po rozszerzeniu). SVG celowo nie — może zawierać skrypt. */
export function rodzajObrazu(b: Uint8Array): "image/webp" | "image/jpeg" | "image/png" | null {
  if (b.length > 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return "image/webp";
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  return null;
}

const IMIE = /^[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż][A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż .'-]{1,29}$/;

export function oczyscPracownikow(lista: Pracownik[]): Pracownik[] {
  return lista.map((p) => ({ imie: p.imie.replace(/\s+/g, " ").trim(), uslugi: [...new Set(p.uslugi)].sort() }));
}

/** Błąd listy pracowników albo null. Usługi tylko z branży salonu. */
export function walidujPracownikow(branza: Branza, lista: Pracownik[]): string | null {
  if (lista.length > LIMITY_PROFILU.maksPracownikow) return `Najwyżej ${LIMITY_PROFILU.maksPracownikow} osób.`;
  const dozwolone = new Set(uslugiBranzy(branza).map((u) => u.kod));
  const imiona = new Set<string>();
  for (const p of oczyscPracownikow(lista)) {
    if (!IMIE.test(p.imie)) return `„${p.imie}” — wpisz samo imię albo pseudonim (2–30 liter).`;
    if (imiona.has(p.imie.toLowerCase())) return `Imię „${p.imie}” jest na liście dwa razy — dodaj np. inicjał.`;
    imiona.add(p.imie.toLowerCase());
    if (p.uslugi.some((k) => !dozwolone.has(k))) return `${p.imie}: usługa spoza katalogu Twojej branży.`;
  }
  return null;
}

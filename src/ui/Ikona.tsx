// Ikony liniowe rysowane w SVG (bez zewnętrznej biblioteki). Kolor = currentColor.
import type { SVGProps } from "react";

const SCIEZKI = {
  start: <><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V13h6v9" /></>,
  okienka: <><rect x="3" y="3" width="18" height="18" rx="5" /><path d="M12 3v18M3 12h18" /></>,
  wizyty: <><rect x="3" y="4.5" width="18" height="17" rx="3" /><path d="M16 2.5v4M8 2.5v4M3 10h18" /><path d="M8 14h.01M12 14h.01M16 14h.01M8 17.5h.01M12 17.5h.01" /></>,
  profil: <><circle cx="12" cy="8" r="4" /><path d="M20 21a8 8 0 0 0-16 0" /></>,
  szukaj: <><circle cx="11" cy="11" r="7.5" /><path d="m21 21-4.5-4.5" /></>,
  pinezka: <><path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></>,
  zegar: <><circle cx="12" cy="12" r="9.5" /><path d="M12 6.5V12l3.5 2" /></>,
  gwiazdka: <path d="m12 2.5 2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />,
  iskra: <path d="M12 2.5 13.9 9 20.5 11 13.9 13 12 19.5 10.1 13 3.5 11 10.1 9z" />,
  piorun: <path d="M13 2 3.5 13.5h8L10.5 22 20.5 10h-8z" />,
  wstecz: <><path d="m12 19-7-7 7-7" /><path d="M19 12H5" /></>,
  zamknij: <><path d="M18 6 6 18" /><path d="m6 6 12 12" /></>,
  dalej: <path d="m9 18 6-6-6-6" />,
  w_dol: <path d="m6 9 6 6 6-6" />,
  ok: <path d="M20 6 9 17l-5-5" />,
  filtry: <><path d="M4 7h10M18 7h2M4 17h4M12 17h8" /><circle cx="16" cy="7" r="2" /><circle cx="10" cy="17" r="2" /></>,
  serce: <path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z" />,
  dzwonek: <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a2 2 0 0 0 3.4 0" /></>,
  prezent: <><rect x="3" y="8" width="18" height="4" rx="1" /><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" /><path d="M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5" /></>,
  salon: <><path d="M3 9.5 5 4h14l2 5.5" /><path d="M4 9.5V20h16V9.5" /><path d="M3 9.5a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0" /><path d="M10 20v-5h4v5" /></>,
  telefon: <><rect x="6" y="2" width="12" height="20" rx="3" /><path d="M11 18h2" /></>,
  tarcza: <path d="M12 22s8-3.5 8-10V5l-8-3-8 3v7c0 6.5 8 10 8 10Z" />,
  // kategorie
  paznokcie: <><rect x="8" y="10" width="8" height="11" rx="2.5" /><rect x="10" y="3" width="4" height="7" rx="1" /></>,
  rzesy: <><path d="M2.5 13c3-3.5 6.2-5 9.5-5s6.5 1.5 9.5 5" /><path d="M5.5 10 4 7.5M9 8.5 8.2 5.8M15 8.5l.8-2.7M18.5 10 20 7.5" /></>,
  brwi: <><path d="M3.5 13.5c3-4 11-6 17-2.5" /><path d="M5 16.5c3-2 8-3 12-1.5" opacity=".45" /></>,
  fryzjer: <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" /></>,
  barber: <><path d="M4 4h16v5H4z" /><path d="M6 9v11M10 9v7M14 9v11M18 9v7" /></>,
  masaz: <><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.5 19 2c1 2 2 4.2 2 8 0 5.5-4.8 10-10 10Z" /><path d="M2 21c0-3 1.9-5.4 5.1-6" /></>,
  makijaz: <><path d="m9 12 8-8a2.1 2.1 0 1 1 3 3l-8 8" /><path d="M7 15c-1.7 0-3 1.3-3 3 0 1.3-2.5 1.5-2 2 1.1 1.1 2.5 2 4 2 2.2 0 4-1.8 4-4a3 3 0 0 0-3-3Z" /></>,
  kosmetologia: <><path d="M12 2.5 13.4 7 18 8.4 13.4 9.8 12 14.3 10.6 9.8 6 8.4 10.6 7z" /><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
} as const;

export type NazwaIkony = keyof typeof SCIEZKI;

export function Ikona({ nazwa, rozmiar = 22, ...reszta }: { nazwa: NazwaIkony; rozmiar?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={rozmiar}
      height={rozmiar}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...reszta}
    >
      {SCIEZKI[nazwa]}
    </svg>
  );
}

export function Znak({ rozmiar = 30 }: { rozmiar?: number }) {
  return (
    <svg width={rozmiar} height={rozmiar} viewBox="0 0 64 64" aria-hidden="true" className="znak">
      <rect x="5" y="11" width="44" height="44" rx="13" fill="none" stroke="currentColor" strokeWidth="5.5" />
      <line x1="27" y1="13" x2="27" y2="53" stroke="currentColor" strokeWidth="3" />
      <line x1="7" y1="33" x2="47" y2="33" stroke="currentColor" strokeWidth="3" />
      <circle className="znak-kropka" cx="49" cy="12" r="9" strokeWidth="5" />
    </svg>
  );
}

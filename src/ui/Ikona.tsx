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
  mikrofon: <><rect x="9" y="2.5" width="6" height="12" rx="3" /><path d="M5 11a7 7 0 0 0 14 0" /><path d="M12 18v3.5" /></>,
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
  depilacja: <><path d="M7 3v18M7 7h6a3 3 0 0 1 0 6H7" /><path d="M17 17l3 3M17 20l3-3" /></>,
  spa: <path d="M12 20c-4 0-8-2-9-5 3 0 6 1 9 5Zm0 0c4 0 8-2 9-5-3 0-6 1-9 5Zm0 0c-2-3-2-7 0-11 2 4 2 8 0 11Z" />,
  podologia: <><path d="M8 21c-2 0-3-2-3-5 0-4 1-9 4-9s3 3 3 6-1 8-4 8Z" /><circle cx="15" cy="5" r="1.4" /><circle cx="18" cy="7.5" r="1.2" /><circle cx="19.5" cy="11" r="1" /></>,
  medycyna_estetyczna: <><path d="m18 2 4 4M17 7l3-3M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5" /><path d="m9 11 4 4M5 19l-3 3" /></>,
  makijaz_permanentny: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  tatuaz: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></>,
  stomatologia: <path d="M7 3c-2 0-3.5 1.6-3.5 4 0 2.8 1.2 4.5 2 7 .7 2.3 1 7 2.8 7 1.6 0 1.6-5 3.7-5s2.1 5 3.7 5c1.8 0 2.1-4.7 2.8-7 .8-2.5 2-4.2 2-7 0-2.4-1.5-4-3.5-4-1.6 0-2.6 1-5 1S8.6 3 7 3Z" />,
  lekarz: <><path d="M5 3H4a1 1 0 0 0-1 1v5a5 5 0 0 0 10 0V4a1 1 0 0 0-1-1h-1" /><path d="M8 14v1a5 5 0 0 0 10 0v-3" /><circle cx="18" cy="10" r="2" /></>,
  diagnostyka: <path d="M22 12h-4l-3 8L9 4l-3 8H2" />,
  fizjoterapia: <><circle cx="12" cy="4.5" r="2" /><path d="M4 9.5 12 11l8-1.5M12 11v5l-3 5.5M12 16l3 5.5" /></>,
  psychologia: <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />,
  opony: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="M12 3v5.5M12 15.5V21M3 12h5.5M15.5 12H21" /></>,
  serwis: <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.8-3.8a6 6 0 0 1-7.9 7.9l-6.9 6.9a2.1 2.1 0 0 1-3-3l6.9-6.9a6 6 0 0 1 7.9-7.9z" />,
  myjnia: <><path d="M7 16.3c2.2 0 4-1.8 4-4 0-1.2-.6-2.3-1.7-3.2S7.3 6.8 7 5.3c-.3 1.5-1.1 2.8-2.3 3.8S3 11.1 3 12.3c0 2.2 1.8 4 4 4z" /><path d="M12.6 6.6A11 11 0 0 0 14 3c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a7 7 0 0 1-11.9 5" /></>,
  groomer: <><circle cx="5.5" cy="9.5" r="1.8" /><circle cx="9.5" cy="5.5" r="1.8" /><circle cx="14.5" cy="5.5" r="1.8" /><circle cx="18.5" cy="9.5" r="1.8" /><path d="M12 11.5c-3 0-6 3.5-6 6.5 0 1.9 1.4 3 3 3 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.6 0 3-1.1 3-3 0-3-3-6.5-6-6.5Z" /></>,
  weterynarz: <><path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /><path d="M12 9v6M9 12h6" /></>,
  korty: <><circle cx="12" cy="12" r="9" /><path d="M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8" /></>,
  trener: <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />,
  jazda: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="2" /><path d="M3.5 10.5 10 12M20.5 10.5 14 12M12 14v7" /></>,
  korepetycje: <><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></>,
  sprzatanie: <><path d="m19 3-6 6M9.5 8.5l6 6" /><path d="M5 13.5c1.5-1.5 4.5-4.5 4.5-5l6 6c-.5 0-3.5 3-5 4.5-2 2-6 3-7.5 1.5S3 15.5 5 13.5Z" /></>,
  zlota_raczka: <><path d="m15 12-8.4 8.4a2.1 2.1 0 1 1-3-3L12 9" /><path d="M17.6 15 22 10.6M20.9 11.6l-1.3-1.3a2 2 0 0 1-.6-1.4V7.6l-2.5-2.5a5.6 5.6 0 0 0-4-1.6H9l.9.8A6.2 6.2 0 0 1 12 9.1v1.6l2 2h2.5a2 2 0 0 1 1.4.6l1.2 1.4" /></>,
  hydraulik: <path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z" />,
  // branże
  opalanie: <><circle cx="12" cy="12" r="4.5" /><path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M4.9 19.1l1.8-1.8M17.3 6.7l1.8-1.8" /></>,
  dietetyka: <><path d="M12 7c-2-1.6-6-1.4-7 2.2-1 3.8 1.6 11.3 4.6 11.3 1 0 1.4-.6 2.4-.6s1.4.6 2.4.6c3 0 5.6-7.5 4.6-11.3C18 5.6 14 5.4 12 7Z" /><path d="M12 7c0-2 1-3.5 3-4.5" /></>,
  logopedia: <><path d="M4 4.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-8l-5 4v-4H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z" /><path d="M8 10.5h.01M12 10.5h.01M16 10.5h.01" /></>,
  detailing: <><path d="M11 3.5s-5 5.6-5 9.5a5 5 0 0 0 10 0c0-3.9-5-9.5-5-9.5Z" /><path d="M19 2.5l.6 1.4 1.4.6-1.4.6-.6 1.4-.6-1.4-1.4-.6 1.4-.6z" /></>,
  przeglad: <><rect x="5" y="4" width="14" height="17" rx="2" /><path d="M9 4V2.5h6V4" /><path d="m9 13 2 2 4-4" /></>,
  opieka_zwierzat: <><path d="m3 11 9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" /><circle cx="12" cy="15.5" r="2.2" /><path d="M9 12.5h.01M15 12.5h.01M10.8 10.8h.01M13.2 10.8h.01" /></>,
  szkolenie_psow: <><path d="M9 9l6 6" /><path d="M7.5 4.5a2.3 2.3 0 0 0-3.2 3.2 2.3 2.3 0 0 0 1.5 3.8L9 9l.5-3.2a2.3 2.3 0 0 0-2-1.3ZM16.5 19.5a2.3 2.3 0 0 0 3.2-3.2 2.3 2.3 0 0 0-1.5-3.8L15 15l-.5 3.2a2.3 2.3 0 0 0 2 1.3Z" /></>,
  muzyka: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  plywanie: <><path d="M2 15c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /><path d="M2 20c2 0 2-1.5 4-1.5s2 1.5 4 1.5 2-1.5 4-1.5 2 1.5 4 1.5 2-1.5 4-1.5" /><circle cx="16" cy="6" r="2" /><path d="m6 11 4-3.5 3.5 2.5" /></>,
  slusarz: <><circle cx="7.5" cy="15.5" r="4.5" /><path d="m11 12 9-9M16 7l3 3M13.5 9.5l2 2" /></>,
  elektryk: <path d="M13 2 3.5 13.5h8L10.5 22 20.5 10h-8z" />,
  serwis_agd: <><rect x="4" y="2.5" width="16" height="19" rx="2" /><circle cx="12" cy="13.5" r="4.5" /><path d="M7.5 6h.01M10.5 6h.01" /></>,
  escape_room: <><rect x="4.5" y="10.5" width="15" height="11" rx="2" /><path d="M8 10.5V7a4 4 0 0 1 8 0v3.5" /><path d="M12 15v2.5" /></>,
  kregle: <><path d="M12 2.5c-1.7 0-2.5 1.4-2.2 3.2.2 1.2.7 2 .5 3-.4 1.6-2.8 3.6-2.8 7.3 0 2.8 1.6 5.5 4.5 5.5s4.5-2.7 4.5-5.5c0-3.7-2.4-5.7-2.8-7.3-.2-1 .3-1.8.5-3 .3-1.8-.5-3.2-2.2-3.2Z" /><path d="M10.3 9.5h3.4" /></>,
  sauna: <><path d="M3 13h18l-1.5 7.2a1 1 0 0 1-1 .8H5.5a1 1 0 0 1-1-.8z" /><path d="M8 3c-1 1.3 1 2.2 0 3.5M12 3c-1 1.3 1 2.2 0 3.5M16 3c-1 1.3 1 2.2 0 3.5" /></>,
  gokarty: <><path d="M5 21V4" /><path d="M5 4h14v8H5" /><path d="M9.7 4v8M14.3 4v8M5 8h14" /></>,
  czas_wolny: <><path d="M3 7a1 1 0 0 1 1-1h16a1 1 0 0 1 1 1v3a2 2 0 0 0 0 4v3a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-3a2 2 0 0 0 0-4z" /><path d="M15 6v2M15 11v2M15 16v2" /></>,
  uroda: <><path d="M12 2.5 13.4 7 18 8.4 13.4 9.8 12 14.3 10.6 9.8 6 8.4 10.6 7z" /><path d="M18.5 14.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z" /></>,
  zdrowie: <><path d="M12 21s-8-4.5-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 6.5-8 11-8 11Z" /><path d="M8 12h2l1-2 2 4 1-2h2" /></>,
  auto: <><path d="M5 17H3v-4.5l2-5A2 2 0 0 1 6.9 6h10.2a2 2 0 0 1 1.9 1.5l2 5V17h-2" /><circle cx="7.5" cy="17" r="2" /><circle cx="16.5" cy="17" r="2" /><path d="M9.5 17h5M3 12.5h18" /></>,
  zwierzeta: <><circle cx="5.5" cy="9.5" r="1.8" /><circle cx="9.5" cy="5.5" r="1.8" /><circle cx="14.5" cy="5.5" r="1.8" /><circle cx="18.5" cy="9.5" r="1.8" /><path d="M12 11.5c-3 0-6 3.5-6 6.5 0 1.9 1.4 3 3 3 1.2 0 2-.6 3-.6s1.8.6 3 .6c1.6 0 3-1.1 3-3 0-3-3-6.5-6-6.5Z" /></>,
  sport: <path d="M6.5 6.5v11M17.5 6.5v11M3 9v6M21 9v6M6.5 12h11" />,
  nauka: <><path d="M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z" /><path d="M22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7z" /></>,
  dom: <><path d="m3 10 9-7 9 7v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><path d="M9 22V13h6v9" /></>,
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

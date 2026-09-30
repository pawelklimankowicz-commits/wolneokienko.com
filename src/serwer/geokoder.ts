// Adres → punkt na mapie. OpenStreetMap (Nominatim): darmowy, bez klucza,
// przy rejestracji salonów wystarczy (zasady: najwyżej 1 zapytanie na sekundę
// i podpis aplikacji w User-Agent). Wyszukiwanie strukturalne — ulica, miasto,
// kod — trafia pewniej niż jeden napis; bez trafienia próbujemy bez kodu.

export interface Punkt {
  lat: number;
  lon: number;
  /** jak adres rozumie mapa, np. „Jana Henryka Dąbrowskiego 12, Jeżyce, Poznań” */
  opis: string;
}

export interface Geokoder {
  znajdz(adres: { ulica: string; kodPocztowy: string; miasto: string }): Promise<Punkt | null>;
}

const ADRES_NOMINATIM = "https://nominatim.openstreetmap.org/search";
const AGENT = "WolneOkienko/0.1 (+https://wolneokienko.com)";
// Polska z zapasem — odrzuca trafienia w miejscowościach o tej samej nazwie za granicą
const POLSKA = { latMin: 48.9, latMax: 55.0, lonMin: 14.0, lonMax: 24.3 };

interface WynikNominatim {
  lat: string;
  lon: string;
  address?: Record<string, string>;
}

function opisz(w: WynikNominatim, zapasowy: string): string {
  const a = w.address ?? {};
  const ulica = [a.road, a.house_number].filter(Boolean).join(" ");
  const dzielnica = a.suburb ?? a.neighbourhood ?? a.quarter;
  const miasto = a.city ?? a.town ?? a.village ?? a.municipality;
  const czesci = [ulica, dzielnica !== miasto ? dzielnica : undefined, miasto].filter(Boolean);
  return czesci.length ? czesci.join(", ") : zapasowy;
}

export function geokoderNominatim(opcje: { fetch?: typeof fetch } = {}): Geokoder {
  const pobierz = opcje.fetch ?? fetch;
  async function szukaj(parametry: Record<string, string>): Promise<WynikNominatim | null> {
    const q = new URLSearchParams({ ...parametry, country: "Polska", countrycodes: "pl", format: "jsonv2", addressdetails: "1", limit: "1" });
    const r = await pobierz(`${ADRES_NOMINATIM}?${q}`, { headers: { "User-Agent": AGENT, "Accept-Language": "pl" } });
    if (!r.ok) throw new Error(`Nominatim: HTTP ${r.status}`);
    const wyniki = (await r.json()) as WynikNominatim[];
    return wyniki[0] ?? null;
  }
  return {
    async znajdz({ ulica, kodPocztowy, miasto }) {
      // numer lokalu („12/3”, „12 m. 4”) myli wyszukiwarkę — zostaje numer budynku
      const street = ulica.replace(/^(ul\.|ulica|al\.|aleja|os\.|pl\.)\s*/i, "").replace(/(\d+[a-z]?)\s*(\/|m\.|lok\.).*$/i, "$1");
      const w = (await szukaj({ street, city: miasto, postalcode: kodPocztowy })) ?? (await szukaj({ street, city: miasto }));
      if (!w) return null;
      const lat = Number(w.lat);
      const lon = Number(w.lon);
      if (!(lat >= POLSKA.latMin && lat <= POLSKA.latMax && lon >= POLSKA.lonMin && lon <= POLSKA.lonMax)) return null;
      return { lat, lon, opis: opisz(w, `${ulica}, ${miasto}`) };
    },
  };
}

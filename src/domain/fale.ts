// =====================================================================
// Rozsyłanie zapytania klientki do salonów falami.
//
// Fala 1 (0 min): 5 najlepiej dopasowanych salonów.
// Fala 2 (3 min): kolejnych 10.
// Fala 3 (6 min): wszystkie pozostałe w promieniu. Termin odpowiedzi: 10 min.
//
// Promień rośnie sam, aż obejmie co najmniej 5 salonów: w dużym mieście
// zwykle wystarczą 3 km, w mieście powiatowym 10–15 km, na wsi do 30 km.
// Moduł jest czysty (bez bazy) — dane o salonach i odległościach podaje
// wywołujący (zapytanie PostGIS).
// =====================================================================

export interface SalonKandydat {
  id: string;
  /** Odległość od miejsca wskazanego przez klientkę. */
  odlegloscKm: number;
  /** Udział zapytań, na które salon odpowiedział (0–1). Nowy salon: 0,5. */
  wskaznikOdpowiedzi: number;
  /** Przełącznik „Przyjmuję zapytania”. */
  przyjmujeZapytania: boolean;
  /** Czy salon ma tę usługę w cenniku. */
  maUsluge: boolean;
}

export interface ParametryFal {
  /** Kolejne promienie do sprawdzenia, rosnąco. */
  promienieKm: number[];
  /** Minimalna liczba salonów, przy której promień przestaje rosnąć. */
  minSalonow: number;
  /** Wielkości fal; ostatnia fala bierze wszystkich pozostałych. */
  wielkosciFal: number[];
  /** Start kolejnych fal w sekundach od wysłania zapytania. */
  startyFalSek: number[];
  /** Czas na odpowiedź salonów, liczony od wysłania zapytania. */
  terminOdpowiedziSek: number;
}

export const PARAMETRY_FAL: ParametryFal = {
  promienieKm: [3, 5, 10, 15, 20, 30],
  minSalonow: 5,
  wielkosciFal: [5, 10],
  startyFalSek: [0, 180, 360],
  terminOdpowiedziSek: 600,
};

export interface Fala {
  numer: number;
  startPoSek: number;
  salonIds: string[];
}

export interface PlanRozeslania {
  promienKm: number;
  fale: Fala[];
  terminOdpowiedziSek: number;
}

/** Ocena dopasowania: 60% szybkość odpowiadania, 40% bliskość. */
function ocena(s: SalonKandydat, promienKm: number): number {
  const bliskosc = promienKm > 0 ? 1 - Math.min(s.odlegloscKm / promienKm, 1) : 1;
  return 0.6 * s.wskaznikOdpowiedzi + 0.4 * bliskosc;
}

export function zaplanujFale(
  kandydaci: SalonKandydat[],
  parametry: ParametryFal = PARAMETRY_FAL,
): PlanRozeslania {
  const dostepni = kandydaci.filter((s) => s.przyjmujeZapytania && s.maUsluge);
  const maxPromien = parametry.promienieKm[parametry.promienieKm.length - 1];

  let promienKm = maxPromien;
  for (const r of parametry.promienieKm) {
    if (dostepni.filter((s) => s.odlegloscKm <= r).length >= parametry.minSalonow) {
      promienKm = r;
      break;
    }
  }

  const wPromieniu = dostepni
    .filter((s) => s.odlegloscKm <= promienKm)
    .sort((a, b) => ocena(b, promienKm) - ocena(a, promienKm) || a.id.localeCompare(b.id));

  const fale: Fala[] = [];
  let od = 0;
  for (let i = 0; od < wPromieniu.length && i < parametry.startyFalSek.length; i++) {
    const ostatnia = i === parametry.startyFalSek.length - 1 || i >= parametry.wielkosciFal.length;
    const ile = ostatnia ? wPromieniu.length - od : parametry.wielkosciFal[i];
    fale.push({
      numer: i + 1,
      startPoSek: parametry.startyFalSek[i],
      salonIds: wPromieniu.slice(od, od + ile).map((s) => s.id),
    });
    od += ile;
  }

  return { promienKm, fale, terminOdpowiedziSek: parametry.terminOdpowiedziSek };
}

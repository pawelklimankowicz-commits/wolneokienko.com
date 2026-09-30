// =====================================================================
// Nieobecności klientek (faza 1, bez zadatku).
//
// Nieobecność nic nie kosztuje klientki, więc chronimy usługodawców
// blokadą: 3 nieobecności w ciągu 12 miesięcy → 90 dni bez możliwości
// wysyłania zapytań. Odwołanie wizyty w aplikacji (nawet w ostatniej
// chwili) nie jest nieobecnością. Ta sama reguła jest opisana w
// regulaminie dla klientek (docs/prawne/regulamin-klientki.md, § 8).
// =====================================================================

export const ZASADY_NIEOBECNOSCI = {
  limit: 3,
  okresDni: 365,
  blokadaDni: 90,
} as const;

const DZIEN_MS = 24 * 60 * 60 * 1000;

/**
 * Do kiedy klientka ma zablokowane zapytania, gdy `nieobecnosci` to terminy
 * wizyt, na które nie przyszła (ostateczne, po czasie na sprzeciw).
 * null — brak blokady.
 */
export function blokadaDo(nieobecnosci: Date[], teraz: Date, z = ZASADY_NIEOBECNOSCI): Date | null {
  const rosnaco = [...nieobecnosci].sort((a, b) => a.getTime() - b.getTime());
  let koniec: Date | null = null;
  // blokadę wyzwala każda nieobecność, która jest `limit`-tą w oknie `okresDni`
  for (let i = z.limit - 1; i < rosnaco.length; i++) {
    const t = rosnaco[i];
    if (t.getTime() - rosnaco[i - z.limit + 1].getTime() <= z.okresDni * DZIEN_MS) {
      const k = new Date(t.getTime() + z.blokadaDni * DZIEN_MS);
      if (!koniec || k > koniec) koniec = k;
    }
  }
  return koniec && koniec > teraz ? koniec : null;
}

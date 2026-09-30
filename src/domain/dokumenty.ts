// Wersje dokumentów prawnych (docs/prawne/). Przy akceptacji zapisujemy
// w bazie wersję, którą ktoś zaakceptował. Zmiana dokumentu = nowa wersja
// (data wejścia w życie); usługodawców uprzedzamy co najmniej 15 dni
// wcześniej (rozporządzenie P2B, art. 3 ust. 2).
export const WERSJE_DOKUMENTOW = {
  regulaminKlientki: "2026-10-01",
  regulaminUslugodawcy: "2026-10-01",
  politykaPrywatnosci: "2026-10-01",
} as const;

/** Dokumenty pokazywane w aplikacji (treść: docs/prawne/*.md). */
export type NazwaDokumentu = "regulamin-klientki" | "regulamin-uslugodawcy" | "polityka-prywatnosci" | "zasady-opinii";

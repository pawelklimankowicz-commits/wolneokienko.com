import { neon } from "@neondatabase/serverless";

/**
 * Baza z punktu widzenia serwera: jedno zapytanie SQL z parametrami → wiersze.
 * Ten sam kod działa na Neonie (sterownik HTTP) i na PGlite w testach.
 * Każde wywołanie to osobna, samodzielna transakcja — operacje, które muszą
 * być niepodzielne, piszemy jako jedno polecenie (np. z CTE).
 */
export type Baza = <W = Record<string, unknown>>(sql: string, parametry?: unknown[]) => Promise<W[]>;

export function bazaNeon(adres: string): Baza {
  const sql = neon(adres);
  return async <W,>(tekst: string, parametry: unknown[] = []) => (await sql.query(tekst, parametry)) as W[];
}

/** Znacznik czasu do parametru zapytania (jawnie rzutowany w SQL na timestamptz). */
export const czas = (data: Date) => data.toISOString();

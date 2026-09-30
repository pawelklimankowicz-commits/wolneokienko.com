// Baza do testów: PGlite (Postgres w procesie) z wykonanymi migracjami.
// PGlite nie ma PostGIS, więc pomijamy `create extension postgis`,
// `extensions.geography(point, 4326)` zamieniamy na `text`, a indeks GiST
// na zwykły. Reszta SQL (typy, klucze, CHECK-i, RLS) wykonuje się bez zmian.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import type { Baza } from "./baza";

export const KATALOG_MIGRACJI = path.resolve(__dirname, "../../baza/migrations");

export function dlaPglite(sql: string): string {
  return sql
    .replace(/create extension if not exists postgis[^;]*;/gi, "")
    .replace(/(extensions\.)?geography\s*\(\s*point\s*,\s*4326\s*\)/gi, "text")
    .replace(/using gist \((\w+)\)/gi, "($1)");
}

export function plikiMigracji(): string[] {
  return readdirSync(KATALOG_MIGRACJI).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
}

export async function bazaTestowa(): Promise<{ pglite: PGlite; baza: Baza }> {
  const pglite = new PGlite();
  for (const plik of plikiMigracji()) {
    await pglite.exec(dlaPglite(readFileSync(path.join(KATALOG_MIGRACJI, plik), "utf8")));
  }
  const baza: Baza = async <W,>(sql: string, parametry: unknown[] = []) => (await pglite.query<W>(sql, parametry)).rows;
  return { pglite, baza };
}

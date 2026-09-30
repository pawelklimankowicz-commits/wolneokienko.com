// Baza do testów i lokalnego serwera: PGlite (Postgres w procesie) z wykonanymi
// migracjami i katalogiem usług.
// PGlite nie ma PostGIS, więc pomijamy `create extension postgis`,
// `extensions.geography(point, 4326)` zamieniamy na `text`, a indeks GiST
// na zwykły. Reszta SQL (typy, klucze, CHECK-i, RLS) wykonuje się bez zmian.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import { BRANZE, KATALOG_USLUG, KATEGORIE_KATALOGU } from "../domain/katalog-uslug";
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
  // katalog usług — na Neonie wgrywa go `npm run db:katalog`
  const medyczne = new Set(BRANZE.filter((b) => b.medyczna).map((b) => b.id));
  await baza(
    `insert into public.uslugi (kod, nazwa, kategoria, branza, medyczna, typowy_czas_min, bez_promocji, wymaga_lekarza, wymaga_deklaracji_kwalifikacji)
     select * from jsonb_to_recordset($1::jsonb) as x(kod text, nazwa text, kategoria text, branza text, medyczna boolean,
       typowy_czas_min int, bez_promocji boolean, wymaga_lekarza boolean, wymaga_deklaracji_kwalifikacji boolean)`,
    [
      JSON.stringify(
        KATALOG_USLUG.map((u) => {
          const branza = KATEGORIE_KATALOGU[u.kategoria].branza;
          return {
            kod: u.kod,
            nazwa: u.nazwa,
            kategoria: u.kategoria,
            branza,
            medyczna: medyczne.has(branza),
            typowy_czas_min: u.typowyCzasMin,
            bez_promocji: !!u.bezPromocji,
            wymaga_lekarza: !!u.wymagaLekarza,
            wymaga_deklaracji_kwalifikacji: !!u.wymagaDeklaracjiKwalifikacji,
          };
        }),
      ),
    ],
  );
  return { pglite, baza };
}

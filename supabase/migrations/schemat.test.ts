// Sprawdza, że migracje wykonują się na czystym Postgresie (PGlite, w procesie).
// PGlite nie ma PostGIS ani schematu `auth` z Supabase, więc test:
//  • podstawia minimalny `auth.users`,
//  • pomija `create extension postgis`, a `geography(point, 4326)` zamienia na `text`
//    i indeks GiST na zwykły.
// Reszta SQL (typy, klucze, CHECK-i, RLS) wykonuje się bez zmian.
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "fs";
import path from "path";

const katalog = path.resolve(__dirname);

function dlaPglite(sql: string): string {
  return sql
    .replace(/create extension if not exists postgis;/gi, "")
    .replace(/geography\s*\(\s*point\s*,\s*4326\s*\)/gi, "text")
    .replace(/using gist \((\w+)\)/gi, "($1)");
}

describe("migracje", () => {
  it("wykonują się po kolei na czystej bazie i pilnują kluczowych reguł", async () => {
    const db = new PGlite();
    await db.exec(`
      create schema auth;
      create table auth.users (id uuid primary key default gen_random_uuid());
    `);

    const pliki = readdirSync(katalog).filter((f) => f.endsWith(".sql")).sort();
    expect(pliki.length).toBeGreaterThan(0);
    for (const plik of pliki) {
      await db.exec(dlaPglite(readFileSync(path.join(katalog, plik), "utf8")));
    }

    const { rows } = await db.query<{ id: string }>("insert into auth.users default values returning id");
    const uid = rows[0].id;

    // NIP musi mieć 10 cyfr
    await expect(
      db.query("insert into public.salony (wlasciciel_id, nazwa, nip, adres, lokalizacja) values ($1, 'X', '123', 'Poznań', 'POINT(16.9 52.4)')", [uid]),
    ).rejects.toThrow();

    await db.query(
      "insert into public.salony (wlasciciel_id, nazwa, nip, adres, lokalizacja) values ($1, 'Studio', '7811234567', 'Poznań', 'POINT(16.9 52.4)')",
      [uid],
    );

    // zadatek nie może przekroczyć ceny wizyty — pilnuje tego też baza
    await db.exec(`
      insert into public.uslugi (kod, nazwa, kategoria, faza, typowy_czas_min) values ('manicure_hybrydowy', 'Manicure hybrydowy', 'paznokcie', 1, 60);
      insert into public.klientki (id) values ('${uid}');
    `);
    const zap = await db.query<{ id: string }>(
      `insert into public.zapytania (klientka_id, usluga_kod, okno_od, okno_do, lokalizacja, wygasa_at)
       values ($1, 'manicure_hybrydowy', now(), now() + interval '3 hours', 'POINT(16.9 52.4)', now() + interval '10 minutes') returning id`,
      [uid],
    );
    const salon = await db.query<{ id: string }>("select id from public.salony limit 1");
    const oferta = await db.query<{ id: string }>(
      "insert into public.oferty (zapytanie_id, salon_id, termin, cena_gr) values ($1, $2, now() + interval '1 hour', 13000) returning id",
      [zap.rows[0].id, salon.rows[0].id],
    );
    await expect(
      db.query(
        "insert into public.rezerwacje (oferta_id, klientka_id, salon_id, termin, cena_gr, zadatek_gr) values ($1, $2, $3, now(), 13000, 20000)",
        [oferta.rows[0].id, uid, salon.rows[0].id],
      ),
    ).rejects.toThrow();

    // faza 1: rezerwacja bez zadatku, zgłoszenia salonu i klientki
    const rez = await db.query<{ zadatek_gr: number }>(
      `insert into public.rezerwacje (oferta_id, klientka_id, salon_id, termin, cena_gr, zgloszenie_salonu, potwierdzenie_klientki)
       values ($1, $2, $3, now(), 13000, 'nieobecnosc', 'bylam') returning zadatek_gr`,
      [oferta.rows[0].id, uid, salon.rows[0].id],
    );
    expect(rez.rows[0].zadatek_gr).toBe(0);
    await expect(
      db.query("update public.rezerwacje set potwierdzenie_klientki = 'moze'"),
    ).rejects.toThrow();

    await db.close();
  }, 30_000);
});

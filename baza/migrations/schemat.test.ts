// Sprawdza, że migracje wykonują się na czystym Postgresie (PGlite, w procesie).
// Zamiany pod PGlite (bez PostGIS) opisuje src/serwer/baza-testowa.ts.
import { bazaTestowa, plikiMigracji } from "@/serwer/baza-testowa";

describe("migracje", () => {
  it("wykonują się po kolei na czystej bazie i pilnują kluczowych reguł", async () => {
    expect(plikiMigracji().length).toBeGreaterThan(0);
    const { pglite: db } = await bazaTestowa();

    // telefon w formacie międzynarodowym
    await expect(db.query("insert into public.konta (telefon, rola) values ('600123123', 'klientka')")).rejects.toThrow();
    const { rows } = await db.query<{ id: string }>("insert into public.konta (telefon, rola) values ('+48600123123', 'klientka') returning id");
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

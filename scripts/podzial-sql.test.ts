import { readFileSync, readdirSync } from "fs";
import path from "path";
import { podzielSql } from "./podzial-sql.mjs";

describe("podzielSql", () => {
  it("dzieli po średnikach i pomija komentarze", () => {
    expect(podzielSql("select 1; -- a; b\nselect 2;\n/* c; d */ select 3")).toEqual(["select 1", "select 2", "select 3"]);
  });

  it("nie dzieli wewnątrz napisów, identyfikatorów i bloków $$", () => {
    const sql = "insert into t values ('a;b', 'it''s; ok'); select \"x;y\"; do $$ begin perform 1; end $$; select 4;";
    expect(podzielSql(sql)).toEqual([
      "insert into t values ('a;b', 'it''s; ok')",
      'select "x;y"',
      "do $$ begin perform 1; end $$",
      "select 4",
    ]);
  });

  it("migracje dzielą się na niepuste polecenia bez resztek komentarzy", () => {
    const katalog = path.resolve(__dirname, "../baza/migrations");
    for (const plik of readdirSync(katalog).filter((f) => f.endsWith(".sql"))) {
      const polecenia = podzielSql(readFileSync(path.join(katalog, plik), "utf8"));
      expect(polecenia.length).toBeGreaterThan(0);
      expect(polecenia.every((p) => /^(create|alter|insert|update|comment|do|drop)\b/i.test(p))).toBe(true);
      expect(polecenia.every((p) => p.length > 0 && !p.startsWith("--"))).toBe(true);
    }
  });
});

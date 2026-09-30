#!/usr/bin/env node
// =====================================================================
// scripts/neon-api.mjs — baza Wolnego Okienka w Neon (Postgres + PostGIS).
//
//   node scripts/neon-api.mjs utworz-projekt   projekt „wolne-okienko” we Frankfurcie
//   node scripts/neon-api.mjs migrate          wykonuje nowe pliki z baza/migrations
//   node scripts/neon-api.mjs status           projekt i wykonane migracje
//   node --experimental-strip-types scripts/neon-api.mjs katalog
//                                              wgrywa katalog usług z src/domain/katalog-uslug.ts
//
// Klucz: NEON_API_KEY ze zmiennej środowiskowej albo z .env.local / .env
// (pierwszy, którego API nie odbija 401). Wartość klucza nie jest wypisywana.
// `utworz-projekt` zapisuje do .env.local (poza gitem): NEON_PROJECT_ID
// i DATABASE_URL. Migracje idą sterownikiem HTTP Neona, każda w jednej
// transakcji, i są odnotowywane w tabeli public._migracje.
// =====================================================================

import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { neon } from "@neondatabase/serverless";
import { podzielSql } from "./podzial-sql.mjs";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://console.neon.tech/api/v2";
const ENV_LOCAL = join(REPO, ".env.local");
const MIGRACJE = join(REPO, "baza", "migrations");
const NAZWA_PROJEKTU = "wolne-okienko";
const REGION = "aws-eu-central-1"; // Frankfurt

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function zPlikuEnv(plik, klucz) {
  if (!existsSync(plik)) return null;
  for (const linia of readFileSync(plik, "utf8").split("\n")) {
    const m = linia.match(/^\s*(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (m && m[1] === klucz) return m[2].trim().replace(/^["']|["']$/g, "") || null;
  }
  return null;
}

function zapiszEnvLocal(pary) {
  let tresc = existsSync(ENV_LOCAL) ? readFileSync(ENV_LOCAL, "utf8") : "";
  for (const [klucz, wartosc] of Object.entries(pary)) {
    const linia = `${klucz}=${wartosc}`;
    const re = new RegExp(`^\\s*${klucz}\\s*=.*$`, "m");
    tresc = re.test(tresc) ? tresc.replace(re, linia) : `${tresc}${tresc && !tresc.endsWith("\n") ? "\n" : ""}${linia}\n`;
  }
  writeFileSync(ENV_LOCAL, tresc, { mode: 0o600 });
}

const zmienna = (klucz) => process.env[klucz] || zPlikuEnv(ENV_LOCAL, klucz) || zPlikuEnv(join(REPO, ".env"), klucz);

let KLUCZ = null;
async function klucz() {
  if (KLUCZ) return KLUCZ;
  const kandydaci = [
    [process.env.NEON_API_KEY, "ze zmiennej środowiskowej"],
    [zPlikuEnv(ENV_LOCAL, "NEON_API_KEY"), "z pliku .env.local"],
    [zPlikuEnv(join(REPO, ".env"), "NEON_API_KEY"), "z pliku .env"],
  ].filter(([k]) => k);
  for (const [k, skad] of kandydaci) {
    const r = await fetch(`${API}/projects?limit=1`, { headers: { Authorization: `Bearer ${k}` } });
    if (r.status !== 401) return (KLUCZ = k);
    console.error(`Klucz Neon ${skad}: 401, pomijam.`);
  }
  throw new Error("Brak działającego klucza NEON_API_KEY. Wpisz go do .env.local.");
}

async function api(metoda, sciezka, cialo) {
  const r = await fetch(`${API}${sciezka}`, {
    method: metoda,
    headers: { Authorization: `Bearer ${await klucz()}`, "Content-Type": "application/json", Accept: "application/json" },
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
  });
  const tekst = await r.text();
  if (!r.ok) throw new Error(`${metoda} ${sciezka} → HTTP ${r.status}: ${tekst.slice(0, 500)}`);
  return tekst ? JSON.parse(tekst) : null;
}

async function czekajNaOperacje(projektId) {
  const start = Date.now();
  for (;;) {
    const { operations = [] } = await api("GET", `/projects/${projektId}/operations?limit=20`);
    if (operations.every((o) => ["finished", "skipped", "cancelled"].includes(o.status))) return;
    if (Date.now() - start > 5 * 60_000) throw new Error("Operacje Neona trwają dłużej niż 5 minut.");
    await sleep(3000);
  }
}

async function adresBazy(projektId) {
  const { branches } = await api("GET", `/projects/${projektId}/branches`);
  const galaz = branches.find((b) => b.default) ?? branches[0];
  const { databases } = await api("GET", `/projects/${projektId}/branches/${galaz.id}/databases`);
  const baza = databases[0];
  const q = new URLSearchParams({ branch_id: galaz.id, database_name: baza.name, role_name: baza.owner_name, pooled: "true" });
  const { uri } = await api("GET", `/projects/${projektId}/connection_uri?${q}`);
  return uri;
}

async function utworzProjekt() {
  const { projects } = await api("GET", "/projects?limit=100");
  let projekt = projects.find((p) => p.name === NAZWA_PROJEKTU);
  if (projekt) {
    console.log(`Projekt „${NAZWA_PROJEKTU}” już istnieje (${projekt.id}, ${projekt.region_id}). Zapisuję dane do .env.local.`);
  } else {
    const wynik = await api("POST", "/projects", { project: { name: NAZWA_PROJEKTU, region_id: REGION, pg_version: 17 } });
    projekt = wynik.project;
    console.log(`Utworzono projekt ${projekt.id} (${REGION}).`);
  }
  await czekajNaOperacje(projekt.id);
  zapiszEnvLocal({ NEON_PROJECT_ID: projekt.id, DATABASE_URL: await adresBazy(projekt.id) });
  console.log("Dane dostępowe zapisane w .env.local (NEON_PROJECT_ID, DATABASE_URL).");
}

function baza() {
  const url = zmienna("DATABASE_URL");
  if (!url) throw new Error("Brak DATABASE_URL — najpierw `node scripts/neon-api.mjs utworz-projekt`.");
  return neon(url);
}

async function migrate() {
  const sql = baza();
  await sql.query(
    "create table if not exists public._migracje (wersja text primary key, nazwa text not null, wykonano_at timestamptz not null default now())",
  );
  const wykonane = new Set((await sql.query("select wersja from public._migracje")).map((w) => w.wersja));
  const pliki = readdirSync(MIGRACJE).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  let ile = 0;
  for (const plik of pliki) {
    const [, wersja, nazwa] = plik.match(/^(\d+)_(.+)\.sql$/);
    if (wykonane.has(wersja)) continue;
    const polecenia = podzielSql(readFileSync(join(MIGRACJE, plik), "utf8"));
    await sql.transaction([
      ...polecenia.map((p) => sql.query(p)),
      sql.query("insert into public._migracje (wersja, nazwa) values ($1, $2)", [wersja, nazwa]),
    ]);
    console.log(`✓ ${plik} (${polecenia.length} poleceń)`);
    ile++;
  }
  console.log(ile ? `Wykonano migracji: ${ile}.` : "Baza jest aktualna, brak nowych migracji.");
}

/** Katalog usług z kodu → tabela public.uslugi (wstaw albo zaktualizuj; nic nie usuwa). */
async function katalog() {
  const { KATALOG_USLUG, KATEGORIE_KATALOGU, BRANZE } = await import("../src/domain/katalog-uslug.ts");
  const sql = baza();
  const medyczne = new Set(BRANZE.filter((b) => b.medyczna).map((b) => b.id));
  await sql.transaction(
    KATALOG_USLUG.map((u) => {
      const branza = KATEGORIE_KATALOGU[u.kategoria].branza;
      return sql.query(
        `insert into public.uslugi (kod, nazwa, kategoria, branza, medyczna, typowy_czas_min, bez_promocji, wymaga_lekarza, wymaga_deklaracji_kwalifikacji)
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         on conflict (kod) do update set nazwa = excluded.nazwa, kategoria = excluded.kategoria, branza = excluded.branza,
           medyczna = excluded.medyczna, typowy_czas_min = excluded.typowy_czas_min, bez_promocji = excluded.bez_promocji,
           wymaga_lekarza = excluded.wymaga_lekarza, wymaga_deklaracji_kwalifikacji = excluded.wymaga_deklaracji_kwalifikacji`,
        [u.kod, u.nazwa, u.kategoria, branza, medyczne.has(branza), u.typowyCzasMin, !!u.bezPromocji, !!u.wymagaLekarza, !!u.wymagaDeklaracjiKwalifikacji],
      );
    }),
  );
  const [{ n, m }] = await sql.query("select count(*)::int as n, count(*) filter (where medyczna)::int as m from public.uslugi");
  console.log(`Katalog w bazie: ${n} usług, w tym ${m} medycznych.`);
}

async function status() {
  const id = zmienna("NEON_PROJECT_ID");
  if (id) {
    const { project } = await api("GET", `/projects/${id}`);
    console.log(`${project.name} (${project.id}) · ${project.region_id} · Postgres ${project.pg_version}`);
  }
  const wiersze = await baza()
    .query("select wersja, nazwa from public._migracje order by wersja")
    .catch(() => []);
  for (const w of wiersze) console.log(`  ✓ ${w.wersja}_${w.nazwa}`);
  if (!wiersze.length) console.log("  (brak wykonanych migracji)");
}

const polecenia = { "utworz-projekt": utworzProjekt, migrate, katalog, status };
const komenda = process.argv[2];
if (!polecenia[komenda]) {
  console.error(`Użycie: node scripts/neon-api.mjs <${Object.keys(polecenia).join(" | ")}>`);
  process.exit(1);
}
polecenia[komenda]().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});

#!/usr/bin/env node
// =====================================================================
// scripts/supabase-api.mjs — Supabase Management API dla Wolnego Okienka.
//
//   node scripts/supabase-api.mjs utworz-projekt   nowy projekt w organizacji Prometheusa (Frankfurt)
//   node scripts/supabase-api.mjs migrate          wykonuje nowe pliki z supabase/migrations
//   node scripts/supabase-api.mjs status           stan projektu i wykonane migracje
//
// Token: SUPABASE_ACCESS_TOKEN ze zmiennej środowiskowej albo z .env.local / .env.
// Wygrywa pierwszy, którego API nie odbija 401 (martwy token w środowisku nie
// przykrywa świeżego w .env.local). Wartość tokenu nie jest nigdzie wypisywana.
//
// `utworz-projekt` zapisuje do .env.local (objęty .gitignore): SUPABASE_PROJECT_REF,
// SUPABASE_DB_PASSWORD, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
// Migracje idą przez /database/query i są odnotowywane w
// supabase_migrations.schema_migrations — tej samej tabeli, której używa CLI Supabase.
// =====================================================================

import { randomBytes } from "node:crypto";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const API = "https://api.supabase.com/v1";
const ENV_LOCAL = join(REPO, ".env.local");
const MIGRACJE = join(REPO, "supabase", "migrations");

/** Projekt Prometheusa — nowy projekt ląduje w tej samej organizacji. */
const PROJEKT_PROMETHEUS = "dekmrcdxdkfcucrmcnom";
const NAZWA_PROJEKTU = "wolne-okienko";
const REGION = "eu-central-1";

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

async function wybierzToken() {
  const kandydaci = [];
  const dodaj = (t, skad) => {
    const v = (t ?? "").trim();
    if (v && !kandydaci.some((k) => k.token === v)) kandydaci.push({ token: v, skad });
  };
  dodaj(process.env.SUPABASE_ACCESS_TOKEN, "ze zmiennej środowiskowej");
  for (const plik of [".env.local", ".env"]) dodaj(zPlikuEnv(join(REPO, plik), "SUPABASE_ACCESS_TOKEN"), `z pliku ${plik}`);
  for (const k of kandydaci) {
    const r = await fetch(`${API}/projects`, { headers: { Authorization: `Bearer ${k.token}` } });
    if (r.status !== 401) return k;
    console.error(`Token ${k.skad}: 401, pomijam.`);
  }
  throw new Error("Brak działającego tokenu Supabase (SUPABASE_ACCESS_TOKEN). Wpisz świeży do .env.local.");
}

let TOKEN = null;
async function api(metoda, sciezka, cialo) {
  TOKEN ??= (await wybierzToken()).token;
  const r = await fetch(`${API}${sciezka}`, {
    method: metoda,
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: cialo === undefined ? undefined : JSON.stringify(cialo),
  });
  const tekst = await r.text();
  if (!r.ok) throw new Error(`${metoda} ${sciezka} → HTTP ${r.status}: ${tekst.slice(0, 500)}`);
  return tekst ? JSON.parse(tekst) : null;
}

function refProjektu() {
  const ref = process.env.SUPABASE_PROJECT_REF || zPlikuEnv(ENV_LOCAL, "SUPABASE_PROJECT_REF");
  if (!ref) throw new Error("Brak SUPABASE_PROJECT_REF — najpierw `node scripts/supabase-api.mjs utworz-projekt`.");
  return ref;
}

const sql = (ref, query) => api("POST", `/projects/${ref}/database/query`, { query });

async function czekajNaProjekt(ref) {
  const start = Date.now();
  for (;;) {
    const p = await api("GET", `/projects/${ref}`);
    if (p.status === "ACTIVE_HEALTHY") return p;
    if (Date.now() - start > 15 * 60_000) throw new Error(`Projekt ${ref} po 15 min nadal ma status ${p.status}.`);
    console.log(`  status: ${p.status}, czekam…`);
    await sleep(15_000);
  }
}

async function zapiszKlucze(ref) {
  const klucze = await api("GET", `/projects/${ref}/api-keys`);
  const anon = klucze.find((k) => k.name === "anon")?.api_key;
  zapiszEnvLocal({ VITE_SUPABASE_URL: `https://${ref}.supabase.co`, ...(anon ? { VITE_SUPABASE_ANON_KEY: anon } : {}) });
}

async function utworzProjekt() {
  const istniejace = await api("GET", "/projects");
  const juzJest = istniejace.find((p) => p.name === NAZWA_PROJEKTU);
  if (juzJest) {
    console.log(`Projekt „${NAZWA_PROJEKTU}” już istnieje: ${juzJest.id} (${juzJest.status}). Zapisuję dane do .env.local.`);
    zapiszEnvLocal({ SUPABASE_PROJECT_REF: juzJest.id });
    await czekajNaProjekt(juzJest.id);
    await zapiszKlucze(juzJest.id);
    return;
  }
  const prometheus = await api("GET", `/projects/${PROJEKT_PROMETHEUS}`);
  const dbPass = randomBytes(24).toString("base64url");
  const nowy = await api("POST", "/projects", {
    name: NAZWA_PROJEKTU,
    organization_id: prometheus.organization_id,
    region: REGION,
    db_pass: dbPass,
  });
  zapiszEnvLocal({ SUPABASE_PROJECT_REF: nowy.id, SUPABASE_DB_PASSWORD: dbPass });
  console.log(`Utworzono projekt ${nowy.id} w organizacji Prometheusa (${REGION}). Czekam na uruchomienie…`);
  await czekajNaProjekt(nowy.id);
  await zapiszKlucze(nowy.id);
  console.log(`Projekt ${nowy.id} działa. Dane dostępowe w .env.local.`);
}

async function migrate() {
  const ref = refProjektu();
  await sql(
    ref,
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (version text primary key, statements text[], name text);`,
  );
  const wykonane = new Set((await sql(ref, "select version from supabase_migrations.schema_migrations")).map((w) => w.version));
  const pliki = readdirSync(MIGRACJE).filter((f) => /^\d+_.+\.sql$/.test(f)).sort();
  let ile = 0;
  for (const plik of pliki) {
    const [, wersja, nazwa] = plik.match(/^(\d+)_(.+)\.sql$/);
    if (wykonane.has(wersja)) continue;
    const tresc = readFileSync(join(MIGRACJE, plik), "utf8");
    const nazwaSql = nazwa.replace(/'/g, "''");
    await sql(
      ref,
      `begin;\n${tresc}\ninsert into supabase_migrations.schema_migrations (version, name) values ('${wersja}', '${nazwaSql}');\ncommit;`,
    );
    console.log(`✓ ${plik}`);
    ile++;
  }
  console.log(ile ? `Wykonano migracji: ${ile}.` : "Baza jest aktualna, brak nowych migracji.");
}

async function status() {
  const ref = refProjektu();
  const p = await api("GET", `/projects/${ref}`);
  console.log(`${p.name} (${p.id}) · ${p.region} · ${p.status}`);
  const wiersze = await sql(
    ref,
    "select version, name from supabase_migrations.schema_migrations order by version",
  ).catch(() => []);
  for (const w of wiersze) console.log(`  ✓ ${w.version}_${w.name}`);
  if (!wiersze.length) console.log("  (brak wykonanych migracji)");
}

const polecenia = { "utworz-projekt": utworzProjekt, migrate, status };
const komenda = process.argv[2];
if (!polecenia[komenda]) {
  console.error(`Użycie: node scripts/supabase-api.mjs <${Object.keys(polecenia).join(" | ")}>`);
  process.exit(1);
}
polecenia[komenda]().catch((e) => {
  console.error(`✗ ${e.message}`);
  process.exit(1);
});

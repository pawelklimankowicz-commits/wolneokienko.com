// API pod `npm run dev` i `npm run preview` — ten sam handler co na produkcji.
//
// Domyślnie lokalnie nic nie kosztuje i nie dotyka produkcji:
//   baza — PGlite w pamięci z migracjami (znika po restarcie serwera),
//   SMS  — kod wypisany w terminalu zamiast wysłany.
// Prawdziwa baza: DATABASE_URL_DEV w .env.local (np. gałąź „dev” w Neonie).
// Prawdziwe SMS-y: SMS_PRAWDZIWE=1 (wysyłka z konta SMSAPI, kosztuje punkty).
import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv, type Connect, type Plugin } from "vite";
import { utworzApi } from "./api";
import { bazaNeon, type Baza } from "./baza";
import { bramkaSmsapi, type BramkaSms } from "./bramka-sms";

async function zaleznosci(env: Record<string, string>) {
  let baza: Baza;
  if (env.DATABASE_URL_DEV) {
    baza = bazaNeon(env.DATABASE_URL_DEV);
  } else {
    const { bazaTestowa } = await import("./baza-testowa");
    baza = (await bazaTestowa()).baza;
  }
  const sms: BramkaSms =
    env.SMS_PRAWDZIWE === "1" && env.SMSAPI_TOKEN
      ? bramkaSmsapi({ token: env.SMSAPI_TOKEN, nadawca: env.SMSAPI_NADAWCA || undefined })
      : { wyslij: async (telefon, tresc) => console.log(`\n  📱 SMS do ${telefon} (lokalnie, nie wysłany): ${tresc}\n`) };
  console.log(
    `  API Wolnego Okienka: baza ${env.DATABASE_URL_DEV ? "Neon (DATABASE_URL_DEV)" : "w pamięci"}, SMS ${env.SMS_PRAWDZIWE === "1" ? "prawdziwe" : "w terminalu"}`,
  );
  return utworzApi({ baza, sms, pieprz: env.KODY_SMS_PIEPRZ || "pieprz-lokalny", bezpieczneCiasteczka: false });
}

async function naRequest(req: IncomingMessage): Promise<Request> {
  const kawalki: Buffer[] = [];
  for await (const k of req) kawalki.push(k as Buffer);
  const naglowki = new Headers();
  for (const [nazwa, wartosc] of Object.entries(req.headers)) {
    for (const w of Array.isArray(wartosc) ? wartosc : wartosc === undefined ? [] : [wartosc]) naglowki.append(nazwa, w);
  }
  const metoda = req.method ?? "GET";
  return new Request(`http://${req.headers.host ?? "localhost"}${req.url}`, {
    method: metoda,
    headers: naglowki,
    body: metoda === "GET" || metoda === "HEAD" ? undefined : Buffer.concat(kawalki),
  });
}

async function wyslijOdpowiedz(odp: Response, res: ServerResponse) {
  res.statusCode = odp.status;
  odp.headers.forEach((wartosc, nazwa) => {
    if (nazwa !== "set-cookie") res.setHeader(nazwa, wartosc);
  });
  const ciasteczka = odp.headers.getSetCookie();
  if (ciasteczka.length) res.setHeader("Set-Cookie", ciasteczka);
  res.end(Buffer.from(await odp.arrayBuffer()));
}

export function apiWolnegoOkienka(): Plugin {
  let obsluz: ReturnType<typeof utworzApi> | null = null;
  const posrednik: Connect.NextHandleFunction = (req, res, dalej) => {
    if (!req.url?.startsWith("/api/")) return dalej();
    (async () => {
      obsluz ??= await zaleznosci(loadEnv("development", process.cwd(), ""));
      await wyslijOdpowiedz(await obsluz(await naRequest(req), req.socket.remoteAddress), res);
    })().catch((e) => {
      console.error(e);
      res.statusCode = 500;
      res.end(JSON.stringify({ blad: "serwer" }));
    });
  };
  return {
    name: "wolne-okienko-api",
    configureServer: (serwer) => void serwer.middlewares.use(posrednik),
    configurePreviewServer: (serwer) => void serwer.middlewares.use(posrednik),
  };
}

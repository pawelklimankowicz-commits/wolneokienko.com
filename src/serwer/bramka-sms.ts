import { telefonDlaSmsapi } from "../lib/telefon";

/** Wysyłka SMS-ów. W produkcji SMSAPI, w testach atrapa zapisująca wiadomości. */
export interface BramkaSms {
  wyslij(telefon: string, tresc: string): Promise<void>;
}

export class BladBramkiSms extends Error {
  constructor(
    message: string,
    readonly kod?: number,
  ) {
    super(message);
    this.name = "BladBramkiSms";
  }
}

export const ADRES_SMSAPI = "https://api.smsapi.pl/sms.do";
/** Nazwa nadawcy Wolnego Okienka w SMSAPI (zatwierdzona 30.09.2026). Domyślną nazwą konta jest „Prometheus”, więc podajemy ją zawsze. */
export const NADAWCA_SMS = "WolneOkno";

/**
 * SMSAPI (konto Prometheusa). Uwaga: SMSAPI zgłasza błędy (zły numer, brak
 * punktów, nieaktywny nadawca) odpowiedzią HTTP 200 z polem `error`, więc
 * sprawdzamy treść, nie tylko status. Nadawca domyślnie „WolneOkno”.
 */
export function bramkaSmsapi(opcje: { token: string; nadawca?: string; fetch?: typeof fetch }): BramkaSms {
  const pobierz = opcje.fetch ?? fetch;
  return {
    async wyslij(telefon, tresc) {
      const parametry = new URLSearchParams({ to: telefonDlaSmsapi(telefon), message: tresc, format: "json", encoding: "utf-8" });
      parametry.set("from", opcje.nadawca || NADAWCA_SMS);
      const odpowiedz = await pobierz(ADRES_SMSAPI, {
        method: "POST",
        headers: { Authorization: `Bearer ${opcje.token}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: parametry,
      });
      const tekst = await odpowiedz.text();
      let json: { error?: number; message?: string; count?: number } = {};
      try {
        json = JSON.parse(tekst);
      } catch {
        // niżej zgłosimy błąd z surową treścią
      }
      if (!odpowiedz.ok || json.error !== undefined) {
        throw new BladBramkiSms(`SMSAPI: ${json.message ?? tekst.slice(0, 200)} (HTTP ${odpowiedz.status})`, json.error);
      }
      if (!json.count) throw new BladBramkiSms(`SMSAPI nie przyjęło wiadomości: ${tekst.slice(0, 200)}`);
    },
  };
}

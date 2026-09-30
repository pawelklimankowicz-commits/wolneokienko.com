import { telefonDlaSmsapi } from "./telefon";

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

/**
 * SMSAPI (konto Prometheusa). Uwaga: SMSAPI zgłasza błędy (zły numer, brak
 * punktów, nieaktywny nadawca) odpowiedzią HTTP 200 z polem `error`, więc
 * sprawdzamy treść, nie tylko status. Bez `nadawca` SMSAPI użyje nazwy
 * domyślnej konta.
 */
export function bramkaSmsapi(opcje: { token: string; nadawca?: string; fetch?: typeof fetch }): BramkaSms {
  const pobierz = opcje.fetch ?? fetch;
  return {
    async wyslij(telefon, tresc) {
      const parametry = new URLSearchParams({ to: telefonDlaSmsapi(telefon), message: tresc, format: "json", encoding: "utf-8" });
      if (opcje.nadawca) parametry.set("from", opcje.nadawca);
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

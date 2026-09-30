/**
 * Numer telefonu → zapis międzynarodowy „+48” + 9 cyfr, albo null.
 *
 * Przyjmuje „600 123 123”, „600-123-123”, „+48 600 123 123”, „0048600123123”
 * i „48600123123”. Na start tylko polskie numery: SMS-y za granicę są droższe
 * i to typowa droga nadużyć (masowe zamawianie kodów na płatne numery).
 */
export function normalizujTelefon(tekst: string): string | null {
  const cyfry = tekst.replace(/[\s\-().]/g, "");
  const m = cyfry.match(/^(?:\+48|0048|48)?([1-9]\d{8})$/);
  return m ? `+48${m[1]}` : null;
}

/** „+48600123123” → „48600123123” — format odbiorcy w SMSAPI. */
export function telefonDlaSmsapi(telefon: string): string {
  return telefon.replace(/^\+/, "");
}

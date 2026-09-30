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

/** „+48503090523” → „+48 503 090 523”. */
export function telefonCzytelny(telefon: string): string {
  const m = telefon.match(/^\+48(\d{3})(\d{3})(\d{3})$/);
  return m ? `+48 ${m[1]} ${m[2]} ${m[3]}` : telefon;
}

/** Wpisywany numer bez +48, w grupach po trzy cyfry: „503090523” → „503 090 523”. */
export function grupujNumer(tekst: string): string {
  const cyfry = tekst.replace(/\D/g, "").replace(/^(?:0048|48)(?=\d{9})/, "").slice(0, 9);
  return cyfry.replace(/(\d{3})(?=\d)/g, "$1 ");
}

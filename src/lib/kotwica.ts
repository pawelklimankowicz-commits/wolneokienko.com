/** „§ 3. Konto” → „3-konto” — kotwice nagłówków do odnośników w treści. */
export const kotwica = (tekst: string) =>
  tekst
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ł/g, "l")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

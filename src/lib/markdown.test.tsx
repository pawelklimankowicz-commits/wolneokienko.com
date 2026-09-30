import { renderToStaticMarkup } from "react-dom/server";
import { kotwica } from "./kotwica";
import { Markdown } from "./markdown";

const html = (md: string) => renderToStaticMarkup(<Markdown tresc={md} />);

describe("Markdown", () => {
  it("nagłówki z kotwicami, akapity, listy i wyróżnienia", () => {
    expect(html("# Regulamin\n\n## § 1. Definicje\n\nPierwsza linia\ndruga **ważna** i *miękka*.\n\n- jeden\n- dwa\n\n1. a\n2. b")).toBe(
      '<h1 id="regulamin">Regulamin</h1><h2 id="1-definicje">§ 1. Definicje</h2><p>Pierwsza linia druga <strong>ważna</strong> i <em>miękka</em>.</p><ul><li>jeden</li><li>dwa</li></ul><ol><li>a</li><li>b</li></ol>',
    );
  });

  it("tabela, cytat i linia", () => {
    expect(html("| Cel | Podstawa |\n|---|---|\n| Konto | art. 6 ust. 1 lit. b |\n\n> Uwaga\n\n---")).toBe(
      '<div class="tabela-przewijana"><table><thead><tr><th>Cel</th><th>Podstawa</th></tr></thead><tbody><tr><td>Konto</td><td>art. 6 ust. 1 lit. b</td></tr></tbody></table></div><blockquote>Uwaga</blockquote><hr/>',
    );
  });

  it("linki tylko bezpieczne; HTML w treści zostaje tekstem", () => {
    const wynik = html("[strona](https://uokik.gov.pl) [zły](javascript:alert(1)) [kontakt](mailto:a@b.pl) <script>x</script>");
    expect(wynik).toContain('<a href="https://uokik.gov.pl" target="_blank" rel="noreferrer">strona</a>');
    expect(wynik).toContain("zły");
    expect(wynik).not.toContain("javascript:");
    expect(wynik).toContain('<a href="mailto:a@b.pl">kontakt</a>');
    expect(wynik).toContain("&lt;script&gt;");
  });

  it("kotwice bez polskich znaków", () => {
    expect(kotwica("§ 7. Opinie i zgłoszenia treści")).toBe("7-opinie-i-zgloszenia-tresci");
  });
});

// Mały czytnik Markdownu dla dokumentów prawnych (docs/prawne/*.md).
// Buduje elementy Reacta — bez innerHTML, więc treść nie wstrzyknie kodu.
// Obsługuje: nagłówki #–###, akapity, listy (- i 1.), tabele z |, cytat >,
// linię ---, **pogrubienie**, *kursywę* i linki [tekst](https:// | mailto: | #kotwica).
import { Fragment, type ReactNode } from "react";
import { kotwica } from "./kotwica";

const bezpiecznyLink = (href: string) => /^(https?:\/\/|mailto:|#)/.test(href);

function wLinii(tekst: string, klucz = ""): ReactNode[] {
  const wynik: ReactNode[] = [];
  const wzor = /\*\*(.+?)\*\*|\*(.+?)\*|\[([^\]]+)\]\(([^)\s]+)\)/g;
  let ostatni = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = wzor.exec(tekst))) {
    if (m.index > ostatni) wynik.push(tekst.slice(ostatni, m.index));
    const k = `${klucz}-${i++}`;
    if (m[1] !== undefined) wynik.push(<strong key={k}>{wLinii(m[1], k)}</strong>);
    else if (m[2] !== undefined) wynik.push(<em key={k}>{wLinii(m[2], k)}</em>);
    else if (bezpiecznyLink(m[4]))
      wynik.push(
        <a key={k} href={m[4]} {...(m[4].startsWith("http") ? { target: "_blank", rel: "noreferrer" } : {})}>
          {m[3]}
        </a>,
      );
    else wynik.push(m[3]);
    ostatni = m.index + m[0].length;
  }
  if (ostatni < tekst.length) wynik.push(tekst.slice(ostatni));
  return wynik;
}

const komorki = (linia: string) =>
  linia
    .trim()
    .replace(/^\||\|$/g, "")
    .split("|")
    .map((c) => c.trim());

export function Markdown({ tresc }: { tresc: string }) {
  const linie = tresc.replace(/\r/g, "").split("\n");
  const bloki: ReactNode[] = [];
  let i = 0;
  const k = () => `b${bloki.length}`;
  while (i < linie.length) {
    const linia = linie[i];
    if (!linia.trim()) {
      i++;
      continue;
    }
    const naglowek = linia.match(/^(#{1,3})\s+(.*)$/);
    if (naglowek) {
      const Tag = (["h1", "h2", "h3"] as const)[naglowek[1].length - 1];
      bloki.push(
        <Tag key={k()} id={kotwica(naglowek[2])}>
          {wLinii(naglowek[2], k())}
        </Tag>,
      );
      i++;
      continue;
    }
    if (/^-{3,}\s*$/.test(linia)) {
      bloki.push(<hr key={k()} />);
      i++;
      continue;
    }
    if (linia.trimStart().startsWith("|")) {
      const wiersze: string[][] = [];
      while (i < linie.length && linie[i].trimStart().startsWith("|")) {
        if (!/^\s*\|?\s*:?-{3,}/.test(linie[i])) wiersze.push(komorki(linie[i]));
        i++;
      }
      const [glowa, ...reszta] = wiersze;
      bloki.push(
        <div key={k()} className="tabela-przewijana">
          <table>
            <thead>
              <tr>
                {glowa.map((c, j) => (
                  <th key={j}>{wLinii(c, `${k()}h${j}`)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {reszta.map((w, r) => (
                <tr key={r}>
                  {w.map((c, j) => (
                    <td key={j}>{wLinii(c, `${k()}${r}-${j}`)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }
    const lista = linia.match(/^\s*(-|\*|\d+\.)\s+/);
    if (lista) {
      const numerowana = /\d/.test(lista[1]);
      const elementy: string[] = [];
      while (i < linie.length) {
        const m = linie[i].match(/^\s*(-|\*|\d+\.)\s+(.*)$/);
        if (m && /\d/.test(m[1]) === numerowana) elementy.push(m[2]);
        else if (linie[i].match(/^\s{2,}\S/) && elementy.length) elementy[elementy.length - 1] += ` ${linie[i].trim()}`;
        else break;
        i++;
      }
      const Tag = numerowana ? "ol" : "ul";
      bloki.push(
        <Tag key={k()}>
          {elementy.map((e, j) => (
            <li key={j}>{wLinii(e, `${k()}-${j}`)}</li>
          ))}
        </Tag>,
      );
      continue;
    }
    if (linia.startsWith(">")) {
      const tekst: string[] = [];
      while (i < linie.length && linie[i].startsWith(">")) tekst.push(linie[i++].replace(/^>\s?/, ""));
      bloki.push(<blockquote key={k()}>{wLinii(tekst.join(" "), k())}</blockquote>);
      continue;
    }
    const akapit: string[] = [];
    while (i < linie.length && linie[i].trim() && !/^(#{1,3}\s|\s*(-|\*|\d+\.)\s|>|\s*\||-{3,}\s*$)/.test(linie[i])) akapit.push(linie[i++].trim());
    bloki.push(<p key={k()}>{wLinii(akapit.join(" "), k())}</p>);
  }
  return <Fragment>{bloki}</Fragment>;
}

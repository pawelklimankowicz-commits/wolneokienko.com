// Dzieli skrypt SQL na pojedyncze polecenia (sterownik HTTP Neona wykonuje
// jedno polecenie na zapytanie). Średnik liczy się tylko poza komentarzami,
// napisami w '…', identyfikatorami w "…" i blokami $tag$…$tag$.
export function podzielSql(sql) {
  const polecenia = [];
  let biezace = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i];
    const dalej = sql.slice(i);
    if (dalej.startsWith("--")) {
      const koniec = sql.indexOf("\n", i);
      i = koniec === -1 ? sql.length : koniec + 1;
      biezace += "\n";
      continue;
    }
    if (dalej.startsWith("/*")) {
      const koniec = sql.indexOf("*/", i + 2);
      i = koniec === -1 ? sql.length : koniec + 2;
      biezace += " ";
      continue;
    }
    if (c === "'" || c === '"') {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === c && sql[j + 1] === c) j += 2;
        else if (sql[j] === c) break;
        else j++;
      }
      biezace += sql.slice(i, j + 1);
      i = j + 1;
      continue;
    }
    const dolar = dalej.match(/^\$[A-Za-z0-9_]*\$/);
    if (dolar) {
      const tag = dolar[0];
      const koniec = sql.indexOf(tag, i + tag.length);
      const do_ = koniec === -1 ? sql.length : koniec + tag.length;
      biezace += sql.slice(i, do_);
      i = do_;
      continue;
    }
    if (c === ";") {
      if (biezace.trim()) polecenia.push(biezace.trim());
      biezace = "";
      i++;
      continue;
    }
    biezace += c;
    i++;
  }
  if (biezace.trim()) polecenia.push(biezace.trim());
  return polecenia;
}

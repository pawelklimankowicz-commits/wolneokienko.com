// Dokumenty prawne w aplikacji. Treść: docs/prawne/*.md — ładowana dopiero
// przy otwarciu, żeby nie obciążać startu aplikacji.
import { useEffect, useRef, useState } from "react";
import type { NazwaDokumentu } from "@/domain/dokumenty";
import { Markdown } from "@/lib/markdown";
import { NaglowekEkranu } from "@/ui/wspolne";

const PLIKI = import.meta.glob<string>("../../docs/prawne/*.md", { query: "?raw", import: "default" });

const DOKUMENTY: { nazwa: NazwaDokumentu; etykieta: string }[] = [
  { nazwa: "regulamin-klientki", etykieta: "Regulamin" },
  { nazwa: "polityka-prywatnosci", etykieta: "Prywatność" },
  { nazwa: "zasady-opinii", etykieta: "Opinie i zgłoszenia" },
  { nazwa: "regulamin-uslugodawcy", etykieta: "Dla usługodawców" },
];

export function Dokument({ nazwa, onZamknij }: { nazwa: NazwaDokumentu; onZamknij: () => void }) {
  const [aktywny, setAktywny] = useState(nazwa);
  const [tresc, setTresc] = useState<string | null>(null);
  const przewijane = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let aktualne = true;
    setTresc(null);
    PLIKI[`../../docs/prawne/${aktywny}.md`]?.().then((t) => aktualne && setTresc(t));
    przewijane.current?.scrollTo({ top: 0 });
    return () => {
      aktualne = false;
    };
  }, [aktywny]);

  return (
    <div className="nakladka nakladka-dokumentu">
      <NaglowekEkranu tytul="Dokumenty" onWstecz={onZamknij} />
      <div className="nakladka-tresc dokument" ref={przewijane}>
        <div className="chipy-przewijane" role="tablist" aria-label="Dokumenty">
          {DOKUMENTY.map((d) => (
            <button
              key={d.nazwa}
              type="button"
              role="tab"
              aria-selected={aktywny === d.nazwa}
              className={`chip ${aktywny === d.nazwa ? "chip-wybrany" : ""}`}
              onClick={() => setAktywny(d.nazwa)}
            >
              {d.etykieta}
            </button>
          ))}
        </div>
        <article className="dokument-tresc">{tresc === null ? <p className="wyciszony">Wczytuję…</p> : <Markdown tresc={tresc} />}</article>
      </div>
    </div>
  );
}

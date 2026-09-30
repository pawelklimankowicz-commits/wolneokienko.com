// Import cennika z innego miejsca: tekst (np. skopiowany ze swojej strony),
// zdjęcie (odczyt na telefonie) albo plik z eksportu danych (CSV, Excel).
// Salon zatwierdza każdą pozycję; import tylko wypełnia edytor cennika.
// Rozpoznawanie: src/domain/import-cennika.ts, pliki: src/lib/arkusz.ts.
import { useMemo, useState, type ChangeEvent } from "react";
import { dopasuj, pozycjeZImportu, wierszeZTabeli, wierszeZTekstu, type PozycjaZImportu, type PracownikZImportu, type PropozycjaImportu } from "@/domain/import-cennika";
import { KATALOG_USLUG, uslugiBranzy, type Branza } from "@/domain/katalog-uslug";
import { zlotowkiNaGrosze } from "@/domain/rejestracja-salonu";
import { czytajArkusz } from "@/lib/arkusz";
import { odmiana } from "@/lib/format";
import { tekstZeZdjecia } from "@/lib/ocr";
import { Ikona, type NazwaIkony } from "@/ui/Ikona";

type Zrodlo = "tekst" | "zdjecie" | "plik";
const ZRODLA: { id: Zrodlo; etykieta: string; ikona: NazwaIkony }[] = [
  { id: "tekst", etykieta: "Tekst", ikona: "tekst" },
  { id: "zdjecie", etykieta: "Zdjęcie", ikona: "aparat" },
  { id: "plik", etykieta: "Plik", ikona: "plik" },
];

interface Wiersz extends PropozycjaImportu {
  wybrany: boolean;
  cena: string;
  czas: string;
}

const naWiersze = (p: PropozycjaImportu[]): Wiersz[] =>
  p.map((x) => ({
    ...x,
    // zaznaczamy tylko pewne trafienia; niepewne salon zaznacza sam po sprawdzeniu
    wybrany: x.uslugaKod !== null && x.pewne && x.cenaGr !== null,
    cena: x.cenaGr === null ? "" : String(x.cenaGr / 100).replace(".", ","),
    czas: x.czasMin === null ? "" : String(x.czasMin),
  }));

export function ImportCennika({
  branza,
  onWstaw,
  onAnuluj,
}: {
  branza: Branza;
  onWstaw: (w: { pozycje: PozycjaZImportu[]; pracownicy: PracownikZImportu[] }) => void;
  onAnuluj: () => void;
}) {
  const [zrodlo, setZrodlo] = useState<Zrodlo>("tekst");
  const [tekst, setTekst] = useState("");
  const [wiersze, setWiersze] = useState<Wiersz[] | null>(null);
  const [postep, setPostep] = useState<string | null>(null);
  const [blad, setBlad] = useState<string | null>(null);
  const [zPracownikami, setZPracownikami] = useState(true);
  const uslugi = useMemo(() => uslugiBranzy(branza), [branza]);

  const rozpoznajTekst = (t: string) => {
    const w = naWiersze(dopasuj(wierszeZTekstu(t), branza));
    if (!w.length) return setBlad("Nie znaleźliśmy tu pozycji z cenami. Sprawdź, czy przy usługach są kwoty (np. „Hybryda 120 zł”).");
    setBlad(null);
    setWiersze(w);
  };

  const zdjecie = async (e: ChangeEvent<HTMLInputElement>) => {
    const plik = e.target.files?.[0];
    e.target.value = "";
    if (!plik) return;
    setBlad(null);
    setPostep("Uruchamiam odczyt…");
    try {
      const t = await tekstZeZdjecia(plik, (p) => setPostep(`Czytam zdjęcie… ${Math.round(p * 100)}%`));
      setTekst(t);
      setZrodlo("tekst");
      rozpoznajTekst(t);
    } catch (x) {
      setBlad(x instanceof Error ? x.message : "Nie udało się odczytać zdjęcia.");
    } finally {
      setPostep(null);
    }
  };

  const plik = async (e: ChangeEvent<HTMLInputElement>) => {
    const p = e.target.files?.[0];
    e.target.value = "";
    if (!p) return;
    setBlad(null);
    setPostep("Czytam plik…");
    try {
      const w = naWiersze(dopasuj(wierszeZTabeli(await czytajArkusz(p)), branza));
      if (!w.length) setBlad("W tym pliku nie znaleźliśmy usług z cenami. Potrzebne są co najmniej kolumny z nazwą usługi i ceną.");
      else setWiersze(w);
    } catch (x) {
      setBlad(x instanceof Error ? x.message : "Nie udało się odczytać pliku.");
    } finally {
      setPostep(null);
    }
  };

  const zmien = (i: number, z: Partial<Wiersz>) => setWiersze((w) => w && w.map((x, j) => (j === i ? { ...x, ...z } : x)));

  const gotowe = (wiersze ?? []).filter((w) => w.wybrany && w.uslugaKod && zlotowkiNaGrosze(w.cena) !== null);
  const wynik = pozycjeZImportu(
    gotowe.map((w) => ({ ...w, cenaGr: zlotowkiNaGrosze(w.cena), czasMin: Number.parseInt(w.czas, 10) || null })),
  );
  const pracownicy = wynik.pracownicy;

  if (wiersze) {
    return (
      <>
        <div className="nakladka-tresc import-cennika">
          <div className="logowanie-intro">
            <h2>Sprawdź pozycje</h2>
            <p className="wyciszony">
              Dopasowaliśmy je do naszego katalogu. Popraw usługę, cenę albo czas i odznacz to, czego nie chcesz. Nic nie zapisujemy bez Ciebie.
            </p>
          </div>
          <ul className="lista-importu">
            {wiersze.map((w, i) => (
              <li key={i} className={`pozycja-importu ${w.wybrany ? "wybrana" : ""}`}>
                <label className="pozycja-importu-glowa">
                  <input type="checkbox" checked={w.wybrany} onChange={(e) => zmien(i, { wybrany: e.target.checked })} />
                  <span className="zrodlo-importu">{w.zrodlo}</span>
                  {w.uslugaKod && !w.pewne && <span className="tag-sprawdz">sprawdź</span>}
                </label>
                <div className="pozycja-importu-pola">
                  <select
                    aria-label={`Usługa z katalogu dla: ${w.nazwa}`}
                    value={w.uslugaKod ?? ""}
                    onChange={(e) => zmien(i, { uslugaKod: e.target.value || null, pewne: true, wybrany: !!e.target.value })}
                  >
                    <option value="">— pomiń —</option>
                    {uslugi.map((u) => (
                      <option key={u.kod} value={u.kod}>
                        {u.nazwa}
                      </option>
                    ))}
                  </select>
                  <span className="pole-z-jednostka">
                    <input inputMode="decimal" aria-label={`Cena — ${w.nazwa}`} value={w.cena} onChange={(e) => zmien(i, { cena: e.target.value })} />
                    zł
                  </span>
                  <span className="pole-z-jednostka">
                    <input
                      inputMode="numeric"
                      aria-label={`Czas — ${w.nazwa}`}
                      placeholder={String(KATALOG_USLUG.find((u) => u.kod === w.uslugaKod)?.typowyCzasMin ?? "")}
                      value={w.czas}
                      onChange={(e) => zmien(i, { czas: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                    />
                    min
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {pracownicy.length > 0 && (
            <label className="oswiadczenie">
              <input type="checkbox" checked={zPracownikami} onChange={(e) => setZPracownikami(e.target.checked)} />
              <span>
                Dodaj też zespół z pliku: <strong>{pracownicy.map((p) => p.imie).join(", ")}</strong> (same imiona, z usługami, które wykonują).
              </span>
            </label>
          )}
          <p className="wyciszony maly">
            Kilka pozycji tej samej usługi (warianty, różne osoby) łączymy w jedną z najniższą ceną — w cenniku podajesz cenę „od”.
          </p>
        </div>
        <footer className="nakladka-stopka">
          <button type="button" className="btn btn-duzy btn-obrys" onClick={() => setWiersze(null)}>
            Wróć
          </button>
          <button
            type="button"
            className="btn btn-duzy"
            disabled={wynik.pozycje.length === 0}
            onClick={() => onWstaw({ pozycje: wynik.pozycje, pracownicy: zPracownikami ? pracownicy : [] })}
          >
            Wstaw do cennika · {wynik.pozycje.length} {odmiana(wynik.pozycje.length, "usługa", "usługi", "usług")}
          </button>
        </footer>
      </>
    );
  }

  return (
    <>
      <div className="nakladka-tresc import-cennika">
        <div className="logowanie-intro">
          <h2>Import cennika</h2>
          <p className="wyciszony">Masz cennik na stronie, w innym systemie albo na kartce? Wczytaj go — dopasujemy usługi, a Ty tylko sprawdzisz.</p>
        </div>
        <div className="segment" role="tablist" aria-label="Skąd import">
          {ZRODLA.map((z) => (
            <button key={z.id} type="button" role="tab" aria-selected={zrodlo === z.id} className={zrodlo === z.id ? "wybrany" : ""} onClick={() => setZrodlo(z.id)}>
              <Ikona nazwa={z.ikona} rozmiar={16} /> {z.etykieta}
            </button>
          ))}
        </div>

        {zrodlo === "tekst" && (
          <>
            <textarea
              className="tekst-importu"
              rows={10}
              aria-label="Cennik do wklejenia"
              placeholder={"Wklej cennik, np.:\nManicure hybrydowy — 120 zł, 60 min\nPedicure hybrydowy — od 150 zł\nZdjęcie hybrydy 30 zł"}
              value={tekst}
              onChange={(e) => setTekst(e.target.value)}
            />
            <button type="button" className="btn" disabled={tekst.trim().length < 5} onClick={() => rozpoznajTekst(tekst)}>
              Rozpoznaj usługi
            </button>
          </>
        )}
        {zrodlo === "zdjecie" && (
          <label className="wybor-pliku">
            <Ikona nazwa="aparat" rozmiar={28} />
            <strong>Zrób albo wybierz zdjęcie cennika</strong>
            <span className="wyciszony maly">Tekst odczytujemy na Twoim telefonie — zdjęcie nigdzie nie wychodzi. Najlepiej z bliska, prosto i przy dobrym świetle.</span>
            <input type="file" accept="image/*" onChange={zdjecie} disabled={postep !== null} />
          </label>
        )}
        {zrodlo === "plik" && (
          <label className="wybor-pliku">
            <Ikona nazwa="plik" rozmiar={28} />
            <strong>Wybierz plik CSV albo Excel</strong>
            <span className="wyciszony maly">
              Np. eksport usług z innego systemu rezerwacji. Potrzebne są kolumny z nazwą usługi i ceną; czas i pracownik — jeśli są. Dane klientów w pliku
              pomijamy.
            </span>
            <input type="file" accept=".csv,.tsv,.txt,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={plik} disabled={postep !== null} />
          </label>
        )}
        {postep && (
          <p className="postep-importu" role="status">
            <span className="kropka-live" aria-hidden="true" /> {postep}
          </p>
        )}
        {blad && (
          <p className="blad-pola" role="alert">
            {blad}
          </p>
        )}
      </div>
      <footer className="nakladka-stopka">
        <button type="button" className="btn btn-duzy btn-obrys" onClick={onAnuluj}>
          Wróć do cennika
        </button>
      </footer>
    </>
  );
}

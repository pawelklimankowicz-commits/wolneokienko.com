// Generator wniosku o eksport danych firmy od obecnego dostawcy systemu rezerwacji
// (Data Act). Salon wysyła go sam ze swojej poczty; otrzymany plik wczytuje
// w imporcie cennika. Treść: src/domain/wniosek-eksport.ts.
import { useState } from "react";
import type { SalonKonta } from "@/domain/rejestracja-salonu";
import { ZAKRES_EKSPORTU, brakujacePolaWniosku, wniosekOEksport, type ZakresEksportu } from "@/domain/wniosek-eksport";

export function WniosekEksport({ salon, onImport, onInfo }: { salon: SalonKonta; onImport: () => void; onInfo: (tekst: string) => void }) {
  const [dostawca, setDostawca] = useState("");
  const [emailKonta, setEmailKonta] = useState(salon.email);
  const [zakres, setZakres] = useState<ZakresEksportu[]>(["uslugi", "pracownicy", "profil"]);
  const [osobaFizyczna, setOsobaFizyczna] = useState(false);
  const [wypowiadam, setWypowiadam] = useState(false);

  const dane = {
    dostawca,
    nazwaFirmy: salon.nazwa,
    nip: salon.nip,
    adres: `${salon.ulica}, ${salon.kodPocztowy} ${salon.miasto}`,
    emailKonta,
    miejscowosc: salon.miasto,
    data: new Date(),
    zakres,
    osobaFizyczna,
    wypowiadam,
  };
  const braki = brakujacePolaWniosku(dane);
  const { temat, tresc } = wniosekOEksport(dane);

  const kopiuj = async () => {
    try {
      await navigator.clipboard.writeText(tresc);
      onInfo("Skopiowane. Wklej do wiadomości do obsługi klienta.");
    } catch {
      onInfo("Nie udało się skopiować — zaznacz tekst i skopiuj ręcznie.");
    }
  };
  const pobierz = () => {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([tresc], { type: "text/plain;charset=utf-8" }));
    a.download = "wniosek-o-eksport-danych.txt";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="nakladka-tresc wniosek-eksport">
      <div className="logowanie-intro">
        <h2>Wniosek o eksport danych</h2>
        <p className="wyciszony">
          Obecny dostawca systemu rezerwacji musi wydać Ci dane Twojej firmy w pliku (unijny akt w sprawie danych). Uzupełnij, wyślij ze swojej poczty,
          a otrzymany plik wczytaj w imporcie cennika. Bez podawania nam haseł do innych systemów.
        </p>
      </div>

      <label className="pole">
        <span className="pole-etykieta">Dostawca</span>
        <input list="dostawcy" placeholder="np. Booksy" value={dostawca} onChange={(e) => setDostawca(e.target.value)} />
        <datalist id="dostawcy">
          <option value="Booksy" />
          <option value="Versum" />
          <option value="Fresha" />
        </datalist>
      </label>
      <label className="pole">
        <span className="pole-etykieta">E-mail konta u tego dostawcy</span>
        <input type="email" value={emailKonta} onChange={(e) => setEmailKonta(e.target.value)} />
      </label>

      <fieldset className="grupa">
        <legend>Czego potrzebujesz</legend>
        {ZAKRES_EKSPORTU.map((z) => (
          <label key={z.id} className="oswiadczenie">
            <input
              type="checkbox"
              checked={zakres.includes(z.id)}
              onChange={(e) => setZakres(e.target.checked ? [...zakres, z.id] : zakres.filter((x) => x !== z.id))}
            />
            <span>{z.opis[0].toUpperCase() + z.opis.slice(1)}</span>
          </label>
        ))}
      </fieldset>
      <label className="oswiadczenie">
        <input type="checkbox" checked={osobaFizyczna} onChange={(e) => setOsobaFizyczna(e.target.checked)} />
        <span>Prowadzę jednoosobową działalność — dodaj też prawo do przenoszenia moich danych osobowych (RODO).</span>
      </label>
      <label className="oswiadczenie">
        <input type="checkbox" checked={wypowiadam} onChange={(e) => setWypowiadam(e.target.checked)} />
        <span>Po przekazaniu danych rezygnuję z tej usługi. Bez zaznaczenia prosisz tylko o eksport.</span>
      </label>

      <label className="pole">
        <span className="pole-etykieta">Treść · {temat}</span>
        <textarea className="tresc-wniosku" readOnly rows={14} value={tresc} />
      </label>
      {braki.length > 0 && <p className="blad-pola">Uzupełnij: {braki.join(", ")}.</p>}
      <div className="przyciski-rzad">
        <button type="button" className="btn" disabled={braki.length > 0} onClick={kopiuj}>
          Kopiuj treść
        </button>
        <a
          className={`btn btn-obrys ${braki.length ? "wylaczony" : ""}`}
          aria-disabled={braki.length > 0}
          href={braki.length ? undefined : `mailto:?subject=${encodeURIComponent(temat)}&body=${encodeURIComponent(tresc)}`}
        >
          Otwórz w poczcie
        </a>
        <button type="button" className="btn btn-obrys" disabled={braki.length > 0} onClick={pobierz}>
          Pobierz .txt
        </button>
      </div>
      <p className="wyciszony maly">
        Adres obsługi klienta znajdziesz w ustawieniach konta albo w regulaminie dostawcy. To wzór pisma przygotowany na podstawie przepisów, nie porada prawna.
        Jeśli dostawca odmówi albo nie odpowie w 30 dni, napisz do nas — pomożemy.
      </p>
      <button type="button" className="link" onClick={onImport}>
        Mam już plik z danymi → importuj cennik
      </button>
    </div>
  );
}

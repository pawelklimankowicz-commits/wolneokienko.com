import { Ikona, type NazwaIkony } from "@/ui/Ikona";
import { EtykietaPodgladu } from "@/ui/wspolne";

const MENU: { etykieta: string; ikona: NazwaIkony }[] = [
  { etykieta: "Twoje dane", ikona: "profil" },
  { etykieta: "Ulubione salony", ikona: "serce" },
  { etykieta: "Powiadomienia", ikona: "dzwonek" },
  { etykieta: "Regulamin i prywatność", ikona: "tarcza" },
];

export function Profil({ onSalon, onInfo }: { onSalon: () => void; onInfo: (tekst: string) => void }) {
  return (
    <div className="ekran ekran-jasny">
      <header className="profil-naglowek">
        <span className="profil-awatar" aria-hidden="true">
          A
        </span>
        <div>
          <h1>Anna</h1>
          <p className="wyciszony">
            +48 600 *** 123 · <span className="zweryfikowany">zweryfikowany</span>
          </p>
        </div>
      </header>
      <EtykietaPodgladu />

      <section className="baner-polecen">
        <div>
          <h2>Poleć Wolne Okienko</h2>
          <p>Koleżanka dostaje pierwszą wizytę szybciej, Ty — miejsce w pierwszej fali ofert.</p>
          <button type="button" className="btn btn-maly" onClick={() => onInfo("Link do polecenia skopiowany.")}>
            Poleć <Ikona nazwa="dalej" rozmiar={16} />
          </button>
        </div>
        <span className="baner-znak" aria-hidden="true">
          <Ikona nazwa="prezent" rozmiar={46} />
        </span>
      </section>

      <nav className="menu-lista" aria-label="Ustawienia konta">
        {MENU.map((m) => (
          <button key={m.etykieta} type="button" onClick={() => onInfo(`${m.etykieta}: w kolejnej wersji.`)}>
            <Ikona nazwa={m.ikona} />
            <span>{m.etykieta}</span>
            <Ikona nazwa="dalej" rozmiar={18} className="menu-strzalka" />
          </button>
        ))}
        <button type="button" className="menu-salon" onClick={onSalon}>
          <Ikona nazwa="salon" />
          <span>
            Masz salon?
            <small>Zobacz aplikację dla salonów</small>
          </span>
          <Ikona nazwa="dalej" rozmiar={18} className="menu-strzalka" />
        </button>
      </nav>
    </div>
  );
}

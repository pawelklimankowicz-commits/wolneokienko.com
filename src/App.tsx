// Strona startowa wolneokienko.com na czas budowy fazy 1: mówi klientkom,
// czym jest aplikacja, a salonom — na jakich warunkach dołączają.
import { PROMOCJA_STARTOWA, STAWKA_PROWIZJI } from "./domain/prowizja";

const procent = Math.round(STAWKA_PROWIZJI * 100);

export default function App() {
  return (
    <main className="strona">
      <header className="marka">
        <svg viewBox="0 0 64 64" aria-hidden="true" className="znak">
          <rect x="5" y="11" width="44" height="44" rx="13" fill="none" stroke="currentColor" strokeWidth="5.5" />
          <line x1="27" y1="13" x2="27" y2="53" stroke="currentColor" strokeWidth="3" />
          <line x1="7" y1="33" x2="47" y2="33" stroke="currentColor" strokeWidth="3" />
          <circle className="kropka" cx="49" cy="12" r="9" strokeWidth="5" />
        </svg>
        <h1>Wolne Okienko</h1>
      </header>

      <p className="lead">
        Napisz, czego potrzebujesz i na kiedy. Salony w okolicy, które mają teraz wolny czas, odpowiedzą godziną i ceną w kilka minut.
      </p>

      <section className="karta">
        <h2>Dla salonów</h2>
        <ul>
          <li>Płacisz tylko za wizytę, która przyszła przez aplikację: {procent}% + VAT.</li>
          <li>Bez abonamentu i bez umowy terminowej.</li>
          <li>
            Miesiąc próbny: {PROMOCJA_STARTOWA.darmoweWizyty} pierwszych klientek bez prowizji.
          </li>
          <li>Klientka płaci u Ciebie w salonie, bez przedpłat w aplikacji.</li>
          <li>Zostajesz przy swoim kalendarzu. My wypełniamy wolne okienka.</li>
        </ul>
      </section>

      <p className="start">Start w Poznaniu: listopad 2026.</p>
    </main>
  );
}

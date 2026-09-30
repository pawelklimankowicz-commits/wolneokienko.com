// Profil salonu, który klientka ogląda przy ofercie: zdjęcia prac, opis,
// zespół i cennik „od”. Dane z GET /api/salony/:id (bez NIP-u i telefonu —
// telefon dostaje dopiero po rezerwacji).
import { useEffect, useState } from "react";
import { KATALOG_USLUG } from "@/domain/katalog-uslug";
import { koloryDla } from "@/domain/odleglosc";
import type { ProfilPubliczny } from "@/domain/profil-salonu";
import type { KlientApi } from "@/lib/api";
import { cena } from "@/lib/format";
import { Ikona } from "@/ui/Ikona";
import { AwatarKolory, NaglowekEkranu } from "@/ui/wspolne";

const nazwaUslugi = (kod: string) => KATALOG_USLUG.find((u) => u.kod === kod)?.nazwa ?? kod;

export function ProfilSalonu({ api, salonId, onZamknij }: { api: KlientApi; salonId: string; onZamknij: () => void }) {
  const [profil, setProfil] = useState<ProfilPubliczny | null | undefined>(undefined);
  const [powiekszone, setPowiekszone] = useState<string | null>(null);

  useEffect(() => {
    let aktualne = true;
    api.profilSalonu(salonId).then((p) => aktualne && setProfil(p));
    return () => {
      aktualne = false;
    };
  }, [api, salonId]);

  return (
    <div className="nakladka nakladka-profilu">
      <NaglowekEkranu tytul={profil?.nazwa ?? "Salon"} onWstecz={onZamknij} />
      <div className="nakladka-tresc">
        {profil === undefined && <p className="wyciszony srodek">Wczytuję…</p>}
        {profil === null && <p className="wyciszony srodek">Nie udało się wczytać profilu. Spróbuj za chwilę.</p>}
        {profil && (
          <>
            <div className="profil-glowa">
              <AwatarKolory nazwa={profil.nazwa} kolory={koloryDla(profil.id)} rozmiar={64} logoUrl={profil.logoUrl} />
              <div>
                <h2>{profil.nazwa}</h2>
                <p className="wyciszony maly">
                  <Ikona nazwa="pinezka" rozmiar={14} /> {profil.adres}
                </p>
              </div>
            </div>
            {profil.zdjecia.length > 0 && (
              <div className="galeria">
                {profil.zdjecia.map((url) => (
                  <button key={url} type="button" onClick={() => setPowiekszone(url)} aria-label="Powiększ zdjęcie">
                    <img src={url} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
            {profil.opis && <p className="opis-salonu">{profil.opis}</p>}
            {profil.pracownicy.length > 0 && (
              <section>
                <h3 className="maly-naglowek">Zespół</h3>
                <p>{profil.pracownicy.join(", ")}</p>
              </section>
            )}
            {profil.cennik.length > 0 && (
              <section className="karta-panelu">
                <h3>Cennik</h3>
                <ul className="cennik-lista">
                  {profil.cennik.map((c) => (
                    <li key={c.uslugaKod}>
                      <span>{nazwaUslugi(c.uslugaKod)}</span>
                      <span className="wyciszony">od {cena(c.cenaGr)}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <p className="wyciszony maly">Zdjęcia i opis dodał salon. Telefon zobaczysz po rezerwacji.</p>
          </>
        )}
      </div>
      {powiekszone && (
        <button type="button" className="powiekszenie" onClick={() => setPowiekszone(null)} aria-label="Zamknij zdjęcie">
          <img src={powiekszone} alt="" />
        </button>
      )}
    </div>
  );
}

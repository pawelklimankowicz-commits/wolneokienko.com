// Podgląd bez serwera (`npm run build:podglad`): te same ekrany i zachowanie,
// dane w pamięci przeglądarki. Kod logowania zawsze 123456; oferty napływają
// od usługodawców z danych przykładowych, salon dostaje symulowane zapytanie.
import { SALONY, WIZYTY, ofertyDla, salon as salonPrzykladowy } from "../dane/przyklad";
import { zaplanujFale } from "../domain/fale";
import { KATALOG_USLUG } from "../domain/katalog-uslug";
import { proponowaneTerminy } from "../domain/okno";
import { LIMITY_PROFILU, oczyscPracownikow, rodzajObrazu, walidujPracownikow } from "../domain/profil-salonu";
import { bezBledow, oczyscDane, walidujCennik, walidujDaneSalonu, type SalonKonta } from "../domain/rejestracja-salonu";
import { obrazKategorii } from "../ui/obrazyKategorii";
import type { OfertaNaZywo, StanZapytania, WizytaSalonu, WizytaWidok, ZapytanieDlaSalonu } from "../domain/widoki";
import { KANDYDACI_PODGLAD } from "../dane/przyklad";
import { komunikatBledu, type KlientApi, type Konto } from "./api-typy";

/** W podglądzie część ofert ma imię osoby, która wykona usługę. */
const PRACOWNICY_PODGLADU = ["Ania", null, "Kasia", "Ola", null];
const bajtyZBase64 = (b: string) => {
  try {
    return Uint8Array.from(atob(b), (z) => z.charCodeAt(0));
  } catch {
    return null;
  }
};

const MIESIACE = ["Styczeń", "Luty", "Marzec", "Kwiecień", "Maj", "Czerwiec", "Lipiec", "Sierpień", "Wrzesień", "Październik", "Listopad", "Grudzień"];

interface ZapytaniePodgladu {
  stan: StanZapytania;
  start: number;
  tryb: "zbieram" | "pierwsza";
  wszystkie: (OfertaNaZywo & { poSek: number })[];
}

export function apiPodglad(): KlientApi {
  const KOD = "123456";
  const chwila = (ms = 450) => new Promise((r) => setTimeout(r, ms));
  let konto: Konto | null = null;
  let salon: SalonKonta | null = null;
  let proby = 5;
  let nr = 0;
  const zapytania = new Map<string, ZapytaniePodgladu>();
  // wizyty z danych przykładowych (jak w poprzednich wersjach podglądu) + nowe rezerwacje
  let wizyty: WizytaWidok[] = WIZYTY.map((w) => {
    const s = salonPrzykladowy(w.salonId);
    const [h, m] = w.godzina.split(":").map(Number);
    return {
      id: w.id,
      salonId: s.id,
      salonNazwa: s.nazwa,
      adres: s.adres,
      telefon: "+48600100200",
      uslugaKod: KATALOG_USLUG.find((u) => u.nazwa === w.usluga)?.kod ?? "manicure_hybrydowy",
      termin: new Date(2026, MIESIACE.indexOf(w.miesiac), w.dzien, h, m).toISOString(),
      cenaGr: w.cenaGr,
      kolory: s.okladka,
      status: w.status,
      pracownik: null,
      logoUrl: null,
    };
  });
  // skrzynka salonu: jedno zapytanie z okolicy po włączeniu przyjmowania
  let skrzynka: (ZapytanieDlaSalonu & { ofertaO?: number })[] = [];
  let wizytySalonu: WizytaSalonu[] = [];

  function zrobRezerwacje(z: ZapytaniePodgladu, o: OfertaNaZywo): WizytaWidok {
    const s = SALONY.find((x) => x.id === o.salonId)!;
    const w: WizytaWidok = {
      id: `r${++nr}`,
      salonId: s.id,
      salonNazwa: s.nazwa,
      adres: s.adres,
      telefon: "+48600100200",
      uslugaKod: z.stan.uslugaKod,
      termin: o.termin,
      cenaGr: o.cenaGr,
      kolory: s.okladka,
      status: "potwierdzona",
      pracownik: o.pracownik,
      logoUrl: null,
    };
    wizyty = [w, ...wizyty];
    z.stan = { ...z.stan, status: "zarezerwowane", oferty: [], rezerwacjaId: w.id };
    return w;
  }

  function odswiezSkrzynke(teraz: number) {
    skrzynka = skrzynka.map((z) => {
      if (z.mojaOferta?.status === "zlozona" && z.ofertaO && teraz - z.ofertaO > 6000) {
        wizytySalonu = [
          {
            id: `ws${++nr}`,
            uslugaKod: z.uslugaKod,
            termin: z.mojaOferta.termin,
            cenaGr: z.mojaOferta.cenaGr,
            telefonKlientki: "+48600123123",
            status: "potwierdzona",
            pracownik: z.mojaOferta.pracownik,
          },
          ...wizytySalonu,
        ];
        return { ...z, mojaOferta: { ...z.mojaOferta, status: "potwierdzona" } };
      }
      return z;
    });
  }

  return {
    podglad: true,
    async ja() {
      return konto;
    },
    async wyslijKod(telefon) {
      await chwila();
      const cyfry = telefon.replace(/\D/g, "").replace(/^48(?=\d{9}$)/, "");
      if (!/^[1-9]\d{8}$/.test(cyfry)) return { ok: false, ...komunikatBledu({ blad: "zly_numer" }) };
      proby = 5;
      return { ok: true, telefon: `+48${cyfry}` };
    },
    async zaloguj(telefon, kod, rola = "klientka") {
      await chwila();
      if (kod !== KOD) return { ok: false, ...komunikatBledu(--proby > 0 ? { blad: "zly_kod", pozostaloProb: proby } : { blad: "za_duzo_prob" }) };
      konto = { id: "podglad", rola, telefon };
      return { ok: true, konto };
    },
    async wyloguj() {
      konto = null;
      salon = null;
    },
    async mojSalon() {
      return salon;
    },
    async zapiszSalon(dane, akceptujeRegulamin) {
      await chwila();
      const pola = walidujDaneSalonu(dane);
      if (!bezBledow(pola)) return { ok: false, ...komunikatBledu({ blad: "zle_dane", pola }) };
      if (!salon && !akceptujeRegulamin) return { ok: false, ...komunikatBledu({ blad: "brak_akceptacji" }) };
      const d = oczyscDane(dane);
      salon = {
        id: "podglad",
        przyjmujeZapytania: false,
        aktywowanyAt: null,
        wstrzymany: false,
        wizytyZrealizowane: 0,
        cennik: [],
        opis: null,
        logoUrl: null,
        zdjecia: [],
        pracownicy: [],
        kalendarz: null,
        ...salon,
        ...d,
        adresZMapy: `${d.ulica}, ${d.miasto}`,
      };
      if (konto) konto = { ...konto, rola: "salon" };
      return { ok: true, salon };
    },
    async zapiszCennik(pozycje) {
      await chwila();
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      const cennik = walidujCennik(salon.branza, pozycje);
      if (!bezBledow(cennik)) return { ok: false, ...komunikatBledu({ blad: "zle_dane", cennik }) };
      salon = { ...salon, cennik: [...pozycje].sort((a, b) => a.usluga.localeCompare(b.usluga)) };
      return { ok: true, salon };
    },
    async ustawPrzyjmowanie(wlaczone) {
      await chwila();
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      if (wlaczone && !salon.cennik.length) return { ok: false, ...komunikatBledu({ blad: "brak_cennika" }) };
      salon = { ...salon, przyjmujeZapytania: wlaczone, aktywowanyAt: salon.aktywowanyAt ?? (wlaczone ? new Date().toISOString() : null) };
      if (wlaczone && !skrzynka.length) {
        const p = salon.cennik[0];
        const teraz = new Date();
        const od = new Date(Math.ceil((teraz.getTime() + 45 * 60000) / (15 * 60000)) * 15 * 60000);
        skrzynka = [
          {
            id: "pz1",
            uslugaKod: p.usluga,
            oknoOd: od.toISOString(),
            oknoDo: new Date(od.getTime() + 4 * 3600000).toISOString(),
            limitGr: Math.round((p.cenaGr * 1.25) / 1000) * 1000,
            liczbaOsob: null,
            odlegloscKm: 1.2,
            tresc: null,
            zbieranieDo: new Date(teraz.getTime() + 10 * 60000).toISOString(),
            mojaCenaGr: p.cenaGr,
            czasMin: p.czasMin,
            mojaOferta: null,
            odmowa: false,
            // podłączony kalendarz: druga godzina okna zajęta
            zajete: salon.kalendarz ? [{ od: new Date(od.getTime() + 3600000).toISOString(), do: new Date(od.getTime() + 2 * 3600000).toISOString() }] : [],
          },
        ];
      }
      return { ok: true, salon };
    },

    async wyslijZapytanie(d) {
      await chwila(600);
      const usluga = KATALOG_USLUG.find((u) => u.kod === d.uslugaKod);
      if (!usluga) return { ok: false, ...komunikatBledu({ blad: "zle_dane", pole: "uslugaKod" }) };
      const okno = { od: new Date(d.oknoOd), do: new Date(d.oknoDo) };
      const terminy = proponowaneTerminy(okno, new Date(), usluga.typowyCzasMin, 4);
      const wszystkie = ofertyDla(usluga, null)
        .map((o, i) => {
          const s = SALONY.find((x) => x.id === o.salonId)!;
          return {
            id: `o${++nr}`,
            salonId: s.id,
            salonNazwa: s.nazwa,
            okolica: s.dzielnica,
            odlegloscKm: s.km || null,
            termin: (terminy[i % Math.max(terminy.length, 1)] ?? okno.od).toISOString(),
            cenaGr: o.cenaGr,
            kolory: s.okladka,
            pracownik: PRACOWNICY_PODGLADU[i % PRACOWNICY_PODGLADU.length],
            logoUrl: null,
            poSek: o.poSek,
          };
        })
        .filter((o) => d.limitGr === null || o.cenaGr <= d.limitGr);
      const plan = zaplanujFale(KANDYDACI_PODGLAD);
      const id = `z${++nr}`;
      const z: ZapytaniePodgladu = {
        start: Date.now(),
        tryb: d.tryb,
        wszystkie,
        stan: {
          id,
          status: "otwarte",
          uslugaKod: usluga.kod,
          zbieranieDo: new Date(Date.now() + plan.terminOdpowiedziSek * 1000).toISOString(),
          liczbaWykonawcow: plan.fale.reduce((n, f) => n + f.salonIds.length, 0),
          oferty: [],
          rezerwacjaId: null,
        },
      };
      zapytania.set(id, z);
      return { ok: true, zapytanie: z.stan };
    },
    async stanZapytania(id) {
      const z = zapytania.get(id);
      if (!z) return null;
      if (z.stan.status !== "otwarte") return z.stan;
      const sek = (Date.now() - z.start) / 1000;
      const widoczne = z.wszystkie.filter((o) => o.poSek <= sek).map(({ poSek: _p, ...o }) => o);
      if (z.tryb === "pierwsza" && widoczne.length) {
        zrobRezerwacje(z, widoczne[0]);
        return z.stan;
      }
      if (sek > 600 + 15 * 60) z.stan = { ...z.stan, status: widoczne.length ? "wygasle" : "bez_ofert", oferty: [] };
      else z.stan = { ...z.stan, oferty: widoczne.sort((a, b) => a.termin.localeCompare(b.termin)) };
      return z.stan;
    },
    async anulujZapytanie(id) {
      const z = zapytania.get(id);
      if (z && z.stan.status === "otwarte") z.stan = { ...z.stan, status: "anulowane", oferty: [] };
    },
    async przyjmijOferte(ofertaId) {
      await chwila();
      for (const z of zapytania.values()) {
        const o = z.stan.oferty.find((x) => x.id === ofertaId);
        if (o && z.stan.status === "otwarte") return { ok: true, wizyta: zrobRezerwacje(z, o) };
      }
      return { ok: false, ...komunikatBledu({ blad: "nieaktualna" }) };
    },
    async mojeWizyty() {
      return wizyty;
    },
    async odwolajWizyte(id) {
      wizyty = wizyty.map((w) => (w.id === id ? { ...w, status: "odwolana_przez_klientke" } : w));
      return { ok: true };
    },
    async potwierdzWizyte(id, odpowiedz) {
      const status = odpowiedz === "bylam" ? "zakonczona" : odpowiedz === "nie_bylam" ? "nieobecnosc" : "odwolana_przez_salon";
      wizyty = wizyty.map((w) => (w.id === id ? { ...w, status } : w));
      return { ok: true };
    },

    async skrzynkaSalonu() {
      odswiezSkrzynke(Date.now());
      return salon?.przyjmujeZapytania ? skrzynka.map(({ ofertaO: _o, ...z }) => z) : [];
    },
    async zlozOferte(zapytanieId, termin, cenaGr, pracownik = null) {
      await chwila();
      const z = skrzynka.find((x) => x.id === zapytanieId);
      if (!z) return { ok: false, ...komunikatBledu({ blad: "nieaktualne" }) };
      if (z.limitGr !== null && cenaGr > z.limitGr) return { ok: false, ...komunikatBledu({ blad: "powyzej_limitu" }) };
      skrzynka = skrzynka.map((x) =>
        x.id === zapytanieId ? { ...x, mojaOferta: { termin, cenaGr, pracownik, status: "zlozona" }, odmowa: false, ofertaO: Date.now() } : x,
      );
      return { ok: true, przyjeta: false };
    },
    async odmowZapytania(zapytanieId) {
      skrzynka = skrzynka.map((x) => (x.id === zapytanieId ? { ...x, odmowa: true } : x));
      return { ok: true };
    },
    async wizytySalonu() {
      odswiezSkrzynke(Date.now());
      return wizytySalonu;
    },

    // profil i import: zdjęcia jako adresy data: w pamięci
    async zapiszOpis(opis) {
      await chwila(250);
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      if (opis.trim().length > LIMITY_PROFILU.maksOpis) return { ok: false, ...komunikatBledu({ blad: "za_dlugi" }) };
      salon = { ...salon, opis: opis.trim() || null };
      return { ok: true, salon };
    },
    async dodajZdjecie(rodzaj, dane, oswiadczenie) {
      await chwila();
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      if (!oswiadczenie) return { ok: false, ...komunikatBledu({ blad: "brak_oswiadczenia" }) };
      const bajty = bajtyZBase64(dane);
      const typ = bajty && rodzajObrazu(bajty);
      if (!typ) return { ok: false, ...komunikatBledu({ blad: "zly_plik" }) };
      const url = `data:${typ};base64,${dane}`;
      if (rodzaj === "logo") salon = { ...salon, logoUrl: url };
      else if (salon.zdjecia.length >= LIMITY_PROFILU.maksZdjec) return { ok: false, ...komunikatBledu({ blad: "za_duzo_zdjec" }) };
      else salon = { ...salon, zdjecia: [...salon.zdjecia, { id: `zd${++nr}`, url }] };
      return { ok: true, salon };
    },
    async usunZdjecie(id) {
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      // logo nie ma tu osobnego identyfikatora: nieznany id = usunięcie logo
      salon = salon.zdjecia.some((z) => z.id === id) ? { ...salon, zdjecia: salon.zdjecia.filter((z) => z.id !== id) } : { ...salon, logoUrl: null };
      return { ok: true, salon };
    },
    async zapiszPracownikow(lista) {
      await chwila(300);
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      const blad = walidujPracownikow(salon.branza, lista);
      if (blad) return { ok: false, ...komunikatBledu({ blad: "zle_dane", komunikat: blad }) };
      salon = { ...salon, pracownicy: oczyscPracownikow(lista) };
      return { ok: true, salon };
    },
    async polaczKalendarz(adres) {
      await chwila(900);
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      let host: string;
      try {
        host = new URL(adres.trim().replace(/^webcal:/i, "https:")).host;
      } catch {
        return { ok: false, ...komunikatBledu({ blad: "zly_adres" }) };
      }
      if (!/^(calendar\.google\.com|outlook\.(office365|live|office)\.com|[\w-]+\.icloud\.com)$/.test(host))
        return { ok: false, ...komunikatBledu({ blad: "niedozwolony_host" }) };
      salon = { ...salon, kalendarz: { host, pobranoAt: new Date().toISOString(), blad: null, zajeteBloki: 7 } };
      skrzynka = skrzynka.map((z) => ({ ...z, zajete: [{ od: new Date(new Date(z.oknoOd).getTime() + 3600000).toISOString(), do: new Date(new Date(z.oknoOd).getTime() + 7200000).toISOString() }] }));
      return { ok: true, salon };
    },
    async odlaczKalendarz() {
      if (!salon) return { ok: false, ...komunikatBledu({ blad: "brak_salonu" }) };
      salon = { ...salon, kalendarz: null };
      skrzynka = skrzynka.map((z) => ({ ...z, zajete: [] }));
      return { ok: true, salon };
    },
    async profilSalonu(id) {
      await chwila(250);
      const s = SALONY.find((x) => x.id === id);
      if (!s) return null;
      return {
        id: s.id,
        nazwa: s.nazwa,
        opis: `${s.nazwa} — ${s.dzielnica}. Przykładowy profil w podglądzie: tu salon opisuje siebie, a poniżej pokazuje zdjęcia swoich prac.`,
        adres: s.adres,
        logoUrl: null,
        zdjecia: s.kategorie.map((k) => obrazKategorii(k)).filter((u): u is string => !!u).slice(0, 4),
        pracownicy: ["Ania", "Kasia", "Ola"],
        cennik: KATALOG_USLUG.filter((u) => s.kategorie.includes(u.kategoria))
          .slice(0, 6)
          .map((u, i) => ({ uslugaKod: u.kod, cenaGr: 8000 + i * 2000 })),
      };
    },
  };
}

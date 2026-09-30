# Rejestr czynności przetwarzania (art. 30 RODO)

Dokument wewnętrzny. Stan na 1 października 2026 r. Administrator: [NAZWA SPÓŁKI], [ADRES], dane@wolneokienko.com. Inspektor ochrony danych: niewyznaczony (zob. ocena skutków, pkt 7).

| # | Czynność | Kategorie osób | Kategorie danych | Cel | Podstawa | Odbiorcy | Poza EOG | Usunięcie | Zabezpieczenia |
|---|---|---|---|---|---|---|---|---|---|
| 1 | Logowanie kodem SMS | klientki, osoby z firm Usługodawców | numer telefonu, skrót kodu, skrót IP, sesja | konto i bezpieczne logowanie | 6.1.b, 6.1.f | SMSAPI (procesor), Neon (procesor) | Neon: dostęp z USA (DPF/SCC) | kody i IP po 30 dniach; sesje 30 dni po wygaśnięciu | HMAC z pieprzem, limity prób i wysyłek, HTTPS |
| 2 | Zapytania i rozsyłanie | klientki | usługa, termin, limit ceny, opis, punkt na mapie | dopasowanie Ofert | 6.1.b | Usługodawcy w obszarze (bez numeru i bez dokładnego miejsca), Neon | j.w. | Zapytania bez Wizyty po 30 dniach | Usługodawcy widzą odległość, nie miejsce |
| 3 | Zapytania medyczne | klientki | rodzaj wizyty medycznej (art. 9) | dopasowanie Ofert gabinetów | 9.2.a (wyraźna zgoda) | gabinety w obszarze (bez opisu z pola tekstowego) | j.w. | jak 2 i 4 | zgoda z datą w `zapytania.zgoda_dane_zdrowotne_at`; opis nie trafia do gabinetów |
| 4 | Wizyty i wynik Wizyty | klientki, Usługodawcy | Oferta, termin, cena, zgłoszenia wyniku, nieobecności | umówienie Wizyty, rozliczenie prowizji, zasady nieobecności | 6.1.b, 6.1.f | wybrany Usługodawca (numer telefonu Klientki) | j.w. | powiązanie z Klientką po 12 miesiącach; dane rozliczeniowe 5 lat | spór rozstrzyga człowiek; blokada z uzasadnieniem |
| 5 | Opinie | klientki, Usługodawcy | ocena, komentarz, odpowiedź | publikacja opinii | 6.1.b | wszyscy użytkownicy | j.w. | do usunięcia opinii | tylko po Wizycie, moderacja |
| 6 | Rejestracja Usługodawcy | Usługodawcy (w tym JDG), osoby wskazane w oświadczeniach | nazwa, NIP, adres, telefon, e-mail, numer w rejestrze, oświadczenia o lekarzu i kwalifikacjach | umowa, weryfikacja uprawnień | 6.1.b, 6.1.f | OpenStreetMap (adres, geokodowanie), Neon | OSM: Wielka Brytania (decyzja o adekwatności) | do końca umowy + przedawnienie | walidacja NIP, adres na mapie |
| 7 | Faktury i rozliczenia | Usługodawcy | dane do faktury, zestawienia Wizyt | obowiązki podatkowe, KSeF | 6.1.c | Ministerstwo Finansów (KSeF), biuro rachunkowe | nie | 5 lat od końca roku podatkowego | — |
| 8 | DAC7 | Usługodawcy | dane identyfikacyjne, data urodzenia (JDG), liczba i wartość Wizyt, prowizje | informacja dla Szefa KAS | 6.1.c | Szef KAS | nie | 5 lat od końca roku złożenia informacji | procedura DAC7 |
| 9 | Zgłoszenia DSA, reklamacje, skargi | wszyscy | treść zgłoszenia, dane kontaktowe, decyzje | obowiązki z DSA i prawa konsumenckiego | 6.1.c, 6.1.f | — | nie | 12 miesięcy po zamknięciu | — |
| 10 | Korespondencja | wszyscy | e-mail, treść | odpowiedzi na pytania | 6.1.f | dostawca poczty [DO WYBORU] | zależnie od dostawcy | 12 miesięcy | — |
| 11 | Profil Usługodawcy | Usługodawcy, osoby widoczne na zdjęciach | opis, logo, zdjęcia (wizerunek za zgodą, oświadczenie z datą) | prezentacja Usługodawcy przy Ofercie | 6.1.b | wszyscy użytkownicy (publiczny profil), Neon | j.w. | do usunięcia przez Usługodawcę albo końca umowy | zmniejszanie na urządzeniu usuwa EXIF/GPS; typ pliku sprawdzany po bajtach, bez SVG |

### Jako podmiot przetwarzający (art. 30 ust. 2) — na zlecenie Usługodawców

| # | Kategoria czynności | Administrator | Dane | Podprzetwarzający | Usunięcie | Zabezpieczenia |
|---|---|---|---|---|---|---|
| P1 | Lista pracowników | Usługodawca | imię albo pseudonim, usługi; imię w Ofercie | Neon, Cloudflare | po usunięciu z listy albo końcu umowy | tylko imię (minimalizacja), walidacja |
| P2 | Zajętość z kalendarza | Usługodawca | przedziały zajętości na 8 dni; zaszyfrowany adres iCal | Neon, Cloudflare | przy odłączeniu kalendarza albo końcu umowy | AES-GCM na adres, treści wydarzeń odrzucane przy parsowaniu, lista dozwolonych hostów (SSRF) |

## Podmioty przetwarzające

Umowy powierzenia akceptujemy w panelach dostawców:

- **Neon, Inc.** (Databricks), baza danych w regionie AWS eu-central-1 (Frankfurt). DPA na stronie Neon.
- **LINK Mobility Poland sp. z o.o.** (SMSAPI), wysyłka SMS. Konto Prometheusa; umowa powierzenia w panelu SMSAPI.
- **Cloudflare, Inc.**, hosting Aplikacji (od uruchomienia hostingu). DPA w panelu Cloudflare.
- Biuro rachunkowe: [DO WYBORU].

## Do wdrożenia przed startem (obietnice z polityki prywatności)

- [ ] Codzienne czyszczenie: `kody_sms` starsze niż 30 dni, wygasłe `sesje` starsze niż 30 dni.
- [ ] Zapytania bez Wizyty: usunięcie po 30 dniach.
- [ ] Wizyty: zerwanie powiązania z Klientką (pseudonimizacja) po 12 miesiącach.
- [ ] Usuwanie Konta w Aplikacji; Konto nieużywane 24 miesiące usuwane po SMS-ie z uprzedzeniem.
- [ ] Wycofanie zgody na dane o zdrowiu w profilu.
- [ ] Przy rozsyłaniu Zapytań medycznych gabinety nie dostają pola `tresc`.
- [ ] Czcionki z własnego serwera zamiast Google Fonts.
- [ ] Skrzynki kontakt@, dane@ i dsa@ w domenie wolneokienko.com.

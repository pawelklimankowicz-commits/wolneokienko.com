# Decyzje właściciela — Wolne Okienko

Stan na 30.09.2026. Pełna koncepcja (rynek, fazy, koszty, kolorystyka):
https://claude.ai/artifact/SMFywkP4VAqLcTv8F2WEqa

## 1. Nazwa i domena

- Nazwa: **Wolne Okienko**.
- Domena: **wolneokienko.com**.
- Znak towarowy: zgłaszamy **słowno-graficzny** (nazwa + logo). Samo „wolne okienko”
  opisuje usługę, więc znak słowny UPRP może odrzucić.

## 2. Prowizja

- **20% + VAT od każdej wizyty** przyjętej przez aplikację. Wypełniamy wolne terminy,
  a nie prowadzimy całego kalendarza jak Booksy.
- **Wszystkie branże płacą prowizję, łącznie ze zdrowiem. Nikt nie płaci abonamentu**
  (decyzja z 30.09.2026).
- Bez umowy terminowej.
- Promocja startowa: **miesiąc próbny, w którym 5 pierwszych klientek jest bez prowizji**.
  Darmowe wizyty nie przechodzą na czas po miesiącu próbnym.
- Prowizja idzie na **miesięczną fakturę salonu** (KSeF), bo w fazie 1 nie pobieramy
  żadnych płatności od klientek. Nieopłacona faktura po terminie wstrzymuje salonowi
  zapytania.

## 3. Branże i fazy

**Decyzja z 30.09.2026: aplikacja obsługuje od razu wszystkie branże z wolnymi okienkami:**
uroda, zdrowie (dentysta, lekarz, badania, fizjoterapia, psycholog), auto (opony, serwis,
myjnia), zwierzęta (groomer, weterynarz), sport (korty, trener, joga), nauka (nauka jazdy,
korepetycje), dom (sprzątanie, złota rączka, hydraulik). Katalog: `src/domain/katalog-uslug.ts`.

Fazy określają już tylko zasięg geograficzny i kolejność pozyskiwania usługodawców:

| Faza | Zasięg |
|---|---|
| F1 | Poznań. Start przed grudniowym szczytem. |
| F3 | Wszystkie miasta wojewódzkie. |
| F4 | Wszystkie miasta powiatowe. |
| F5 | Gminy i wsie. |

Faza 0 (test ręczny) pominięta — testem jest F1. Dawne F2 (całe beauty) i F6 (inne branże)
weszły do aplikacji od razu.

### Zdrowie — zasady szczególne

- Informacje podmiotów leczniczych nie mogą mieć cech reklamy (art. 14 ustawy o działalności
  leczniczej): tylko termin, cena i adres; bez promocji i płatnych wyróżnień; kolejność ofert
  według terminu.
- Zapytanie o wizytę medyczną to informacja o zdrowiu (art. 9 RODO): wysłanie wymaga
  zaznaczenia wyraźnej zgody, a klient podaje rodzaj wizyty, nie objawy
  (`zapytania.zgoda_dane_zdrowotne_at`).
- Rozliczenia: prowizja 20% + VAT jak w innych branżach, bez abonamentu (decyzja
  z 30.09.2026). W regulaminie dla gabinetów prowizja jest opisana jako opłata za obsługę
  rezerwacji terminu przez platformę.

## 3a. Infrastruktura — niskie koszty

**Decyzja z 30.09.2026:** baza w **Neon** (Postgres + PostGIS, Frankfurt), zamiast Supabase.
Na start darmowy plan; płatność według zużycia dopiero przy wzroście. Hosting, funkcje API
i pliki — Cloudflare, gdy przyjdzie czas na hosting. Logowanie SMS-em własne (SMSAPI),
oferty na żywo na start przez odświeżanie co kilka sekund.

**SMS-y — decyzja z 30.09.2026:**
- Wysyłka z **konta SMSAPI Prometheusa**. Saldo punktów jest wspólne z powiadomieniami
  Prometheusa — właściciel potwierdził.
- Nazwa nadawcy: **WolneOkno** (limit SMSAPI to 11 znaków, „WolneOkienko” ma 12).
  Zgłoszona i zatwierdzona w SMSAPI 30.09.2026. Aplikacja podaje ją przy każdej wysyłce;
  domyślną nazwą konta zostaje „Prometheus” (powiadomienia Prometheusa bez zmian).
- Konto odrzuca SMS-y z linkiem, także z samą domeną, więc kody idą bez adresu strony.

## 4. Zadatek — NIE w fazie 1

**Decyzja z 30.09.2026: w pierwszych fazach nie pobieramy zadatku**, żeby nie
zniechęcać klientek. Klientka płaci całość w salonie.

Skutki i zabezpieczenia w fazie 1:

- O prowizji decyduje to, czy wizyta się odbyła. Po terminie pytamy salon i klientkę
  (`src/domain/wynik-wizyty.ts`): potwierdzenie salonu wystarcza; „byłam” klientki przy
  „nieobecności” salonu to spór dla operatora; brak zgłoszeń przez 48 h = wizyta odbyta.
- Nieobecności nic nie kosztują klientki, więc: weryfikacja numeru telefonu SMS-em,
  licznik nieobecności, blokada konta po kilku nieobecnościach.

Na późniejsze fazy, gdy zadatek wróci (analiza z 30.09.2026):

- **Nieobecność bez odwołania:** zadatek przepada; 20% + VAT dla nas, reszta dla salonu.
  Zgodne z art. 394 § 1 Kodeksu cywilnego. ✅
- **Odwołanie przez klientkę:** właściciel chce, żeby zadatek przepadał także wtedy.
  Ryzyko prawne: umowa zawarta przez aplikację to umowa na odległość; konsumentka ma
  14 dni na odstąpienie (art. 27 ustawy o prawach konsumenta), zwrot wszystkich
  płatności w 14 dni (art. 32), a postanowienie mniej korzystne od ustawy jest
  nieważne (art. 7). Nazwa „zadatek” tego nie zmienia; odstąpienie rozlicza się według
  ustawy, a nie art. 394 KC. Wyjątek z art. 38 ust. 1 pkt 12 (usługi związane
  z wypoczynkiem z oznaczonym dniem) da się ewentualnie bronić dla SPA i masażu
  relaksacyjnego, dla paznokci i fryzjera raczej nie.
- W kodzie: `POBIERAMY_ZADATEK = false` i parametr `PARAMETRY_ZADATKU.przyOdwolaniuKlientki`
  w `src/domain/rozliczenie.ts`, domyślnie `"zwrot"`. Zmiana decyzji = zmiana jednej wartości.

## 5. Zabiegi iniekcyjne

- Wchodzą, jeśli salon ma je w ofercie.
- Toksyna botulinowa to lek na receptę: w aplikacji nazwa ogólna („Zabieg z toksyną
  botulinową”), bez nazw handlowych, bez promocji i płatnych wyróżnień; salon deklaruje,
  że zabieg wykonuje lekarz.
- Wypełniacze z kwasem hialuronowym (wyroby medyczne): bez promocji; salon deklaruje
  kwalifikacje osoby wykonującej.

## 6. Dokumenty prawne

Przygotowuje Claude (bez zewnętrznego prawnika): regulaminy klientek i salonów (P2B),
polityka prywatności, rejestr czynności i DPIA, zasady zadatku, moderacja (DSA, Omnibus),
procedura DAC7, umowa z przedstawicielami.

## 7. Rejestracja usługodawcy (30.09.2026)

- Salon rejestruje się sam w aplikacji: dane firmy, NIP (suma kontrolna), adres
  sprawdzony na mapie, cennik „od” z czasem usługi. Bez ręcznej weryfikacji przed
  startem; operator może zablokować salon.
- **Miesiąc próbny liczy się od pierwszego włączenia przyjmowania zapytań**, nie od
  samej rejestracji. Salon, który zarejestruje się wcześniej, nie traci próby.
- Gabinety medyczne podają numer w RPWDL albo numer prawa wykonywania zawodu.
- Toksyna botulinowa tylko z oświadczeniem, że wykonuje lekarz. Wypełniacze tylko
  z opisem, kto wykonuje zabieg i z jakimi kwalifikacjami.
- Dane firmy nie są pobierane automatycznie z białej listy VAT: serwis Ministerstwa
  Finansów blokuje zapytania z serwerów.

## 8. Nieobecności klientek (propozycja z 30.09.2026, do potwierdzenia przez właściciela)

- 3 ostateczne nieobecności w ciągu 12 miesięcy → 90 dni bez możliwości wysyłania zapytań.
- Odwołanie wizyty w aplikacji, nawet w ostatniej chwili, nie jest nieobecnością.
- Klientka ma 48 h na sprzeciw wobec zgłoszenia salonu; spór rozstrzyga człowiek.
- Parametry: `src/domain/nieobecnosci.ts`; opis: regulamin dla klientek, § 8.

## 9. Dokumenty prawne i dyktowanie (30.09.2026)

- Dokumenty w `docs/prawne/`, przygotowane samodzielnie na wzór rozwiązań Booksy i Fixly (bez kopiowania tekstów).
- Dyktowanie zapytań głosem przez rozpoznawanie mowy wbudowane w przeglądarkę (bez płatnego serwisu); opisane w polityce prywatności.
- Czcionki serwowane z aplikacji, bez Google Fonts.

## 10. Rozbudowa katalogu (30.09.2026)

Właściciel zatwierdził wszystkie propozycje z analizy. Katalog: 8 branż, 47 kategorii, 120 usług.
- Nowa branża **Czas wolny**: escape room, kręgle i bilard, sauna i balia, gokarty; zapytanie ma liczbę osób.
- Zdrowie: pediatra, okulista, laryngolog, endokrynolog, urolog, neurolog, psychiatra; wybielanie, ortodonta, usunięcie zęba, zęby dziecka; terapia manualna, osteopata, fala uderzeniowa, psychoterapia; dietetyk, logopeda.
- Auto: klimatyzacja, geometria, diagnostyka komputerowa, detailing, przegląd techniczny.
- Zwierzęta: szczepienie, opieka dzienna i hotel, szkolenie psa, behawiorysta.
- Nauka: niemiecki, hiszpański, egzamin ósmoklasisty, matura, gitara, pianino, nauka pływania.
- Dom: mycie okien, pranie tapicerki, ślusarz, elektryk, serwis AGD.
- Uroda: opalanie natryskowe, Kobido, drenaż, balayage, przedłużanie włosów, strzyżenie dziecięce, manicure męski.


## 11. Zapytania i oferty na żywo (30.09.2026)

- Zapytanie idzie falami: 5 najbliższych usługodawców od razu, 10 kolejnych po 3 min, reszta po 6 min; promień rośnie od 3 do 30 km, aż znajdzie się co najmniej 5.
- Oferty zbieramy 10 minut; oferta wiąże usługodawcę jeszcze 15 minut po końcu zbierania. Jedna oferta salonu na zapytanie, najwcześniej 10 minut od teraz, nigdy powyżej limitu klientki.
- Tryb „biorę pierwszą pasującą”: pierwsza oferta w warunkach klientki od razu staje się rezerwacją.
- Klientka: najwyżej 3 otwarte zapytania i 20 na dobę. Opis przy usługach medycznych nie jest zapisywany ani wysyłany.
- Telefon salonu klientka widzi dopiero po rezerwacji; salon widzi telefon klientki tylko przy swoich wizytach.
- Do zrobienia: powiadomienie usługodawcy o nowym zapytaniu, gdy nie ma otwartej aplikacji (push w aplikacji mobilnej albo SMS — SMS kosztuje, decyzja właściciela).

## 12. Import danych z innych systemów (np. Booksy) (30.09.2026)

- Bez logowania się loginem salonu do cudzego systemu i bez automatycznego pobierania z niego danych (regulamin tych systemów, ryzyko blokady konta salonu).
- Legalnie: import cennika z tekstu lub zdjęcia (salon zatwierdza dopasowanie do katalogu), wgrywanie własnych zdjęć, eksport danych na wniosek salonu (Data Act, rozporządzenie UE 2023/2854) i import pliku.
- Listy klientek nie importujemy (RODO).

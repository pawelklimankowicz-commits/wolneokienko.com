# Ocena skutków dla ochrony danych (DPIA, art. 35 RODO)

Dokument wewnętrzny. Stan na 1 października 2026 r. Dotyczy zapytań medycznych w Aplikacji Wolne Okienko.

## 1. Dlaczego ocena jest potrzebna

- Aplikacja przetwarza dane o zdrowiu (art. 9 RODO). Samo Zapytanie w branży „Zdrowie” zdradza, jakiego lekarza lub badania szuka osoba.
- Te dane trafiają jednocześnie do wielu gabinetów w okolicy, zanim Klientka kogokolwiek wybierze.
- Planowana jest skala miejska, a potem krajowa. Do tego dochodzi zautomatyzowana decyzja o blokadzie po nieobecnościach.

Każda z tych cech osobno kwalifikuje przetwarzanie do oceny skutków. Razem nie zostawiają wątpliwości.

## 2. Opis przetwarzania

1. Klientka wybiera rodzaj wizyty medycznej, termin i obszar. Zaznacza wyraźną zgodę na przekazanie rodzaju wizyty gabinetom w okolicy.
2. System wybiera gabinety w obszarze: te, które mają usługę w cenniku i przyjmują zapytania. Rozsyła do nich Zapytanie falami.
3. Gabinet widzi rodzaj wizyty, termin, limit ceny i odległość. **Nie widzi** numeru telefonu, dokładnego miejsca ani opisu z pola tekstowego.
4. Gabinet składa Ofertę. Po przyjęciu Oferty dostaje numer telefonu Klientki i od tej chwili jest odrębnym administratorem.
5. Po Wizycie strony zgłaszają, czy się odbyła. Na tej podstawie liczymy prowizję i nieobecności.

## 3. Niezbędność i proporcjonalność

- **Minimalizacja:**
  - gabinety dostają rodzaj wizyty z zamkniętego katalogu, bez opisu i bez tożsamości;
  - tożsamość dostaje tylko gabinet wybrany przez Klientkę;
  - w interfejsie jest ostrzeżenie „Nie opisuj objawów”.
- **Podstawa:** wyraźna zgoda (art. 9 ust. 2 lit. a) z zapisaną datą, wycofywalna.
- **Okresy:**
  - Zapytania bez Wizyty są usuwane po 30 dniach;
  - powiązanie Wizyty z Klientką usuwamy po 12 miesiącach;
  - dane rozliczeniowe (usługa, cena, data) przechowujemy bez tożsamości przez 5 lat.
- **Przejrzystość:** osobna część polityki prywatności o danych o zdrowiu; informacja przy polu zgody.

## 4. Ryzyka dla osób

| Ryzyko | Prawdopodobieństwo | Waga | Uwagi |
|---|---|---|---|
| Wyciek bazy ujawnia, kto szukał jakiego lekarza | niskie | wysoka | dotyczy tabel `zapytania` i `rezerwacje` |
| Gabinet używa informacji z Zapytania do marketingu | niskie | średnia | gabinet nie zna tożsamości przed przyjęciem Oferty |
| Klientka wpisze objawy w opis | średnie | średnia | opis nie trafia do gabinetów |
| Nieuprawniony „gabinet” zbiera zapytania | niskie | średnia | weryfikacja numeru w rejestrze |
| Niesłuszna blokada po nieobecnościach | średnie | niska | tylko możliwość wysyłania Zapytań, 90 dni |
| Ujawnienie danych przez dostawcę (Neon, SMSAPI, Cloudflare) | niskie | wysoka | umowy powierzenia, UE jako region danych |

## 5. Środki

- Szyfrowanie połączeń; kody i tokeny tylko jako skróty.
- Dostęp do bazy wyłącznie przez API; RLS bez polityk dla połączeń spoza API.
- Rozdzielenie danych: gabinety dostają widok Zapytania bez tożsamości i bez opisu.
- Numer w RPWDL albo numer prawa wykonywania zawodu przy rejestracji gabinetu; możliwość zawieszenia.
- Ostrzeżenie i blokada wysyłki opisu w Zapytaniach medycznych.
- Blokada po nieobecnościach: jawny próg, 48 godzin na sprzeciw, spór rozstrzyga człowiek, uzasadnienie i skarga.
- Czyszczenie danych według okresów z pkt 3 (lista zadań w rejestrze czynności).
- Brak marketingu i brak profilowania reklamowego.

## 6. Ryzyko szczątkowe i decyzja

Po wdrożeniu środków z pkt 5 ryzyko szczątkowe oceniamy jako **niskie**. Uprzednie konsultacje z Prezesem UODO (art. 36) nie są potrzebne. Ocenę powtarzamy:

- przed startem w kolejnym województwie;
- przy każdej zmianie sposobu rozsyłania Zapytań medycznych;
- przy dodaniu płatności lub zadatków.

## 7. Inspektor ochrony danych

Na starcie przetwarzanie danych o zdrowiu nie ma dużej skali, więc inspektora nie wyznaczamy. Ponownie ocenimy to, gdy miesięcznie będzie ponad 1000 Zapytań medycznych albo gdy Aplikacja wyjdzie poza Poznań. Wtedy wyznaczymy inspektora i podamy jego dane w polityce prywatności.

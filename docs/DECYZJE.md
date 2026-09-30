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
- Bez abonamentu, bez umowy terminowej.
- Promocja startowa: **miesiąc próbny, w którym 5 pierwszych klientek jest bez prowizji**.
  Darmowe wizyty nie przechodzą na czas po miesiącu próbnym.
- Prowizja idzie na **miesięczną fakturę salonu** (KSeF), bo w fazie 1 nie pobieramy
  żadnych płatności od klientek. Nieopłacona faktura po terminie wstrzymuje salonowi
  zapytania.

## 3. Fazy

| Faza | Zakres |
|---|---|
| F1 | MVP: Poznań, paznokcie. Start przed grudniowym szczytem. |
| F2 | Poznań, wszystkie usługi salonu beauty (w tym toksyna botulinowa i wypełniacze, jeśli salon je oferuje). |
| F3 | Wszystkie miasta wojewódzkie. |
| F4 | Wszystkie miasta powiatowe. |
| F5 | Gminy i wsie. |
| F6 | Inne branże z wolnymi okienkami, na czele z dentystami i lekarzami. |

Faza 0 (test ręczny) pominięta — testem jest F1.

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

## 5. Zabiegi iniekcyjne (od F2)

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

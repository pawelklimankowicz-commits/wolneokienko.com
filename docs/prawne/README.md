# Dokumenty prawne Wolnego Okienka

Wersje z 1 października 2026 r. Przygotowane samodzielnie, bez kopiowania tekstów innych serwisów. Jako materiał porównawczy posłużyły regulaminy, polityki prywatności i zasady Booksy (booksy.com, wersje z października 2025 do września 2026) i Fixly (fixly.pl, wersje od 15 listopada 2025). Przejęliśmy sprawdzone rozwiązania i uzupełniliśmy to, czego nie mają, a czego potrzebuje model Wolnego Okienka.

## Dokumenty publiczne (pokazywane w Aplikacji)

| Plik | Dla kogo | Najważniejsze |
|---|---|---|
| `regulamin-klientki.md` | klientki i klienci | zapytanie = zaproszenie do ofert, oferta wiąże, przyjęcie = umowa z usługodawcą; odwołanie bezpłatne; blokada po 3 nieobecnościach w 12 miesięcy na 90 dni |
| `regulamin-uslugodawcy.md` | salony, gabinety, fachowcy | prowizja 20% + VAT od wizyty, która się odbyła; okres próbny; parametry kolejności (P2B art. 5); 30 dni wypowiedzenia; KSeF; DAC7 |
| `polityka-prywatnosci.md` | wszyscy | dane o zdrowiu tylko za wyraźną zgodą i bez opisu; jedno ciasteczko sesyjne; dyktowanie przez przeglądarkę |
| `zasady-opinii.md` | wszyscy | opinie tylko po wizycie (Omnibus); zgłaszanie treści, uzasadnienia i skargi (DSA) |

Aplikacja pokazuje je w Profil → Regulamin i prywatność, a także przy logowaniu i rejestracji usługodawcy. Wersje są zapisane w `src/domain/dokumenty.ts`. Przy zmianie treści podbij wersję i uprzedź usługodawców co najmniej 15 dni wcześniej.

## Dokumenty wewnętrzne (`wewnetrzne/`)

- `rejestr-czynnosci.md`: rejestr z art. 30 RODO oraz **lista rzeczy do wdrożenia przed startem**.
- `ocena-skutkow.md`: ocena skutków dla zapytań medycznych.
- `procedura-dac7.md`: raportowanie usługodawców do KAS.

## Do uzupełnienia przed startem

Wszystkie miejsca do uzupełnienia są oznaczone nawiasami kwadratowymi: `grep -rn "\[" docs/prawne`.

- Dane spółki po rejestracji w S24: nazwa, adres, KRS, NIP, REGON, kapitał.
- Data startu, od której obowiązują regulaminy.
- Skrzynki kontakt@, dane@ i dsa@wolneokienko.com, po zakupie domeny.
- Umowy powierzenia z Neon, SMSAPI i Cloudflare: akceptacja w panelach dostawców.

## Świadome odstępstwa od Booksy i Fixly

- Zamiast szerokiej, bezterminowej licencji na treści: licencja na czas trwania konta, a opinie bez numeru telefonu po usunięciu konta.
- Brak odesłania do unijnej platformy ODR, wyłączonej w lipcu 2025 r. Zamiast niej: rzecznicy konsumentów, WIIH i UOKiK.
- Blokada klientki na poziomie całej platformy (u Booksy blokuje tylko salon), ale z jawnym progiem, sprzeciwem, rozstrzygnięciem przez człowieka i uzasadnieniem.
- Prowizja od ceny z oferty, a nie od kwoty zapłaconej na miejscu. Tę da się sprawdzić, a cenę z oferty tak.
- Wizyty umówione poza aplikacją są bez prowizji, nawet ze stałymi klientkami z aplikacji. Nie ma klauzuli parytetowej.

# Procedura DAC7

Dokument wewnętrzny. Stan na 1 października 2026 r.

## 1. Czy nas dotyczy

- Wolne Okienko jest platformą, przez którą Usługodawcy świadczą usługi osobiste Klientkom: uroda, zdrowie, nauka, opieka nad zwierzętami, usługi domowe.
- Wynagrodzenie jest nam znane: to cena z przyjętej Oferty, od której liczymy prowizję. Płatność w salonie tego nie zmienia.
- Przy usługach osobistych nie ma progu de minimis. Próg 30 transakcji i 2000 euro dotyczy tylko sprzedaży towarów.
- **Wniosek:** jesteśmy operatorem platformy raportującym. Informację składamy Szefowi KAS elektronicznie **do 31 stycznia** za poprzedni rok. Pierwsza informacja obejmie rok, w którym Aplikacja zacznie działać.

## 2. Jakie dane zbieramy od Usługodawców

| Usługodawca | Dane |
|---|---|
| Osoba fizyczna (JDG) | imię i nazwisko; adres zamieszkania; NIP albo PESEL; data urodzenia; państwo rezydencji |
| Spółka i inny podmiot | firma; adres siedziby; NIP; numer KRS; informacja o zakładach w innych państwach UE |
| Wszyscy | adres miejsca świadczenia usług; liczba Wizyt i suma cen w każdym kwartale; suma prowizji w każdym kwartale |

Rachunku bankowego nie zbieramy, bo nie wypłacamy Usługodawcom pieniędzy.

## 3. Kalendarz

- **Do 30 listopada:** w panelu Usługodawcy prośba o uzupełnienie danych z pkt 2, z wyjaśnieniem po co.
- **Pierwsze przypomnienie:** 30 dni po prośbie. **Drugie:** 60 dni po prośbie.
- **Po drugim przypomnieniu, nie wcześniej niż 60 dni od pierwszej prośby:** wstrzymanie przyjmowania Zapytań do czasu uzupełnienia danych (§ 14 regulaminu dla usługodawców), z uzasadnieniem.
- **Weryfikacja:** NIP (suma kontrolna i biała lista, jeśli dostępna), zgodność nazwy z CEIDG albo KRS, kompletność danych.
- **Do 31 stycznia:** złożenie informacji Szefowi KAS i wysłanie każdemu Usługodawcy kopii jego części.
- **Przechowywanie:** dane i kopie informacji przez 5 lat od końca roku, w którym złożyliśmy informację.

## 4. Skąd dane w systemie

- Wizyty zrealizowane: `rezerwacje.wynik = 'zrealizowana'`, cena z `rezerwacje.cena_gr`.
- Prowizje: tabela `rozliczenia`.
- Dane Usługodawcy: `salony` oraz pola DAC7 do dodania w migracji przed pierwszym listopadem po starcie.

## 5. Do potwierdzenia przed pierwszym raportem

- Aktualny format i kanał składania informacji w systemie e-Deklaracje albo e-Urząd Skarbowy.
- Czy Usługodawcy zwolnieni z VAT wymagają dodatkowych pól.

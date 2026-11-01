# Fiszki – co poprawić przed wydaniem i jak zarabiać

Kolejność: **najpierw blokery** (bez nich nie wychodź), potem jakość, na końcu monetyzacja.

## 🚨 Blokery – bez tego nie wydawaj

1. **Ekonomia liczona na telefonie = nie można jej sprzedawać.**
   - Kryształy, złoto i przedmioty są dziś zapisywane w telefonie gracza, a baza tylko je sprząta i karze.
   - Kto zna narzędzia przeglądarki, dopisze sobie wszystko. Dopóki to darmowe, to tylko nieuczciwość.
   - Gdy ktoś **płaci prawdziwe pieniądze**, płatną walutę i zakupy musi liczyć serwer (Supabase Edge Functions + tabela portfela tylko do odczytu dla gracza).
   - To największa praca techniczna przed monetyzacją.
2. **Moderacja treści od użytkowników.** Jest czat, nicki, zdjęcia profilowe, klasy i ranking publiczny. App Store i Google Play wymagają przy UGC:
   - zgłaszania treści/gracza;
   - blokowania gracza;
   - filtra wulgaryzmów w nickach i czacie;
   - kontaktu do zgłoszeń.
   Masz już narzędzia kar, ale gracz nie ma jak nikogo zgłosić.
3. **Prawa autorskie:**
   - naklejki w stylu Pepe i puszka „M” jak Monster (szczegóły w `naklejki-do-poprawy.md`);
   - ikony z game-icons.net (CC BY 3.0) wymagają widocznego podpisu autorów w aplikacji;
   - fiszki „Pierwsza pomoc” i anatomia: dopisz zastrzeżenie „materiał edukacyjny, nie zastępuje kursu/porady medycznej” i upewnij się, że treści są poprawne.
4. **Skrzynki z losowaniem = „loot boxy”.**
   - Jeśli kiedyś da się je kupić za prawdziwe pieniądze (bezpośrednio albo przez kryształy kupione za pieniądze), w UE robi się z tego temat prawny. Belgia to praktycznie zakazała, Apple i Google wymagają pokazania szans.
   - Szanse już pokazujesz – dobrze.
   - Najbezpieczniej: **skrzynki tylko za walutę zdobytą graniem, a za pieniądze sprzedawać konkretne rzeczy** (bez losowania).
5. **RODO i wiek.**
   - W Polsce zgoda na przetwarzanie danych dziecka to od 16 lat. Dodaj potwierdzenie wieku albo zgodę rodzica przy zakładaniu konta.
   - Uzupełnij dane administratora w polityce prywatności.
   - Zawrzyj umowę powierzenia (DPA) z Supabase – jest u nich do zaakceptowania w panelu.
6. **Darmowy Supabase.**
   - Projekt na darmowym planie jest wstrzymywany po tygodniu bez ruchu.
   - Wbudowana wysyłka maili do logowania ma bardzo niski limit (kilka maili na godzinę), więc przy większej liczbie nowych graczy logowanie stanie.
   - Przed wydaniem: **plan Pro** (ok. 25 $/mies.) i **własny SMTP**, np. Resend albo Brevo z darmowym progiem.

## 🐞 Znane błędy i słabe miejsca do naprawy

- **Checkpoint walki:**
  - zamknięcie aplikacji w trakcie przegrywanej walki omija utratę serca;
  - rozwiązanie: walka przywrócona z checkpointu, której gracz nie dokończy, po np. 1 h liczy się jak porażka.
- **Rozjazd wersji przy zapisie i synchronizacji** (scalanie danych z kilku urządzeń):
  - przetestuj usuwanie talii/fiszek na 2 urządzeniach naraz;
  - przetestuj tryb hardcore na 2 urządzeniach.
- **Wieża duetu / hydra online:** brak testów prawdziwej gry we dwoje po ostatnich zmianach (zapisy, nagrody drużyny, kategorie quizu). Zagraj kilka pełnych biegów z kolegą.
- **Brak automatycznych testów:** każda zmiana jest sprawdzana ręcznie. Przed wydaniem przydałoby się kilka testów krytycznych ścieżek: nauka, zapis, synchronizacja, walka, zakup w sklepie.
- **CSS z wieloma nadpisaniami (`!important`):**
  - wygląd jest łatany warstwami;
  - przed wydaniem warto raz przejść ekrany na małym telefonie (iPhone SE), dużym (Pro Max), tablecie i komputerze, w jasnym i ciemnym motywie oraz w hardcore.
- **Własne tło** jest tylko na jednym urządzeniu – po zmianie telefonu trzeba je wgrać od nowa. To OK, ale warto to napisać przy zakupie.
- **Raporty błędów:** dodaj darmowe zbieranie błędów (np. Sentry, darmowy próg), żeby wiedzieć, co się psuje u ludzi.

## 🌍 Wydanie

1. **Domena i nazwa:**
   - „Fiszki” to słowo ogólne – trudno je zastrzec i wypozycjonować;
   - przemyśl nazwę własną (np. „Fiszkon”, „Pamięciak” – sprawdź wolne domeny i znaki towarowe w EUIPO);
   - kup domenę i podepnij ją do GitHub Pages.
2. **Strona startowa:** 1 ekran z opisem, zrzutami, przyciskiem „Graj” i linkami do regulaminu i polityki prywatności.
3. **Sklepy z aplikacjami:**
   - **Google Play:** 25 $ jednorazowo. Masz już Capacitor – najprostsza ścieżka.
   - **App Store:** 99 $/rok i Mac do zbudowania aplikacji.
     - Apple wymaga, żeby cyfrowe rzeczy w aplikacji były kupowane przez **ich płatności** (prowizja 15% dla małych twórców).
     - Na samej stronie internetowej (PWA) możesz używać zwykłych płatności.
4. **Statystyki:** proste i bez śledzenia, np. Plausible albo Umami (z banerem zgody, jeśli wymaga).
5. **Wersja angielska:** podwaja rynek. Teksty są dziś wpisane w kod, więc to większa praca – na później.

## 💰 Monetyzacja – co ma sens w aplikacji do nauki

Zasada: **nigdy nie sprzedawaj przewagi w nauce ani w rankingu.** Sprzedawaj wygląd, wygodę i treści.

1. **Fiszki Pro – abonament** (np. 9,99 zł/mies. albo 59 zł/rok). Przykłady:
   - synchronizacja bez limitu urządzeń;
   - nielimitowane talie i obrazki;
   - zaawansowane statystyki i plan nauki do egzaminu;
   - import z Anki bez limitu;
   - generowanie fiszek z notatek (jeśli dodasz AI);
   - motywy premium;
   - wcześniejszy dostęp do nowych bossów.
2. **Jednorazowe zakupy kosmetyczne bez losowania:** konkretne skiny, motywy, własne tło (już masz!), ramki, tytuły. Gracz widzi, co kupuje.
3. **Pakiety fiszek:** gotowe talie np. pod maturę, LEK, prawo jazdy, języki. Tylko z treściami, do których masz prawa (własne albo licencjonowane).
4. **Plan dla nauczycieli i szkół (Klasa):** nauczyciel tworzy klasę i talie, uczniowie grają za darmo, szkoła płaci np. za rok. Twoja funkcja Klasy już to umożliwia.
5. **Reklamy – raczej nie.** Ewentualnie tylko „obejrzyj reklamę = +1 serce / darmowa skrzynka” poza nauką. Reklamy w trakcie nauki zabiją aplikację.

**Płatności na stronie:** Lemon Squeezy albo Paddle – sami rozliczają VAT w UE (tzw. merchant of record), więc nie musisz tego robić sam. Stripe jest tańszy, ale VAT i faktury są wtedy po Twojej stronie.

**Działalność:** sprzedaż wymaga działalności gospodarczej. Na start w Polsce sprawdź działalność nierejestrowaną (limit przychodu) albo zwykłą JDG i skonsultuj się z księgową w sprawie VAT OSS przy sprzedaży do UE.

## Sugerowana kolejność

1. Supabase Pro + własny SMTP, poprawki naklejek (prawa autorskie), zgłaszanie i blokowanie graczy, wiek 16+.
2. Testy we dwoje + naprawa checkpointu + zbieranie błędów.
3. Domena, strona startowa, Google Play.
4. Płatna waluta liczona na serwerze → dopiero wtedy sprzedaż (Pro / kosmetyki).
5. App Store, wersja angielska, plan dla szkół.

*To nie jest porada prawna ani podatkowa – przy podatkach i loot boxach warto zapytać księgową / prawnika.*

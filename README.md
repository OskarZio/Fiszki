# Fiszki – kopia Anki w przeglądarce (iPhone + komputer)

Aplikacja webowa (PWA) do nauki z powtórkami rozłożonymi w czasie. Działa offline, instaluje się na iPhonie jak zwykła apka.

## Co potrafi
- **Powtórki jak w Anki** (algorytm SM-2): oceny *Nie pamiętam / Trudne / Dobrze / Łatwe* z podglądem następnego terminu, kroki nauki, limit nowych kart dziennie, cofnięcie ostatniej odpowiedzi.
- **Pasek postępu** sesji i dnia, cel dzienny, seria dni 🔥, licznik „do zrobienia” per talia (nowe / w nauce / do powtórki).
- **Rodzaje fiszek**: zwykła (opcjonalnie z obrazem i w obie strony), **luki w tekście** (`{{c1::odpowiedź::podpowiedź}}`), **obraz z lukami** (wklejasz zdjęcie np. z atlasu anatomii i palcem zaznaczasz prostokąty).
- **Szybkie dodawanie listy** – wklejasz `pytanie - odpowiedź - skojarzenie` linia po linii (separator wykrywany sam, działa też kopiowanie z Excela).
- **💡 Skojarzenia** – pole na mnemotechnikę, pokazywane na żądanie jako podpowiedź (dla całej fiszki i dla każdej luki na obrazie).
- **Tryby nauki**: fiszki, wpisywanie odpowiedzi (tolerancja literówek i polskich znaków), test ABCD, test pisemny (wynik %, błędne → powtórka), przegląd „trudnych” kart.
- **Pałace pamięci**: zrzuty ekranu ze Street View jako kolejne miejsca trasy, pinezki ze skojarzeniem i faktem, „spacer” po pałacu i zamiana pinezek w fiszki.
- **Przypomnienia**: codzienne wydarzenie w Kalendarzu iPhone'a (.ics) + liczba powtórek na ikonie aplikacji.
- **📷 Skan – zdjęcie / PDF → fiszki**:
  - ✨ z AI (Claude): rozumie notatki, tabele i schematy, sama robi pytania, luki i skojarzenia; wymaga własnego klucza API Anthropic (Więcej → AI),
  - bez AI: odczyt tekstu (OCR po polsku, tekst z PDF) do listy do poprawki,
  - zdjęcie lub strona PDF jako „obraz z lukami”.
- **Anki ⇄ Fiszki**: import `.apkg`/`.colpkg` (stary i nowy format, obrazy, karty odwrotne, luki, wbudowane „Image Occlusion”, postęp nauki) oraz eksport do `.apkg` (Anki, AnkiMobile, AnkiDroid; obrazy z lukami eksportują się jako gotowe obrazki).
- **📚 Tematy**: katalogi i podtematy z materiałami (strony, filmy YouTube, notatki z zakreślaczem); z zaznaczonego tekstu notatki robi się fiszkę jednym stuknięciem.
- **🏆 Motywacja**: XP i poziomy, 50+ osiągnięć z konfetti, serie poprawnych odpowiedzi, cel dzienny.
- **📈 Wykres skuteczności** (7/30/90 dni) i powtórek dziennie, z podglądem po dotknięciu.
- **🎨 Wygląd**: gotowe motywy, wybór koloru tła i akcentu z palety albo w HEX.
- **👥 Ranking ze znajomymi** (dziś / tydzień / seria / poziom) – przez prywatny GitHub Gist, znajomych dodaje się kodem albo linkiem.
- **⚔️ Bitwy 1 na 1**: szybki mecz z losowym graczem (matchmaking), pojedynek ze znajomym na kod/link albo trening z botem. Tryb „Fiszki” (kto szybciej się nauczy i odtworzy – wpisując lub mówiąc) i „Pamięć” (liczby/słowa/obrazy). Pasek życia i „szala” przesuwają się z każdą dobrą odpowiedzią, naklejki w trakcie walki, zabezpieczenia przed oszukiwaniem, statystyki i bilans ze znajomymi. Komunikacja przez publiczny przekaźnik ntfy.sh.
- **💎 Kryształy i sklep**: skrzynki z naklejkami losowane na ruletce (rzadkości: zwykła/rzadka/epicka/legendarna), darmowa skrzynka za każdą wygraną, album naklejek, efekty zwycięstwa i motywy premium.
- **🧠 Trening pamięci**: gry jak w Memory League (liczby, słowa, obrazy, karty) z rekordami i trasą z pałacu pamięci, polski system liczbowy 00–99 (konwerter, szybki trening, fiszki).
- **🧘 Tryb skupienia**: jednym przełącznikiem chowa całą grywalizację – zostają fiszki i materiały w spokojnym wyglądzie.
- **⚙️ Własne ustawienia**: kroki nauki, maks. odstęp, premia „Łatwe”, dokładność sprawdzania odpowiedzi, animacje, dźwięki; w grach pamięciowych dowolna liczba elementów i czas (także bez limitu); w bitwach: liczba fiszek, kierunek, czas na naukę i odpowiedź (lub bez limitu), dokładność, ukryty/na żywo wynik, sabotaże.
- **🔊 Własne dźwięki**: wgraj piosenkę na wygraną albo efekt na poprawną fiszkę, dodanie fiszki czy osiągnięcie – każdy osobno.
- **🛡️ Bezpieczeństwo danych**: codzienne kopie lokalne, kosz (30 dni), historia wersji w chmurze, kopia do pliku/iCloud i przypomnienie, gdy dane nie są zabezpieczone.
- **🫀 Atlas (anatomia)**: własne ryciny ze strukturami – przegląd, nazywanie (wpisując lub mówiąc), wskazywanie na obrazie i rysowanie z pamięci z porównaniem (nałożenie / obok siebie) i historią prób.
- **🖼️ Galerie zdjęć** w tematach (podgląd pełnoekranowy, podpisy, zdjęcie → fiszka z lukami albo atlas).
- **📌 Karteczki-przypominajki** na ekranie startowym (kolory, terminy) i eksport jako tapeta / ekran blokady.
- **3 tryby**: Pełny, Skupienie (bez grywalizacji, z pałacami pamięci) i Pełne skupienie (tylko nauka).
- **Personalizacja**: rozmiar i czcionka fiszek, wyrównanie, narożniki, 2 lub 4 przyciski ocen, czytanie na głos, gradienty lub jednolite kolory, układ kompaktowy, animacje naklejek.
- **Elo i rangi** w bitwach (Brąz → Mistrz), bot dopasowujący się do Twojego poziomu, własne zdjęcie jako awatar.
- **Synchronizacja telefon ⇄ komputer** przez prywatny GitHub Gist (token z zakresem `gist`) albo eksport/import pliku.

## Uruchomienie (GitHub Pages)
1. W repozytorium: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, gałąź `master`, folder `/ (root)` → Save.
2. Po minucie aplikacja będzie pod adresem `https://<twoj-login>.github.io/<repo>/`.
3. Na iPhonie otwórz ten adres w **Safari → Udostępnij → Do ekranu początkowego**.

Lokalnie: `python3 -m http.server` w folderze i wejście na `http://localhost:8000`.

Bez żadnego budowania – czysty HTML/CSS/JS. Biblioteki do importu/eksportu, PDF, OCR i SDK Claude leżą w `vendor/` i wczytują się dopiero przy użyciu (OCR pobiera przy pierwszym użyciu silnik i słownik z CDN jsDelivr). Dane są w IndexedDB przeglądarki na danym urządzeniu.
Po zmianie plików podbij `CACHE` w `sw.js`, żeby telefony pobrały nową wersję.

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
- **Synchronizacja telefon ⇄ komputer** przez prywatny GitHub Gist (token z zakresem `gist`) albo eksport/import pliku.

## Uruchomienie (GitHub Pages)
1. W repozytorium: **Settings → Pages → Build and deployment → Source: Deploy from a branch**, gałąź `master`, folder `/ (root)` → Save.
2. Po minucie aplikacja będzie pod adresem `https://<twoj-login>.github.io/<repo>/`.
3. Na iPhonie otwórz ten adres w **Safari → Udostępnij → Do ekranu początkowego**.

Lokalnie: `python3 -m http.server` w folderze i wejście na `http://localhost:8000`.

Bez żadnego budowania – czysty HTML/CSS/JS. Biblioteki do importu/eksportu, PDF, OCR i SDK Claude leżą w `vendor/` i wczytują się dopiero przy użyciu (OCR pobiera przy pierwszym użyciu silnik i słownik z CDN jsDelivr). Dane są w IndexedDB przeglądarki na danym urządzeniu.
Po zmianie plików podbij `CACHE` w `sw.js`, żeby telefony pobrały nową wersję.

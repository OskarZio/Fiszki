# Fiszki – zasady pracy w tym repo

- Kod aplikacji to pliki `.js` z listy `scripts.txt` (kolejność ma znaczenie). Strona ładuje **jeden plik `bundle.js`**.
- **Po każdej zmianie w dowolnym pliku `.js` uruchom `python3 tools/bundle.py`** i commituj także `bundle.js` – inaczej zmiana nie zadziała na stronie.
- Nowy plik skryptu: dopisz go do `scripts.txt` (we właściwym miejscu), potem przebuduj bundle.
- Pliki pod linią `# lazy` w `scripts.txt` (tryby w testach) trafiają do `bundle-x.js`, który doładowuje się tylko u admina i testerów (`lazyLoad()` w `admin.js`). Commituj też `bundle-x.js`.
- Przy każdej wydanej zmianie podbij `APP_VERSION` w `app.js` i `CACHE` w `sw.js` (`fiszki-vNNN`).
- Test lokalny: `python3 -m http.server 8765` + Playwright.

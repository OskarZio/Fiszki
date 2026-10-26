# 📱 Fiszki na iOS

To jest natywna aplikacja iOS (Capacitor 8), która pakuje tę samą aplikację, co strona. Działa offline: pliki są w środku aplikacji.

## Co potrzebujesz
- **Maca** z **Xcode 16+** (darmowy w App Store). Na Windowsie aplikacji iOS zbudować się nie da.
- **Node.js 22** (nodejs.org).
- Na własnego iPhone'a: wystarczy darmowe **Apple ID** (aplikacja działa wtedy 7 dni, potem uruchamiasz ją z Xcode ponownie).
- Do **App Store**: **Apple Developer Program** (99 USD rocznie).

## Uruchomienie na iPhonie (ok. 10 minut)
```bash
git clone https://github.com/OskarZio/Fiszki.git
cd Fiszki/mobile
npm install
npm run sync      # kopiuje aplikację do projektu iOS
npm run open      # otwiera Xcode
```
W Xcode:
1. Kliknij **App** (lewa kolumna) → zakładka **Signing & Capabilities** → **Team**: wybierz swoje Apple ID (Add Account…).
2. Jeśli Xcode zgłosi zajęty identyfikator, zmień **Bundle Identifier** na unikalny, np. `pl.twojenazwisko.fiszki`.
3. Podłącz iPhone'a kablem, wybierz go u góry i naciśnij ▶️.
4. Na iPhonie: **Ustawienia → Ogólne → VPN i urządzenia** → zaufaj swojemu certyfikatowi. Przy pierwszym uruchomieniu włącz też **Tryb dewelopera**.

## Po każdej zmianie w aplikacji
```bash
cd mobile && npm run sync
```
Potem w Xcode znowu ▶️ (albo nowa wersja do App Store).

## Wysłanie do App Store
1. Zapisz się do Apple Developer Program i utwórz aplikację w **App Store Connect** (ten sam Bundle Identifier).
2. W Xcode: podnieś **Version** (np. 1.1) i **Build**, wybierz **Any iOS Device** → **Product → Archive** → **Distribute App → App Store Connect**.
3. W App Store Connect uzupełnij: opis, zrzuty ekranu (iPhone 6,7"), kategorię **Edukacja**, kategorię wiekową i adres **polityki prywatności**: `https://oskarzio.github.io/Fiszki/#/privacy`.
4. Najpierw najlepiej **TestFlight** (testy ze znajomymi), potem „Wyślij do weryfikacji”.

Uwaga: Apple odrzuca aplikacje, które są tylko „opakowaną stroną”. Fiszki działają offline i mają dużo własnych funkcji, ale przy recenzji warto to opisać (nauka offline, powtórki, tryby gry).

## Sprawdzanie kompilacji
GitHub Actions (`.github/workflows/ios.yml`) przy każdej zmianie buduje aplikację na symulator na Macu w chmurze – zielony znaczek = projekt się kompiluje.

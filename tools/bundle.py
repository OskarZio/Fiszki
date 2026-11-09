#!/usr/bin/env python3
"""Składa wszystkie skrypty aplikacji (lista w scripts.txt, w tej kolejności) w jeden plik bundle.js.
Jeden plik = jedno zapytanie zamiast ~65 – na iPhonie start jest dużo szybszy (każdy plik przechodzi przez service workera).
Uruchom po KAŻDEJ zmianie w plikach .js:  python3 tools/bundle.py"""
import os, re, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
names = [l.strip() for l in open(os.path.join(root, 'scripts.txt')) if l.strip() and not l.startswith('#')]
out = ["'use strict';\n/* ⚠️ PLIK GENEROWANY – nie edytuj. Źródła: pliki z scripts.txt, budowanie: python3 tools/bundle.py */\n"]
for n in names:
    src = open(os.path.join(root, n), encoding='utf-8').read()
    # osobne pliki: `typeof X` dla stałej z późniejszego pliku daje 'undefined'; w jednym pliku stała jest w „martwej strefie”
    # i rzuca błąd. Dlatego deklaracje najwyższego poziomu (od początku linii) zamieniamy na `var`.
    src = re.sub(r'^(const|let) ', 'var ', src, flags=re.M)
    out.append(f'\n/* ===== {n} ===== */\n{src.rstrip()}\n;\n')
open(os.path.join(root, 'bundle.js'), 'w', encoding='utf-8').write(''.join(out))
print(f'bundle.js: {len(names)} plików, {sum(len(x) for x in out)//1024} KB')

# Bento bediening — 16 november 2026

Lokaal geïmplementeerd; niet gecommit, gepusht of gedeployed.

- Gap, Spacing, Cell radius en Frame radius hebben sliders naast hun exacte invoerveld. Slepen toont een tijdelijke preview; loslaten of een afgeronde toetsenbordactie bewaart één Undo-stap. Escape, focusverlies, verouderde state en mislukte opslag behouden de geaccepteerde waarde. New layout blijft een voorstel tot Generate.
- De groene resize-rand staat 12 schermpixels buiten het echte frame, onafhankelijk van zoom. Rechtsboven staat de actuele totale breedte × hoogte in pixels, ook tijdens slepen. Opgeslagen geometrie krijgt geen extra marge.
- Een cel verwijderen verwijdert meteen haar native Image-, Text- en Shape-inhoud, inclusief vergrendelde kinderen. Undo herstelt alles samen. Bibliotheekbronnen en andere cellen blijven bestaan; Merge behoudt overgedragen inhoud.

## Eigenaarschap en vervanging

De bestaande Reception-reconciliatie verwijdert de inhoud en ruimt de native layout- en groepsverwijzingen op. De oude route die verwijderde celinhoud als losse lagen behield, inclusief de bijbehorende private-visibility omzetting, is verwijderd. De minimale afmetingen voor expliciet losgemaakte inhoud blijven nodig en behouden.

De bestaande scope blijft eigenaar van opslag, Undo en toegangscontrole. De maatweergave leest de bestaande tijdelijke WorkbenchArea-preview. De paneelvelden gebruiken de bestaande settings- en appearance-preview-acties. Er is geen tweede opslagmodel of nieuwe dependency toegevoegd. Het numerieke Field blijft gedeeld met afmetingen en cel-aantallen; de lokale RangeField voegt alleen de sliderinteractie toe.

## Controle

- 127 gerichte unittests geslaagd: Reception document, scope, Bento en cell structure.
- Vijf gerichte browsergevallen geslaagd: verwijderen van gevulde en actief bewerkte cellen, resize op 1440 en 900 px, plus de sliders. Laatste slidercontrole omvat pointer-release, keyboard, één Undo/Redo-stap, Escape, leeg exact invoerveld, mislukte opslag en herladen.
- Screenshots bekeken op brede donkere en smallere lichte editor; sliders, frame-afstand en maatlabel gecontroleerd. Testgegevens zijn geïsoleerd; geen bestaande gebruikerscompositie aangepast.
- Lint, contract-typecheck, productiebuild, build-budgetcontrole, design-tokeninventaris en diff-whitespacecontrole van de gewijzigde bestanden geslaagd.
- Geen volledige unit-suite uitgevoerd. Dit is geen releasecheckpoint of volledige applicatieaudit. Bestaande hook-observaties en de algemene Vite-waarschuwing voor grote chunks blijven buiten deze wijziging; de productieplafonds slagen.

## Omvang van deze wijziging

Gemeten tegenover de bestandsinhoud bij aanvang van deze Bento-ronde; eerdere lokale wijzigingen niet meegeteld.

| Onderdeel | Toegevoegd | Verwijderd |
| --- | ---: | ---: |
| Productiecode | 81 | 25 |
| Tests | 125 | 13 |
| Actief contract | 23 | 11 |
| Gegenereerde tokeninventaris | 1 | 1 |

Dit verslag is apart toegevoegd. De codegroei zit hoofdzakelijk in de afbreekbare sliderinteractie en de garanties voor één opgeslagen wijziging per gebaar.

# Grain en Blur in FX

Lokale implementatie na de expliciete goedkeuring van Grain en Blur voor Shapes.
Checkout `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. Ongecommitteerd en niet gedeployed.
De bestaande lokale wijzigingen zijn behouden. De verify-workflow is gelezen;
een externe CI-run kan deze ongecommitteerde staat niet bevestigen.

## Bediening en verantwoordelijkheid

FX is de zesde tab, naast Layers, Transform, Color, Image en Shape. Hetzelfde
dock verzorgt losmaken, terugplaatsen, sluiten, verplaatsen en onzichtbare
resize-randen. Actions → FX haalt de tab terug. Selectie kiest geen andere tab.
De indeling blijft sessiestaat; een herlaadactie start de zes tabs samen.

Een geselecteerde rechthoek heeft Grain (0–100%) en Blur (0–12 px, stap 0,5).
Grid en de reeds ondersteunde Texture-records krijgen Blur; hun bestaande
patrooninstellingen blijven bij Shape. Grain is geen tweede ruisbewerking voor
die patronen. Image, Text en meervoudige selectie krijgen in deze stap geen FX.
Text-migratie blijft als laatste gepland.

`ShapeWorkbench` levert de effecten via zijn bestaande tool-source. De module
houdt het eigenaarschap van waarden, validatie, opslag, fouten en Undo; de host
presenteert de bron voor de huidige selectie. Grain gebruikt het bestaande
`grain`-veld. Het optionele, begrensde `blur`-veld reist via de bestaande
recordprojectie mee bij dupliceren, Undo/Redo, reload en publicatie/herstel.
Er is geen tweede store, generiek effectenframework of nieuw publicatiepad.

Een slider toont tijdens slepen een tijdelijk voorbeeld en bevestigt één
wijziging bij loslaten. Toetsenbordbediening bevestigt bij het loslaten van de
bereiktoets. Escape, focusverlies, pointer-cancel, sluiten, selectie wisselen of
een gewijzigde opslaggeneratie annuleert het voorbeeld. Verder bewegen met
dezelfde ingedrukte muisknop na Escape kan geen stilzwijgende wijziging opslaan.
Een mislukte opslag laat het bewaarde artwork intact; FX toont de fout en de
volgende poging kan gewoon slagen.

Blur wordt alleen op het tekenwerk gezet. Een afzonderlijke paint-wrapper
houdt de selectie en resize-randen scherp en laat zachte randen buiten het
frame doorlopen. De bestaande Workbench-schaalfactor verwerkt camerazoom en
pixeldichtheid. Dezelfde Shape-renderer wordt gebruikt voor bezoekers.

## Controles en beeld

De nieuwe browsergevallen gebruiken geïsoleerde fixturedata achter de gewone
editorgrens op de bestaande server (poort 24970). Zij controleren tijdelijke
preview versus opslag, één Undo per gebaar, annuleren, herladen, losmaken en
terugplaatsen, sluiten/heropenen, opslagfalen/herstel, ongeschikte selectie en
gesloten Grid-artwork. Een echt gebouwd publiek document wordt met de
bezoekersrenderer getoond; er vindt geen upload plaats.

De verfijnde controles verifiëren ook selectie wisselen midden in een gebaar,
camera 50%/100% en pixeldichtheid 2. De paint-wrapper moet de volledige hoogte
van het artwork behouden, terwijl de buitenste selectie geen blur heeft.
Mist (1440 × 1000), Carbon (760 × 620), een los FX-venster en de bezoekersweergave
zijn visueel gecontroleerd. De zes tabs kunnen horizontaal scrollen; de actieve
FX-tab en sluitknop blijven zichtbaar.

![FX in het Mist-dock](fx-tools/fx-mist-docked.png)
![Los FX-venster naast Layers](fx-tools/fx-mist-independent.png)
![FX in het smalle Carbon-dock](fx-tools/fx-carbon-narrow.png)
![Dezelfde blur in de bezoekersweergave](fx-tools/fx-visitor.png)

Actuele resultaten:

- `npm test`: **1.310/1.310 geslaagd**, inclusief de productiebuild naar een
  alternatieve map. [Log](fx-tools/unit-all.log). De eerste run vond een nog
  niet opnieuw gegenereerde tokeninventaris; na regeneratie slaagt de volledige
  reeks.
- Design-system-inventaris opnieuw gegenereerd; **10/10 checks geslaagd**.
  [Log](fx-tools/design-system.log).
- `npm run build -- --configLoader native` en `npm run build:check` geslaagd.
  [Build](fx-tools/build.log), [budgetcontrole](fx-tools/build-check.log),
  [bundlerapport](fx-tools/bundle-report.json).
- Gerichte browserreeks: **17/17 geslaagd**, met FX, Shape, Image, Color-focus,
  Transform/Color, docking, Image-fit en Text/Article-regressies.
  [Log](fx-tools/acceptance.log).
- De twee FX-gevallen zijn na uitbreiding met selectie-wissel en
  pixeldichtheid opnieuw afzonderlijk uitgevoerd: **2/2 geslaagd**.
  [Log](fx-tools/focused.log). De gerichte diffcontrole vindt geen
  whitespacefouten.

De productiebuild meet **2.478.131 raw / 793.096 gzip** core-JavaScript;
initieel **822.889 raw / 239.433 gzip**. Geen budgetplafond is gewijzigd.
De marge voor core-JavaScript blijft klein. Dit is functionele en visuele
verificatie, geen meting van een volle compositie met veel gelijktijdige blurs.
De algemene releasebrowserreeks is niet volledig uitgevoerd. Geen upload,
walletactie, commit, push of deployment is uitgevoerd.

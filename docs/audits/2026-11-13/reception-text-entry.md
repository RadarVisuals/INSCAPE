# Reception — ruimere tekststart en moderne selectie

Datum: 13 november 2026. Lokale implementatie; niet gecommit, gepusht of gepubliceerd.

## Wat verandert

Nieuwe tekst in een cel begint in een gecentreerd kader van maximaal **560 × 160 werkpixels**, met binnenmarges die begrensd worden door de cel. De standaardlettergrootte voor nieuwe Reception-tekst is 28 px. Het tekstvak houdt zijn gekozen breedte tijdens typen en gebruikt normale regelafbreking. De hoogte blijft met de bestaande grijppunten aanpasbaar; dit voegt geen nieuw algoritme voor automatisch meegroeien in hoogte toe.

De eerdere automatische inschakeling van content-hugging is verwijderd voor nieuw ingevoegde tekst. De bestaande optie blijft beschikbaar onder **Fit box to text**. Bestaande vakken behouden hun opgeslagen afmetingen en fitkeuze.

De witte, dubbele selectie is vervangen door één dunne lijn in de bestaande interface-accentkleur en ronde resize-markeringen. De 28 px hitgebieden, acht resize-richtingen, toetsenbordbediening, schaalprojectie en verplaatsing blijven bij de gedeelde vensterhost. Er is geen nieuwe palette- of stylinglaag toegevoegd.

Bij actieve lege tekst in een cel wordt de echte editor direct gefocust. Een bestaande titel voorkomt dat deze focus naar een lege body springt. De callback hangt van stabiele waarden af, zodat een geometriewijziging de resize-handle niet opnieuw door de tekstcursor laat vervangen.

De compacte schrijfprompt volgt nu de echte teksttypografie en -kleur, zonder eigen panelvlak, en blijft gedimd zichtbaar tot de gebruiker typt. Gewone artikelvensters behouden hun bestaande paneelvormige Start writing-guide en focusgedrag. Prompts blijven tijdelijke UI en komen niet in het artikel terecht.

## Eigenaars en vervanging

- De bestaande new-text-optie in de commit wordt nu uitsluitend gebruikt om de initiële geometrie te zetten. De Reception-capability blijft de celgrens, generatie, opslag en geschiedenis bewaken.
- De route die nieuwe tekst meteen in fitText opnam en vervolgens naar de minimale lege tekstmaat liet krimpen is verwijderd. De oude tijdelijke optie fitNewText is vervangen door newText; er is geen opgeslagen veld of schema bijgekomen.
- De obsolete centreInCell-parameter van fitReceptionText en de aparte lege-placeholdermaat zijn verwijderd. Expliciete fit gebruikt de echte meting. Een meting met nulbreedte of nulhoogte behoudt het bruikbare bestaande kader.
- Text CSS bezit de selectie-afwerking en de compacte placeholder. De modulevariant voor resize-markeringen geldt zowel voor native als portalled Text-controls. De generieke vensterregels blijven nodig voor andere soorten vensters; hun gedrag is niet vervangen.
- De extra rand rond lege editable tekst is verwijderd. De buitenste selectielijn en de cursor geven de actieve tekst aan.

Productiecode tegenover de startsnapshots: **31 regels toegevoegd, 24 verwijderd, in 7 bestanden**. Tests, documentatie en de gegenereerde inventaris zijn daar niet bij geteld. De CSS-inventaris blijft 101 bestanden, 713 definities en 396 namen.

## Verificatie op de definitieve bron

Bronhash: `42a5bd25ae26fccaa8e66b648d45cb423b6e21176ef169a0c0fcfd455bc60bfe`.

| Controle | Resultaat |
|---|---|
| Volledige unit-/integratieset | 1.864 geslaagd, 0 failures/skips/annuleringen |
| Standardscontrole | 5 geslaagd; ook opgenomen in de unitset |
| Native Reception | 53 browsercases geslaagd |
| Focus writing | 5 browsercases geslaagd |
| Tekstvensterranden | 1 browsercase geslaagd |
| Lint, typecontracten, core-formatting | Geslaagd |
| Productiebuild en bestaande bundelgrenzen | Geslaagd |
| Afzonderlijke build met 40-teken releasemetadata | Geslaagd |
| Opruiming definitieve runners | Verified; geen resterende geobserveerde processen |

De **59 gerichte browsercases** en de unit/buildcontroles gebruiken dezelfde bronhash. De twee nieuwe native cases werken op 1440 px Dark en 900 px Light: echte celinvoeging via + Text, cursorfocus, ruime opgeslagen geometrie, default fit uit, accentkleur, ronde markers, geen dubbele focusrand, blijvende leesbare schrijfprompt, werkelijk typen, stabiele framebreedte, isolatie van de andere canvas, Undo/Redo, toetsenbordresize met behouden focus en herladen.

De nieuwe unittests controleren typen zonder DOM-fitter bij vaste geometrie, optionele fit, geschiedenis/herladen en het behouden van het kader bij een nulmeting. De eerdere unitproef die op het bundelbudget stopte is na de uiteindelijke vereenvoudiging volledig opnieuw groen uitgevoerd. Budgetten, classificaties en dependencies zijn niet verruimd.

De definitieve screenshots zijn bekeken op beide breedtes. De Light-fixture staat op 25% canvaszoom: tekst en kader volgen die bestaande camera-instelling; dit is geen nieuwe schermvaste lettergrootte of automatische zoom tijdens schrijven.

## Bredere bestaande teksttestfouten

Drie extra suites hadden samen zes failures. Diezelfde drie suites zijn ook tegen een Vite-overlay van alle zeven oorspronkelijke productiebronnen uitgevoerd, zonder de werkbestanden terug te zetten. Exact dezelfde zes cases en foutmeldingen kwamen terug. Het vergelijkingsoverzicht staat in `output/reception-text-entry-2026-11-13/baseline-comparison.json`.

| Suite | Bestaande failures |
|---|---|
| text-empty-editor | 2: aanname dat het volledige lege schrijfdoel in schermpixels past |
| text-create | 1: aanname over de negatieve panoorsprong van de fixture |
| text-tools-resize | 3: oud geopend brand-menu, action-stripgeometrie op 390 px en een Activity-knop die deze flow niet aanbiedt |

Deze zes failures zijn niet aangepast, overgeslagen of als opgelost gemeld. Ze zijn geen regressie die door deze wijziging ontstaat. De hele browsercatalogus is niet opnieuw uitgevoerd en er is geen volledige releasevrijgave geclaimd.

## Bundel en verdere grenzen

Development-metadata: core JavaScript **2.743.962 raw / 901.949 gzip bytes**, met 38 raw bytes marge. Met 40-teken releasemetadata: **2.743.991 raw / 902.130 gzip bytes**, met **9 raw bytes marge** tot de ongewijzigde limiet van 2.744.000.

Initieel JavaScript blijft 726.263 raw bytes bij development-metadata. De bundelruimte blijft bijzonder klein; dit is geen laadtijd- of inputlatencymeting. De metadata-build bevat lokale wijzigingen en betekent niet dat HEAD die wijzigingen bevat.

De wijziging herschrijft geen bestaande composities en publiceert niets. Voor de nieuwe start moet een nieuw tekstvak via + Text worden toegevoegd; het nieuwe selectie-uiterlijk geldt ook voor bestaande Text-vakken.

## Bewijs

- `.verification/reception-text-entry-1794561711308/verification.json`
- `.browser-test-runtime/reception-text-entry-1794561711564/browser.json`
- `.browser-test-runtime/reception-text-entry-confirm-1794561803772/browser.json`
- `output/reception-text-entry-2026-11-13/head-metadata-summary.json`
- `output/reception-text-entry-2026-11-13/baseline-process.json` en `baseline-comparison.json`
- `output/reception-text-entry-2026-11-13/summary.json`
- `output/reception-text-entry-2026-11-13/screenshots/text-start-1440-DARK.png` en `text-start-900-LIGHT.png`

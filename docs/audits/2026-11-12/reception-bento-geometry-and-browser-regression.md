# Reception: Bento-geometrie en volledige browserregressie

> Update 13 november 2026: de hier beschreven browserfouten zijn onderzocht en hersteld. De actuele eindstatus is **118/118 releasesuites (614 browserregressies) geslaagd**, plus **1.857 unit-/integratietests geslaagd**. Zie [het herstelrapport](../2026-11-13/reception-browser-remediation.md). De onderstaande resultaten blijven de historische baseline van deze geometrieslice.

Datum: 12 november 2026. Alle wijzigingen lokaal; geen commit, push, deployment, upload of walletactie.

## Geometrie-optimalisatie

ReceptionBentoEditor maakte bij elke body-edit een nieuwe painted-projectie en berekende daardoor alle dividerlimieten opnieuw. De read-only projectie wordt nu hergebruikt op basis van workbench, cells, imageModules, bento en tijdelijke transforms. Dividers en inner-line-frames volgen diezelfde projectie. De documentstore blijft de enige eigenaar van auteursgeometrie; er is geen tweede documentstore, persistente cache of generatiesynchronisatie toegevoegd.

Een tijdelijke preview, cel-/memberwijziging, afbeeldingsmaat, opgeslagen frame of gutterwijziging blijft de berekening ongeldig maken. Artikelinhoud zonder geometriewijziging doet dat niet. De referenties komen uit het bestaande immutable documentpad. React mag de memo opnieuw berekenen: het resultaat is puur afgeleid en niet nodig voor correctheid.

Productcode: één bestand, 11 toegevoegde en 6 verwijderde regels (netto +5), inclusief import en uitleg. De oude onvoorwaardelijke projectie/dividerberekening is vervangen. Geen dependency, vlag of parallel rekenpad.

## Gepaarde meting

Zelfde mixed-16 fixture: 16 Images en 16 teksten van elk 24 paragrafen; productie-geminificeerde componentbuild met tijdelijke telinstrumentatie; 200 individuele invoergebeurtenissen in acht blokken van 25. Zelfde publieke HTTPS-WebPs.

| Functieaanroepen | Voor | Na |
| --- | ---: | ---: |
| editorCellWindow | 194.800 | 50.800 |
| TextInstance, actieve tekst | 400 | 400 |
| WorkbenchWindow, actieve tekst | 400 | 400 |
| Overige tekst-, cel- en Properties-vensters | 0 | 0 |

Ongeveer 73,9% minder geometrieaanroepen in deze ene gepaarde run. Geen claim dat CPU-tijd of gebruikerslatentie met hetzelfde percentage daalt. Timinggaten, focus en settling zijn niet gecontroleerd; timings worden niet gebruikt. De 50.800 overige aanroepen bestaan nog. Werkbanklayout en andere teksten bleven gelijk; de volledige 200 getypte tekens werden opgeslagen.

Baseline-identiteit: source-manifest plus de pre-change ReceptionBentoEditor-overlay in baseline-snapshots.json. De telcode is alleen in de afzonderlijke diagnosebuild geïnjecteerd. Zie output/reception-bento-geometry-2026-11-12/ui-comparison.json.

## Functionele checks

Gerichte Chrome-UI: divider 360→361; de minimumpositie van de volgende divider 456→457; Undo/Redo 361→360→361; numeriek naar 400 met volgende minimum 496; Merge 16→15; Add 15→16 met Undo/Redo; gutter 0→12 live preview en Escape exact terug naar de oorspronkelijke style; Enter bewaart de gutter en Undo/Redo herstelt de bijbehorende geometrie. Preview bevat de gewijzigde tekst. Visueel bekeken: preview op 900 px en Editor op 1440 px. Geen consolefouten. Beide meetdocumenten gesloten en tijdelijke viewport teruggezet.

Twee nieuwe browserregressies op 1440 en 900 px behouden artikelinhoud tijdens resize, Undo/Redo en preview. Beide slagen afzonderlijk en ook in de volledige Reception Editor-suite.

## Volledige browserronde

De standaard meegeleverde Chromium kon niet starten (spawn UNKNOWN). De bestaande expliciete browser-override met geïnstalleerde Chrome werkt: Chrome 157.0.8103.78, Playwright 1.61.1. Geen Windows-, security- of toestemmingsinstelling gewijzigd. De volledige standaard release-selectie is via de vier bestaande shards uitgevoerd. Alle vier controleerden dezelfde bronhash: 0a7ff337dd205157e5fe76219675cba535d537def13abe599f5af3a95c104474.

**118 suites afgewerkt: 77 geslaagd, 41 gefaald. De brede regressie is niet groen.** De eerste sequentiële poging is expliciet afgebroken om dezelfde volledige selectie via de ondersteunde shards te laten lopen; deze gedeeltelijke poging is niet als voltooide regressie geteld.

De volledige Reception Editor-suite voerde 47 tests uit: 36 geslaagd en 11 gefaald, inclusief beide geslaagde nieuwe geometriechecks. De volledige celinteractie-suite, contextmenu-suite en onder meer Reception image-inspect, inspect, linked, SVG-breakpoints, overview-navigation en boundaries slagen.

Fouten hebben verschillende symptomen: kleurserialisatie, ontbrekende/verborgen Visitor-modules, niet gevonden oude bediening, pixel-/padverwachtingen en fixture-initialisatie. Dit zijn observaties, niet automatisch bewijs van verouderde tests of van productbugs. De plaatsingssuite is apart voor en na de productwijziging vergeleken: beide varianten falen ook op hetzelfde ontbrekende-id-punt. Daarmee is aangetoond dat die suite al faalt vóór deze stap; dit is geen onafhankelijke baseline voor alle andere fouten.

Canonieke eerste-round resultaten en concrete eerste fout per suite: output/reception-bento-geometry-2026-11-12/browser-regression-summary.json. De vier volledige rapporten staan onder .browser-test-runtime/bento-geometry-installed-shard-*.

Eén oude tiling-timeout kreeg een conservatieve cleanupstatus unknown met Channel closed en remainingPids leeg. Deze status is niet tot verified opgewaardeerd. De latere gerichte hertests hebben geverifieerde procesopruiming.

## Twee testreparaties na de volledige ronde

1. Een lokale testfixture bevatte nog twee Split-oproepen; die hadden in de vorige opruiming moeten verdwijnen. De fixture bouwt nu rechtstreeks dezelfde lege T-indeling met vaste frames en ids op, vóór de normale native Image/Text-plaatsing. Er is geen Split-implementatie teruggebracht. Een zoekactie in alle huidige lokale browserbronnen vindt alleen nog afwezigheidsasserties voor Split.
2. De prepared-image-regressie verwachtte nog twee URL’s voor dezelfde source/resolutie. Zij controleert nu expliciet dat beide consumers hetzelfde prepared URL gebruiken en dat één URL door beide wordt gedeeld. Alle bestaande checks voor pixels, alpha, crop, transforms, animatie, native fallback, stale completion, worker- en URL-opruiming blijven bestaan.

De brede run is na deze twee test-only reparaties niet volledig herhaald. Er zijn doelgerichte hertests uitgevoerd op een ongewijzigde post-repair-bron: native tiling-consumers 5/7 geslaagd, Reception navigator 1/1 geslaagd, tiling 3/5 geslaagd. De eerste eigen prepared-image-hertest gebruikte een verkeerde origin; die omgevingsfout is vervangen door een volledige standaardrunner-uitvoering: **prepared-image 2/2 geslaagd**, bron en cleanup geverifieerd. Die mislukte eerste hertest wordt niet als productfout geïnterpreteerd.

De vier overblijvende gerichte fouten zijn behouden:

- Nieuwe Reception Text boven Shape: een DOM-node ontbreekt voor compareDocumentPosition.
- Mixed cell style/radius: verwachte path-clip ontbreekt op de gevonden node.
- Fluid quote: 27,183324 in plaats van 28 bij de terugkeer naar de oorspronkelijke breedte.
- Bottom text: de verwachte proportionele framehoogte bij het verkleinen wijkt af.

Deze vereisen afzonderlijke oorzaakbepaling. Geen skip, force, ruimere tolerantie, soepeler deadline of gewijzigd productgedrag toegevoegd om de suite groen te maken.

## Overige verificatie en vervolg

Alle 1.855 unit/integratietests, lint (46 bestaande observaties), strikte contractchecks, core-opmaak, productiebuild en bundelbudgetten slagen op de gewijzigde productcode. Na de test-only reparaties opnieuw 53 gerichte Bento-/image-queue-tests geslaagd. Initieel JavaScript: 726.263 bytes; plafonds ongewijzigd.

De resterende geometrieaanroepen en brede toolcontexten blijven bestaan. De volgende prioriteit is het vaststellen en verhelpen van de open browserfouten, vooral de vier hierboven, voordat nog een volgende optimalisatieslice wordt opgestapeld. De originele 41 failures blijven zichtbaar in het volledige rapport; de geslaagde hertests worden apart vermeld.

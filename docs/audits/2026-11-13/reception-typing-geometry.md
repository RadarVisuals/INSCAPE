# Reception: minder geometriewerk tijdens tekstinvoer — 13 november 2026

## Afgebakende wijziging

Twee vroege controles in bestaande eigenaren, zonder extra cache, store of persistentiemechanisme:

- editorCellPreviewTransforms berekent het celframe pas wanneer die cel een tijdelijke transform heeft. De projectie van leden en expliciete individuele previews blijven ongewijzigd.
- reconcileReceptionCells slaat alleen het werk voor leden over wanneer het celframe gelijk blijft én de cel geen memberAnchors heeft. Veranderde ouderframes en alle bestaande ankers behouden hun projectie- en vrijgavepad. Opschoning van verwijderde leden, privacy, ordening en uiteindelijke documentvalidatie blijven buiten deze controle en worden nog uitgevoerd.

De tekstcommit blijft via ReceptionEditorScope, reconcileReceptionCells en de bestaande root-store lopen. Validatie, geschiedenis, generatiecontrole en opslag zijn niet vervangen.

## Gepaarde meting

Dezelfde geïsoleerde productiefixture voor en na: mixed-16, zestien cellen met ieder een afbeelding en een artikel van 24 opgemaakte alinea's, tweehonderd invoergebeurtenissen in het eerste artikel, viewport 1440 × 1000 en 900 × 1000. Minified diagnostische builds instrumenteren identieke functies. Twee oorspronkelijke lokale WebP-bronnen worden lokaal afgehandeld. Geen echte compositie, upload of wallet gebruikt.

| Computerbreedte | Invoer | editorCellWindow vóór | Na | Minder |
|---|---:|---:|---:|---:|
| 1440 px | 200 | 50.910 | 34.894 | 16.016 (31,46%) |
| 900 px | 200 | 50.910 | 34.894 | 16.016 (31,46%) |

De meetperiode omvat ook de identieke focusverplaatsing bij Stop; daarom wijken absolute tellingen licht af van de eerdere losse proef. De reductie bestaat uit 3.216 frame-opzoekingen zonder tijdelijke celtransform en 12.800 ongebruikte opzoekingen van leden.

Beide runs: 200 reconciliaties, ingevoerde tekst aanwezig in het opgeslagen document, identieke layout en overige artikelen, geen paginafouten. De actieve TextInstance en WorkbenchWindow blijven ieder 401 aanroepen hebben; deze wijziging claimt geen verdere renderreductie. Screenshots op beide breedtes zijn bekeken. De beperkte werkruimte tussen beide zijpanelen op 900 px bestaat ook in de nulmeting en is niet gewijzigd.

Dit is een aanroepentelling, geen bewijs voor 31% lagere invoervertraging of CPU-tijd. Eventtiming en framegegevens zijn alleen diagnostiek; automatische invoer en instrumentatie beïnvloeden deze. De winst is specifiek voor cellen zonder ankers terwijl het ouderframe niet verandert. Geankerde inhoud blijft dezelfde berekeningen uitvoeren.

## Bewijs

- output/reception-typing-geometry-2026-11-13/{before,after}/results.json, process.json, source-manifest.json en screenshots.
- comparison.json bevat de samengevatte gepaarde meting.
- De broninventarissen verschillen alleen in src/reception/editorCellGeometry.js en src/reception/receptionEditorDocument.js. Geen bronbestanden verwijderd.
- Na-wijziging bronhash: 72f42c714935e002121aee0ccdd07a16299404defa0bc001cf1b75f648ded3dd.

## Verificatie

- 1.857 unit-/integratietests geslaagd; geen failures, skips of annuleringen.
- Lint geslaagd met de 46 al geregistreerde hook-observaties; contractcontroles en core-formatting geslaagd.
- Productiebuild en budgetcheck geslaagd; initial JavaScript 726.263 bytes, gelijk aan het vorige checkpoint.
- 55 gerichte browsercases geslaagd: native editor 47, celinteractie 5, Bento-plaatsing 2, rich cell 1. De editortests omvatten typen gevolgd door resize, Undo en behouden tekst op 1440 en 900 px.
- Alle gemeten browserprocessen en verificatiestappen hebben geverifieerde opruiming zonder resterende geobserveerde processen.

De eerste browserrun bevatte 54 successen en één fout: rich-cell probeerde op regel 34 een tekstkleurveld te vullen terwijl de bestaande Text-disclosure dicht was. Dezelfde fout is apart gereproduceerd met beide oorspronkelijke bronbestanden als Vite-overlay, zonder de werkende productbestanden terug te zetten. Daarna opent de test expliciet de tekstkleurkiezer en controleert aanvullend dat openen niets opslaat. Alle eerdere assertions voor kleur, Undo, lagen, gestures en herladen blijven intact. De rich-cell hercontrole is geslaagd. Geen productkleurgedrag of timeout aangepast.

De broninventaris van de hercontrole verschilt van de groene bron/build-verificatie uitsluitend in browser-tests/reception-rich-cell.browser.mjs; productiecode en buildinputs zijn identiek. Daarom zijn de al geslaagde 54 browsercases en unit/buildchecks niet opnieuw gedraaid. Bronhash hercontrole: 73145101163e8a3d4c286cbcf3f7362af24238fe297acee639f88683207b8a5b.

Bewijs: .verification/typing-geometry-1794545304625/verification.json; .browser-test-runtime/typing-geometry-1794545304828/browser.json; .browser-test-runtime/typing-geometry-rich-recheck-1794545822535/browser.json. Het initiële gefaalde resultaat blijft bewaard, naast de geslaagde hercontrole. Het samenvattende bewijs staat in output/reception-typing-geometry-2026-11-13/verification-summary.json.

De eerdere volledige release-browserscan wordt niet als verificatie van deze nieuwe wijziging opgevoerd. Dit is een gerichte controle, geen volledige releasegoedkeuring. Dit verslag is pas na de test- en buildruns toegevoegd.

Geen commit, push, publicatie of deploy uitgevoerd. Alle bestaande lokale wijzigingen behouden.

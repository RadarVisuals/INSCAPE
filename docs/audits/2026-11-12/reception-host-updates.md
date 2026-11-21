# Reception: minder gedeelde updates tijdens typen

Datum: 12 november 2026. Lokale wijziging; niets gepusht of gepubliceerd.

## Resultaat

In een identieke mixed-16 fixture (16 afbeeldingen, 16 teksten met elk 24 paragrafen) veroorzaakten 200 afzonderlijke invoergebeurtenissen eerst 3.000 renderaanroepen in de 15 onaangeroerde TextInstances. Na deze wijziging: nul. De actieve tekst bleef bijwerken en opslaan.

| Getelde functie | Voor | Na |
| --- | ---: | ---: |
| TextInstance, totaal | 3.401 | 400 |
| TextInstance, 15 overige teksten | 3.000 | 0 |
| WorkbenchWindow, totaal | 6.818 | 3.800 |
| ImageArtworkAttempt | 0 | 0 |
| editorCellWindow | 632.766 | 630.000 |

Dit zijn functieaanroepen in een geïnstrumenteerde, geminificeerde componentbuild; geen DOM-paints of bewijs voor een bepaald percentage tijdwinst. Eén gepaarde run, invoer in acht blokken van 25 tekens. Startsettling en automatiseringspauzes zijn niet gecontroleerd; timings worden niet gebruikt. De overgebleven 3.800 vensteraanroepen zijn Properties (200), 16 celvormen (3.200) en de actieve tekst (400). De geometrieberekeningen blijven vrijwel gelijk en zijn een afzonderlijke vervolgstap.

## Implementatie

- WorkbenchHostView publiceert de bestaande hostgeometrie, camera en live registries los van volledige documentinhoud. WorkbenchView blijft de volledige actuele inhoud en selectieacties publiceren. Geen extra documentstore, opgeslagen kopie of alternatieve eigenaar.
- WorkbenchWindow, registratie, toolregistratie en miniaturen gebruiken het hostgedeelte. De bestaande single-owner maps en callbackrefs blijven intact.
- EditorCellLayoutContext publiceert alleen cellen, actieve cel en stabiele enter/leave-acties. De volledige EditorCells-context behoudt de generatiegebonden grain-, appearance- en inner-line-previews.
- TextInstance gebruikt deze smallere contexten. De duplicatielimiet komt expliciet van records.length via canDuplicate en blijft bij toevoegen/verwijderen actueel.
- Twee directe contextproviders in bestaande browserfixtures volgen de nieuwe hostgrens.
- Twee bestaande lintuitzonderingen zijn herbeoordeeld: effectlogica en dependency arrays zijn onveranderd; alleen de contextkeuze, regelnummers (+4) en bronhash veranderden. Geen extra uitzonderingen. De key-gebaseerde saved-layout/Undo-effecten blijven behouden.

## Browserbewijs

Twee eigen loopback-origins met dezelfde fixture, dezelfde openbare HTTPS-WebPs en tijdelijke renderinstrumentatie. Baselinecode wordt tijdens de build uit de vooraf opgeslagen snapshots geleverd; gebruikersbestanden worden daarvoor niet teruggezet. Zie output/reception-host-updates-2026-11-12/baseline-snapshots.json voor de overlay-identiteit; de source-manifest beschrijft de gewone werkboom.

De 200 tekens werden opgeslagen; de werkbanklayout en de 15 overige teksten bleven ongewijzigd. Daarna: terug naar cellen, tweede cel openen en typen, Undo van de laatste spatie, Redo van die spatie, beide gewijzigde teksten in preview, previewbreedte 320 px, terug naar editor, zoom 94% naar 118%, eerste tekst opnieuw openen met behouden inhoud. Geen consolefouten. Beide tijdelijke documenten en tabbladen gesloten.

De definitieve correctie van de disabled-reason voor dupliceren is daarna opnieuw gebouwd en kort geopend. De telling hierboven komt van de kandidaat vóór die ene verklaringscorrectie. De volledige browser-releasegroep is in deze stap niet uitgevoerd.

## Controle

Geslaagd: alle 1.854 unit/integratietests; lint (46 bestaande, herbeoordeelde observaties); strikte contractchecks (40 ongeldige calls en 9 productiemutaties afgewezen); core-opmaak; productiebuild en bundelbudgetten. Initial JavaScript: 726.263 bytes, gelijk aan vóór deze stap. Zie de bijbehorende logs. De bestaande omvangrijke lokale wijzigingen zijn behouden.

## Vervolg

De generatiespecifieke celvorm- en Properties-updates blijven bestaan. Vooral editorCellWindow blijft vaak worden aangeroepen. Eerst apart meten waar dezelfde celgeometrie herhaald wordt berekend en welke consumers echt van documentinhoud afhangen; preview-generatiebescherming niet omzeilen om contextreferenties stabiel te maken.

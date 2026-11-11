# Reception audit remediation — 27 oktober 2026

De zeven bevestigde bevindingen en de twee gerichte architectuurpunten uit de
[onafhankelijke audit](../reception-boundaries-audit/README.md) zijn aangepakt.
De bestaande Reception-vormgeving en eerdere lokale wijzigingen zijn behouden.
Dit verslag beschrijft lokale, niet-gecommitte wijzigingen bovenop
`4a0251647234c0757847078ec34f0865425f6857` op
`codex/static-reception-bento-2026-10-26`. Er is niet gepusht of gedeployed.

## Uitgevoerde punten

| Punt | Wijziging | Bewijs |
| --- | --- | --- |
| F1 · lokale About afhankelijk van publicatie | PublishedProfileBoundary kiest de geverifieerde eigenaar vóór de publieke statusgate. Een ontbrekende, ladende, ongeldige of falende publicatie blokkeert zijn lokale Reception niet. Bezoekers blijven uitsluitend gepubliceerd lezen. | Nieuwe boundary-browsergevallen en de bestaande route door de echte App. |
| F2 · verouderde reader | Een read-only adapter leest gevalideerde canonieke opslag opnieuw bij profielgebonden storage-events, foreground/focus en expliciete retry. Ongewijzigde bytes behouden dezelfde snapshot; mislukte reads behouden zichtbaar de laatste geldige inhoud. Verwijdering wist die lokale snapshot. De actieve editorstore wordt niet herladen. | Reader-unittests; twee echte tabbladen met normale edit/Done; leaseconflict en verlies van ownership. |
| F3 · herstel toont oude inhoud | Done en succesvolle backup-recovery verlaten de editscope en openen een verse reader. Zowel herstel na een corrupte draft als herstel vanuit de geopende editor gebruiken die overgang. Herstelwaarschuwingen kunnen worden doorgegeven. | Twee afzonderlijke recovery-browsergevallen; backup/store/lease-regressies. |
| F4 · focus na sluiten | Panelen registreren hun trigger met een layout-effect. De bestaande deferred-focushelper in de blijvende editor herstelt na verwijdering, respecteert een nieuwe focuskeuze en wordt geannuleerd bij disposal. | Enter op sluiten, Escape vanuit een veld, ander paneel openen en ownershipverlies. |
| F5 · chrome op authored Text | De editorcontainer heeft geen generieke toolchrome meer. Alleen header, lokale acties en toolpanelen krijgen het controlscope. | Werkelijke berekende titeltypografie, border en padding gelijk in editor en preview, na laden van de rijke Text-editor. |
| F6 · touch-controls | Reception gebruikt het gedeelde Workbench-sizingrecept. Controls en sluiten hebben 44px doelen bij smalle schermen of coarse pointer; velden gebruiken 16px. Geen aparte parallelle Reception-touchschaal. | 320/390px en brede coarse-pointer-viewport; bestaande mobiele Text/Library-tests; zes gedeelde Workbench-toolgevallen. |
| F7 · artworknaam | De geverfde afbeelding krijgt de bestaande artworknaam en beschrijving. De recoveryhost blijft daarbuiten zodat Retry een bereikbare knop blijft. Opgeslagen-contentminiaturen gebruiken een decoratieve afbeelding naast hun bestaande tekstnaam. | Raster en SVG in de accessibility tree; laden en herstel; visuele controle van transparante SVG. |
| R1 · onduidelijke laadgrenzen | De eigen About-reader laadt de editor pas op Edit. Alleen de editor gebruikt live Library-resolutie; de reader gebruikt opgeslagen media en de bestaande identity-viewmodels. Gedeelde presentatievariabelen zijn uit de brede Workbench-host-CSS gehaald. Productierapportage bevat nu publieke About, eigen About en Reception-editing; de importgraph weigert editor/owner-Library in beide readers. | Manifestmeting, graaftests, alternate-output build en daadwerkelijke imports van de gebouwde routes. |
| R2 · geen bundelmarge | Bestaande budgetten blijven gelijk. Beide edit-entrees delen één bundel. Rollup voegt geen dubbele transitive imports meer aan elke facade toe; Vites bestaande dependency-preloads blijven aan. | Native en alternate-output build; echte productie-startup op desktop en mobiel; onderstaande metingen. |

## Grenzen die behouden blijven

De canonieke draft blijft de enige opslagautoriteit. De readeradapter hergebruikt
de bestaande storevalidatie via wegwerpinstanties en biedt zelf geen
mutatiecommando's aan; er is geen tweede parser of documentschema toegevoegd.
Gedeelde validatie/storecode blijft wel een afhankelijkheid van de reader.
Ownership en editing leases worden nog steeds door de bestaande grenzen bepaald.
Done en refresh publiceren niets. Publieke projectie, privécontent-filtering,
Workbench-composities en Library-bronnen zijn niet vervangen.

Reception blijft verantwoordelijk voor zijn cellen, frame en layoutgebaren.
Text, kleur, metadata, media en Library blijven hun bestaande onderdelen.
Er is geen nieuw editorframework of Workbench-modus toegevoegd.

## Metingen

Statische routeclosures inclusief gedeelde startup; dit zijn geen gemeten
netwerk- of reactietijden. Routebedragen mogen niet bij elkaar worden opgeteld.

| Maat | Audit vóór | Nu |
| --- | ---: | ---: |
| Publieke About JS raw | 1.019.807 | 987.113 |
| Eigen About JS raw | 1.264.541 | 1.012.114 |
| Publieke/eigen About CSS raw | 126.714 / 180.312 | 85.603 / 85.603 |
| Reception-editing JS raw | 1.215.470 (oude StoreEditor-entry) | 1.250.453 (beide edit-entrees, inclusief owner-gate) |
| Totale non-wallet JS raw | 2.652.486 | 2.638.173 |
| Totale non-wallet JS gzip | 865.503 | 857.684 |
| Ruimte binnen bestaande non-walletlimiet raw / gzip | 514 / 497 | 14.827 / 8.316 |

De editing-entry is breder dan de oude StoreEditor-entry; de lagere readerkosten
zijn dus geen claim dat elke afzonderlijke entry kleiner is geworden. De totale
codegrootte en het aparte walletbudget blijven onafhankelijk gecontroleerd.
Nieuwe features horen vooraf op hun routekosten te worden beoordeeld; de
resterende marge is geen onbeperkte groeiruimte.

## Verificatie

- 53/53 gerichte unit-/grens-/buildtests, inclusief een echte alternate-output build.
- 40/40 browsergevallen: 6 Reception-boundaries, 17 Reception-editor, 6 Reception-card,
  5 echte App-routes, 3 companion-tool-viewports en 3 gedeelde Workbench-tools.
- 1/1 productie-browsertest, met desktop en mobiel, verse startup onder 1 MB,
  wallet-import en de drie werkelijk gebouwde Reception-routes.
- Lint geslaagd: 502 bronbestanden; de 91 bestaande geregistreerde hook-observaties blijven bestaan.
- Typecheck geslaagd; 17 ongeldige calls en 3 ongeoorloofde mutaties afgewezen.
- Productiebuild, build:check en git diff --check geslaagd. De bestaande
  large-chunkwaarschuwing en dubbele statische/dynamische PublicEntryPortal-import
  zijn niet door deze taak opgelost.
- Gevulde desktopweergave, mobiele tools en transparante SVG visueel bekeken.
  [Desktop](public-desktop.png), [320px](touch-320.png), [390px](touch-390.png),
  [Text-tools](text-tools-mobile.png), [SVG](transparent-svg.png).

Bewijs: [testresultaten](browser-results.json), [samenvatting](verification.json),
[bundelrapport](bundle-report.json), [importgraph](owner-runtime-graph.json) en de
logs in deze map. De oorspronkelijke auditbestanden zijn niet herschreven.
De bestaande wijziging in code-quality-progress.json is bytegelijk aan de
auditbaseline (SHA-256 opgenomen in verification.json).

Eerste verificatiepogingen vonden een sandboxbeperking bij esbuild en een
verkeerde SVG-selector in de nieuwe test. De build werd aanvankelijk ook terecht
tegengehouden door het ongewijzigde budget. Deze oorzaken zijn verholpen en de
betrokken controles zijn opnieuw groen uitgevoerd; er zijn geen falende cases
uit de passing resultaten weggelaten.

Geen volledige release-suite of fysieke iPhone/Safari-controle uitgevoerd.
Dit is gerichte regressiedekking, geen nieuwe volledige audit van de hele app.
Gebruikersprofielen zijn niet aangepast, gepubliceerd of geüpload.

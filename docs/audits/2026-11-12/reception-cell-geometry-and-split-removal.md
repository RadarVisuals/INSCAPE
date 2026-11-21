# Reception: celgeometrie, vensterupdates en verwijderen van Split

12 november 2026. Lokaal uitgevoerd; geen commit, push, upload, deploy of walletactie.

## Uitkomst

De dedicated Split cell-functie is op uitdrukkelijk verzoek van de founder volledig verwijderd: menu, inspector, scope-dispatch, planner en uitvoering. Add cell blijft de uitbreiding van de indeling verzorgen; directioneel Merge cell blijft bestaan. Bestaande celgeometrie en inhoud blijven geldig; er is geen conversie of herschrijving toegevoegd. De actuele productafspraak staat in INSCAPE_ACTIVE_CONTRACT.md.

Daarnaast zijn de herhaalde werkzaamheden tijdens tekstinvoer beperkt:

| Functieaanroepen bij 200 invoergebeurtenissen | Voor | Na |
| --- | ---: | ---: |
| editorCellWindow | 630.287 | 194.800 |
| WorkbenchWindow, totaal | 3.801 | 400 |
| Celvormvensters | 3.200 | 0 |
| Properties-venster | 200 | 0 |
| Actieve tekst | 401 | 400 |
| Overige teksten / ImageArtworkAttempt | 0 | 0 |

Ongeveer 69,1% minder geometriefunctieaanroepen. Geen claim over een even groot percentage tijdwinst: dit meet render- en functieaanroepen, niet CPU-tijd, DOM-paints of gebruikerslatentie. Eén gepaarde run met acht automatiseringsblokken van 25 tekens; settling en pauzes zijn niet gecontroleerd. De ene extra actieve-tekst-aanroep vóór de wijziging is geen zelfstandige winstclaim.

## Vereenvoudiging en eigenaarschap

ShapeInstance blijft eigenaar van de actuele, generatiegebonden tools, lokale previews en opslag. Het vervangen van die context door een context die generaties negeert zou de previewbescherming verzwakken en is niet gedaan. De ongewijzigde zichtbare window/paint-subtree staat nu in ShapeArtworkWindow met standaard React.memo-propvergelijking. Camera- en transformupdates blijven via de hostcontext komen; echte inhouds-, geometry-, selectie- en previewwijzigingen blijven via expliciete props komen. GridPaint gebruikt dezelfde hostgeometrie. Geen eigen comparator, extra documentstore of geometry-cache.

De gewone ShapeInstance-render berekende voorheen alle merge- en splitplannen, ook voor niet gebruikte menu’s. De bestaande actions.items-property wordt nu bij het opvragen berekend. De objectpicker vraagt deze op bij zijn geopende menu; de bestaande generatiecontrole vóór uitvoering blijft intact. De inspector blijft actuele merge-opties en controls uit dezelfde eigenaar gebruiken.

Properties gebruikt alleen de hostgegevens die het nodig heeft en is gememoiseerd tegen identieke parentprops. Contextwijzigingen van selectie of portalcontent blijven gewoon doorkomen.

Verwijderd: splitplanner, splitmutatie, twee dispatchverwijzingen, splitsubmenu en inspectorkeuze, de oude actie-filtering en het nu ongebruikte action-tag in menuplannen. Overblijvende mergefunctie en de gedeelde celgeometrie hebben actuele gebruikers. Productdiff ten opzichte van snapshots vóór deze stap: 45 toegevoegde, 67 verwijderde regels over zes bestanden (netto -22). Tests, documentatie en diagnostische output zijn apart bijgehouden.

## Tests

Tests die Split alleen als fixture-opbouw gebruikten, gebruiken nu expliciete lege 2×2- en T-geometrie. De live-plaatsings- en smalle-Text-tests gebruiken Add cell. Merge blijft getest op inhoud, locked members, publicatie, ordering, opslagfalen, stale saves, Undo/Redo en heropenen. Er is een nieuwe gedragstest: de verwijderde opdracht wordt afgewezen zonder wijziging van document, generatie of geschiedenis. Er zijn geen skips of soepelere budgetten toegevoegd.

De browserregressies zijn naar Add cell of expliciete fixture-geometrie overgezet en controleren ook de afwezigheid van Split. Bestaande keyboard-, merge-, storage-failure-, preview-, reload- en artworkasserties blijven behouden. Beide aangepaste browsermodules slagen voor de syntaxcontrole; de volledige browserreleasegroepen zijn in deze stap niet uitgevoerd.

Live Chrome-controle op geïsoleerde eigen loopback-origins: 200 invoergebeurtenissen; opgeslagen payload gelijk; layout en overige teksten ongewijzigd; Merge 16→15; Add cell 15→16; Undo/Redo 16→15→16; Split afwezig in keyboardcontextmenu en inspector; celradius 0→24 direct in paint en via Undo terug naar 0; preview bevat de gewijzigde tekst; visueel bekeken bij 900×900 en 1440×900 na Fit canvas in view. Geen consolefouten. Fixtures gesloten, viewport hersteld en eigen tijdelijke servers gestopt.

Het meetrapport staat in output/reception-cell-geometry-2026-11-12/ui-comparison.json. De baseline-build gebruikt de twee pre-change snapshots van ShapeWorkbench en ContextToolbar; overige Split-code was op dat moment nog ongewijzigd. Source-manifest plus baseline-snapshots.json beschrijven deze overlay. De laatste verwijdering van het ongebruikte action-tag verandert geen menu-uitkomst of invalidatie en vond na de telmeting plaats.

## Verificatie en resterende koppeling

Alle 1.855 tests, lint (46 bestaande observaties), strikte contractcontrole, core-opmaak, productiebuild en buildcheck slagen. Initieel JavaScript blijft 726.263 bytes; budgetten zijn ongewijzigd.

De resterende 194.800 geometrieaanroepen en de volledige ShapeInstance/toolcontextupdates zijn niet verdwenen. Bento-overlays, divider-/groottegrenzen en de actieve inspector blijven delen van het document volgen. Deze stap ruimt de ongevraagde menuplannen en ongewijzigde vensterpaint op; het is geen bewijs dat alle geometrie slechts eenmaal wordt berekend of dat de volledige browserrelease is geverifieerd.

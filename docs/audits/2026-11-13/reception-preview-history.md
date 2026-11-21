# Reception Preview — opslagstatus en gedeelde geschiedenis, 13 november 2026

## Resultaat en productafspraak

De responsive instellingen blijven in Preview, zoals de founder expliciet heeft gekozen. De breedteslider, Fit/Desktop/Tablet/Phone en het pixelveld blijven staan en blijven tijdelijk: ze wijzigen geen opgeslagen compositie.

Boven de bestaande responsive instellingen staat nu “Responsive editing”, met uitleg dat layoutwijzigingen in deze Reception worden opgeslagen terwijl de breedte alleen de weergave verandert. De bestaande bevestigde lokale opslagstatus is zichtbaar. Undo/Redo gebruiken dezelfde Reception-geschiedenis als de editor; de tooltip benoemt de bijbehorende operatie.

Herstelpreviews blijven alleen-lezen en krijgen geen nieuwe bewerk- of historybediening. De afspraken zijn vastgelegd in INSCAPE_ACTIVE_CONTRACT.md onder “Reception preview and responsive editing (2026-11-13)”.

## Eigenaarschap en wijzigingen

| Eigenaar | Wijziging | Wat bij de bestaande eigenaar blijft |
|---|---|---|
| OwnerSystemWorkflowRuntime | Geeft history, performHistory, historyBlocked en saveState aan Preview door. | De berekening van save-/attentionstatus, pending Text-bescherming, actuele scoped store en documentovergangen. |
| ReceptionEditorPreview | Voegt uitleg, status en twee historyknoppen toe aan het bestaande zijpaneel. Een geweigerde historyactie wordt in Preview gemeld. | Tijdelijke breedte/selectie en bestaande responsive commands; geen nieuwe bewerkstand of opgeslagen UI-projectie. |
| useDraftUndo | Geeft het bevestigde booleaanse resultaat van de bestaande actie aan de aanroeper terug. | Keyboardfiltering, historygroepen, geblokkeerde tekst, scopecontrole via de store en bestaande notices voor de overige editorconsumenten. |
| Reception scope / root-store | Geen history- of persistentiemechanisme vervangen. | Bevestigde opslag vóór canonical acceptatie/historyverplaatsing, write-access en isolatie ten opzichte van canvasinhoud. |

De nieuwe Preview gebruikt de bestaande ReceptionButton en iconen. De CSS voegt alleen de compacte historyrij toe binnen het zijpaneel; de bestaande header, presets, slider en pixelveld zijn niet herontworpen. ReceptionViewportControls.jsx is bytegelijk aan het vorige geverifieerde checkpoint; de hash staat in slider-preservation.json.

De callbackresultaatuitbreiding in useDraftUndo voorkomt dat Preview een geweigerde Undo als succes behandelt. De oude notices blijven nodig voor de gewone editor en zijn niet vervangen door een tweede historycontroller.

## Bundelblokkade en noodzakelijke verwijdering

De eerste volledige unitrun vond één echte buildblokkade: core-JavaScript was 2.744.502 bytes bij een bestaand plafond van 2.744.000. De functionele browserronde slaagde op dat moment al; de unitrun wordt niet achteraf als geslaagd opgevoerd.

Om binnen hetzelfde plafond te blijven, zijn zeven kopieën van een strikte recordcontrole vervangen door één kleine, importvrije helper in recordValidation.js: isRecord en hasExactKeys. De callers houden hun eigen toegestane velden, waarderegels, aantallen en rechten.

De consumenten zijn profileDocumentV9Asset, profileDocumentV9Validation, systemWorkflowDraft, identityCard, shapes, keeper en workbenchCollection. De controles op objecttype, uitsluiten van arrays, sleutelenaantal en verplichte eigen velden blijven gelijk. Private predicaten die voor ongeldige primitieve waarden een falsy waarde opleverden, gebruiken nu false; alle openbare validators consumeerden dat als booleaanse conditie. De bestaande JSON-/recordpolicy is niet verruimd.

Helpers voor optionele sleutelsets en andere afwijkende regels zijn bewust behouden. Er is geen algemene schema-engine, migratie, extra dependency of tweede opslagmodel gemaakt. De zeven vervangen strikte controles zijn uit hun oude modules verwijderd. Productiecode ten opzichte van de startsnapshots: 39 regels toegevoegd en 26 verwijderd, inclusief de vier regels van de gedeelde helper. De browser- en helpertests, gegenereerde inventaris, contracttekst en verslagen zijn daarbij niet meegerekend.

Dezelfde feature met gedeelde controles bouwt naar 2.743.739 core-JavaScript-bytes: 763 minder dan de geblokkeerde tussenversie. Dit is geen claim dat de volledige feature kleiner is dan het checkpoint vóór deze taak. De oorspronkelijke categorieën en limieten blijven intact.

| Buildmetadata | Core raw | Core gzip | Raw marge tot 2.744.000 |
|---|---:|---:|---:|
| development, normale dirty-checkoutverificatie | 2743739 | 901774 | 261 |
| volledige 40-teken release-identificatie | 2743768 | 901845 | 232 |

Alle raw- en gzipplafonds slagen. De raw-marge blijft klein en is geen toestemming om het plafond te verhogen. De tweede build toetst uitsluitend het metadataformaat; hij bevat nog ongecommitte lokale wijzigingen en bewijst niet dat HEAD deze code bevat. Initiële JavaScript: 726263 bytes normaal en 726292 bytes met volledige metadata.

De CSS-inventaris bevat dezelfde 101 bestanden, 710 definities en 395 namen. Alleen de hash/regelnummers van de bestaande receptionPreview.css zijn bijgewerkt; geen tokens of budgetten toegevoegd.

## Gedrags- en regressiebewijs

Twee nieuwe browsercases gebruiken de echte native editor op 1440 px Dark en 900 px Light, met een gevulde driecellige Reception, afbeeldingen en tekst. Zij controleren:

- de slider en alle presets blijven bereikbaar en veranderen geen draft of history;
- de tijdelijke Phone-breedte blijft los van de authored phone-instellingen;
- cell width, volgorde en hoogte worden via de bestaande Reception-save opgeslagen;
- beeld-/artikelinhoud, desktopgeometrie en andere canvasinhoud blijven intact;
- de knoppen en Ctrl+Z / Ctrl+Shift+Z gebruiken dezelfde geschiedenis;
- storage failure bij een responsive edit én bij Undo laat draft en history intact, toont een fout en claimt geen opgeslagen wijziging;
- retry, Redo, sluiten en herladen behouden de geaccepteerde wijzigingen;
- header en zijpaneel blijven binnen hun beschikbare breedte.

De bestaande herstelpreviewcases controleren aanvullend dat daar geen responsive/historyknoppen verschijnen, de slider wel blijft bestaan en het openen de opgeslagen Reception ongemoeid laat.

Tegen de vier oorspronkelijke UI-/historybronnen via een Vite-overlay falen beide nieuwe cases op de ontbrekende bewerkstatus. De echte bronbestanden zijn daarvoor niet teruggezet. Na de wijziging slagen de gerichte cases, ook met de sneltoetscontroles. Screenshots van succes en opslagfalen zijn op beide computerbreedtes in Dark/Light bekeken.

Drie nieuwe tests voor de gedeelde recordhelper bewaken primitieve/array-afwijzing, eigen versus geërfde vereiste velden, extra geserialiseerde velden en behoud van de bestaande JSON-zichtbare sleutelregels voor frozen/null-prototype records. De bestaande domeintests blijven de afzonderlijke schema’s en grensgevallen controleren.

## Eindverificatie

| Controle | Uitkomst |
|---|---|
| Volledige unit-/integratieset | 1.860 geslaagd, 0 failures/skips/annuleringen |
| LUKSO-standaardencontrole afzonderlijk | 5 geslaagd; deze zijn ook onderdeel van de brede unitset |
| Native Reception editor | 51 browsercases geslaagd |
| Gewone editor/context-action-bars | 11 browsercases geslaagd, inclusief gewone historyroutes |
| Reception SVG-breakpoints | 1 browsercase geslaagd |
| Lint / typecontracten / core-formatting | Geslaagd |
| Productiebuild / bestaande bundelgrenzen | Geslaagd |
| Metadata-compatibiliteitsbuild / bundelgrenzen | Geslaagd |
| Procesopruiming | Gecontroleerde eindruns verified, zonder resterende geobserveerde processen |

Samen 63 gerichte browsercases, zonder failures, skips, annuleringen of todo. De eindverificatie, browserrun en metadata-proef gebruiken dezelfde bronhash: 34117307b5006d5c04a7401e316b3ecccd2f0bc95611f13d5032a1d01deb374b. De eerdere mislukte unitrun blijft als diagnostisch bewijs bewaard; de groene hercontrole is nieuw uitgevoerd na de helperextractie. Geen assertion verzwakt, geen test verwijderd of overgeslagen, geen grens verruimd. De volledige 118-suites releasecatalogus is voor deze afgebakende wijziging niet opnieuw gedraaid.

Bewijs: .verification/reception-preview-history-1794555369038/verification.json; .browser-test-runtime/reception-preview-history-1794555369264/browser.json; output/reception-preview-history-2026-11-13/{summary.json,head-metadata-summary.json,slider-preservation.json,before-tests.log,after-tests.log}. De aparte metadata-build staat onder head-metadata/. De vroegere inputlatentiebenchmark is in deze ronde niet herhaald; deze UI-/validatiewijziging claimt geen nieuwe typsnelheidswinst.

## Afbakening en vervolg

Auditpunt U1 is hiermee afgehandeld binnen de door de founder gekozen plaatsing in Preview. De andere open auditpunten blijven afzonderlijk: Fit/Fill-woordenschat, bijzondere horizontale tekstoverflow, conversiefoutdetails en de twee nog niet gereproduceerde lifecycle-/pixelhypothesen. Deze taak verandert geen publicatiegedrag of publieke leeslayout.

Alle bestaande lokale wijzigingen zijn behouden. Geen gebruikerscompositie bewerkt, geen Windows-instelling gewijzigd, geen commit, push, upload, walletactie, publicatie of deployment uitgevoerd. De code en rapporten zijn lokaal. Dit verslag en de auditstatusupdate worden na de verificatie opgeslagen.

# Eerste begrensde verwijdering van ongebruikte code

23 oktober 2026. Deze onafhankelijke deelcontrole is vervroegd uitgevoerd tijdens
de nulmeting. Zij vervangt de verdere architectuur- en CSS-stappen niet.

Acht ongebruikte exports zijn verwijderd uit zeven actieve bestanden: 41 regels,
2.766 bytes inclusief hun regeleindes. Er is geen module, stylesheet, asset of
compositiepad verwijderd. Dit is minder misleidende API-oppervlakte; geen gemeten
bundel- of prestatiewinst.

| Bestand | Verwijderde declaratie |
| --- | --- |
| `src/lattice/browser/browserWorkspaceModel.js` | `BROWSER_TABS`, `BROWSER_DISPLAY_MODES` |
| `src/lattice/rendering/latticeGeometry.js` | `AUTO_LATTICE_OVERLAY_INK` |
| `src/systemWorkflow/systemWorkflowCrop.js` | `SYSTEM_WORKFLOW_CROP_ZOOM_STEP` |
| `src/public/menus/contextMenuModel.js` | `resolveContextTarget` |
| `src/profileDocument/domain/profileDocumentV9Reconciliation.js` | `createProfileDocumentV9RestorePlan` |
| `src/systemWorkflow/systemWorkflowResize.js` | `nudgeSystemWorkflowGroupResizeGeometries` |
| `src/signals/domain/reactionDirector.js` | `getReactionPresentation` |

De import-/re-exportcontrole omvatte productie, ontwikkeling, browserfixtures,
tests, het designsysteem en niet-letterlijke imports. Elk symbool had uitsluitend
zijn eigen declaratie als uitvoerbare referentie. De actieve vervangende paden en
bewust behouden historische namen staan in het onafhankelijke rapport. De controle
is vlak vóór verwijdering opnieuw uitgevoerd.

Een bytevergelijking met de afzonderlijk bewaarde voorbestanden bevestigt dat
uitsluitend de genoemde declaraties zijn weggehaald. Alle imports en overige
inhoud van deze zeven bestanden zijn gelijk. De herhaalde importinventaris vindt
geen nieuw onbereikbaar bestand. Alle **291 bestaande gerichte unit-tests** slagen,
zonder skips of cancellations. De gecombineerde build en browsercontroles horen
bij de aansluitende integratie; oude baselinefailures blijven afzonderlijk zichtbaar.

- [Onderbouwing en behouden actieve paden](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/README.md)
- [Preflight en bronidentiteit](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/implementation/preflight.json)
- [Exacte eigen delta](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/implementation/own-delta.patch)
- [Controle dat alleen declaraties verdwenen](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/implementation/delta-check.json)
- [Unit-resultaat en commando](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/implementation/unit-result.json)

De [gezamenlijke integratiecontrole](../integration/result.md) bevestigt daarna
alle 1.260 unit-tests, beide builds en de productie-opstart. De gerichte
Activity-, Library-, opslag- en publicatieherstelchecks slagen; drie andere
browsersuites blijven met concrete vervolgacties rood. De zeven verwijderbestanden
waren bij de gezamenlijke controle hashgelijk aan hun goedgekeurde na-versie.
De laatste diffcontrole verwijderde uitsluitend nog één lege CRLF-eindregel (2 bytes)
uit `profileDocumentV9Reconciliation.js`; de uitvoerbare bytes zijn gelijk.
Samen zijn daarmee 42 regels en 2.768 bytes verwijderd. De bronzoekactie en
grafiekcontrole vonden geen verwijzing naar de verwijderde symbolen of nieuw
onbereikbaar bestand. Dit sluit deze acht verwijderingen af; de bredere CSS- en
architectuuropdracht van het plan is niet als uitgevoerd aangemerkt.

Deze deelverwijdering is lokaal. Geen commit, push of deployment. De uitkomst
rechtvaardigt geen verdere blanket-verwijdering van exports, tests of oude namen.

## Vervolgronde: actuele Library-opslag

[Huidige uitvoering](../../../../../../technical-regie-2026-10-23/continuation/step-25-library/README.md): v1–v8-lees/conversiepaden en twee ongebruikte opslag-API’s zijn verwijderd. De enige actuele reader levert workspace en conflicttoken uit dezelfde v9-bytes; de bestaande transactionele writer blijft verantwoordelijk voor bewaren vóór acceptatie. Historische sleutels op schijf worden niet verwijderd. Ongeldige/hogere/oudere versies onder de huidige sleutel blijven behouden en blokkeren schrijven. Geen nieuwe migratielaag.

147 units en 26 browsergevallen slagen. De hoofdtaak controleerde de gerichte diff, alle actieve callers en de tests op versie/profiel/JSON, read failure, recovery, externe wijziging en failed write. De aanvullende gezamenlijke capture/schema/Library-opslagrun slaagde 24/24. De eerder verwijderde dubbele Library-filter/selectionvelden staan onder stap17; actieve browserselectie blijft behouden. Verdere restantencontrole na de nog lopende architectuurstappen en de build/budgetcontrole blijven open.

De [begrensde nacontrole](../../../../../../technical-regie-2026-10-23/continuation/step-25-restants/README.md) verantwoordt de bekende exports, dynamische imports, Library-restanten, fixtures en CSS-kandidaten. SharedDisplayToolsLauncher blijft behouden: de Visitor gebruikt die daadwerkelijk. De afzonderlijke [Canvas-cleanup](../../../../../../technical-regie-2026-10-23/continuation/step-25-canvas/README.md) verwijdert alleen bewezen onbereikbare fallbackmeting. De hoofdtaak heeft de diff en projectie-inputs gelezen; 22 geometry-units, Display-core 1/1, crop-lifecycle 10/10 en Text-recovery 8/8 ondersteunen deze grens. De aanvullende formaatsuite en de uiteindelijke core-integratie blijven open. Geen claim van een volledig dood-codevrije applicatie.


## Aanvullende gerichte verwijderingen

De aanvullende [projectiecleanup](../../../../../../technical-regie-2026-10-23/continuation/step-25-projection/README.md) verwijdert de niet-bereikbare no-Stage projectie en het oude schaalargument.540 bestaande actieve projectiegevallen zijn exact gelijk;8 units en40 browsergevallen slagen. Een onafhankelijke bronreview bevestigt deze vijfbestandsdelta. De twee Text-transferfixturegevallen zijn daarna op huidige native bediening aangesloten en slagen2/2 met17 ongewijzigde assertions: [bewijs](../../../../../../technical-regie-2026-10-23/continuation/text-transfer-fixture-closure/README.md). De afzonderlijke clippingobservatie blijft expliciet open. De formaatsuite is4/4 groen, ook tegen de vóór-Canvas-cleanupbron; [vergelijking](../../../../../../technical-regie-2026-10-23/continuation/step-25-canvas/format-closure/README.md).

De oude per-Display hulpmiddelconversie en vier uitsluitend daarvoor gebruikte statehelpers zijn verwijderd. De huidige schrijver gebruikt workbench:tools; per Display blijven gridId/locked. Strikte validatie van huidige Layers/Metadata/Appearance-vensters en opslagherstel blijven behouden.121 units en8 browsergevallen slagen; [exacte delta en callerbewijs](../../../../../../technical-regie-2026-10-23/continuation/step-25-tools-legacy/README.md). Hoofdtaak heeft de diff en testmapping gelezen; onafhankelijke nacontrole loopt. Geen bewaarde records, modules of styles verwijderd. De definitieve build/budget en gezamenlijke run blijven open.


De [twee Text-compatibiliteitsrestanten](../../../../../../technical-regie-2026-10-23/continuation/step-25-text-legacy/README.md) zijn verwijderd na volledige gerichte caller/writercontrole: per-artikel settings had geen schrijver meer; de NFT-targetbinding was uitsluitend oude ongebruikte draftcompatibiliteit. Huidige Read/Write-mode, expliciete toolzichtbaarheid, geldig opgeslagen Text-target, scene links, pagination, embedded artwork en publieke/private filtering blijven behouden. Onbekende velden worden afgewezen en bestaande opgeslagen bytes blijven intact voor expliciet herstel.5 voorkeurunits,70 artikel/opslag/projectie/herstelunits en6 browsergevallen slagen. De hoofdtaak las de delta; onafhankelijke bronreview vond geen productiebevinding. De contractpassages zijn met de actuele lezers in overeenstemming gebracht. Preflight03 op stabiele bron blijft145 raw/256 gzip bytes boven het ongewijzigde budget; dit is geen releasegroen.


## Laatste Stage-inputcontrole

De Canvas krijgt de schaal nu uitsluitend van zijn bestaande Stageprovider. Ongebruikte childprops, een onbereikbaar fallbackpad en de altijd1 zijnde inline-inverseschaal zijn verwijderd; de betekenisvolle nulgeometrieguards blijven. De onafhankelijke bronreview accepteert de drie bestandsdeltas en beoordeelt alle zeven hookinvarianten afzonderlijk.39 gerichte units slagen. De ene falende Lift-sleepassertion faalt eveneens met de twee vóórcomponenten; de huidige fixture-reparatie blijft apart open. [Bronreview](../../../../../../technical-regie-2026-10-23/continuation/reviews/final-core/stage-input-review.md).

Preflight04 op stabiele bron bouwt de artifacts maar keurt de build wegens het bestaande gzipbudget af:809723 tegenover809500 bytes. Het rawbudget slaagt. Geen budget aangepast en geen volledige releaseclaim. Lint slaagt met458 bronbestanden en93 individueel beoordeelde observaties.


## Geïntegreerde laatste bronreviews

De Display Lift-afsnijding is hersteld met de bestaande tijdelijke clipuitzondering: 12/12 gerichte browsergevallen slagen en alle 33 oorspronkelijke Lift-assertions blijven behouden. De naamcorrectie verwijdert een historische uitzondering die de huidige eigen naam PRESENTATION BOARD na herladen verving: één native roundtrip en vier bestaande units slagen; de 149 bestaande fixture-assertions zijn ongewijzigd. Display blijft op expliciet verzoek van de founder functioneel behouden en uit de gewone aanmaakmenu’s verborgen.

Ongebruikte bestandsmetadata van de vijf artikelfonts is verwijderd; bestaande fontkeuze en CSS blijven gelijk. Domein en beide tekstgroottevelden gebruiken dezelfde bestaande 8–300-validatie. De onafhankelijke reviews bevestigen behoud van conversies, titelvoorwaarden en schaalreset. Er is geen algemene claim dat iedere oude naam of koppeling verdwenen is.

Bewijs: continuation/reviews/final-core/{display-lift-crop,display-name-legacy-alias,font-metadata,ui-font-size-policy}-review.json. De gezamenlijke units: 1418/1420 op stabiele bron; de twee fouten zijn de inmiddels bijgewerkte stijlinventaris en het nog falende productiebuildbudget. Vier inventarisproeven slagen na hergeneratie. Dit vervangt geen volledige eindrun.

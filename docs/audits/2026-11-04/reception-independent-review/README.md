# Onafhankelijke Reception-review — 4 november 2026

Reception hergebruikt daadwerkelijk de bestaande Editor, native modules en canonieke opslag. De gewone Bento-bewerkingen hebben sterke regressiedekking. Deze review bevestigt echter **twee productfouten van prioriteit P2**: een herstelde cel kan inhoud visueel aannemen zonder die inhoud als lid op te slaan, en het verwijderen van een private celachtergrond kan behouden inhoud opnieuw opnemen in de publieke projectie. Daarnaast is de bredere browserdekking momenteel niet volledig groen.

Dit verslag is gemaakt door een afzonderlijke agent met verse taakcontext. Er zijn geen eerdere auditconclusies als uitgangspunt verstrekt of eerdere auditverslagen inhoudelijk gelezen. Dit was **geen letterlijk via de UI aangemaakte nieuwe gebruikerschat**. De actieve contracten en actuele bron waren de product- en implementatiebronnen. Alleen eigen bewijs is hieronder als verificatie gebruikt.

## Bronmoment en afbakening

- Checkout: `remediation-2026-10-19-shared-checkpoint/work`.
- Branch: `codex/profile-work-index-2026-10-30`.
- HEAD: `82837f1d76debe98f1597cf69d5bd95aac5f2659`; remote branch wees bij controle naar dezelfde commit. Remote `main`: `cef32fb6b40001dc06c091636eeb144872331ffc`.
- De werkboom was bij aanvang omvangrijk gewijzigd. Dit rapport beoordeelt die **lokale bron**, niet uitsluitend HEAD. Het eigen bronmanifest van de geslaagde gerichte browserrun heeft SHA-256 `89b6304fd926c6bcebe0120f6e77aee243ef8090f776ed9fbe079342599a83f1`.
- Node `24.20.0`, Playwright `1.61.1`, Chrome `156.0.8078.80`, Windows. Tests gebruiken wegwerp-browsercontexten en eigen fixture-opslag.
- Gelezen: checkout-AGENTS, actieve contracten, creatieve intentie en relevante huidige code/tests. Het beschermde continuation-handoffbestand is niet geopend, gewijzigd of gebruikt.
- Geen productcode of producttests gewijzigd, geen commit/push, publicatie, upload, walletprompt, handtekening of transactie uitgevoerd. Bewijs en scripts staan uitsluitend in deze nieuwe auditmap en de [eigen outputmap](../../../../output/reception-independent-review-2026-11-04/).

De browserchecks mounten de **echte** `OwnerSystemWorkflowRuntime`, native Text/Image/Shape en Reception-reader in bestaande lokale integratiefixtures. De artworkbytes komen uit de repository: onder andere ABYSSAL STUDY, SKULL REAPER en vijf andere bestaande assets. De figuren zijn geen visuele mockups. Synthetische profielidentiteit en gecontroleerde assetroutes betekenen wel dat dit geen volledige geauthenticeerde productiesessie met live chain/indexer is.

## Bevestigde productfouten

### F1 — P2: Undo herstelt de zichtbare inhoudmodus, maar niet de opslagscope

**Gevolg.** Na het terughalen van een verwijderde cel meldt de Editor weer `Editing contents · Cell 1`. Een vervolgens binnen die cel getekende Shape wordt desondanks als vrije laag opgeslagen. Ze volgt de cel daardoor niet als lid en krijgt niet de bedoelde celclip. Het canvas oogt aanvankelijk logisch, waardoor de fout pas bij een volgende celbewerking kan opvallen.

**Reproductie via de huidige UI:**

1. Maak via Bento één cel en open de inhoud met dubbelklik.
2. Open Layers; verwijder de celachtergrond via de rij met de celnaam en bevestig.
3. Kies Edit → Undo. De rij `Editing contents` en `Back to cells` keren terug.
4. Kies Rectangle (`r`) en teken een tweede rechthoek binnen de herstelde cel.
5. Lees het opgeslagen Reception-document: de nieuwe Shape bestaat, maar `cells[0].members` is `[]`.
6. Controle: verlaat de inhoud met Back to cells, open dezelfde cel opnieuw en teken nog een Shape. Die wordt wél lid. Daarmee is dit specifiek een fout in de Undo-overgang, geen algemene tekenfout.

**Oorzaak in huidige bron.** [EditorCellsContext.jsx:27](../../../../src/reception/EditorCellsContext.jsx#L27) bewaart `editingId` lokaal, naast `editingCell` in de scope. Regel 40 leidt de zichtbare modus af van dat oude ID en actuele cellen; regels 44 en 47 schrijven beide waarden alleen bij expliciet betreden/verlaten. De opruiming op regel 54 wist bij verwijdering uitsluitend de scopewaarde. [receptionEditorScope.js:56](../../../../src/reception/receptionEditorScope.js#L56) wist eveneens de scopewaarde als de cel verdwenen is. Undo brengt het cel-ID terug, waardoor de React-modus herleeft zonder de scope opnieuw te activeren. De native commit gebruikt vervolgens de scopewaarde als `targetCell` op [regel 105](../../../../src/reception/receptionEditorScope.js#L105).

**Bewijs.** [Reproduceerbaar browserscript](../../../../output/reception-independent-review-2026-11-04/boundary-probes.mjs), [resultaat](../../../../output/reception-independent-review-2026-11-04/boundary-probes/results.json), [screenshot](../../../../output/reception-independent-review-2026-11-04/boundary-probes/undo-editing-cell-membership.png). Gemeten: `noticeAfterDelete: 0`, `noticeAfterUndo: 1`, `addedBelongs: false`, `explicitReentryRestoresMembership: true`.

**Gerichte correctierichting.** Geef de inhoudmodus één eigenaar, of wis bij verdwenen cellen ook het React-ID. Een nieuwe celidentiteit door Undo mag niet vanzelf een andere UI-modus herstellen dan de scope die de volgende save bepaalt. Voeg een gedragscheck voor precies deze overgang toe; een geslaagde gewone Undo van geometrie dekt dit niet.

### F2 — P2: verwijderen van een private cel maakt behouden inhoud opnieuw publiceerbaar

**Gevolg.** Een PUBLIC Text in een PRIVATE cel wordt eerst terecht uit de publieke projectie verwijderd. Het verwijderen van alleen de achtergrond verwijdert ook de celrelatie; de behouden Text blijft `PUBLIC` en verschijnt vervolgens in Preview en de volgende publieke projectie. De enige verwijderbevestiging meldt `Delete Cell 2?`.

**Belangrijke grens.** Deze handeling verandert lokaal de draft en de daaruit berekende publieke projectie. Een reeds gepubliceerde immutable versie is niet aangepast. Externe bezoekers zouden de inhoud pas zien na een aparte publicatie waarin de gewijzigde Reception wordt meegenomen. Tijdens deze audit is niets gepubliceerd.

**Reproductie:**

1. Maak twee cellen, voeg via + Text aan de tweede cel tekst toe. Nieuwe Reception-Text is standaard PUBLIC.
2. Selecteer de tweede cel, open Shape en vink `Include in publication` uit.
3. Open Preview: de Text is uitgesloten. De eigen probe meet `projectReception(...).texts.length === 0`.
4. Verwijder die celachtergrond via Layers. De bevestiging noemt alleen het verwijderen van de cel.
5. De Text blijft bestaan als vrije PUBLIC laag; de projectie bevat nu één Text. Open Preview om die zichtbaar te zien. Undo herstelt de vorige toestand.

**Oorzaak.** [receptionEditorDocument.js:139](../../../../src/reception/receptionEditorDocument.js#L139) berekent een private suppressieset uit bestaande cellen en hun leden. [Regel 218](../../../../src/reception/receptionEditorDocument.js#L218) verwijdert de celrelatie wanneer de achtergrond verdwijnt, zonder de effectieve publicatiekeuze van behouden leden over te nemen. De native verwijdering behoudt terecht andere records; [WorkbenchLayers.jsx:85](../../../../src/public/ownerSystemWorkflow/WorkbenchLayers.jsx#L85) voegt geen uitleg over deze veranderende publiceerbaarheid toe. De gebruiker bereikt de privacykeuze via [ShapeWorkbench.jsx:92](../../../../src/shapes/ShapeWorkbench.jsx#L92).

**Contractafweging.** Het actieve contract schrijft op regels 310–318 voor dat verwijderen van een celachtergrond native artwork als onafhankelijke lagen behoudt. Dat is geen reden om die inhoud te verwijderen als oplossing. Het contract voorkomt bij merge expliciet dat inhoud van een private cel via een publieke cel wordt blootgesteld (regels 302–307), en behoudt bestaande private schrijfkeuzes (regels 420–423). Voor **verwijderen** specificeert het contract niet letterlijk welke zichtbaarheid de behouden laag moet erven. De bevestigde fout is daarom de onverklaarde verandering van de effectieve publieke uitsluiting; de definitieve UX-keuze kan behoud van die uitsluiting zijn, of een expliciete keuze die het opnieuw opnemen uitlegt.

**Bewijs.** [Pure state-probe](../../../../output/reception-independent-review-2026-11-04/state-probes.mjs), [state-resultaat](../../../../output/reception-independent-review-2026-11-04/state-probes.json), [onafhankelijke UI-probe](../../../../output/reception-independent-review-2026-11-04/browser-probes.mjs), [UI-resultaat](../../../../output/reception-independent-review-2026-11-04/independent-browser/results.json), [bevestiging](../../../../output/reception-independent-review-2026-11-04/independent-browser/private-cell-delete-confirmation.png), [Preview na verwijderen](../../../../output/reception-independent-review-2026-11-04/independent-browser/private-text-exposed-in-preview.png).

## Testbetrouwbaarheid en releasebewijs

### T1 — P2 verificatiegat: de bredere Reception-/recoverydekking is rood

De 39 geselecteerde kernchecks zijn groen, maar uitbreiding naar toegang, herstel en navigatie levert falende bestaande suites op. De audit noemt dit niet automatisch een defect in de bijbehorende productfuncties.

| Suite/check | Eigen resultaat | Betekenis |
| --- | --- | --- |
| `src/reception/*.test.js` | 88/88 geslaagd | Geometrie, scope, generatie, schema, projectie en opslaggrenzen. |
| Volledige `npm test` | 1710/1710 geslaagd | Dit commando bevat unit/contractchecks; het voert niet alle `.browser.mjs`-suites uit. |
| `reception-native-editor` | 29/29 geslaagd | Native creatie, cellen, spacing, clips, merge/split, undo/reload, pointerherstel en foutopslag. |
| `reception-cell-interaction` | 3/3 geslaagd | Interactie met native cellen. |
| `reception-layer-order` | 3/3 geslaagd | Native laagvolgorde en clipgedrag. |
| `reception-reader` | 4/4 geslaagd | Bestaande v2-reader, media-identiteit en herstel; geen volledige v3-readeracceptatie op zichzelf. |
| `reception-linked` | 4/4 geslaagd | Gekoppelde canvasinhoud. |
| `reception-overview-navigation` | 2/2 geslaagd | Overgang naar de aparte werkenoverzichtsroute. |
| `reception-boundaries` | 5/8 geslaagd | Drie failures hieronder. |
| `workbench-recovery` | 0/1 geslaagd | Blokkeert op een oude layoutstateverwachting vóór de resterende recoveryasserties. |
| `owner-profile-routing` | Setup mislukt | Browseradapter `ETIMEDOUT`; geen functioneel routingresultaat claimen. |
| Eigen boundary-probe | Geslaagd, inclusief F1-reproductie | Lease, vrijgave/retry, Backup, authority-verlies en de Undo-modusovergang. |
| Lint | Geslaagd | 549 bronbestanden; **78 geregistreerde hook-dependency-observaties blijven bestaan**. Geen claim van nul technische schuld. |
| Typecheck | Geslaagd | Strict contracts; 39 ongeldige calls en 9 productie-mutaties afgewezen door de contractchecks. |
| Build + build:check | Geslaagd | Eigen uitvoermap; 800.014 initial-JS-bytes binnen huidige budgetten. Vite meldt wel grote chunks. |

De concrete verouderde aannames staan in [reception-boundaries.browser.mjs](../../../../browser-tests/reception-boundaries.browser.mjs): `viewReception` op regel 25 veronderstelt dat de sidebar al openstaat; regel 91 zoekt Backup onder Settings terwijl Backup een eigen hoofdmenu heeft; regels 132 en 141 behandelen `saved().workbenches` als aanwezige collectie terwijl de fixture `store().getDraft()` retourneert, ook voor een enkel document ([fixture:41](../../../../browser-tests/reception-boundaries-fixture.jsx#L41)). De eerste twee actuele paden zijn zelfstandig met de juiste menu's doorlopen en werken. De derde faalt vóór de bedoelde history/navigationcontrole en bewijst dus niets over die navigatie.

[workbench-recovery.browser.mjs:70](../../../../browser-tests/workbench-recovery.browser.mjs#L70) wacht op `readLayout()?.views?.['workbench:tools']?.layers === false`; de huidige toolvoorkeuren lezen Layers via de editor-docks in [editorPreferencesStore.js:48](../../../../src/public/ownerSystemWorkflow/editorPreferencesStore.js#L48). Deze failure laat het vervolg van die suite ongetest. Het is geen bewijs dat de specifieke Text-disposalrecovery fout is. Repareer de testroute/assertie bij de huidige eigenaar en voer het vervolg opnieuw uit; de assertions afzwakken of de suite schrappen is geen onderbouwing.

De lokale standaardbrowserprobe faalde eerst met `spawn UNKNOWN` voor de aanwezige Playwright-Chromium. Een expliciete Chrome-executable maakte de gewone runner bruikbaar. De afzonderlijke owner-routingadapter bleef vervolgens met `ETIMEDOUT` falen. Beide infrastructuurproblemen zijn apart vastgelegd, niet als productcrash geteld.

Bewijs: [kernrun met bronmanifest](../../../../output/reception-independent-review-2026-11-04/browser-chrome/browser.json), [bredere run](../../../../output/reception-independent-review-2026-11-04/browser-boundaries/browser.json), [boundary-failures](../../../../output/reception-independent-review-2026-11-04/browser-boundaries/reception-boundaries.log), [recovery-failure](../../../../output/reception-independent-review-2026-11-04/browser-boundaries/workbench-recovery.log), [routing-setup](../../../../output/reception-independent-review-2026-11-04/browser-boundaries/owner-profile-routing.log), [unitlog](../../../../output/reception-independent-review-2026-11-04/full-unit.log), [buildcheck](../../../../output/reception-independent-review-2026-11-04/build-check.log).

**Actuele remote status.** De GitHub-run op HEAD is [Verify Inscape #70](https://github.com/RadarVisuals/INSCAPE/actions/runs/41333804853), push-run van 1 november, status `completed`, conclusie `failure`. De eenvoudiger commit-status/PR-runconnectoren gaven lege lijsten; een aanvullende Actions-API-read vond de push-run wel. Dat is een belangrijk verschil tussen ontbrekende connectorresultaten en groen CI-bewijs. De nieuwe lokale wijzigingen zijn met deze remote run niet geverifieerd. Zie [eigen CI-uittreksel](../../../../output/reception-independent-review-2026-11-04/ci-evidence.json).

De openbare host `enterinscape.netlify.app` antwoordde op 4 november 09:44 UTC met HTTP 200 en een HTML-entry naar `index-BGyEhxbI.js`. Dit bewijst bereikbaarheid, **niet** dat deze lokale werkboom daar draait of dat publicatie werkt. Geen deploy gedaan; geen Netlify-releaseprovenance of walletpublicatie end-to-end geverifieerd. [HTTP-bewijs](../../../../output/reception-independent-review-2026-11-04/deployment-http.json).

## Architectuur en native hergebruik

De hoofdgrens is goed gekozen. [OwnerWorkbenchSession.jsx:84](../../../../src/public/ownerSystemWorkflow/OwnerWorkbenchSession.jsx#L84) opent een Reception-scope in dezelfde sessie. [systemWorkflowDraftStore.js:403](../../../../src/systemWorkflow/systemWorkflowDraftStore.js#L403) bindt die capability aan profiel/activatie, controleert schrijfbevoegdheid en laat wijzigingen buiten Reception/identity niet passeren. `receptionEditorScope` projecteert native `workbench`, `imageModules`, `texts`, `shapes` en `artworkLayers`; het bewaart geen tweede compositie naast het profiel. History wordt door de rootstore per document gescheiden. De tests controleren canvasisolatie daadwerkelijk met inhoudsvergelijkingen.

Bento is een gespecialiseerde layoutinteractie boven native rechthoeken. De generator bewaart geen extra seed-/tilemodel: voorgestelde geometrie wordt normale Shape-windowgeometrie. Gutter/outer margin zijn expliciete settings. De scheiding tussen tijdelijke proposals/transforms en opgeslagen inhoud is aantoonbaar: sluiten, Escape, afgebroken pointergestures, generatieverandering en mislukte saves zijn gericht getest. Capaciteit, native min/max-afmetingen en inhoudsbehoud bij count-reductie worden vóór opslaan gecontroleerd.

Image-creatie gebruikt `addImageModule` en de bestaande Library; Text gebruikt `addTextModule` en het native artikelgereedschap. `commitInCell` schrijft creatie en lidmaatschap atomair naar de expliciete bestemming. De vertraagde Library-resultaten worden aan request, scope en generation gebonden. Dat is wezenlijk hergebruik, geen visueel nagebouwde tweede editor.

De publieke v3-weergave en responsive Preview gebruiken beide [ReceptionDocumentCanvas.jsx](../../../../src/reception/ReceptionDocumentCanvas.jsx). Die leest de publieke projectie, native laagvolgorde en afgeleide responsive geometrie. Shape gebruikt `ShapeSurface`, Image gebruikt `ImageArtwork`, Text gebruikt de gedeelde artikelrendering. Dit is een afzonderlijke read-only host voor dezelfde records; geen tweede authoring-implementatie.

Er bestaan nog v2-reader-/conversiepaden (`ReceptionCanvas`, layout/arrangement/scene en versievertakkingen). In de huidige contracten hebben immutable publicaties en expliciete editconversie een bestaande consument. Dat is geen voldoende bewijs om ze als dode duplicatie te verwijderen. Ook oudere reader-browsertests controleren die paden; hun groen zegt minder over v3 dan de naam van de suite doet vermoeden.

De concrete verantwoordelijkheidsschuld zit vooral in **F1**: de tijdelijke celinhoudmodus heeft twee eigenaren. De generieke `convert`-catch levert daarnaast vaak alleen `false` aan native callers, waardoor de concrete validatiefout verloren kan gaan; dat is een onderhouds-/diagnosepunt, zonder hier een extra onbewezen dataverliesclaim van te maken. Een zoekcontrole in `src/reception` vond geen `!important`, TODO/FIXME of `console`-restanten. De twee lokale DOM-queries zijn begrensd tot eigen panel/celhosts; gesturelisteners hebben cleanup. Geen aanwijzing gevonden voor een tweede algemene toolbar-, Color- of toolwindow-implementatie binnen Reception.

## Werking, opslag en toegang: wat aantoonbaar goed gaat

- Genereren, vorige variant, tijdelijke radius/gutter, toevoegen aan een rij, rij toevoegen, gezamenlijke grenzen, swap, merge/split en lokale ruimteopvulling bij verwijderen zijn met echte interacties en canonieke state gecontroleerd.
- Gewone completed operations zijn één Undo-stap; saved geometry blijft behouden bij mislukte opslag. De nieuw gevonden F1 betreft een **tijdelijke UI-modus na Undo**, niet het terugzetten van de canonieke celgeometrie zelf.
- In een eigen iteratieve probe groeide de Bento tot veertien cellen; de volgende toevoeging werd met een bruikbare beperking geweigerd. De Text eindigde exact op zijn native minimum van 180 px breed, niet daaronder.
- Private cellen en private Text worden in normale projectie onderdrukt; private linked references worden niet meegestuurd. F2 is specifiek de overgang waarbij de celrelatie wordt verwijderd.
- Een tweede tab met hetzelfde profiel werd via de echte leaseboundary view-only. Na vertrek uit de eerste Editor lukte expliciete retry. Backup via het huidige hoofdmenu herstelde de lokale Reception, behield documenttarget `reception` en vernieuwde de reader. Verlies van owner-authority unmountte de Editor en liet uitsluitend `PUBLIC ONLY` zien.
- Breed/smal scrollen en de vaste Bento-footer houden de Apply-actie bereikbaar. De gedeelde actionstrip, toolbar, zijpanelen en instellingen hebben in Dark/Light één herkenbare controlestijl. De onderzochte browserprobes leverden geen pageerrors op.

## Visuele beoordeling en UX-voorstellen — geen aanvullende bevestigde productfouten

De eigen reeks omvat 1440×900 en 900×900 voor Editor, Bento en Preview, in Dark en Light, met een werkelijk geladen ABYSSAL-afbeelding en meerdere gevulde Text-paragrafen. Verder is dezelfde inhoud met de echte publieke Reception-component op 900×900 bekeken en is de gevulde maximale-cellenproef visueel geïnspecteerd.

| Onderdeel | Oordeel en gerichte mogelijkheid |
| --- | --- |
| Custom Bento beginnen | Eén cel maken en vervolgens splitten is directer dan met willekeurige rechthoeken beginnen. Current grid/New layout maakt het onderscheid tussen wijzigen en vervangen helder. Het gegenereerde voorstel blijft afzonderlijk van de opgeslagen layout. |
| Inhoud en layout | + Image/+ Text en Back to cells maken de twee interactieniveaus zichtbaar. Voor frequent gebruik blijven de overlappende floating tools een praktische keuze: docken/sluiten geeft ruimte zonder nieuwe schermstructuur. F1 moet eerst worden opgelost omdat het zichtbare niveau betrouwbaar moet blijven. |
| Fit-preview op een klein computervenster | Op 900 px houdt Preview permanent 240 px instellingenruimte voor telefoonopmaak. Fit gebruikt daardoor 628 px en schakelt de bestaande ≤640-opmaak in. De daadwerkelijke publieke Reception had op hetzelfde venster 860 px canvasruimte en bleef in de desktopopmaak. Dat volgt de huidige viewportregels, maar is een verwarrende vergelijking. Overweeg het instellingenpaneel inklapbaar te maken of de effectieve previewbreedte ook bij Fit te tonen. Geen mobiel redesign nodig. |
| Light met transparante nieuwe Text | De standaard Textkleur is authored wit (`defaultTextAppearance`), terwijl nieuwe Reception-Text een transparante achtergrond krijgt. Op de standaard doorzichtige grijze cel in Light was het contrast visueel zwak. Het behouden van opgeslagen authored kleur is contractueel juist. Overweeg bij **nieuwe** Text een passende beginwaarde of een gerichte authoringhint; verander bestaande kleuren niet stilzwijgend met het interfacethema. |
| Venster smaller maken tijdens bewerken | De Editor behoudt bewust camera/zoom; een verkleind venster kan daardoor een deel van de bestaande compositie buiten beeld laten. De menu-/navigatieacties blijven bereikbaar. Dit is geen bewijs voor foutieve celgeometrie of reden om het canvas automatisch te herordenen. |
| Preview/public-pariteit | Hetzelfde documentcanvas is een sterke basis. De verschillende beschikbare ruimte veroorzaakt tekstomloop en, bij de breakpoint, andere plaatsing/crop. Vergelijk daarom gelijke **effectieve canvasbreedte**, niet alleen gelijke buitenste browserbreedte. Onmiddellijke screenshots na resize kunnen bovendien een tussenframe vóór de ResizeObserver-update tonen; definitieve eigen captures wachten meerdere renderframes. |

Voorbeelden: [Editor breed Dark](../../../../output/reception-independent-review-2026-11-04/independent-browser/editor-1440-dark.png), [Bento smal Dark](../../../../output/reception-independent-review-2026-11-04/independent-browser/bento-900-dark.png), [Preview breed Dark](../../../../output/reception-independent-review-2026-11-04/independent-browser/preview-1440-dark.png), [Preview smal Light](../../../../output/reception-independent-review-2026-11-04/independent-browser/preview-900-light.png), [publieke component smal Light](../../../../output/reception-independent-review-2026-11-04/independent-browser/public-900-light.png). De aangewezen publieke component is een lokale read-only mount met synthetische identiteit; geen claim dat deze data live is gepubliceerd.

## Performance binnen bestaande grenzen

Eigen belasting: **16 cellen, 16 native Images, 16 native Texts, 7 verschillende echte artworkbestanden**. Alle zestien image-renderers rapporteerden `ready`; de screenshot toont daadwerkelijk gevulde inhoud. Dit raakt de bestaande Image- en Text-capaciteiten en de generatorgrens, zonder hypothetische grotere aantallen te introduceren.

| Meting in lokale Chrome/Vite | Resultaat |
| --- | --- |
| Commit van de voorbereide, geldige fixture | 2,7 ms |
| 180 idle requestAnimationFrame-intervallen | mediaan 7,0 ms; p95 7,0 ms; max 7,2 ms; geen interval >50 ms |
| 180 intervallen tijdens 24 afwisselende keyboard-grensbewerkingen | mediaan 7,0 ms; p95 41,8 ms; max 69,5 ms; 3 intervallen >50 ms |
| Hele actieve sample inclusief commandoloop | 2.183 ms |
| Productiebudgetcheck | Geslaagd; 800.014 initial-JS-bytes |

Dit laat zien dat deze gevulde configuratie bruikbaar blijft, met korte haperingen bij opeenvolgende saves/rerenders. Het is geen universele FPS-garantie: de meting draait in development/headless op deze machine, zonder netwerkvertraging/CPU-throttling, met hergebruik van zeven assetbronnen en statische rastermedia. Er is geen afzonderlijk bewijs voor een langdurige sessie met zestien onafhankelijke geanimeerde SVG/HTML-assets of maximale artikelbytes. De performanceproef hoort daarom niet als algemene vrijbrief voor elke toegestane media-inhoud te worden geciteerd.

[Gevulde scene](../../../../output/reception-independent-review-2026-11-04/independent-browser/performance-filled-16.png), [script en meetmethode](../../../../output/reception-independent-review-2026-11-04/browser-probes.mjs), [ruwe metrics](../../../../output/reception-independent-review-2026-11-04/independent-browser/results.json).

## Aanbevolen volgorde en resterende beperkingen

1. Herstel F1 bij de eigenaar van de tijdelijke inhoudmodus; bescherm de delete → Undo → create-overgang met een native UI-check.
2. Maak bij F2 de effectieve zichtbaarheid van behouden inhoud expliciet, zonder de inhoud te verwijderen. Controleer private cel + PUBLIC Image/Text, Undo en projectie in dezelfde test.
3. Werk de rode boundary/recoverytests bij naar de actuele menu-/opslageigenaars, herstel de routingadapter en voer hun volledige inhoud opnieuw uit. Claim pas daarna een volledige releaseacceptatie.
4. Behandel de Fit-paneelruimte en Light-beginwaarde als kleine UX-beslissingen. Een tweede Reception-editor of brede herschrijving is voor de bevestigde fouten niet nodig.

Niet volledig geverifieerd: live wallet/chain-admission, live indexerfouten, publicatie/upload/on-chainpointer, Netlify-releaseprovenance, complete browsercatalogus, langdurige geheugenretentie of animatiebelasting, alle mogelijke vrije/overlappende celconfiguraties en alle cross-browser/screenreadercombinaties. Mobiel authoring is niet onderzocht of herontworpen. Bestaande phone-reflow is alleen waargenomen wanneer de smalle **computer**-preview daar automatisch in terechtkwam.

## Reproduceren

Voer vanuit de applicatiecheckout uit; elk runnerresultaat heeft een nieuwe uitvoermap nodig:

```powershell
node output/reception-independent-review-2026-11-04/state-probes.mjs
node output/reception-independent-review-2026-11-04/boundary-probes.mjs
node output/reception-independent-review-2026-11-04/browser-probes.mjs
$env:INSCAPE_BROWSER_EXECUTABLE='C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'
$env:INSCAPE_BROWSER_REPORT='output/reception-independent-review-rerun'
node scripts/runBrowserTests.mjs reception-native-editor reception-cell-interaction reception-layer-order reception-reader
```

De eigen probes gebruiken poorten 15804 en 15805, sluiten hun eigen browsers/servers en schrijven alleen eigen fixturedata. Hun eerdere selector-/import-/wachtvoorwaardeproblemen zijn in afzonderlijke logbestanden bewaard; de bevestigde resultaten komen uit de laatste succesvolle runs. Er staan geen uitvoerbare `.test.js`-kopieën in de auditoutput. De [integriteitscontrole](../../../../output/reception-independent-review-2026-11-04/integrity.json) vergelijkt 1.418 bron-, test- en configuratiebestanden met het vastgelegde runnermanifest: geen gewijzigde bronbytes en geen kapotte rapportlinks. Het toevoegen van dit verslag is uiteraard een nieuwe documentwijziging.

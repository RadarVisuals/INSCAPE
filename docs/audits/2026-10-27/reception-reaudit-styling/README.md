# Reception: onafhankelijke heraudit en stylinggrenzen — 27 oktober 2026

## Oordeel

De functionele reparaties F1–F4 en F7 zijn opnieuw bevestigd. De oorspronkelijke artikeltitelcase van F5 is opgelost. F6 is **gedeeltelijk opgelost**: header, lokale celacties, sluiten en normale velden gebruiken nu de gedeelde sizing, maar die dekking bereikt niet alle geneste bediening.

Er blijven vier concrete stylingproblemen: profieltekst erft de editorfont, Text-bediening blijft te klein op touch, kleurbediening mist een deel van haar stylesheetcontract en de gedeelde profieleditor mist haar vereiste hostscope.

De reader/editor-scheiding is wezenlijk verbeterd. De canonieke store, publicatieprojectie, bestaande Text-editor, beeldrenderer, metadata en Library worden hergebruikt. Er is geen reden aangetoond voor een nieuw editorframework of een herontwerp van Reception. Gedeelde componenten hebben wel explicietere presentatiegrenzen nodig.

**Dit is uitsluitend een audit.** Alleen deze bewijsmap en gegenereerde buildoutput zijn toegevoegd. Geen applicatiebron aangepast, geen commit, push, deployment, walletactie of publicatie uitgevoerd. De voorgestelde reparaties zijn niet geïmplementeerd.

## Gecontroleerde toestand

- Checkout: remediation-2026-10-19-shared-checkpoint/work.
- Branch: codex/static-reception-bento-2026-10-26.
- HEAD: 4a0251647234c0757847078ec34f0865425f6857.
- De checkout was al sterk gewijzigd: 456 statusregels in de gefilterde baseline. Dit verslag beoordeelt de **huidige lokale bestanden**, inclusief eerdere niet-gecommitte reparaties, niet alleen HEAD.
- Toegepast: checkout-AGENTS, relevante actuele Reception-, navigatie- en stylingafspraken uit INSCAPE_ACTIVE_CONTRACT.md, INSCAPE_CREATIVE_INTENT.md, de Hanssen-referentiemap, de [oorspronkelijke audit](../reception-boundaries-audit/README.md) en het [remediatieverslag](../reception-audit-remediation/README.md).
- Hanssen: opgeslagen Work-, About- en detailbeelden bekeken; live About → Work → Darkness en scrollgedrag geïnspecteerd. Ruime panelen, kleine tussenruimte, compacte navigatie en contour zijn presentatiereferenties. De productafspraken blijven leidend; Desktop blijft buiten scope.
- [Baseline](baseline.json) en [eindcontrole](preservation.json) bewaken 2.222 bestaande bestanden. De bestaande wijziging in docs/audits/2026-10-23/code-quality-progress.json is bytegelijk gebleven: SHA-256 8bf24f49f157fa2ddf6aa6880301a6ab4e301e7986e65f9391a86248affc479f.

Remote bewijs bevestigt deze lokale toestand niet. [PR 5](https://github.com/RadarVisuals/INSCAPE/pull/5) was nog draft op een andere head, 3cfd6cf5da12218938d7706268ebd10bed890966. De opgevraagde buildchecks daarop waren cancelled; Netlify-preview en header/redirectchecks waren success. Voor lokale HEAD leverde de opgevraagde check/statusinformatie geen runs/statussen op. Een groene previewstatus voor die andere head is geen releasebewijs voor deze dirty checkout. Zie [remotegegevens](remote-checks.json) en [PR-diagnostiek](remote-pr-diagnostics.json).

## F1–F7 en R1–R2

| Punt | Status nu | Bewijs en begrenzing |
| --- | --- | --- |
| F1 · owner About geblokkeerd door publicatie | **Bevestigd opgelost** | PublishedProfileBoundary.jsx:58 kiest owner-overview vóór de publieke statusgate. Boundarygevallen dekken ontbrekende, ladende, ongeldige en falende publicatie; echte App-routing opnieuw getest. De productieprobe toont lokale ownerinhoud bij geblokkeerde externe aanvragen. Bezoekers krijgen geen lokale ownerinhoud. |
| F2 · verouderde reader | **Bevestigd opgelost** | profileDraftReader.js:8–36: profielgebonden storage-events, focus/foreground en retry; stabiele snapshot bij gelijke bytes; laatste geldige inhoud met stale/error bij leesfout; wissen bij verwijdering. Units en twee-tabbladenbrowsergevallen slagen. Geen schrijfcommando's of reload van de actieve editor. |
| F3 · herstel naar oude inhoud | **Bevestigd opgelost** | OwnerReceptionEditor.jsx:26–27 en ReceptionStoreEditor.jsx:16–17 voeren recovery en Done via het verlaten van de editscope naar een verse reader. Beide herstelroutes — corrupte start en herstel vanuit editor — opnieuw groen. |
| F4 · focus bij sluiten | **Bevestigd opgelost** | ReceptionControls.jsx:15–18 registreert de trigger met layout-effect; de blijvende editor gebruikt de bestaande deferred-focushelper. Enter, Escape, paneelwissel en authorityverlies opnieuw getest. Frameprobe eindigt op Page settings; expliciete nieuwe focuskeuze Preview blijft behouden. |
| F5 · toolchrome op authored Text | **Oorspronkelijke case bevestigd opgelost** | Brede chrome-attribuut niet meer op de editorwindow. Artikeltitel in productie: editor/preview/reader steeds 28px, line-height 36,4px, border 0 en padding 0. Verwante maar andere fontlek voor profielinhoud: **S1**. |
| F6 · mobiele controls | **Gedeeltelijk opgelost** | Header, celiconen en sluiten halen 44px; normale touchvelden hebben 16px tekst. Text-toolbar blijft 32px hoog en andere geneste controls vallen buiten het recept: **S2/S4**. Passing tests dragen de algemene claim “controls hebben 44px doelen” niet volledig. |
| F7 · artworknaam | **Bevestigd opgelost** | ReceptionCanvas.jsx:32–37: naam/beschrijving op de geschilderde afbeelding, recoveryhost apart, opgeslagen thumbnails decoratief naast hun tekstnaam. Raster, SVG, loading/retry en toegankelijkheidsboom opnieuw getest. |
| R1 · reader/editor-laadgrenzen | **Bevestigd binnen gerapporteerde statische scope** | Beide readers hebben bewaakte statische closures. Koude productie-owner vraagt geen reception-editing op. Editor en owner-Library niet eager in reader. Deze audit rendert bovendien echte ownerflows. Een gevulde editsessie kost meer dan de entryclosure: zie M2. |
| R2 · vrijwel geen bundelmarge | **Bevestigd verbeterd, marge klein** | Verse native en alternate-output builds slagen binnen ongewijzigde budgetten. Non-wallet raw/gzip-marge opnieuw 14.827/8.316 bytes. Geen algemene performanceclaim. |

Bronpaden zijn ten opzichte van de applicatiecheckout. Bewijs: [browserresultaten](browser-verified/results.json), [unitlog](focused-tests.log), [productiemetingen](production-style/results.json) en [focusmetingen](details/results.json).

## Vier bevestigde stylingproblemen

### S1 · P2 · De editorfont verkleint authored profielinhoud

**Trigger:** open een Reception met introduction, links of details; kies Edit Reception en vergelijk met Preview/Done.

**Bron:** [reception.css:49](../../../../src/reception/reception.css#L49) zet de workflow-controlfont op de hele editorwindow. [ReceptionCanvas.jsx:40](../../../../src/reception/ReceptionCanvas.jsx#L40) rendert profielinhoud daarbinnen. De profielregels in reception.css:20–30 herstellen de bodyfont niet.

**Productiebewijs:** dezelfde lange biografie is in owner-reader, preview en reader na Done **16px/27,2px**, maar in editor **11px/18,7px**. De profiel-link gaat van 16px naar 11px. De bronfixture bevestigt dit ook voor details. De expliciet gestileerde artikeltitel blijft correct. Dit is inheritance van een controlfont, geen normaal gevolg van een smaller canvas.

**Effect:** regelafbreking en hiërarchie veranderen tijdens bewerken; de gebruiker beoordeelt andere authored typografie dan de opgeslagen weergave.

**Kleinste structurele reparatie:** controltypografie alleen op header, lokale acties en toolinhoud; één gedeelde bodytypografie voor authored canvasinhoud in reader en editor. Geen losse correctie per profielsubtype.

Bewijs: [productie editor](production-style/editor-1440.png), [preview](production-style/preview-1440.png), [metingen](production-style/results.json). Actuele fout; een nieuwe regressie door de remediatie is niet aangetoond.

### S2 · P2 · Het touchrecept bereikt de Text-toolbar niet volledig

**Trigger:** 320/390px met coarse pointer; open Text tools en scroll naar Bold. Ook op een brede coarse-pointerviewport reproduceerbaar.

**Bron:** [textTools.css:49](../../../../src/text/textTools.css#L49) legt 32px vast op de toolbar-knoppen. De coarse-pointerregel op regel 111 heeft minder specificiteit. Tabs krijgen 42px op regel 12; resetknoppen eigen breedtes op 43/46/55. [workbenchToolChrome.css:102](../../../../src/public/ownerSystemWorkflow/workbenchToolChrome.css#L102) levert 44px tokens, maar hardgecodeerde descendantregels consumeren die niet.

**Gemeten in productie:** Bold op 390px circa **56,8 × 32px**, op 320px **42,8 × 32px**. In gedeelde Workbench-tools op 1280px coarse pointer eveneens **55,6 × 32px**. Dit is mede een bestaande fout in gedeelde Text-styling, geen bewezen nieuwe Reception-regressie. De buitenste closeknop is wel 44 × 44px.

De backup-disclosure in Page settings is daarnaast circa **27,2px** hoog: de mobiele summaryregel geldt voor workbench-tool-window, maar Reception gebruikt workbench-tool-controls. De downloadknop zelf meet wél 44px en het fileveld 50px. Geen algemene backup-stylingfout.

**Effect:** inconsistente touchbediening binnen één paneel. F6 is te breed als volledig opgelost gerapporteerd. Dit toetst het afgesproken productrecept, niet volledige WCAG-conformiteit.

**Kleinste structurele reparatie:** laat intrinsieke Text-controls het gedeelde sizingrecept volgen, met één specificitystrategie. Neem disclosures en smalle resetknoppen mee. Verifieer Workbench en Reception samen; geen tweede mobiel Text-recept in reception.css.

Bewijs: [Text 320px](production-style/text-320.png), [productiemetingen](production-style/results.json), [Workbench-vergelijking](workbench-style/results.json), [backup](details/mist-backup.png).

### S3 · P2 · Kleurbediening veronderstelt een Workbench-host

**Trigger:** Cell appearance → scroll naar Saturation/Lightness; dezelfde component wordt ook onder Text color gebruikt.

**Bron:** [ColourControls.jsx:337](../../../../src/colour/ColourControls.jsx#L337) produceert ds-sr-only en op 341 ds-studio-field-row. Hun verberg-/gridregels bestaan uitsluitend onder workbench-tools-body in [workbenchSharedTools.css:1](../../../../src/public/ownerSystemWorkflow/workbenchSharedTools.css#L1). Die host definieert ook --ds-field-edge, --ds-control-radius en --ds-text-small. [colourControls.css:6](../../../../src/colour/colourControls.css#L6) gebruikt deze zonder fallback. ReceptionPanel-content heeft de host niet.

**Waargenomen:** de voor schermlezers bedoelde instructie is in Reception een zichtbaar tekstblok van circa 40px (320px: circa 53px). De veldrij is block, met inline labels/velden. In Workbench is dezelfde instructie 1 × 1px, absoluut en geclipt; de veldrij is grid. Het kleurwiel en de 16px mobiele invoer werken wel. Productie Carbon en broncontrole Carbon/Mist bevestigen de afwijking.

**Effect:** onbedoelde instructieparagraaf, afwijkende veldindeling en onvolledig gedefinieerde swatch-/validatiestijlen. Geen fout in de kleurdata.

**Kleinste structurele reparatie:** intrinsieke controleregels en a11y-hulpmiddelen bij de gedeelde kleurcomponent; tokens via een gedeeld contract of veilige fallback. Host bepaalt alleen paneelpositie, scrollruimte en omliggende layout. Niet volledige Workbench-docking importeren.

Bewijs: [Reception](production-style/color-390.png), [Workbench](workbench-style/color.png), [productiemetingen](production-style/results.json), [vergelijkingsmetingen](workbench-style/results.json).

### S4 · P2 · De gedeelde profieleditor mist haar stijlscope

**Trigger:** Page settings → Edit profile details; scroll naar profielvelden en verplaats-/verwijderacties.

**Bron:** [ReceptionProfileEditor.jsx:2](../../../../src/reception/ReceptionProfileEditor.jsx#L2) importeert losse IdentityCardSettings-onderdelen en rendert op regel 18 een kale div. [identityModule.css:114](../../../../src/public/identity/identityModule.css#L114) scoped inlinevelden en op 121 actieknoppen onder identity-module; die ancestor ontbreekt. In broncode wordt de stylesheet alleen door IdentityModule.jsx:16 geïmporteerd.

**Productie op 320/390px:** veldacties zijn native grijze/outset-knoppen van **18 × 18px**. Add cell oogt eveneens native; veldbreedtes volgen niet het gedeelde inline-editorcontract. Globale identityregels zoals grid/dividers gelden wel. Dit is een half toegepast contract.

**Laadvolgorde:** de bronfixture heeft eerst block en na import van IdentityModule grid. In productie zit IdentityCardSettings in de IdentityModule-chunk en wordt de stylesheet al bij de koude geneste flow geladen. Een productieverschil tussen koud en warm laden is **niet** aangetoond. De ontbrekende ancestor en 18px-knoppen zijn daar wel bevestigd.

**Kleinste structurele reparatie:** een kleine gedeelde stylesheet/scope voor de herbruikbare profielbewerkingsinhoud, inclusief veldacties en mobiele sizing, expliciet gebruikt door beide hosts. Alleen identity-module toevoegen kan volledige modulepositionering/decoratie binnenhalen en is geen veilige blinde reparatie.

Bewijs: [productie profiel](production-style/profile-390.png), [metingen](production-style/results.json), [bron koud](details/carbon-profile-cold.png), [bron met stylesheet](details/carbon-profile-warm.png).

## Stylinginventaris en eigenaarschap

De [inventaris](stylesheet-inventory.json) bevat directe importers, statische/lazy bereikbaarheid, selectors, media-/containercontext en herhaalde declaraties. Traversering van alle lazy imports betekent niet dat alle styles tegelijk geladen worden. [Samenvatting](inventory-summary.json).

| Laag | Bestanden/componenten | Beoordeling |
| --- | --- | --- |
| Foundation en materiaal | inscapeTokens.css, latticeMenuSurface.css, workflowTokens.css, workflowTactile.css, workflowFlat.css | Kleur, materiaal, type en controltokens gedeeld. Neutrale tokenscope voorkomt brede owner-host in reader. Directorynaam ownerSystemWorkflow is op zichzelf geen fout. |
| Reception-presentatie | reception.css, ReceptionCanvas/Navigation/Overview, profileOverview.css | Contour, cellayout, responsive stapeling, navigatie en presentatie horen hier. Editorfont op authored inhoud overschrijdt de grens: S1. |
| Frame en panelen | ReceptionEditor/Controls, workbenchToolChrome.css, workbenchToolPanel.css | Materiaal/controls gedeeld; bounded positionering, celacties en mobiele bottompanelen lokaal. Goede scheiding. |
| Text | ArticleView/Editor, TextToolsContent, TextColourTools, text.css, textTools.css | Bestaande editor, edit-session en portal hergebruikt; geen tweede rich-textmodel. Sizing moet gedeeld recept volgen: S2. |
| Kleur | CommittedColourControls, ColourControls, colourControls.css | Data-/gesturegedrag gedeeld; presentatiecontract ontbreekt buiten Workbench: S3. |
| Profiel | ReceptionProfileEditor, IdentityCardSettings, IdentityModule/identityModule.css | Data en bewerkingslogica gedeeld; import/ancestors niet zelfstandig herbruikbaar: S4. |
| Media en metadata | ReceptionImage, ImageArtwork/ProjectedSvgArtwork, OwnerSystemWorkflowMetadataContent/artworkInfo.css | Rendering, recovery en metadata gedeeld. Lokale crop/layoutbediening passend; artworknaam nu aanwezig. |
| Library | ProfileLibraryPicker, bestaande Library-workspace, browserWorkspace.css, libraryWorkspace.css | Selectie, bronnen en plaatsing hergebruikt. Reception levert doelcel en bounded overlay. Grootte/scroll op 320–1440px geïnspecteerd; geen extra fout vastgesteld. |
| Recovery | WorkbenchBackupControls/workbenchBackup.css, bestaande storevalidatie | Recovery gedeeld. Carbon/Mist leesbaar; disclosure-sizinguitzondering bij S2. |

### Cascade en onderhoud

- reception.css telt 124 rule-blokken en 13.303 bronbytes. Geen important-declaraties, exact herhaalde selectorblokken in dezelfde at-rule-context of dubbele properties binnen een rule gevonden. Dit sluit cross-file-overlap niet uit: de bewezen problemen zitten juist in inheritance en specificiteit.
- Het ene important in textTools.css is de expliciete hidden-regel. Geen bewijs dat die moet verdwijnen.
- profileOverview.css definieert exploration-room__origin tweemaal met complementaire eigenschappen op 8/20. Samenvoegbare onderhoudskans, geen renderingfout.
- De dubbele class in workbenchBackup.css:2 verhoogt bewust specificiteit. Niet mechanisch verwijderen als “duplicatie”; de fixture toont correcte tekst-/themakleuren.
- Brede descendantselectors onder chrome, text-tools en identity maken het hostcontract belangrijker dan de React-componentnaam. Componenthergebruik garandeert niet automatisch dezelfde presentatie.
- Geen lijst “dode CSS” afgeleid uit alleen bezochte schermen. Andere states/routes kunnen die regels gebruiken.

**M1 · onderhoud:** ArticleView importeert text.css, dat op regel 2 ook textTools.css importeert. Beide readers nemen daardoor inspector-styling mee ondanks correcte JavaScript-isolatie. Een gerichte splitsing tussen documentpresentatie en inspector-CSS is een optimalisatie; geen actuele UI-bug of reden voor een algemene stylesysteemmigratie.

**M2 · onderhoud/meetgrens:** entrykosten zijn niet gelijk aan een volledige gebruikersflow. De automatisch geselecteerde Text-cel activeert meteen een lazy rich-textpad. Profielonderdelen/identitystylesheet zitten ook in de resulterende chunkverdeling. Houd bij groei een renderende flowmeting naast de statische graph.

Afmetingen van gaten/rondingen, compactheid van desktopchrome, Sora-typografie en het verschil tussen eigenaarstools en publieke presentatie zijn zonder aanvullende productafspraak **ontwerpkeuzes**, geen bugs. Hanssen rechtvaardigt geen vervanging van celinteracties, Library of Text.

## Bundels en daadwerkelijk laden

Verse build; bedragen zijn raw bytes, tenzij anders vermeld.

| Statische closure inclusief gedeelde startup | JavaScript | CSS |
| --- | ---: | ---: |
| Public About | 987.113 | 85.603 |
| Owner About | 1.012.114 | 85.603 |
| Reception editing-entry | 1.250.453 | 177.160 |

Totale non-wallet-JS: **2.638.173 raw / 857.684 gzip**. Budget: **2.653.000 / 866.000**. Resterend: **14.827 / 8.316**. Native en alternate-output builds bevestigen deze ongewijzigde budgetten. Bestaande large-chunk- en PublicEntryPortal static/dynamic-waarschuwingen blijven bestaan.

| Cumulatief unieke JS/CSS-aanvragen in één koude desktopcontext | JS-bronbytes | CSS-bronbytes |
| --- | ---: | ---: |
| Owner-reader met gevulde Reception | 1.014.100 | 85.603 |
| Na Edit met automatisch geopende Text-editor | 1.902.158 | 225.401 |
| Na profiel-/kleur-/Text-panelen, Preview en Done | 1.902.158 | 225.401 |

Dit telt raw bestanden achter werkelijk aangevraagde URL's, niet gecomprimeerde transfers, latency of geheugen. Fonts/media ontbreken; routebedragen mogen niet worden opgeteld. De kleine extra ownerkosten komen uit aanvullend aangevraagde bestanden. De grotere editingflow omvat lazy inhoud buiten de entryclosure. De laatste rij betekent alleen dat deze specifieke vervolgpanelen geen verdere unieke JS/CSS vroegen.

De bestaande productie-startup-test controleert startup plus imports van gebouwde routes; hij rendert niet al die routes. Deze audit vult dat aan met daadwerkelijke owner-reader → edit → profiel → kleur → Text → preview → Done, plus afzonderlijk terugkeer via Workbench. De productiebezoeker is alleen in unavailable-state gecontroleerd; gevulde publieke weergave via bronfixture en publieke projectietests. Geen volledige live-publicatie/netwerktest.

Bewijs: [bundelrapport](bundle-report.json), [importgraph](owner-runtime-graph.json), [runtimekosten](runtime-costs.json), [productieflow 1](production-first/results.json), [gevulde productieflow](production-style/results.json).

## States, interactie en visuele dekking

- Desktop 1440 × 900; tussenmaten 800 × 600 en 640 × 480; touch 390 × 844 en 320 × 568; brede coarse-pointer 1280 × 720. Aanvullende productieprobes: 1440/390/320 × 900.
- Carbon/Mist, selected/disabled, lege/opgeslagen inhoud, ongeldige kleurinput, falende write, media-retry, profielvelden, Text-format/defaults, metadata, Library en backup bekeken.
- Header/paneel en geneste content apart gemeten. Naar relevante control gescrold vóór screenshot. Eerste ruwe probes kunnen descendants van gesloten disclosures bevatten; conclusies over zichtbare controls steunen op latere metingen en screenshots.
- Sluiten, Escape, paneelwissel, expliciete nieuwe focus, ownerverlies en recovery getest. Extra 1,2s frameprobe (172 samples) eindigt met verwijderd paneel en triggerfocus; geen late focusroof aangetoond.
- Forced-colors/reduced-motion geëmuleerd in Chromium. Geen fysieke touch-, Safari/VoiceOver- of volledige contrastaudit. Geen performanceclaim uit snelle lokale responstijden.
- Na Workbench blijft readerpresentatie in de gecontroleerde flow bruikbaar; geen nieuwe brede stylesheetlekkage aangetoond. De bronfixture-loadorderafwijking bij Identity staat apart onder S4.
- Eerste brede probes blokkeren externe artworkrequests en tonen soms unavailable-media: bruikbaar voor paneelmetingen, niet voor succesvolle beeldweergave. Latere detail-/productieprobes mappen bekende repository-assets lokaal; bestaande suites controleren raster en transparante SVG.

## Verificatie

| Controle | Resultaat |
| --- | --- |
| Reader, navigation, Reception projection en runtime-isolatie-unitchecks | **22/22** |
| Production-buildtests, inclusief echte alternate-output build | **20/20** |
| Browser: boundaries 6, editor 17, card 6, echte App-routes 5, companion viewport 3, shared tools 3 | **40/40** |
| Gebouwde startup/importtest, desktop en mobiel | **1/1** |
| Extra bron-/productie-stylingprobes | Afgerond; metingen/screenshots, niet in bovenstaande testtellers |
| Lint | Geslaagd, 502 bestanden; 91 bestaande geregistreerde hook-observaties |
| Typecheck | Geslaagd; 17 ongeldige calls en 3 ongeoorloofde mutaties afgewezen |
| Native build en build:check | Geslaagd |
| Git whitespacecontrole en bronbehoud | Geslaagd, exitcode 0; bestaande LF→CRLF-waarschuwingen. [Eindcontrole](preservation.json), [diff-check.log](diff-check.log), [verificatiesamenvatting](verification.json) |

Logs: [browser](browser-verified.log), [units](focused-tests.log), [buildtests](build-tests.log), [native build](build-verified.log), [buildcheck](build-check.log), [startup](production-startup.log), [lint](lint.log), [typecheck](typecheck.log).

Eerste browseropdracht: twee onjuiste suite-namen; volgende poging: esbuild-sandboxbeperking. Juiste suites/build daarna met toegestane uitvoering opnieuw geslaagd. Eerste extra Workbench-probe time-outte op een niet-geopende Layers-selectie; [workbench-style.mjs](workbench-style.mjs) gebruikt de bestaande fixturehelper en voltooide de vergelijking. Eerste productieprobe veronderstelde een niet-geëxporteerde resolution-store; definitieve probe gebruikt alleen bestaande walletstore-export voor synthetische authority en claimt geen gevulde productiebezoeker. Harnessproblemen zijn geen applicatiefouten en tellen niet als passing cases.

Alle browserdata waren synthetisch in afzonderlijke lokale contexten. Productiecode is niet aangepast voor de metingen; authority werd alleen in testgeheugen ingesteld. Geen volledige release-suite uitgevoerd.

## Gericht vervolg

1. Herstel authored typografiegrens S1; toets profiel, links, details én Text tussen edit/preview/reader.
2. Maak gedeelde kleur-/profielbewerkingsinhoud zelfstandig qua stylesheetcontract (S3/S4), zonder volledige host te kopiëren.
3. Rond F6 af via gedeelde sizing (S2), inclusief geneste controls, disclosures en smalle resetacties; verifieer beide editorhosts.
4. Behoud graphchecks; voeg gerichte regressiedekking voor deze vier bewezen verschillen toe. Houd de gevulde editingflow zichtbaar bij volgende bundelwijzigingen.

De functionele architectuurverbeteringen kunnen behouden blijven. Deze heraudit rechtvaardigt gerichte stylingreparaties, geen herbouw van Reception of parallel design system.


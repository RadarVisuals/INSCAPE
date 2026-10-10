# Onafhankelijke audit van de Display-module — 21 september 2026

Status: onderzoek van de huidige lokale versie; geen productieaanpassingen. Dit rapport is geen productcontract of vrijgave voor publicatie.

## Oordeel

De Display heeft bruikbare, vrij goed afgebakende opslag- en modulegrenzen, maar is nog niet betrouwbaar genoeg om visuele gelijkheid en alle bewerkingscombinaties te garanderen. De belangrijkste zwakte is dat dezelfde compositie langs verschillende geometrie- en interactiepaden wordt geïnterpreteerd. Daardoor kan een correctie aan een rand, inspectie of bediening elders een andere betekenis krijgen.

De oorspronkelijke intermitterende korte onderbreking tijdens doorgaande beweging mag niet als opgelost worden beschouwd op basis van deze audit. De hieronder beschreven bewegingsproeven begrenzen wat is gemeten; ze zijn geen bewijs voor iedere zichtbare presentatie op de computer van de gebruiker.

## Opdracht, autoriteit en methode

Onderzocht: huidige lokale code en tests, met `AGENTS.md`, `INSCAPE_ACTIVE_CONTRACT.md` en `INSCAPE_CREATIVE_INTENT.md` als uitgangspunt. Geen Git-geschiedenis, oude auditrapporten of beschermde continuation handoff gebruikt als richting of bewijs. Bestaande wijzigingen zijn behouden. De server op `http://127.0.0.1:5194/` is niet vervangen of gestopt.

Drie onafhankelijke deelonderzoeken betroffen geometrie, camera/beweging en gegevens/interactielifecycle. Hun bevindingen zijn gecombineerd met eigen brononderzoek, testinventarisatie en een aanvullende mediaproef. Browserproeven gebruiken nieuwe headless Chrome-contexten en afzonderlijke fixtures; ze raken de Chrome-opslag van de gebruiker niet. Externe aanvragen zijn geblokkeerd of door lokale artworkfixtures beantwoord. Geen walletprompt, upload, transactie, publicatie of deployment uitgevoerd.

Bewijsniveaus:

- **A:** gereproduceerd gedrag; vermeld wordt of dit een volledige UI-route of een gerichte component/hookproef betreft.
- **B:** aantoonbaar code-/rekenprobleem, zonder volledige reproductie van de gebruikersroute.
- **C:** hypothese; niet als vastgestelde oorzaak gepresenteerd.

Ernst: **P1** kan onbedoeld authored werk veranderen of een wezenlijke compositiekeuze verkeerd weergeven; **P2** is een concrete functionele/visuele fout met beperktere trigger. Prioriteit is geen claim over frequentie.

## Verantwoordelijkheden en afhankelijkheden

| Onderdeel | Huidige eigenaar en route | Beoordeling |
| --- | --- | --- |
| Actieve Display en gedeelde tools | `OwnerSystemWorkflowRuntime`, `SharedDisplayTools`, `ContextToolbar`; expliciet module-ID | Host kiest doel; module levert inhoud en acties. Geen zelfstandige tweede compositie. |
| Geselecteerde Grid/placements en verborgen editorlagen | `useOwnerSystemWorkflowController`; Layers en Stage gebruiken dezelfde selectie | Tijdelijke state, van draftinhoud gescheiden. |
| Geauthorde Display-inhoud | `displayModuleSession` → domain candidates → gedeelde `systemWorkflowDraftStore` | Projectie en merge beperken zich tot `artboard`, `geometry`, `appearance`, `grids`; root-envelop blijft compatibel. |
| Drag/resize | `useOwnerSystemWorkflowPlacementInteraction` → movement/resize-domain → één voltooide commit | Tijdelijke geometriepreview; annulering en snapshotvalidatie bestaan. Crop vormt een afwijkend pad. |
| Crop | `useOwnerSystemWorkflowCrop` + crop-domain + Canvas + contextdock | State, pointerrefs en baseline-eigenaarschap vallen bij beëindiging niet volledig samen. |
| Tijdelijke camera | `useGridPlayback` bezit bron-Grid, lokale positie, absolute railslot, drag/transport; `useGridSwipe` projecteert DOM en meldt voortgang | Refs zijn geen tweede draft; kwetsbaarheid zit in coherentie tussen navigatiecommit, fysieke slots en inhoud. |
| Automatische beweging | `gridCameraTransport` bezit WAAPI-transform; `gridMomentum` bepaalt landingscurve | Play en uitrollen gebruiken dezelfde klok. React hoort de klok bij Gridwissel niet opnieuw te starten. |
| Railscènes | `gridRailScenes`; Owner Canvas en `ProfileDocumentV9Visitor` bereiden maximaal vijf verschijningen voor | Dezelfde Grid kan terecht meerdere fysieke verschijningen hebben bij korte loops. |
| Afmetingen, crop, spiegeling, raster | Gedeelde pure helpers, maar owner `DisplayPlacementContent`, public `GridProductionRenderer` en Lift passen ze verschillend toe | Geen volledige renderingpariteit; zie bevindingen. |
| Inspectie, dimming, Lift, terugkeer | Gedeelde `useDisplayInspection`, `DisplayFocusViewer`, `DisplayLiftArtwork`; mode-adapters leveren entries | Request-/scopebewaking en cleanup zijn sterk; brongeometrie van Lift heeft een afzonderlijke tekortkoming. |
| Grain en selectiechrome | Module-oppervlak en aparte overlays; grain boven Lift | Behoudenswaardige scheiding van bronpixels, module-effect en editorbediening. |
| Gekoppelde Text | Workbench-scoped `SceneNavigation`; Text volgt rapport en transportklok | Display blijft navigatie-eigenaar. Geen geauthorde tekstwijziging per frame. |
| Opslag, undo/redo | Gedeelde profile draft-store; immutable accepted snapshot; generatie + vergelijking opgeslagen bytes | Geen aangetoonde tweede opslagautoriteit. Mislukte writes worden niet als succesvolle commits aangenomen. |
| Preview/public | Builder filtert private inhoud; Preview gebruikt Visitor; Visitor krijgt public document en lokale interactiestate | Geen owner-store voor Visitor-acties. Preview is dezelfde publieke renderer, niet dezelfde artworkrenderer als owner. |

`displayModuleSession.js:6` cachet een afgeleide projectie zolang het aanvaarde rootobject hetzelfde blijft. `useOwnerSystemWorkflowFocusViewer.js:13` cachet afgeleide inspectiemodellen per placement/asset-snapshot. `ownerSystemWorkflowAssetDimensions.js:65` begrenst bronafmetingen op 256 cache-items en verwijdert mislukte entries. Dit zijn verklaarbare caches, geen concurrerende authored waarheid. Het alpha-maskercache in `artworkPicking.js` heeft een maximum van 24 en een vervaltijd van vijf minuten; onbekende alpha valt expliciet terug op rechthoekige picking.

## Geprioriteerde bevindingen

### F1 — P1, A: teksttoetsen veranderen of verwijderen de hele Text-laag

**Trigger en impact.** Voeg in een unlocked Display een Text-laag toe, typ `//ARRIVAL`, druk met de tekstcursor actief op ArrowRight en vervolgens Backspace. In de volledige owner-runtime werd de opgeslagen kolom **2 → 3**; Backspace verwijderde de volledige placement (**1 → 0**). Dit is onbedoelde authored bewerking, niet alleen een verschoven overlay. Gereproduceerd in Edge en onafhankelijk opnieuw in **Chrome 153.0.8010.48**, 1440×1000, reduced motion aan, zonder page errors.

**Code.** `src/public/ownerSystemWorkflow/OwnerSystemWorkflowCanvas.jsx:250` installeert globale keydownbediening. De uitsluiting op regel 255 controleert INPUT/TEXTAREA/SELECT, maar niet contenteditable of een al afgehandeld event. De verwijdertak begint op regel 260 en de pijltak op 269. `src/text/DisplayArticleEditor.jsx:52` plaatst de rich-texteditor in dezelfde Stage. De geporteerde Text-tools hebben wel een propagationgrens, de editorinhoud hier niet.

**Bewijs.** `data-text-probe.mjs`, `data-text-results.json`, de bewaarde Edge-resultaten en `data-text-before-delete.png`/`data-text-after-delete.png`. De proef leest de opgeslagen draft na elke toets. Het slagen van deze auditproef betekent dat de fout is aangetoond.

**Oorzaak en kleinste herstel.** Verschillende globale shortcuts bepalen afzonderlijk of zij eigenaar van een toets zijn. Laat Canvas compositiecommando's alleen verwerken voor een geschikt niet-bewerkbaar selectiedoel en respecteer afgehandelde events. Behoud toetsenbordbediening voor placements; schakel niet alle toetsen uit.

**Regressie.** Echte toetsen in nested rich text, geselecteerde tekst, lege tekst, Shift/Alt-pijlen, Delete/Backspace en native undo; daarnaast dezelfde toetsen bij expliciete placementselectie. Test primaire én extra Display en bevestig draftinhoud, geometrie en undo-eenheden.

### F2 — P1, A/B: owner en publieke weergave interpreteren authored mat/transparantie verschillend

**Trigger en impact.** Een afbeelding met een rode asymmetrische mat (boven/rechts/onder/links 10/20/30/10%) toont in de owner-renderer geen rode mat. De publieke projectie reserveert wel die randen. De maker beoordeelt dus een andere compositie dan Preview/Visitor zal tonen.

**Code.** `DisplayPlacementContent.jsx:19` gebruikt het hele placementvlak als opening; regel 25 voegt alleen hardcoded `padding: '5%'` toe. Matkleur en vier insets worden niet gelezen. Publiek gebruikt `src/lattice/rendering/latticeProductionProjection.js:10` de matopening, inclusief de aangepaste `mediaFrameRatio` op regel 22. `src/profileDocument/components/GridProductionRenderer.jsx:62` verwerkt de OPAQUE-fallback en regel 94 de matkleur. Owner negeert OPAQUE wanneer backing uitstaat. Owner schrijft `data-frame`, terwijl de publieke frames op `data-frame-id` reageren (`visitorGridWorld.css:38`).

**Bewijs en zekerheid.** Mat is **A op de echte ownercomponent**: een gedecodeerde 300×300-placement toont een 302×302-afbeelding over het hele vlak; `geometry-mat-owner.png` en `geometry-browser.json`. De publieke matprojectie is in dezelfde proef berekend: opening (30,30,210,180) in een footprint 300×300. OPAQUE/frameverschillen zijn **B** uit de afzonderlijke renderpaden, niet elk via de volledige toolbar gereproduceerd.

**Oorzaak en herstel.** Verschillende renderers bezitten feitelijk verschillende interpretaties van dezelfde authored presentatie. Laat owner dezelfde footprint/opening/backplate/media-projectie gebruiken; houd laden en editorhandles apart. Geen nieuwe schema's of herschrijven van bestaande composities nodig.

**Regressie.** Owner, Preview en Visitor vergelijken met presets, asymmetrische insets, backing/OPAQUE, transparante media, crop, quarter-turns, spiegelen en vrij schalen. Controleer zowel pixels als openingbounds, niet alleen bewaarde velden.

### F3 — P2, A: rasterbleed veroorzaakt echte overlap binnen één Grid

**Trigger en impact.** Twee exact aansluitende ongecropte vierkante beelden, links rood en rechts groen, krijgen in owner een zichtbare grens vóór de authored grens. Hogere stacking-order bepaalt welk beeld de ander overschildert. Pointerselectie blijft gebaseerd op de oorspronkelijke footprint; zichtbare rand en selecteerbaar object hoeven daar dus niet overeen te komen.

**Code.** `src/lattice/rendering/latticePixelGeometry.js:61` vergroot een passend beeld tot één layoutpixel per aansluitende rand. `DisplayPlacementContent.jsx:21` past dit toe, maar `ownerSystemWorkflow.css:611` laat overflow toe; alleen `data-cropped` clipt op regel 623. De publieke opening clipt altijd (`latticeProductionTableRenderer.css:63`).

**Bewijs.** `adjacency-probe.mjs` rendert twee productiecomponenten en de werkelijke `GridProductionRenderer` met gelijke geometrie. Footprints zijn [60,180] en [180,300]; imagebounds zijn [59,181] en [179,301], dus **twee layoutpixels overlappende getekende rechthoeken**. Op DPR 1 is pixel x=179 groen in owner en rood in public. Op DPR 2 zijn x=358 en 359 groen in owner en rood in public. DPR 1,25 toont bovendien een gemengde randpixel. Zie `adjacency-results.json` en `adjacent-1.png`, `adjacent-1.25.png`, `adjacent-2.png`. De browseproef betreft één Grid, geen Gridrailnaad.

**Berekening en begrenzing.** Bij een zoomfactor s en DPR d wordt één layoutpixel s·d devicepixels. Een gutter kleiner dan twee layoutpixels kan door beide bleeds worden gevuld. Dat betekent niet dat ieder transparant beeld een dekkende overlap toont: alpha en broninhoud bepalen de zichtbare bijdrage. Rotatie, contain-letterboxing en crop veranderen welke randen aan de opening aansluiten. De geteste uniforme native-fitbeelden maken het probleem ondubbelzinnig.

**Herstel.** Behoud alleen rasterbescherming binnen de gezaghebbende mediaopening. Verwijder niet blind alle bleed: dat kan eerdere kieren terugbrengen. Dit herstel hoort bij F2's gedeelde projectie/clipgrens, niet bij een tweede algemene renderinglaag.

**Regressie.** Exacte joins, 1/2-pixel gutters en fractionele schalen; opaque én semi-transparante randen, crop/null-crop, rotatie/spiegeling, integer/fractionele bounds. Verifieer pixels en picking samen in owner/Preview/Visitor.

### F4 — P2, A: de thumbnail blijft door de transparante originele afbeelding heen zichtbaar

**Trigger en impact.** Een thumbnail bevat een achtergrond die het originele transparante beeld niet heeft. Na volledig laden blijft die thumbnail als onderlaag zichtbaar in owner. Ook gedeeltelijke alpha kan daardoor anders ogen dan het canonieke beeld.

**Code.** `src/public/ownerSystemWorkflow/ProgressiveArtworkImage.jsx:19` houdt de low-res img gemonteerd. `ownerSystemWorkflow.css:629` maakt alleen de laatste img zichtbaar; de thumbnail wordt niet verborgen zodra high ready is.

**Bewijs.** `media-probe.mjs` gebruikt de werkelijke `DisplayPlacementContent`, een rode thumbnail met groene cirkel en een transparante canonical source met dezelfde cirkel. Beide owner-imgs hebben na laden opacity 1 en `data-high-ready` is gezet. De hoekpixel is **[255,0,0,255]** in owner, terwijl het origineel op dezelfde blauwe ondergrond **[0,0,255,255]** toont. `media-alpha.png` en `media-result.json`, Chrome, 800×500, DPR 1. Dit is een componentreproductie met doelbewust onderscheidende media, geen claim dat ieder bestaand asset zo'n thumbnail heeft.

**Herstel.** Definieer de low-res afbeelding als tijdelijke vervanging, niet als blijvende compositielaag. Na bevestigde high-ready mag zij niet aan het eindbeeld bijdragen; bewaar betekenisvol fallbackgedrag bij high-failure. Houd deze mediaoverdracht gescheiden van rail-/Gridwissels.

**Regressie.** Opaque thumbnail → transparant origineel; beide semi-transparant; gecachte en vertraagde load; mislukte high-load; bronwissel. Vergelijk eindpixels met één canonical source en controleer picking tegen diezelfde zichtbare bron.

### F5 — P2, A op hookgrens/B voor volledige gebruikersroute: oude cropinteractie kan nieuwe crop beïnvloeden

**Trigger en impact.** Begin crop A, begin een pointerpan, annuleer terwijl de pointer nog actief is, open crop B en beweeg de oorspronkelijke pointer. In de echte hook verandert B's preview van x=.5/zoom=1 naar **x=.28125/zoom=2**, terwijl B's controlZoom 1 blijft. Een tweede proef verandert de canonical crop naar zoom 3 terwijl preview zoom 2 openstaat; Apply levert de nieuwste placement als `expectedPlacement` mee en verstuurt de oude zoom 2.

**Code.** `useOwnerSystemWorkflowCrop.js:85` wist alleen React-state. De pointerlisteners op regels 104–140 eindigen bij pointerup/cancel of unmount, niet bij die state-annulering. De moveclosure schrijft in iedere dan bestaande sessie. Commit op regel 31 gebruikt de actuele placement als verwachte baseline; reconciliatie vanaf regel 179 controleert geometrie, maar niet alle bron/crop/transformwijzigingen.

**Bewijs/zekerheid.** `data-crop-probe.mjs`/`data-crop-results.json`, eerst Edge en vervolgens Chrome 153, 1280×800. **A voor de hooktransities**, met een synthetische controller die de commitrequest registreert. De volledige UI-route naar een blijvend verkeerd opgeslagen resultaat is **niet** gereproduceerd; die impact blijft B. Dit rapport presenteert de fake commit niet als geslaagde productieopslag.

**Oorzaak en herstel.** Crop mist één operationele identiteit en één beëindigingspad voor state, dragref, resizeref en listeners. Bind de sessie aan profiel/module/Grid/placement plus oorspronkelijke relevante content. Ondersteun intentional crop-resize-reconciliatie expliciet, zonder de hele stale baseline te vervangen door latest state.

**Regressie.** Escape, pointercancel, blur, sluiten, Preview, lock, doel-/Grid-/profielwissel, heropenen met dezelfde pointer en undo/redo tijdens crop. Verifieer listenerbeëindiging én onveranderde volgende sessie. Controleer apply tegen een tussentijds gewijzigde canonical snapshot.

### F6 — P2, B met uitgevoerde berekening: groepsrotatie draait posities en media tegengesteld

**Trigger en impact.** Twee asymmetrische delen van één samengesteld beeld worden samen geroteerd. De onderlinge posities draaien tegen de klok in; ieder beeld zelf draait met de klok mee. De compositie blijft daardoor niet één gedraaid geheel.

**Code/bewijs.** `src/systemWorkflow/systemWorkflowTransform.js:95` gebruikt x'=y, y'=W−x−w voor groepsposities; regel 30 verhoogt quarterTurns, regel 178 geeft CSS rotate(+90deg). Beide worden op regels 153–155 gecombineerd. `geometry-node-probe.mjs` voert de productiehelpers uit: links (5,5,2,2) → (7,7,2,2), rechts (9,5,2,2) → (7,3,2,2), terwijl beide media +90° krijgen. Geen volledige toolbar/browserrotatie gereproduceerd: niveau B.

**Herstel.** Gebruik dezelfde draairichting voor centerposities en member-media. Behoud bounds en quantization. Reeds opgeslagen composities mogen niet stilzwijgend opnieuw worden geroteerd.

**Regressie.** Een gemarkeerd asymmetrisch samengesteld object moet pixelmatig overeenkomen met één rigide rotatie. Test alle kwartslagen, mirrors, ongelijke afmetingen en undo/redo. De huidige domain-test die de bestaande positieformule verwacht, is hiervoor onvoldoende.

### F7 — P2, B met uitgevoerde berekening: Lift begint niet bij de echte matopening

**Trigger en impact.** Inspecteer een gecropte placement met asymmetrische mat. De kopie die de bron vervangt begint met andere beeldgeometrie en kan over de mat tekenen; dat kan als een sprong bij inspectie ogen, ook als de Gridcamera volledig stilstaat.

**Code/bewijs.** `DisplayLiftArtwork.jsx:26` meet de hele bronplacement. `src/lattice/rendering/latticeProductionFocusArtworkMotion.js:80` gebruikt die hele footprint als sourceOpening, maar verwerkt mat pas aan de targetkant. De img staat naast, niet binnen, de opening (`LatticeProductionFocusArtwork.jsx:26`). In `geometry-node-probe.mjs` heeft een 300×300-source met genoemde mat en crop zoom1 een publieke opening (30,30,210,180), met beeld (30,15,210,210), geclipt aan de opening; Lift progress 0 levert beeld (0,0,300,300). **B:** reken-/codebewijs, geen gemeten eerste compositorframe van een volledige inspectie.

**Herstel.** Leid de bronafbeelding én bronclip af uit dezelfde projectie als de getoonde compositie; interpoleer media en opening expliciet naar de volledige inspectieweergave. Dit bouwt voort op F2/F3; alleen de owner-mat repareren verhelpt deze gedeelde Lift-fout niet.

**Regressie.** Eerste en laatste inspectieframe gelijk aan bronpixels voor mat/crop/free-scale/rotate/mirror, inclusief onderbroken opening, resize en Escape. Controleer bronherstel bij mislukte decode.

### F8 — P2, A: reduced-motion-drag kiest al vóór loslaten een Grid

**Trigger en impact.** Met reduced motion aan wordt een navigatiedrag langer dan één Stagebreedte vastgehouden en daarna losgelaten. In owner én Visitor wisselde de geselecteerde Grid **3 → 0 terwijl de pointer vastgehouden werd**, en **0 → 1 bij release**. Een held -.35-breedte gaf bovendien een zichtbare -350px railoffset. Het harde contractverschil is de selectie vóór release; de slide alleen is hier niet als afzonderlijke contractschending geclassificeerd.

**Code/bewijs.** `useGridPlayback.js:175` leidt moveDrag ook bij reduced motion door de gewone `move()`-grenscommits; de releasebranch vanaf regel 185 kiest vervolgens opnieuw uit de restpositie. `motion-extra.mjs`/`motion-extra.json`, Chrome, vier geladen Grids, 1440×1000.

**Herstel.** Geef de reduced-motion-gesture één expliciet completionbeleid binnen de bestaande tijdelijke camera: verzamel input tot release en commit de afgesproken discrete bestemming dan eenmaal. Geen tweede saved/current Gridbron toevoegen.

**Regressie.** Beide richtingen, cancel, één/twee/veel Grids en een drag over meer dan één breedte. Voor release blijft de selectie gelijk; cancel navigeert niet; release levert de bedoelde bestemming op in owner en Visitor.

## Wat gebeurt er bij een doorgaande Gridgrens?

1. De native animatie verandert de rail-transform op één doorlopende tijdlijn. `gridCameraTransport.js:18` maakt twee transformkeyframes; Play duurt 12 seconden per Grid. De horizon van een transport is één uur, met vernieuwing vijf seconden eerder, niet bij iedere Gridgrens.
2. JavaScript leest in rAF `animation.currentTime`. `useGridPlayback` brengt die absolute positie terug naar lokale voortgang en een fysieke railslot. Bij een grens veranderen de bron-Grid, slot en geselecteerde Grid. Normale navigatie wordt via `startTransition` gecommit; bij meer dan één slot achterstand wordt synchroon ingehaald.
3. `gridRailScenes` maakt vijf verschijningen rond de bron. Hun sleutel is `gridId:slot`, zodat dezelfde binnenkomende DOM-scène haar fysieke plaats houdt. Aan de verre zijde verdwijnt een scène en komt een nieuwe bij; `useDeferredValue` stelt de verste voorbereiding uit. Dit is begrensde voorbereiding, geen garantie dat alle nieuwe media al zijn gedecodeerd.
4. `useGridSwipe` schrijft de procentuele left-posities en laat de transform ongemoeid zolang een transport bestaat. Zonder transport schrijft het de behouden camerapositie. De layoutcommit publiceert pas passende lokale voortgang aan gekoppelde Text.
5. De actieve scène krijgt andere selectie-/interactieprops. De owner houdt artworkinhoud via `memo(DisplayPlacementContent)` vast zolang de relevante inputs gelijk blijven. Visitor heeft eigen media-loadstate en projectie. Nieuwe verre media kunnen decodering, style/layout, paint en rasterwerk veroorzaken; geladen URL's betekenen niet dat iedere verschijning al bruikbare rastertiles heeft.
6. Na uitrollen wordt de eindtransform overgenomen, de animatie geannuleerd en de stilstaande toestand met dezelfde transitionprioriteit gepubliceerd. Een expliciete pauze houdt een tussenpositie; inspectie leent die scène en schort navigatie op.

Deze constructie bevat een echte verbetering ten opzichte van een beweging die op iedere React-Gridwissel opnieuw moet starten. Zij blijft afhankelijk van tijdige, coherente voorbereiding en van browsercompositing. Een correcte transformmeting kan samengaan met een te laat getekende inhoud. rAF, paint-aantallen en gemiddelde FPS kunnen die mogelijkheid niet uitsluiten.

### Wat is over de oorspronkelijke hapering vastgesteld?

**Camera:** in de nieuwe probes geen gemeten reset, achteruitstap of extra stilstaande transform tijdens de onderzochte doorgaande normale coast. Twee-Grid Play liep in beide modes ruim 24,5 seconden door, inclusief wrap. Pauze behield de tussenpositie; synthetisch blur bevroor en focus hervatte Play. Dit laatste is geen OS-achtergrondtabtest.

**Volledig bedekte scènes:** acht onafhankelijke coast-runs, owner/Visitor × twee/zes Grids × beide richtingen, viewport 1415×900, Stage 1000 layoutpixels, DPR owner 1,25 en Visitor 2. De achtergrond van de auditfixture is bewust gecropt om de gehele Stage te bedekken; daarboven staan echte grote transparante WebP-lagen. Release rond ±.94 Grid met snelheid ±.002 Grid/ms koos ±2 als eindpositie en passeerde ±1 tijdens de beweging. Alle acht eindigden op ±2000px. Dit test dus werkelijk loslaten en een **tussenliggende** grens, niet alleen de bedoelde stilstand op de eindgrens.

**Rendererwerk:** rond de geobserveerde Gridcommit staan 7–25 Paint-events, 13–45 RasterTasks en 2–4 Layout-events in een venster van −30 tot +60ms. De animatie blijft bestaan terwijl die inhoudswerkzaamheden gebeuren. In één owner/twee-Grids-run overspande een headless `Display::FrameDisplayed`-interval van 13,954ms de commit; gewone cadence was circa 6,95ms. Een owner/zes-Grids-run registreerde over de hele proef vijf frames met ontbrekende rasterinhoud en drie dropped frames. De Visitor/zes-Grids-vooruitrun telde zeven drops, zonder ontbrekende inhoud. Dit zijn **rendererwaarnemingen**, geen bewezen zichtbare reproductie van de klacht of causale toewijzing aan de naad.

**Waarom JS-timing niet voldoende is:** in een andere owner/zes-Grids-run was een rAF-gat van 55,6ms nabij de grens aanwezig terwijl headless compositorframes rond 6,95ms bleven komen. De geobserveerde sourcecommit liep daar achter op de camera. Voorbereide planes kunnen die achterstand opvangen. Andersom bewijst een gelijkmatig bemonsterde camera niet dat alle benodigde rasterinhoud beschikbaar is.

**Getekende pixels:** een aanvullende eigen CDP-screencastproef gebruikte zes volledig bedekte Grids, owner/Visitor, beide richtingen, viewport 1100×850, Stage 700px, DPR 1. Gekleurde identificatiemarkers reisden binnen de echte geladen planes mee. In de eerste 300ms na release werden per run 28–29 frames met de verwachte binnenkomende Gridmarker vastgelegd. Na ordening op capturetimestamp waren markerposities steeds doorgaand in de bedoelde richting, zonder gelijke positie of terugwaartse stap; er werd in die samples geen marker van een verkeerde Grid waargenomen. Bewijs: `presented-results.json`, `presented-analysis.json`, geselecteerde `presented-*.png`.

Deze pixelproef bewijst **geen frame-perfecte overeenstemming** met de curve. Vergelijking van PNG-markerposities met de native curve op CDP-timestamps leverde circa 12px gewone tijds-/captureafwijking en grotere initiële afwijkingen tot circa 60px; één run leverde twee eerste screencastberichten in omgekeerde timestampvolgorde. Daarom zijn deze ruwe residuals niet als camerafout of visuele terugwaartse beweging geclassificeerd. Screencast is bemonsterde, door instrumentatie beïnvloede headless beeldproductie, geen volledige opname van monitorpresentatie. De bewijsgrens staat expliciet in de resultaten; de oorspronkelijke klacht is hiermee niet weerlegd.

**Normale afremming:** de huidige formule begrenst releaseafstand tot ongeveer 1,22 Grid. Een tussenliggende naad ligt daardoor vroeg in een maximale coast; de laatste naad is het bedoelde nulsnelheidseindpunt. Langzame/held releases hebben doorgaans geen tussengrens. De huidige exacte-landingwens verandert dus de beschikbare bewegingsscenario's. Een test van de laatste stilstand alleen kan het historische lange-doorbewegenprobleem niet beoordelen.

**Conclusie per mogelijke oorzaak:** daadwerkelijk kort stoppen van de camera is niet gereproduceerd in normale doorgaande beweging; vertraagde semantic/sourcecommit is wel gemeten; renderer-/rasterdruk is wel gemeten; verkeerde getekende Gridframes zijn in de bemonsterde markerreeks niet gezien maar niet algemeen uitgesloten; ruimtelijke randfouten bestaan aantoonbaar (F3). Dat meerdere oorzaken samen het oorspronkelijke gevoel veroorzaken blijft **C**. De meetuitkomsten rechtvaardigen geen uitspraak “opgelost” en ook geen willekeurige camerarewrite.

### Beoordeling van de genoemde eerdere correcties

Zonder historische oorzaak aan oude code toe te schrijven, is de **huidige** vorm beoordeeld:

| Huidige maatregel | Beoordeling |
| --- | --- |
| Eén WAAPI-klok; overname samplet voor annuleren | Structurele scheiding van bewegingsklok en React-rendering. Behouden; niet gelijkstellen aan vlekkeloze rasterpresentatie. |
| Stabiele Grid-ID + fysieke slotkeys; voorbereiding van buren | Structurele aanpak van zichtbare recycling. Vijf verschijningen blijven begrensd; decode/readiness van nieuw voorbereide inhoud is geen harde garantie. |
| Landingscommit op dezelfde transitionprioriteit | Pakt een concreet coherentieprobleem aan. Huidige landingtest met CPU-throttle ×4 slaagt; geen volledige garantie voor alle interleavings. |
| Procentuele planes en camera-transform | Vermijdt het optellen van verschillend afgeronde widths aan Gridgrenzen. De huidige landing-/buitenrandproef slaagt bij fractionele Displaybreedte. |
| Rasterbleed | Als algemene owner-randcorrectie te breed: verplaatst een kierprobleem naar overlap binnen een Grid (F3). Publieke clip begrenst diezelfde expansie wel. |
| `plus-lighter`, track-isolatie, blijvend `will-change` | Samenhangend compositor-/naadbeleid, maar hun individuele noodzaak en GPU-/kleurbijwerkingen zijn niet via een gecontroleerde aan/uit-matrix bewezen. Geen zelfstandige blendfout gevonden; geen basis om ze blind te verwijderen. |
| Selectieglow weg uit beeldfilters | Goede scheiding van geselecteerd object en bronpixels. Huidige selectie-/terugkeercheck vindt filter `none`; resize/cropchrome blijft apart. |
| Inspectie suspendeert camera zonder reset | Structurele tijdelijke-viewgrens. Bemonsterde inspectie na landen behoudt transform; mat-Liftgeometrie is een andere fout (F7). |
| Grain als blijvende modulelaag boven Lift | Structureel correcte laagverantwoordelijkheid. Screenshotverschil met/zonder grain bewijst bijdrage over Lift in geteste owner/Visitor wide/narrow. Geen bewijs voor iedere immersive/resizecombinatie. |

## Beoordeling van het testbewijs

De mechanische inventaris van vijf relevante bron-/testmappen bevat **144 testbestanden**, waarvan **72 browserbestanden**, **16 bestanden die bronbestanden lezen** en **533 `assert.match`/`assert.doesNotMatch`-aanroepen**. Dit zijn geen 533 bewezen visuele gedragingen; de inventaris omvat ook daadwerkelijke Display-afhankelijkheden. Zie `test-inventory.json` voor de exacte lijst.

- De domain-/storetests vergelijken echte objecten, stale snapshots, privéprojectie en mislukte writes. Dat is betekenisvol gegevensbewijs en moet behouden blijven.
- `presentationBoardFoundation.test.js:7`, delen van `ownerSystemWorkflowPolish.test.js` en `profileDocumentV9Visitor.test.js` testen vaak importnamen/regex/CSS-vormen. Ze kunnen gewenste scheiding bewaken, maar niet aantonen dat de pixels of interactiecombinaties kloppen.
- `latticePlacement.test.js` onderzoekt `LatticePlacementRenderer.jsx`, terwijl de huidige ownerroute `OwnerSystemWorkflowCanvas` + `DisplayPlacementContent` gebruikt en Visitor `GridProductionRenderer`. Het is geen eigenaar/public-pariteitstest voor de huidige Display.
- De groepsrotatietest in `systemWorkflowAuthoringRules.test.js:559` bevestigt de huidige geometrieformule zonder coherentie met de draairichting van de afbeelding te vergelijken.
- De Text-browsertest vult tekst in en verlaat de editor vóór placementpijlen worden getest. Zij mist de combinatie waarin F1 optreedt.
- De crop-browsertest verwacht op regel 48 een 1px selection outline terwijl het actieve contract artworkfocusoutline juist uitsluit. Een oude assertion is geen geldige visuele acceptatiegrens.
- Diverse browsertests hardcoden Edge, oude poorten (o.a. 5173) of vroegere Play-knoppen. De gebruiker test Chrome op 5194. Sommige recente probes ondersteunen environment-overrides; andere niet.
- `grid-motion` meet vooral rAF/DOM en latere eindposities; de zware fixture was zonder crop niet volledig bedekkend. `grid-playback-seam` zet na pauze handmatig transforms en gebruikt zwarte vervangbeelden: nuttig voor een ruimtelijke naad, niet voor daadwerkelijke coastpresentatie.
- De bestaande coast-continuityproef bekijkt wel screencastpixels tijdens een geblokkeerde main thread. De minimumgarantie is enkele verschillende markerposities en netto beweging, niet de afwezigheid van iedere extra stilstand of een exacte framecurve. Gelijke achtergronden/markers onderscheiden niet iedere verkeerde Gridinhoud.
- `npm test` is `node --test`; afzonderlijke `*.browser.mjs` moeten expliciet worden aangeroepen. `npm run test:browser` noemt alleen `published-visitor.browser.mjs`. Een groene standaardrun is geen verklaring dat alle gespecialiseerde Display-browserproeven uitgevoerd zijn.

## Gedeelde oorzaken tegenover losse fouten

De vastgestelde problemen vormen geen bewijs dat de hele applicatiearchitectuur ondeugdelijk is. De drie relevante clusters zijn:

1. **Eén compositie, verschillende uitvoeringen van beeldgeometrie.** Owner, publieke weergave en Lift gebruiken wel gedeelde helpers, maar niet één gezaghebbende opening/clip/media-projectie. Randcorrecties en mat/crop-behandeling krijgen daardoor verschillende werkingsgebieden.
2. **Interactie-eigenaarschap is niet overal even streng.** De gewone placementgestures en inspectie binden werk aan hun doel en beëindigen het; crop en sommige globale toetsen volgen afwijkende regels. Een wijziging in tools of selectie kan daardoor een nog levende oude interactie raken.
3. **Bewijs sluit onvoldoende aan op de beloofde garantie.** Een helperformule, CSS-regex of camera-rAF-test kan slagen terwijl pixels, samengestelde rotatie of een combinatie van tekstbewerking en compositietoetsen fout is.

Groepsrotatie heeft daarnaast een concrete draairichtingsfout. Reduced-motion kent een afzonderlijke inputtak die niet consequent van de continue camera is gescheiden. Geen van deze bevindingen mag automatisch als verklaring voor de oorspronkelijke korte onderbreking worden opgevoerd.

## Wat behouden moet blijven

- De gedeelde draft-store, begrensde moduleprojectie en bestaande opslagkeys; geen reden aangetoond voor een schemamigratie of reset.
- Expliciete private/public projectie en Visitor-state zonder owner-writepad.
- Pure geometrie-/transformatiefuncties en de scheiding tussen bronasset en placementdata.
- Eén cameraklok voor drag-overname, Play en uitrollen; stabiele fysieke slots en gedeelde inspectie.
- Decode-afhankelijke Lift-handoff, request-/scopevalidatie, cleanup van observers en animaties.
- Grain als module-effect en selectiebediening als overlay, buiten de bronpixels.

## Herstelvolgorde en acceptatie

1. Leg de gereproduceerde fouten vast als gedragsregressies met de huidige fixtures. Maak één expliciet uitvoerbaar Display-browserpakket en bewaar de omstandigheden. Corrigeer verouderde expectations op basis van het actieve contract; maak tests niet groen door hun zichtbare garanties weg te nemen.
2. Herstel onbedoelde authored bewerkingen door toetsen en beëindig cropinteracties op één plaats. Acceptatie: typen/caretbediening verandert geen placementgeometrie of bestaan; oude pointers/requests kunnen na annuleren of doelwissel geen nieuwe crop wijzigen; stale apply wordt afgewezen of expliciet gereconcilieerd.
3. Geef mediaopening, mat, backing, crop, vrije schaal en clipping één herbruikbare projectie voor owner/public/Lift. Behoud media-loadbeleid als aparte verantwoordelijkheid. Acceptatie: dezelfde authored input levert dezelfde genormaliseerde bounds en pixels; rasterbleed komt niet buiten de opening; eerste/laatste Lift-frame sluit op de compositie aan.
4. Herstel groepsrotatie en de reduced-motion-inputtak afzonderlijk. Acceptatie: samengestelde asymmetrische beelden draaien als één object; reduced motion kiest discreet bij release zonder voorafgaande slides of dubbele navigatie.
5. Valideer daarna de doorlopende rail met representatieve volledig bedekkende composities, transparante lagen, twee en veel Grids, beide richtingen, echte release/coast over een tussengrens, wrap, pause/takeover, inspectie en resize. Leg camera, inhoudsidentiteit en daadwerkelijk geproduceerde frames naast elkaar. Een transportreset bij een tussenliggende grens, terugwaartse stap of oud Grid-frame is een afkeurpunt, los van normale eindafremming.

Gerichte reparatie is voldoende voor de aangetoonde problemen. Een afgebakende herwerking van de gedeelde artworkprojectie en de crop-interactielifecycle is gerechtvaardigd; een nieuwe Workbench, algemene pluginarchitectuur of volledige Display-herschrijving is niet onderbouwd. Een eventuele compositor-/railsurface-herwerking hangt af van aanvullend framebewijs, niet van vermoedens.

## Controles, beperkingen en auditbestanden

### Uitgevoerd

| Controle | Omstandigheden | Resultaat en betekenis |
| --- | --- | --- |
| Gerichte rootregressies | Node 24.20.0; rail, momentum/transport, progressive sources, dimensies, polish en Visitorbroncontract | 36/36 geslaagd; bevat bronpatroontests, dus geen visuele vrijgave. `root-focused-tests.log`. |
| Geometriehelperregressies | crop, pixelgeometry, production projection, focus motion | 13/13 geslaagd. Aanvullende berekeningen tonen desondanks F6/F7. `geometry-tests.log`, `geometry-node-results.json`. |
| Store/session/public regressies | module-session, draft history, authoring session, v9 domain | 49/49 geslaagd. `data-tests.txt`; positieve gegevensgrenzen, geen bewijs voor alle UI-combinaties. |
| Mat/bleed component | Chrome, 1000×550, decoded SVG, 300px-placement | F2/F3 gereproduceerd; publieke projectie erbij berekend. |
| Exact aansluitende beelden | Chrome, 800×900, 640×360 stages, DPR 1/1,25/2; productie owner en public | F3 zichtbaar en pixelmatig gereproduceerd. |
| Thumbnail/canonical alpha | Chrome, 800×500, DPR 1; delayed high source, beide decoded | F4 gereproduceerd, high-ready bevestigd. |
| Live Text-toetsen | Volledige owner-runtime, 1440×1000, reduce; eerst Edge en daarna Chrome | F1 gereproduceerd, opgeslagen draft gemeten, screenshots geïnspecteerd. |
| Crop scope/baseline | Werkelijke hook + synthetische controller, 1280×800; Edge en Chrome | F5 aan de hookgrens gereproduceerd; geen fake persistence als productiecommit aangemerkt. |
| Play/pause/drag/resize/focus | Chrome, owner/Visitor; twee Grids; 1440×1000 → 390×900; vijf artworklagen per Grid, zeven Image-vensters | Wrap, retained pause, integer landing, synthetisch focusherstel en onveranderde draftbytes bevestigd. Basisfixture niet volledig bedekkend; timing van deels overlappende eerste pogingen niet als benchmark gebruikt. |
| Reduced motion en eerste coasttraces | Chrome, vier Grids, 1440×1000 | F8 gereproduceerd. Renderertraces opgeslagen; geen causale naadclaim uit totale Paint-count. |
| Bedekte tussengrens-coast | Acht Chrome-runs; 1415×900; DPR 1,25/2; twee/zes Grids; ±richting; release → ±1 → landing ±2 | Camera loopt in samples door; compositor/rasterverschijnselen en grenzen beschreven in bewegingssectie. |
| Getekende voortgang | Vier Chrome-screencasts; zes Grids; 1100×850, Stage 700; DPR 1; ±richting owner/Visitor | 28–29 identificeerbare markerframes per run in eerste 300ms; geen achteruit-/gelijke stap na timestampordening; timestamps onvoldoende voor pixel-exacte curvegarantie. |
| Bestaande landingsregressie, opnieuw uitgevoerd | Chrome, owner/Visitor; 1440 en 390; fractionele Displaybreedte 1001,3; CPU-throttle ×4; richtingen −/+/− | Geslaagd: sampled Grididentiteit/monotone landing, geometrische buur-intrusie <.02px, inspectietransform behouden en contrast-buitenrandcheck. `landing-existing.log`; de bewijsomvang blijft die van deze test. |
| Bestaande grain-/focusregressie, opnieuw uitgevoerd | Chrome, owner/Visitor; 1440 en 390; reduce; grain .7; vergelijking pixels met/zonder grain tijdens Lift | Geslaagd, focus keert terug en imagefilter is `none`. `grain-existing.log`; geen animated/matted Liftpariteitstest. |

De screenshots van brede/nauwe scenes, mat, adjacency, transparantie, Text-verwijdering, grain en een bewegingsframe zijn daadwerkelijk bekeken. Een screenshot is uitsluitend ruimtelijk bewijs; de temporele conclusies gebruiken de afzonderlijk beschreven traces/screencasts.

Aanvankelijke proefproblemen zijn gescheiden van applicatiefouten: de sandbox weigerde nieuwe outputbestanden (EPERM); de auditbestanden zijn daarna via goedgekeurde uitvoering opgeslagen. Een eerste mediaprobe gebruikte een verkeerde Vite-exportvorm voor createRoot en werd gecorrigeerd. Een eerste adjacencyfixture gaf `guideSize: 'CELL'` in plaats van de vereiste integer en werd naar 0 gecorrigeerd. De mislukte pogingen zijn geen productbevindingen. Een bestaande motionrun eindigde zonder bruikbare einddiagnose en telt niet als geslaagd. Er is geen automatische-goedkeuringsafwijzing overgebleven.

### Niet vastgesteld of niet volledig doorlopen

- De oorspronkelijke intermitterende zichtbare hapering op de fysieke Chrome/GPU/monitorconfiguratie van de gebruiker. Headless resultaten zijn niet die hardwarematige acceptatietest; er wordt geen nieuwe gebruikersvideo gevraagd.
- Urenlang Play inclusief transportvernieuwing, echte OS-focus/achtergrondtab/discard, geheugen-/GPU-gebruik bij langdurig openen/sluiten, maximaal acht Displays of 200 placements per Grid. De vijflaagsscènes zijn representatief voor compositie, geen maximale belastingstest.
- Alle combinaties van portrait, immersive, maximaliseren, Workbench-zoom, wijzigen van Displayformaat en bewegen tijdens deze overgangen. Wide/narrow viewport, fractionele breedte en DPR zijn getest; portrait/immersive-pariteit is hier niet vrijgegeven.
- Volledige UI-reproductie van stale crop na undo/profielwissel, groepstransformatie en gematte eerste/laatste Liftframes. Daarvoor zijn de B-/hookbeperkingen hierboven behouden.
- Alle netwerk-failure/retrycombinaties. Source-/abort-/timeoutpaden zijn gelezen; de audit legt geen algemene garantie op voor traag of falend extern artwork. Owner progressive fallback en Visitor loading/failed zijn bovendien verschillende implementaties.
- Een volledige nieuwe end-to-end-publicatie of walletcontrole. De lokale projectie en bestaande v9/storetests zijn onderzocht; externe handelingen zijn buiten opdracht gebleven.
- Volledige `npm test`, production build, `build:check` en LUKSO-standardsrun zijn niet uitgevoerd. Dit is geen releasecheckpoint, er is geen productie- of standardswijziging gemaakt. Gerichte tests zijn expliciet vermeld; bestaande groene suites zijn niet als auditbewijs overgenomen.

### Auditbestanden en opnieuw uitvoeren

Alle nieuwe bewijsbestanden staan uitsluitend in [output/display-audit-2026-09-21](../output/display-audit-2026-09-21/). De volledige bestandslijst met doel, grootte en SHA-256 staat in [ARTIFACTS.md](../output/display-audit-2026-09-21/ARTIFACTS.md). Het enige nieuwe bestand buiten die map is dit auditrapport. De subrapporten bewaren de onafhankelijke analyses; dit gecombineerde rapport geeft de definitieve bewijsclassificatie, inclusief de latere Chromebevestiging en pixelproeven.

| Auditgroep | Doel / opnieuw uitvoeren vanaf repositoryroot |
| --- | --- |
| `inventory-scan.mjs` → `test-inventory.json` | `node output/display-audit-2026-09-21/inventory-scan.mjs`; inventariseert testvormen, voert ze niet uit. Hernoemd tijdens herstel om automatische Node-testdetectie te vermijden. |
| `geometry-probe.mjs`, `geometry-node-probe.mjs` | Node uitvoeren; respectievelijk owner-mat/bleedbrowser en groep/Liftberekeningen. Bijbehorende JSON/PNG/logs en `geometry-findings.md`. |
| `adjacency-probe.mjs`, `media-probe.mjs` | Node uitvoeren; owner/public-naadpixels op drie DPR's en thumbnail/canonical alpha. Bijbehorende result-JSON en screenshots. |
| `data-text-probe.mjs`, `data-crop-probe.mjs` | Node uitvoeren; volledige Text-UI en gerichte crop-hook. Zet voor Chrome `INSCAPE_BROWSER_EXECUTABLE` op de Chrome-executable. JSON bevat waargenomen defecten, niet assertions van gerepareerd gedrag. |
| `motion-probe.mjs`, `motion-extra.mjs` | Node uitvoeren; Play/wrap/pause/resize/focus en reduced-motion/aanvankelijke coasttrace. |
| `motion-covered-fixture.mjs`, `motion-covered.mjs`, `motion-analyze.mjs` | Eerste bestand is alleen de bedekte auditfixture. Voer covered uit en daarna analyze; bewaart acht traces en hun analyse. |
| `presented-probe.mjs`, `presented-analyze.mjs` | Eerst screencastproef, daarna analyse. Ruwe capturevolgorde blijft behouden; analyse ordent op capturetijd en meldt omgekeerde delivery. |
| `run-existing-checks.mjs` | Maakt auditkopieën `landing-derived.browser.mjs` en `grain-derived.browser.mjs` met aangepaste fixture-/outputpaden en voert die sequentieel uit. Bestaande tests worden niet gewijzigd. |
| `artifact-manifest.mjs` | Genereert `ARTIFACTS.md` opnieuw na proeven; verandert geen productiecode. |

Gebruik op deze machine Node **24.20.0** via `C:/Users/Hidden Swarm/AppData/Roaming/nvm/v24.20.0/node.exe`; de gewone terminal resolveerde nog Node 18. De Chromeproeven gebruiken `C:/Program Files (x86)/Google/Chrome/Application/chrome.exe`. Zij verwachten de bestaande server op **5194** en starten of stoppen zelf geen server. Laat timingproeven sequentieel lopen; gelijktijdige browsers/tests veranderen de belasting. Nieuwe geïsoleerde contexts voorkomen dat fixtures bestaande composities overschrijven. Resultaatbestanden worden bij herhaling vervangen; bewaar een kopie wanneer runs vergeleken moeten worden.

Geen productiecode vereenvoudigd of gerepareerd tijdens deze opdracht. Alleen auditrapport/proeven/bewijs toegevoegd; alles is **lokaal, niet gecommit en niet gepusht**.

## Antwoorden voor de opdrachtgever

**Waarom ontstaan zo vaak nieuwe problemen?** Niet doordat iedere laag slecht gescheiden is. Het probleem zit vooral waar dezelfde afbeelding opnieuw wordt geïnterpreteerd (owner/public/Lift), waar tijdelijke interacties verschillende beëindigingsregels hebben, en waar tests een formule of DOM-toestand bewijzen maar de artistieke uitkomst niet vergelijken.

**Wat is fragiel en wat niet?** Beeldprojectie/clippariteit, crop-lifecycle, toetsenbereik en de combinatie van railscenecommit met rastervoorbereiding zijn de risicogrenzen. De gedeelde opslagautoriteit, modulemerge, private/public projectie en scoped inspectierequests zijn relatief sterk en moeten behouden blijven.

**Welke correcties zijn structureel?** Eén bewegingsklok, stabiele slots, behouden inspectiecamera en grain boven Lift hebben duidelijke eigen verantwoordelijkheden. De ongeclipte rasterbleed verplaatst aantoonbaar het probleem. De overige compositorinstellingen verdienen gerichte meting, geen automatische goedkeuring of verwijdering.

**Is de oorspronkelijke onderbreking gevonden of opgelost?** Niet als dezelfde zichtbare klacht gereproduceerd. Camera- en pixelproeven geven positieve resultaten binnen hun bereik; traces laten tegelijk gemiste/raster-onbeschikbare frames zien. Oorzaak en afwezigheid op de fysieke gebruikersconfiguratie blijven onbewezen.

**Repareren of herwerken?** Repareer gericht. Herwerk de afgebakende gedeelde artworkprojectie en crop-lifecycle waar hun verantwoordelijkheden aantoonbaar uiteenlopen. Een volledige herbouw is niet nodig op basis van dit bewijs.

**Wanneer is “correct” verantwoord?** Als de beschreven regressies de echte UI en opgeslagen resultaten controleren, owner/public/Lift dezelfde samengestelde pixels leveren en herhaalde representatieve release-/Playruns geen extra grensstilstand, terugwaartse beweging, reset of verkeerd frame vertonen. Beoordeel de normale eindafremming apart. Bewaar browser/viewport/DPR/content/capturecondities en de volledige relevante traces; een betere gemiddelde millisecondewaarde of groene build volstaat niet.

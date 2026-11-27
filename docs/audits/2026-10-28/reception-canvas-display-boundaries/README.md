# Reception, canvassen en Display: afhankelijkheden vóór koppeling

28 oktober 2026. Gericht onderzoek naar de voorgestelde doorlopende Reception/
canvaspresentatie met meerdere cellen die één Display volgen. Dit document is
een architectuuradvies, geen wijziging van de actieve productbeslissingen.

## Conclusie

Een beperkte voorbereidende ontkoppeling is aangewezen. De belangrijkste
afhankelijkheid is dat Display-navigatie nu door een gemount Display wordt
gerapporteerd en gedeeltelijk zijn concrete animatietransport doorgeeft. De
canvasviewer met Index gebruikt ondertussen een afgeleide eerste-scèneweergave.
Reception kent uitsluitend eigen inhoud en profielvelden. Die drie paden
hebben nog geen gedeelde, expliciet gescopeerde presentatiebesturing.

De opslaggrenzen zijn juist een bruikbaar fundament: één canoniek record,
profielgedeelde Reception, afzonderlijke canvasinhoud, afgebakende
schrijfbevoegdheden, undo en publicatie. Behoud deze grenzen bij visueel
samenvoegen. Een volledige herschrijving of algemeen pluginframework is geen
voorwaarde voor het voorgestelde experiment.

## Onderzochte staat en verificatie

- Checkout: `remediation-2026-10-19-shared-checkpoint/work`.
- Branch: `codex/static-reception-bento-2026-10-26`.
- HEAD: `4a0251647234c0757847078ec34f0865425f6857`, plus bestaande lokale
  wijzigingen en nieuwe bronbestanden. De audit beoordeelt die werkboom.
- PR #5 staat op `3cfd6cf5da12218938d7706268ebd10bed890966` op een andere
  branch. De actuele Netlify-status voor dat commit is success, op
  `https://deploy-preview-5--enterinscape.netlify.app`.
- De teruggegeven PR-workflow `40338966078` is completed/cancelled.
  Dit is geen groene CI-verificatie van de lokale werkboom. De connector geeft
  alleen de eerste pagina van PR-triggered runs; hiermee is niet beweerd dat
  alle andere runs ontbreken of falen.
- **147/147 gerichte Node-controles geslaagd**, zonder skips: Reception,
  scènes/tekst, collectie-isolatie, read-only reader, selectieve publicatie,
  overzicht/projectie, camera-indexmodel, routing en importgraphregels.
- **5/5 aanvullende diagnostische voorbeelden bevestigd**; zie
  [diagnostic-probes.json](diagnostic-probes.json) en het herhaalbare
  [probe-boundaries.mjs](probe-boundaries.mjs).
- [focused-tests.log](focused-tests.log) bevat de verse testuitvoer.
  [source-snapshot.json](source-snapshot.json) legt de relevante bronhashes vast.
- Geen volledige release-suite, productiebuild, nieuwe bundelmeting of
  browser-/performanceproef uitgevoerd. De React-lifecycle- en layoutbevindingen
  hieronder zijn code-inspectie; de diagnostische voorbeelden gebruiken pure
  functies. De passing graaftests toetsen de regels, geen nieuw gebouwd bundle.
- Deze beurt voegt uitsluitend auditbestanden toe; geen appcode, productcontract,
  bestaande wijzigingen, Git-commits, deployments of gebruikersprofielen gewijzigd.

## 1. Scènekeuze en levensduur hangen aan Display-weergave — eerst scheiden

`PublishedDisplayModule.jsx:46` bewaart `activeIndex` lokaal. Het component
rapporteert via `useReportScene` op regel 208. `SceneNavigation.jsx:20–27` meldt
alleen een beschikbare/open scène en verwijdert die bij unmount. De ownerzijde
rapporteert vanuit `OwnerSystemWorkflowCanvas.jsx:177`. De provider in
`OwnerWorkbenchSession.jsx:84–104` omringt de editor, terwijl Reception en het
overzicht via eerdere returns buiten die provider renderen.

De bestaande consumenten krijgen bovendien `motion`, `transport`, `sourceSlot`
en `widthRatio`; `useSceneProgress` koppelt een teksttrack direct aan dat
transport. `useGridPlayback` heeft echte canvas-/track-DOM-references nodig.
Dit is een gerichte oplossing voor Display en volgend Text binnen één sessie,
geen zelfstandig aanspreekbare scènebesturing voor meerdere paginacellen.

Bij rechtstreeks hergebruik zou het verdwijnen of sluiten van een Display-view
de bron voor andere cellen laten verdwijnen. Een gedeelde provider hoger zetten
verandert dat eigenaarschap niet. Herhaalde galerijtegels mogen ook niet ieder
een nieuwe besturing of automatische afspeellus starten.

**Voorbereiding:** maak de logische scènekeuze een expliciete presentatiesessie
met select/next/previous/reset en één eigenaar per gekoppelde groep. Display en
volgende cellen lezen dezelfde sessie. Houd de concrete horizontale beweging
als optionele animatieadapter, los van de keuze van inhoud. Gebruik de bestaande
Display/Text-route als eerste consument van die scheiding; vervang haar oude
statepad in plaats van een tweede synchronisatiepad toe te voegen.

Acceptatie: twee views volgen één keuze; één view unmounten wist de andere niet;
andere canvassen/profielen blijven onafhankelijk; vertraagde callbacks na
sessievervanging worden genegeerd; bezoekerskeuzes schrijven geen draft/history.

## 2. Koppelingen hebben nog geen profiel/canvasbrede identiteit — eerst vastleggen

`display:primary` is geldig in elk afzonderlijk canvas. Bestaande `sceneLink`
verwijst naar `displayId` binnen die lokale scope. Dit is nu veilig dankzij de
afzonderlijke editor-/publicatiesessies. Een nieuwe globale map op alleen dat ID
zou bronnen verwisselen wanneer meerdere canvassen samen getoond worden.
Diagnostisch voorbeeld 1 bevestigt dat twee geldige canvassen dezelfde
Display-ID bevatten.

`applicationNavigation.js:4–8,28–40` en
`profileOverviewModel.js:45` ondersteunen module/grid-doelen, maar geen doel met
named-canvas-ID én camera-indexpunt. `CanvasPresentation.jsx:28` bewaart zijn
indexkeuze alleen lokaal. Voorbeeld 5 bevestigt de huidige routebeperking; dit
is een ontbrekende nieuwe mogelijkheid, geen fout in het bestaande contract.

Ook hebben de bestaande tekstkoppelingen twee betekenissen:
`scenePassages.js:5` koppelt sections aan de positie in de scènevolgorde;
expliciete passages koppelen aan `gridId`. Voorbeeld 4 bevestigt dat herschikken
bij sections de tekst voor hetzelfde scène-ID verandert. Dat is bestaand,
getest gedrag en mag geen stilzwijgende standaard voor Bento-koppelingen worden.

**Voorbereiding:** leg een bronadres vast met profiel/publicatiescope, canvas-ID,
module-ID en waar nodig scène- of inhoud-ID. De tijdelijke sessiescope moet
ook een vervangen publicatiesnapshot onderscheiden. Maak drie bedoelingen
expliciet: inhoud tonen, een bestemming openen, een scènebesturing volgen.
Een camera-indexpunt kiest framing; een scènebinding kiest inhoud. Gebruik voor
de nieuwe bindings stabiele IDs en definieer beschikbaarheid/verwijdering.

Acceptatie: gelijke lokale IDs in canvas A en B blijven onafhankelijk; volgorde
wijzigen verwisselt geen gebonden inhoud; ontbrekende doelen krijgen een
zichtbare unavailable-status en vallen niet terug op een toevallig ander werk.

## 3. De canvasviewer is een projectie, geen live Display-host — gerichte adapter nodig

`workbenchOverviewModel.js:24,45` kiest de eerste Display-grid en de bijpassende
tekst. `CanvasPresentation.jsx:91` gebruikt `WorkbenchOverviewPreview` voor zowel
de volledige compositie als camera-uitsneden. De index verandert de viewregion;
het model krijgt geen actuele Display-scène mee. Interactieve mini-apps zijn
bewust placeholders. Voorbeeld 3 bevestigt de eerste-scèneprojectie en dat zij
haar input niet wijzigt.

Daarom volgt deze viewer niet vanzelf de Display-bediening wanneer men er een
link naartoe maakt. De huidige previewmodel-functie is wel een goede pure grens.

**Voorbereiding:** laat een expliciete presentatieprojectie de gewenste scène
en inhoud oplossen uit een gegeven snapshot plus tijdelijke sessie. De
thumbnail behoudt een vaste, goedkope uitgangsweergave; de geopende weergave kan
de actuele keuze gebruiken. Hergebruik de onderliggende media-/tekstrenderers.
Importeer niet het volledige owner-editorruntime om één cel te laten volgen.

Meet pas bij het functionele experiment met gevulde cellen en meerdere zichtbare
werken wat media, actieve renderers en herhaalde tegels kosten. Er is hier geen
nieuwe gemeten performanceclaim gedaan.

## 4. Reception en publicatie kennen alleen zelfstandige inhoud — voor echte links uitbreiden

`receptionPresentation.js:23–54` valideert cellen met eigen Image/Text-records en
profielvelden, weigert scene-linked/paginated Text en weigert dubbele plaatsing
van hetzelfde eigen record. Voorbeeld 2 bevestigt de bewuste sceneLink-grens.
`ReceptionCanvas.jsx` zoekt rechtstreeks in `reception.imageModules/texts`.
`projectReception` filtert die eigen inhoud zonder context van andere canvassen.

`workbenchCollection.js:37–64` bewaart Reception eenmaal bij `shared` en
compositie-inhoud per canvas. `canvasPublication.js:27–47` publiceert geselecteerde
canvassen en gedeelde profielinhoud afzonderlijk; niet-geselecteerde canvassen
behouden hun vorige publieke versie. Nieuwe links moeten dus worden opgelost
tegen de werkelijk samengestelde publicatie, niet tegen alle lokale drafts.

**Voorbereiding:** voeg een kleine getypeerde bronresolver toe met aparte invoer
voor eigen inhoud en gekoppelde bronnen. Behoud één eigenaar voor de inhoud en
bewaar in Reception alleen de verwijzing plus de eigen layoutinstellingen.
Definieer vóór publiceerbare links validatie, undo/recovery, verwijderen en het
geval waarin een doel privé, afwezig of in een oudere publieke versie bestaat.
Geen automatische publicatie van een gekoppelde lokale bron.

Dit zijn nog ontbrekende extensies. Er is geen aangetoond huidig privé-datalek;
de huidige grenzen weigeren deze nieuwe constructies juist.

## 5. Beide presentaties bezitten hun eigen pagina en scroll — eerst voor samenvoegen losmaken

`reception.css:1,44–53` maakt een viewportgebonden pagina met een begrensd venster
en eigen scrollgebied. `workbenchOverview.css:3,10` bezit een vaste pagina en
vast ondermenu; `workbenchOverviewGrid.css:5–6` bezit een absoluut gepositioneerde
gridhost en eigen scroll. `WorkbenchOverviewGrid.jsx:46–65,108–141` gebruikt dat
scrollgebied voor zichtbaarheid, herhaalde collecties en scrollnormalisatie.

Reception is daarnaast een authored verdeling van een volledig rechthoekig
vlak; de galerij is een collectie tegels met eigen volgorde/grootte/optionele
wrap. Visuele overeenkomst maakt dit nog niet hetzelfde documentmodel.

**Voorbereiding:** scheid de herbruikbare tegel-/sectie-inhoud van de
pagina-navigatie en scrollhost. Geef de doorlopende profielpagina één duidelijke
scrollverantwoordelijke. Toon canvassen daar eerst eindig onder Reception;
wrap blijft een expliciete galerijpresentatie zolang het product daarvoor kiest.
De bestaande viewer kan als los geopende presentatie behouden blijven, met
focus- en scrollherstel naar de oorspronkelijke cel.

List verwijderen is een afzonderlijke UI-vereenvoudiging. Het lost de scène-,
bron- en publicatiekoppelingen hierboven niet op.

## 6. Lezen en bewerken zijn al afgebakend — behouden en gericht aanvullen

`systemWorkflowDraftStore.js:280` biedt readWorkbench zonder canvasactivatie.
De Workbench-scope op regel 353 blokkeert verouderde schrijvers; de
Reception-scope op regel 403 weigert wijzigingen aan canvasinhoud met haar
`canvasPart`-controle. `profileDraftReader.js` leest canonieke opslag zonder
mutatiecommando's, houdt een gemarkeerde laatst-goede weergave bij fouten en
ruimt listeners op. `PublishedCanvasGallery.jsx` krijgt uitsluitend een
geverifieerde publicatie en heeft geen lokale opslag-/walletbevoegdheid.

De eigen galerij gebruikt wel de bredere `OwnerWorkbenchSession` met store,
preferences en owner-Library-resolutie. Om die onder de read-only Reception te
tonen, moet een read-only collectieadapter de benodigde snapshots leveren.
De hele ownersessie inladen zou de recent gemaakte reader/editor-laadgrens
weer verbreden. Gebruik de bestaande opslagvalidatie; maak geen tweede
persistente collectie of parser.

Gedeelde renderers, ToolPanel, kleur, gestures en Library-bediening zijn werkelijk
hergebruik. Sommige bestanden/classes heten nog Workbench. Alleen die namen
herorganiseren is geen noodzakelijke voorstap voor deze functie.

## Aanbevolen volgorde

1. Leg de concrete bron-/sessiescopes vast en haal logische scènebesturing uit
   de Display-weergave. Laat de bestaande Display + Text deze gebruiken en
   bewijs levensduur, isolatie en tijdelijke toestand.
2. Maak de bron-/presentatieprojectie en publicatievalidatie expliciet. Breid de
   bestaande read-only adapter uit voor een collectie, met eenduidige
   unavailable/stale/private-afhandeling.
3. Maak galerij-inhoud los van de eigen pagina-/scrollhost. Behoud de afzonderlijke
   authored layout en canvasinhoud; voeg ze alleen in de presentatie samen.
4. Bouw daarna één begrensd experiment: twee scènes sturen één beeldcel en één
   tekstcel, naast één statische cel. Test terugschakelen, unmount/remount,
   twee canvassen met dezelfde module-ID, ontbrekende bron, publiceren van
   geselecteerde versies en mobiel. Geen algemeen systeem voor iedere module.

Een zuiver visuele compositiestudie kan zonder al deze nieuwe functionaliteit.
Voor een werkend experiment met canonieke opslag en publieke links zijn de
betrokken grenzen hierboven de acceptatievoorwaarden. De volledige Display-
editor herstellen, alle CSS verhuizen of alle modules herschrijven is daarvoor
geen aangetoonde afhankelijkheid.

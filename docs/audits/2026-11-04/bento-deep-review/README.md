# Reception Bento — technische en gebruiksreview

4 november 2026. Beoordeling van de actuele lokale implementatie, inclusief de ongecommitte wijzigingen. Geen productcode gewijzigd; dit is een audit met reproduceerbare bevindingen en voorstellen.

## Oordeel

**De basis is goed gekozen, maar de huidige Bento is nog niet klaar om als afgewerkt en betrouwbaar uitbreidbaar te beschouwen.** Het is geen los geïnstalleerde gridbibliotheek: de layoutgenerator en interacties zijn eigen code boven op de bestaande native Editor. Die keuze past bij de geaccepteerde productrichting. Opslag, Undo, native artwork, clipping, Library, kleurbediening en toolvensters worden voor een belangrijk deel correct hergebruikt.

De belangrijkste problemen zijn inhoudsafhankelijke maatgrenzen, verlies van individuele hoekradii, een tweede drag-lifecycle en een paneel dat starten, aanpassen en vervangen onvoldoende onderscheidt. De herstelrichting is gericht consolideren binnen de huidige Editor. Een nieuwe editor of generiek layoutframework is niet nodig.

## Scope en herkomst

- Checkout: `remediation-2026-10-19-shared-checkpoint/work`.
- Branch: `codex/profile-work-index-2026-10-30`.
- Lokale HEAD én live gecontroleerde remote branch: `82837f1d76debe98f1597cf69d5bd95aac5f2659`.
- De Bento-bestanden en aanpalende wijzigingen staan grotendeels lokaal en ongecommitte. De historische commit is geen bewijs voor deze implementatie.
- [CI op deze HEAD](https://github.com/RadarVisuals/INSCAPE/actions/runs/41333804853) is mislukt: source en production slaagden, alle vier browsershards en de aggregatie faalden. Dat is bestaande CI-status, niet het resultaat van deze audit. Geen bevestigde deployment van de lokale Bento-versie gevonden; er is niet gedeployed.
- Actieve contractdelen van 3–4 november, de algemene Editor-afspraken, creative intent en het design-system handboek zijn als context gebruikt. Historische auditbevindingen gelden niet automatisch voor de nieuwe native implementatie. De beschermde continuation-handoff is niet gelezen of gebruikt.
- Gecontroleerd: generator, partitionering, swap/resize, toevoegen/verwijderen, merge/split, inhoud en clipping, previews, documentscope, persistence/recovery/Undo, publieke projectie, gedeelde controls en actuele tests. Visuele inspectie op brede en smallere computerformaten, in Dark en Light. Geen nieuwe mobile-authoring scope.
- [Bronintegriteit](../../../../output/bento-deep-audit-2026-11-04/production-integrity.json): alle 884 bestanden onder `src` zijn na de audit bytegelijk aan het vastgelegde beginmanifest. Bestaande lokale wijzigingen zijn behouden. Alleen auditdocumentatie, diagnostische scripts, logs, screenshots en gegenereerde buildoutput zijn toegevoegd/ververst.

## Wat werkelijk wordt hergebruikt

| Verantwoordelijkheid | Huidige eigenaar | Beoordeling |
|---|---|---|
| Bewaarde celgeometrie | Native Shape + `workbench.shapes[].window` | Goed: geen tweede opgeslagen grid of split tree. |
| Celinhoud | Referenties in `cells[].members` naar native Images, Texts en Shapes | Goed: geen gekopieerde artworkrecords per cel. |
| Layoutvoorstel | `receptionLayoutGenerator.js` | Tijdelijk en reproduceerbaar met seed; alleen toegepaste geometrie wordt bewaard. |
| Topologie en bewerkingen | `receptionPartition.js`, `receptionBento.js`, `receptionCellStructure.js`, `receptionCellDeletion.js` | Terecht Bento-specifiek; niet vervangen door vrije module-snapping. |
| Meebewegen van inhoud | `reconcileReceptionCells` | Eén bestaande reconciler voor de definitieve geometrie; preview gebruikt de bestaande cell-transforms. |
| Opslag, Undo, herstel, autoriteit | `createReceptionEditorScope` → bestaande root-store Reception-capability | Goed: geen eigen database, Undo-stack of actieve gewone canvas als opslagdoel. |
| Image en Text creëren | `addImageModule`, `addTextModule`, Library-resolver | Gedeeld. Text-initialisatie wordt wel in de React-host aangepast via een store-wrapper; zie verbeteringen. |
| Kleur en binnenlijnen | `CommittedColourControls`, `ShapeOutlineControls`, `validShapeOutline` | Goed: geen tweede color picker of outline-validator. |
| Venster, drag en docking van tools | `WorkbenchToolPanel` → `ui/ToolPanel` | Gedeeld. De Bento-inhoud definieert daarnaast eigen controlmaten. |
| Contextmenu en Layers | Bestaand objectmenu en native layer-order | Gedeeld; merge/split sluiten hierop aan. |
| Publieke weergave | `ReceptionDocumentCanvas`, native Shape/Image/Text-paint en `editorCellClip` | Bewust andere host zonder editorinteractie, met dezelfde records en paintcomponenten. Dat is geen dubbele opgeslagen compositie. |
| Drag van Bento-cellen en scheidingslijnen | Eigen lifecycle in `ReceptionBentoEditor` | Onvoldoende hergebruik; aantoonbare afwijking van de bestaande gesturebeveiliging. |

De huidige lezers voor oudere gepubliceerde Reception-documenten hebben een echte consument. Ze zijn niet automatisch dode Bento-code en mogen niet blind worden verwijderd.

## Bevestigde fouten en tekortkomingen

### F1 — Hoog: bewerkingen zijn alleen op lege celmaten begrensd

**Effect:** een toegelaten layout, split of resize kan met bestaande inhoud falen. De gebruiker krijgt een algemene ongeldige-documentmelding, terwijl de cel zelf de toegelaten maat heeft.

Reproducties:

1. Maak één cel op een canvas van 320 × 320, gutter/marge 24. De cel is 272 × 272. Voeg native Text toe en kies **Split vertically**. Het menu laat twee cellen van 124 × 272 toe, maar opslaan faalt: `The Reception cells or artwork are invalid. Your saved work is unchanged.` Ook via de echte interface bevestigd.
2. Split diezelfde lege cel eerst en klik daarna **+ Text**. De cel is geldig, maar Text faalt met `Text module could not be saved.`
3. Plaats een native Image van 32 × 32 in een grote cel en verklein de Bento van 1440 × 900 naar 720 × 450. De cel blijft ruim boven 80 × 80; de meegeschaalde Image komt onder zijn eigen minimum en de operatie faalt.

Oorzaak: [splitplanning](../../../../src/reception/receptionCellStructure.js#L82) en [Bento-settings/dividers](../../../../src/reception/receptionBento.js#L20) rekenen met 80 px. Native Text vereist minimaal 180 × 100 in [workbenchPresentation](../../../../src/profileDocument/domain/workbenchPresentation.js#L16); Image kent 32–4096 en gehele pixels in [imageModule](../../../../src/imageModule/imageModule.js#L11). De [reconciler](../../../../src/reception/receptionEditorDocument.js#L175) schaalt vervolgens de inhoud en valideert het hele document.

**Voorstel:** laat de operatieplanning de bestaande modulegrenzen meenemen en geef vóór de commit een gerichte reden of begrens de drag. Bepaal voor kleine cellen expliciet hoe Text moet passen/reflowen. Versoepel de gedeelde validators niet om de fout te verbergen. De bestaande transactionele afwijzing werkt: opgeslagen werk bleef in alle reproducties intact.

Bewijs: [domain-probes](../../../../output/bento-deep-audit-2026-11-04/domain-probes.jsonl), [browser-probes](../../../../output/bento-deep-audit-2026-11-04/browser-probes.json), [UI-fout](../../../../output/bento-deep-audit-2026-11-04/text-split-failure.png).

### F2 — Hoog: alleen formaat/spacing wijzigen overschrijft individuele hoekradii

Een geldig document met celradii `[12, 64]` krijgt na uitsluitend `width: 1600` radii `[12, 12]`. De rest van de bewerking hoeft geen radiuswijziging te bevatten.

[receptionBentoSettings](../../../../src/reception/receptionBento.js#L7) leest de eerste cel als globale radius. Het geometriepad van [setReceptionBentoSettings](../../../../src/reception/receptionBento.js#L92) schrijft die waarde naar alle cellen. Het appearance-only pad behoudt verschillende radii juist wel. Daardoor hangt ongewenst stijlverlies af van welke andere instelling wordt gewijzigd.

**Voorstel:** bewaar elke radius bij grootte-, gutter- en margewijzigingen; pas alle radii alleen aan bij een expliciete globale radiusactie. Geef een gemengde waarde weer als cellen verschillen. De huidige UI biedt bovendien alleen een globale radius; het eerdere per-celpad is verdwenen. Voor echte personalisatie is een expliciete keuze **Deze cel / Alle cellen** logisch, als kleine uitbreiding van de bestaande Shape/Bento-controls.

Bewijs: vierde geval in [domain-probes](../../../../output/bento-deep-audit-2026-11-04/domain-probes.jsonl).

### F3 — Middel: tweede drag-lifecycle mist bestaande afbreekbeveiliging

[ReceptionBentoEditor](../../../../src/reception/ReceptionBentoEditor.jsx#L66) bezit zelf pointer capture, listeners, temporary transforms, camera-lock en commit/rollback. De bestaande [createWorkbenchGestures](../../../../src/public/ownerSystemWorkflow/workbenchGestures.js#L22) regelt die lifecycle al en annuleert onder meer als de primaire muisknop niet meer ingedrukt is.

Reproductie: tijdens een gedeelde-randdrag een `pointermove` met dezelfde pointer en `buttons: 0` aanbieden. Bento blijft de tijdelijke rand verplaatsen, circa 80 schermpixels in de probe. Pas Escape herstelt de positie. De opgeslagen layout bleef ongewijzigd. Dit is een gecontroleerde simulatie van een verloren mouse-up; geen claim dat elke gewone drag fout gaat.

**Voorstel:** verbind Bento-preview en -commit als specifieke operaties aan de bestaande gesture-owner, met expliciete camera-lock cleanup. Verwijder vervolgens de verdrongen listeners/lifecycle uit Bento. Alleen nog een extra conditie kopiëren lost de dubbele verantwoordelijkheid niet op. De eigen topologie- en swapberekeningen blijven terecht in Bento.

Bewijs: `abandoned mouse gesture` in [browser-probes](../../../../output/bento-deep-audit-2026-11-04/browser-probes.json).

### F4 — Middel: twee Apply-betekenissen delen dezelfde tijdelijke instellingen

In één paneel staan **Apply settings** en **Use layout**. Het eerste verandert de huidige indeling, het tweede vervangt haar. Het celgetal staat in hetzelfde `settings`-object, maar wordt door Apply settings niet toegepast. De documentgeneratie remount vervolgens `BentoSettings` via [key={revision}](../../../../src/reception/ReceptionBentoPanel.jsx#L23).

Bevestigd: bij een grid met zes cellen breedte 1600 en celgetal acht invullen, vervolgens Apply settings: breedte is opgeslagen, de cellen blijven zes, en het ingevoerde getal acht springt terug naar zes. De gebruiker verliest zijn nog niet toegepaste voorstel.

**Voorstel:** scheid de tijdelijke huidige-layoutinstellingen van het vervangingsvoorstel, zonder een tweede opgeslagen layoutmodel. Gebruik duidelijke acties **Pas huidige grid aan** en **Vervang door deze indeling**. Een bewaarbewerking in de ene sectie mag het voorstel in de andere niet stilzwijgend wissen; verouderde voorstellen moeten zichtbaar vervallen of opnieuw berekend worden.

Bewijs: laatste geval in [browser-probes](../../../../output/bento-deep-audit-2026-11-04/browser-probes.json).

### F5 — Middel: de actuele verificatie is niet groen

De volledige `npm test` vindt ook gekopieerde historische `.test.js`-bestanden onder `output/bento-merge-split-2026-11-04/before`. Die imports falen. Daarnaast is de gegenereerde design-system inventory verouderd.

Twee aangrenzende browsersuites falen eveneens. `reception-cell-interaction` heeft een ongeldige image-fixture en een test die nog de expliciet vervangen coupling-controls verwacht. `reception-layer-order` zoekt op twee plaatsen een Reception-knop zonder de huidige navigatieroute te volgen; zijn paint-hitassertie krijgt `undefined` waar native layer-ids verwacht werden. Die laatste moet rekening houden met de nieuwe interactieve celoverlay en daarna de echte paint-order opnieuw bewijzen. De mislukte assertions zijn op zichzelf geen bewijs van kapotte publicatie of verkeerde paint-order.

**Voorstel:** begrens testdiscovery tot echte tests, pas fixtures en verwachtingen aan de actuele route aan en herstel de coverage van publieke paint-order. Vernieuw de inventory met review van de diff. Behoud gedragsdekking; verwijder geen suite louter om groen te worden.

## Styling en de maakflow

### Wat al klopt

Dezelfde Dark/Light-kleuren, Inscape Sora en gedeelde toolvensters geven herkenbaarheid. Library en Text openen hun native tools. Dubbelklik/Enter en **Back to cells** maken een bruikbare scheiding tussen celindeling en inhoud. Preview, Undo en het vasthouden van bestaande inhoud zijn goede bouwstenen. De directe celknoppen voorkomen veel omwegen.

### Wat ik gericht zou veranderen

| Prioriteit | Huidige frictie | Concreet voorstel |
|---|---|---|
| Eerst | Een lege Reception opent vooral instellingen. Bij 1280 × 800 staat **Use layout** op y≈837, buiten het zichtbare paneel. De gebruiker ziet wel Apply settings, maar die maakt geen cellen. | Toon bij een lege Reception bovenaan **Maak je Bento**, celgetal, formaat en de maakactie. Zet de actieve hoofdactie in een vaste paneelvoet. |
| Eerst | Aanpassen en randomizen lijken één doorlopend formulier. | Twee duidelijk benoemde secties: **Huidige grid** en **Andere indeling**. De randomizer is een optionele vervanging, geen verplichte startwijze. |
| Vervolgens | **Cell settings**, **Bento settings** en **Bento size** openen hetzelfde globale paneel. | Benoem globale acties consequent **Bento-instellingen**. Reserveer **Celinstellingen** voor naam, celstijl en eventuele radius van de selectie. |
| Vervolgens | Merge/split zijn alleen via het contextmenu te ontdekken; de lange uitleg staat onderaan. | Geef een compacte hint bij celselectie en een ingang naar de bestaande contextmenuacties. Maak geen tweede eigenaar van deze commands. |
| Vervolgens | Knoppen en velden tekenen eigen 26/28 px maten, terwijl het gedeelde tooltoken 32 px is. | Gebruik de bestaande controlrecepten/tokenwaarden, of documenteer één bewuste compacte variant. Verwijder verdrongen regels in `receptionBento.css`. Kleuren/fonts hoeven niet opnieuw ontworpen. |
| Vervolgens | De actiestrook staat binnen het artwork; op kleine/gezoomde cellen wikkelt ze en bedekt ze inhoud. | Eén selectiegebonden strook net buiten de geselecteerde cel, aan de workspace begrensd; behoud dezelfde vier acties en keyboard focus. Toets dit eerst op een smalle cel met echte inhoud. |
| Daarna | Individuele celstijl is verspreid over Color, Shape, Bento en FX. Het Bento-paneel toont alleen de radius van de eerste cel. | Een duidelijke scoping-indicatie **Geselecteerde cel** tegenover **Hele Bento**, met links naar bestaande Color/Shape-controls. Geen tweede kleurkiezer. |
| Daarna | Een nieuwkomer kan vooral varianten proberen; exact gewenste verhoudingen vinden blijft handwerk. | Maak starten met één cel + zichtbare splitacties eenvoudig. Overweeg een exacte maat/verhouding via de bestaande transformtopologie nadat de maatgrenzen correct zijn; geen grote templatebibliotheek vooraf. |

[Lege laptopweergave](../../../../output/bento-deep-audit-2026-11-04/empty-bento-1280x800.png), [Light op 900 px](../../../../output/bento-deep-audit-2026-11-04/browser-chrome/reception-native-editor/bento-followup-900-light.png), [gevulde live preview](../../../../output/bento-deep-audit-2026-11-04/browser-chrome/reception-native-editor/bento-live-artwork.png).

### Schaalgedrag van de publieke vormgeving: expliciet beslissen en testen

In de native publieke preview wordt een cel bij 900 px breedte 206,25 px in plaats van 330 px, maar de opgeslagen radius van 64 px blijft 64 schermpixels. Gutter en inner-line width schalen wél. De achtergrond en child-clip gebruiken beide de ongeschaalde radius: [ReceptionDocumentCanvas](../../../../src/reception/ReceptionDocumentCanvas.jsx#L74). Daardoor worden de afgeronde hoeken relatief veel groter.

Dit is een bevestigde visuele discrepantie tussen maatprojectie en vormgeving; het precieze gewenste responsive radiusbeleid is niet afzonderlijk vastgelegd. Mijn voorstel is om de authored radius op de verkleinde desktopprojectie proportioneel mee te nemen, via één gedeelde projectieregel voor achtergrond én clip. Behandel de bestaande phone-reflow afzonderlijk.

Text behoudt volgens het actieve contract bewust zijn leesbare lettergrootte en wrapt. In de gevulde 900 px preview raakt daardoor tekst buiten de kleinere cellen geclipt. Dat is **geen bewijs van een fout tegen die productafspraak**. Het verdient wel zichtbare overflowfeedback tijdens authoring en een duidelijke verwijzing naar preview; een gebruiker mag niet aannemen dat een op 1440 px passende tekst overal volledig zichtbaar blijft.

Bewijs: [metingen](../../../../output/bento-deep-audit-2026-11-04/scale-probes.json), [900 px preview](../../../../output/bento-deep-audit-2026-11-04/radius-preview-900.png).

## Codehygiëne en uitbreidbaarheid

De nuttige boundaries zijn aanwezig: pure layoutberekeningen, een Reception-capability, native modulecommands en gedeelde rendering. De bestaande generator/partitionering hoeft niet opnieuw geschreven te worden. De nieuwe code voegt geen aparte Bento-package of stylesheetframework toe.

Gerichte verbeteringen na F1–F4:

- Geef de celminimummaat één benoemde eigenaar in plaats van herhaalde `80`-waarden in generator, split, resize, toevoegen en deletion. Houd dat gescheiden van de strengere grenzen van de inhoud.
- Verplaats de native Text-initialisatie uit de `cellStore`-wrapper in de React-host naar een expliciete bestaande sessionactie met frame/appearance-input. De host past nu zelf kandidaat-Text en Workbench-layout aan. `commitInCell` blijft de eigenaar van lidmaatschap en atomiciteit; Library-drop gebruikt dezelfde capability al.
- Houd de gemeenschappelijke geometryprojectie tussen commit, preview en locked-contentcontrole traceerbaar. Introduceer pas een klein gedeeld helpercontract als het die concrete paden vervangt; geen nieuwe generieke scenegraph.
- Format de compacte, meerledig samengestelde berekeningen leesbaar. De huidige korte bestanden zijn niet hetzelfde als eenvoudige code. Benoemde tussenstappen helpen vooral bij row bands, grenzen en foutafhandeling.
- Breid type-/contractdekking gericht uit naar de Bento-operaties. De geslaagde huidige contractcheck richt zich vooral op Workbench-store, move/resize en gestures; ze is geen volledige typecheck van de nieuwe Bento-Reactcode.

Er gelden echte productgrenzen: 16 nieuw aangemaakte cellen, 32 Shapes, 16 Images en 16 Text modules. **Ready to scale** betekent hier eerst betrouwbaar binnen die grenzen en eenvoudig uitbreidbaar in verantwoordelijkheid. Meer cellen of media vereisen aparte productkeuzes en metingen; de limieten blind verhogen is geen architectuurverbetering.

Een indicatieve lokale dragmeting met 16 cellen, 16 geladen Images uit zeven verschillende lokale WebP-artworks en acht gevulde Texts leverde 292 frame-intervallen op: mediaan 7 ms, p95 20,9 ms, maximum 27,9 ms; geen interval boven 33,4 ms. Alle 16 rastermedia waren vooraf `ready`. Dit is een development-build met headless Chrome op deze machine en een synthetische drag. Het bewijst geen vaste 60 fps, geen performance op zwakkere laptops en geen worst case met unieke animaties/SVGs. Er is op basis hiervan geen reden om nu een ruimtelijke index of nieuw renderframework in te voeren. [Gevuld bewijsbeeld](../../../../output/bento-deep-audit-2026-11-04/filled-16-cells.png).

## Uitgevoerde verificatie

| Check | Actueel resultaat |
|---|---|
| Gerichte Reception/Shape/Image-geometry tests | 101/101 geslaagd |
| `npm run lint` | Geslaagd; 78 bestaande geregistreerde hook-observaties blijven bestaan |
| `npm run typecheck` | Geslaagd binnen de bestaande beperkte contractscope |
| `npm test` | 1705/1709 geslaagd; vier failures zoals F5 |
| `reception-native-editor` browser | 26/26 geslaagd |
| `reception-cell-interaction` browser | 1/3 geslaagd |
| `reception-layer-order` browser | 0/3 geslaagd |
| `reception-reader` browser | 4/4 geslaagd; bevat mede oudere readerfixtures, geen volledige v3-pariteitsgarantie |
| Eigen domein- en browserprobes | F1–F4 en gemeten paneel-/controlgedrag reproduceerbaar |
| Gevulde schaalprobe | 16 Images daadwerkelijk geladen; radiusprojectie en indicatieve timing vastgelegd |
| `npm run build` | Geslaagd; bestaande waarschuwing over grote chunks |
| `npm run build:check` | Geslaagd; 800.014 initial JS bytes binnen huidige budgets |

De eerste browserrun strandde vóór tests doordat de standaard Playwright-Chromium niet startte (`spawn UNKNOWN`). De complete gekozen set is daarna via de bestaande `INSCAPE_BROWSER_EXECUTABLE` override uitgevoerd met de geïnstalleerde Chrome 156.0.8078.80 en Playwright 1.61.1. Geen dependency of browserinstallatie gewijzigd. De eigen schaalprobe is tijdens ontwikkeling gecorrigeerd om echte geladen artwork te meten; alleen `scale-probes-ready.log`/de uiteindelijke `scale-probes.json` onderbouwen de bovengenoemde performancecijfers.

Alle logs en reproduceerbare scripts staan in [output/bento-deep-audit-2026-11-04](../../../../output/bento-deep-audit-2026-11-04/). De bronidentiteit vóór de review staat in `browser-chrome/source-manifest.json`. Er zijn geen live gebruikersdrafts, walletacties, uploads of publicaties uitgevoerd.

## Voorgestelde volgorde

1. Herstel F1 en F2 met gerichte regressies: inhoudsgrenzen en behoud van authored stijl.
2. Laat Bento de bestaande gesture-lifecycle gebruiken en verwijder de parallelle afhandeling.
3. Scheid huidige-layoutinstellingen van het randomizervoorstel en verbeter lege-state/hoofdactie/naamgeving in één kleine UI-stap.
4. Hergebruik de controlstyling en toets celacties, geselecteerde-cel versus hele-grid-stijl en radiusprojectie met echte inhoud op brede/smallere laptops.
5. Herstel de verouderde tests en inventory, voer de getroffen checks opnieuw uit en maak pas daarna een verifieerbaar checkpoint.

Een brede redesign, extra editor, andere gridlibrary of onbeperkte feature-uitbreiding volgt niet uit deze bevindingen. De benodigde verbeteringen passen in de bestaande architectuur.

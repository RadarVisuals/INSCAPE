# Reception-performance: meetresultaten en typeprofiel

Status: raster, mixed, SVG en native Editor zijn gemeten; het typepad is
geprofileerd. Geen releasegoedkeuring: de vervolgrun detecteerde een gelijktijdige
wijziging aan een afzonderlijke browsertest. Geen productie-optimalisatie uitgevoerd.

## Meetidentiteit en geldigheid

Ruwe run: `output/reception-performance-2026-11-12T17-50-28-836Z/report.json`.
Afgeleide kerncijfers: `analysis.json` in dezelfde map. De oorspronkelijke JSON
is niet aangepast. De run eindigde met `failed` doordat de SVG-workload geen
volledige meting opleverde; raster, mixed en de native Editor rondden hun eigen
checks wel af. Er is geen bronhashmismatch tijdens de run gerapporteerd.

Bronhash: `4945dbab687f87a769e6caa7bf5eab93894cf458da913d2e6d314e94c17bd58b`.
Windows, Node 24.20.0, Chrome 157.0.8103.78, Playwright 1.61.1, i5-12600KF,
32GB RAM, NVIDIA RTX 2080. Viewport 1600 × 1000, DPR 1. De rAF-baseline lag
rond 7ms. Dit is een lokale, met productieminificatie gebouwde componentproef;
geen veldmeting, CDN-test of telefoonbenchmark.

Na deze snapshot zijn in een andere werksessie frame-/Bento-aanpassingen
gemaakt, waaronder `WorkbenchArea.jsx`, `ReceptionDocumentCanvas.jsx`,
`receptionEditorDocument.js` en bijbehorende styles. Die wijzigingen zijn
behouden. De onderstaande resultaten gelden voor de vastgelegde snapshot;
een volgende run met andere bronhash is geen zuivere optimalisatievergelijking.

## Reader: raster en gemengde inhoud

Vijf cold/warm-paren per workload. Raster: 14 cellen, twee herhaalde WebP-bronnen.
Mixed: 16 beelden en 16 teksten met samen 384 rich-textparagrafen.

| Meting | Raster-14 | Mixed-16 |
| --- | ---: | ---: |
| Mediane cold FCP van de fixture | 60ms | 100ms |
| Mediane cold ready-tijd | 1213ms | 1198ms |
| Mediane warm ready-tijd | 1137ms | 1103ms |
| Cold gecodeerde responsebytes, main-target CDP | 1.237.814 | 1.348.242 |
| Warm gecodeerde responsebytes, main-target CDP | 622 | 622 |
| P95 frame-interval tijdens 10s resizen | 7,0ms | 7,0ms |
| Hoogste frame-interval tijdens 10s resizen | 7,1ms | 14,0ms |
| P95 frame-interval tijdens 10 inspectiecycli | 7,0ms | 7,1ms |
| Hoogste frame-interval tijdens inspectie | 20,8ms | 34,7ms |
| Top-frame blocking time boven 50ms in deze readerfasen | 0ms | 0ms |

Ready-tijd van deze eerste run omvat Playwrights netwerkstiltecontrole en is
geen first paint. Warmcachebytes tonen effectief hergebruik in deze testcontext,
geen algemene uitspraak over alle externe media of gateways. Netwerkcijfers
uit main-target CDP dekken niet noodzakelijk alle worker-/child-targetrequests.

De pure readeracties bleven in deze desktopproef licht genoeg om meestal de
waargenomen refreshcadans te volgen. Dit is geen bewijs voor alle devices of
SVGs. Mixed inspectie gebruikte cumulatief **5546ms style-recalculation** over
circa 10,1s voor tien open/sluitcycli; rasterinspectie circa **1531ms** over
9,9s. Ondanks de korte frames is stylewerk dus een gerichte tweede kandidaat
voor profilering. Deze cumulatieve tijden zijn geen gebruikerswachttijd en mogen
niet als onafhankelijke, optelbare kosten worden voorgesteld.

## Native Editor: typen verdient als eerste onderzoek

| Meting | 200 tekens typen | Dividerdrag van 10s |
| --- | ---: | ---: |
| Automation-walltime | 9724ms | 10.175ms |
| Cumulatieve main-target ScriptDuration | 4282ms | 2540ms |
| Cumulatieve RecalcStyleDuration | 1042ms | 1055ms |
| P95 frame-interval | 27,8ms | 13,9ms |
| Hoogste frame-interval | 48,6ms | 83,5ms |
| Top-frame Long Tasks | één van 52ms | één van 87ms |
| Blocking time boven 50ms | 2ms | 37ms |

Voor typen was 10ms tussenruimte per teken gevraagd; 9724ms is de totale
Playwright-flow inclusief invoertransport, wijzigingen, blur/savebevestiging en
settling. Het verschil met theoretisch 2000ms is niet uitsluitend productkosten.
De afzonderlijke CDP-script-/styleduur en frame-intervallen tonen wél concreet
meer werk dan in de reader. De waargenomen Event Timing-entry-P95 was 48ms
(581 entries, mogelijk meerdere events per interactie); dit is geen veld-INP.

Code-inspectie maakt JSON-opbouw, tekstsession-save, Reception-conversie,
reconciliatie/validatie, lokale opslag en transaction-/selectiongedreven
React-updates plausibele oorzaken. **Nog niet geprofileerd:** de huidige cijfers
verdelen de 4282ms niet betrouwbaar over die functies. Een gerichte CPU-profielrun
met sourcemaps is toegevoegd, apart van de baseline om profilerkosten niet te
mengen met bovenstaande timings. Geen debounce, vertraagde save of nieuwe
tekstengine ingevoerd op basis van vermoedens.

Dividerwijziging is daadwerkelijk opgeslagen en met één Undo identiek hersteld.
Preview behield het opgeslagen document. Deze waarborgen slagen in de run.

## Media en opruiming

- Na reader-unmount zijn de host-object-URLs terug op nul; de gedeelde worker is
  expliciet beëindigd. Geen media-/iframe-elementen bleven in de live fixture-DOM.
- Heap na GC steeg van circa 2,92 naar 4,00MB voor raster en van 4,10 naar
  4,66MB voor mixed. Inspectie kan extra code en caches hebben geladen. Dit is
  geen bewijs van een lek; herhaalde lifecyclemetingen zijn daarvoor nodig.
- CDP rapporteert na GC meer nodes dan de 11 nog live querybare DOM-elementen.
  Detached/retained nodes verdienen gericht onderzoek als herhaalde cycli groei
  tonen; één voor/na-paar bewijst geen monotone groei.
- In de native Editor waren 16 host-object-URLs actief; aan het einde van de
  preview-idlefase waren dit er 32, na terugkeer 16. Het aantal SVG-image-elementen
  bleef in de afgelezen momenten 32. Dit bewijst extra tijdelijke bronnen, geen
  verdubbelde netwerkoverdracht, exacte pixelallocatie of GPU-geheugen.

Een volgende run telt ook de bekende Blob-bytegroottes en het totale via de
loopbackserver geserveerde responsebodyvolume. Deze nieuwe metingen vervangen
geen ontbrekende waarden in de oorspronkelijke run.

## SVG: meetopstelling herstellen vóór een conclusie

Er zijn geen geldige cold/warm- of fasecijfers voor SVG. De zes Nomads waren
zichtbaar op de foutopname, maar de network-idlewacht liep af. Er verschenen
tevens sandbox-ServiceWorker-errors.

De geïnstalleerde Playwright-code bevestigt de herkomst van die errors:
`serviceWorkers: 'block'` injecteert in ieder frame een ongecontroleerde
`if (navigator.serviceWorker)`-toegang. De getter gooit in opaque sandboxframes.
Deze benchmarkoptie is verwijderd; de product-SVG-sandbox en CSP blijven volledig
behouden. Er zijn geen browsertrust-/OS-instellingen of productguards gewijzigd.

Network idle is bovendien geen betrouwbare ready-definitie voor deze levende,
geneste opaque/blobdocumenten. De meetopstelling gebruikt nu expliciete
media-/fontreadiness met een vaste 500ms settlingpauze. De bestaande checks op
ready-status, animatieklok, bronidentiteit, fouten en documentbehoud blijven
behouden. Deze ready-tijden hebben een andere definitie dan de eerste run en
worden niet stilzwijgend als optimalisatiewinst vergeleken.

## Vervolgmeting: SVG en typeprofiel afgerond

Run: `output/reception-performance-2026-11-12T18-29-18-543Z/report.json`.
Bronhash bij start:
`8525090d17865a0542f39a4e8f9ef9bba240124eb08ff1cd2973030aca2e624b`.
SVG en Editor rapporteren afzonderlijk `passed`, zonder pageerrors. De complete
run blijft terecht `failed`: tijdens de meting wijzigde een andere werksessie
`browser-tests/reception-native-editor.browser.mjs` (18:30:13 UTC). De vergelijking
van broninventarissen wees alleen die wijziging aan. Het bestand komt niet voor
in de sourcemaps van de gemeten build; de gemeten productiecode veranderde niet.
Dit maakt de gegevens bruikbaar als componentdiagnose, zonder het strikte
broncontrole-resultaat te herschrijven of een releasecheckpoint te claimen.

### Zes levende SVG-instanties

Dit zijn zes afzonderlijke instanties van dezelfde ongewijzigde Nomad-export,
geen representatieve verzameling van zes verschillende SVG-programma's.

| Meting | SVG-6 |
| --- | ---: |
| Mediane cold ready-tijd, nieuwe definitie | 795,5ms |
| Mediane warm ready-tijd, nieuwe definitie | 669,0ms |
| P95 top-frame interval tijdens 10s resizen | 7,0ms |
| Hoogste interval tijdens resizen | 8,2ms |
| P95 top-frame interval tijdens tien inspectiecycli | 7,0ms |
| Hoogste interval tijdens inspectie | 34,8ms |
| Top-frame Long Tasks tijdens interactiefasen | 0 |
| Extra serverresponses tijdens gemeten readeracties | 0 |

Alle zes documentprogramma's meldden ready, hun animatieklokken liepen door en
de buitenste iframe-identiteiten bleven behouden na resizen en inspecteren.
Dit meet niet de interne GPU-framerate van ieder SVG-programma. De afzonderlijke
inspectietrace bevat 18.895 events en is niet afgekapt. Na unmount waren er nul
host-object-URLs, nul resterende workers en nul iframes in de fixture.

Cold/warm responsebodyvolume over alle servertargets was circa 4,10/3,84MB.
Deze proef toont dus geen volledige warmcachebesparing voor levende SVGs.
De ready-definitie verschilt van de eerste run; het verschil is geen gemeten
productoptimalisatie.

### Typen: werk buiten de tekstmodule is aantoonbaar

De vervolgbaseline gaf bij 200 tekens een P95 frame-interval van 34,6ms en een
maximum van 62,6ms; ScriptDuration was 4718ms. Bij dividerdrag waren dat
13,9ms P95 en 2534ms ScriptDuration. Undo, opslaan en documentbehoud bij Preview
slaagden. De typingfase omvatte ook twaalf mediaresponses (6,54MB responsebody);
dit is geen volledig uitgestabiliseerde, uitsluitend tekstuele belasting.

Het afzonderlijke typeprofiel staat in `editor-typing.cpuprofile`; de herleidbare
uitsplitsing staat in `typing-profile-analysis.json`. Het bevat 9006 samples over
circa 9,68s bij een gevraagd sample-interval van 1000 microseconden. Onderstaande
tijden zijn sampling-attributies, geen extra walltime of met elkaar optelbare
inclusive kosten.

| Waargenomen pad | Profielbewijs |
| --- | --- |
| React en brede windowrenders | React DOM circa 1287ms self; DisplayInstrumentWindow circa 462ms self |
| Navigator meet viewport opnieuw | Een navigationViewport/readViewport-keten circa 697ms inclusive; native getPropertyValue circa 633ms self |
| Tekstwijziging schrijft door naar gedeelde store | ArticleEditor onUpdate circa 1118ms inclusive; onderliggende commit circa 980ms inclusive |
| Gehele draftvalidatie | validateSystemWorkflowDraft circa 693ms inclusive |
| Opruiming van verwijderde velden | withoutRetiredInterfaceAppearance circa 251ms self; withoutRemovedArtworkPresentation circa 248ms self |

Code bevestigt de samenhang: WorkbenchNavigator heeft een onvoorwaardelijke
layout-effect-paint na elke render. Dat pad leest via navigationViewport opnieuw
computed CSS en viewportmaten. Beide genoemde opruimfuncties beginnen met
structuredClone; ze verschijnen ook tijdens deze actuele tekstupdates. De
recursieve reuseUnchanged-functie kost eveneens tijd, maar opgetelde inclusive
recursietijden zijn niet als onafhankelijke kosten gerapporteerd.

Preview bracht de host-object-URLs tijdelijk van 16 naar 32 en terug naar 16;
de bijbehorende gecodeerde Blob-bytes waren 483.192, 966.384 en weer 483.192.
Tijdens de preview-idlefase serveerde de lokale server circa 8,09MB over vijftien
responses. Dat is aanleiding om hergebruik van voorbereide beelden gericht te
onderzoeken, geen meting van GPU-geheugen of van een gedeployde CDN.

## Aanbevolen volgorde

1. Beperk welke editoronderdelen opnieuw werken bij een tekstwijziging. Begin
   bij Navigator-paint en viewportmetingen; behoud updates bij echte camera-,
   dock-, host- en viewportwijzigingen. Houd saves en Undo direct correct.
2. Vermijd herhaald klonen voor verwijderde velden in een al canoniek document.
   Onderzoek de read/importgrens en vereenvoudig alleen met behoud van huidige
   drafts, validatie en foutmeldingen; schakel controles niet stilzwijgend uit.
3. Meet daarna opnieuw met dezelfde fixture en een stabiele broninventaris.
   Onderzoek vervolgens shared mediavoorbereiding voor Editor/Preview en de
   stylekosten van gemengde readerinspectie.

Geen debounce, vervangende tekstengine, nieuwe layoutengine of afgevlakte SVG
ingevoerd. De gemeten reader rechtvaardigt die ingrepen niet. De wijzigingen
aan productcode van andere werksessies zijn behouden. Dit werk blijft lokaal;
geen commit, push, deployment of publicatie uitgevoerd.

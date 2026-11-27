# SVG-animatie in dezelfde gevulde Workbench

21 oktober 2026. Lokaal onderzoek en een gerichte reparatie, op
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`, met de bestaande niet-gecommitteerde wijzigingen.
Geen commit, push, upload, walletactie of deployment.

## Uitkomst

**Behoud voor deze vaste beweging de gelaagde SVG en laat CSS de beweging
uitvoeren.** Bij 60 nominale bewegingsstappen per seconde daalt de CPU-belasting
van de renderers van 22,5% naar 8,5% van één kern: ongeveer 62% minder, in dezelfde
gevulde Workbench met vier bewegende SVG's. Bij gelijke 60-stapsbeweging is CSS
ongeveer 49% lichter dan de JavaScript-variant met een limiet van 60 updates.

Met de twee HTML-animaties erbij daalt de mediaan van 29,5% naar 18,9%, ongeveer
36%. Die aanvullende meting varieert meer: 15,1–21,5%, tegenover 29,2–30,7% voor
de onbeperkte JavaScript-variant. De 30-fps WebP-proef is hier juist zwaarder,
groter en minder scherp bij vergroting. Dit is een resultaat voor dit artwork,
deze browser en deze resolutie; geen algemene ranglijst van beeldformaten.

De CSS-varianten zijn afzonderlijke proefbestanden. Bestaande artworks en de
Keeper zijn niet omgezet. Er is geen algemene frameratelimiet in Inscape ingevoerd.

## Eerst twee fouten onderscheiden

De oude meetproef selecteerde met `[id^=tentacle-]` zowel zeven groepen als
hun zeven afbeeldingen. Alleen de groepen hebben draaipunten. De afbeeldingen
kregen daardoor ongeldige rotaties met `undefined`. De gecorrigeerde proef
selecteert uitsluitend de zeven groepen met draaipunten en controleert dat
die werkelijk bewegen.

Een afzonderlijke herhaling van de oude selector levert 71,1% renderer-CPU op
(60,6–71,2%), met zeven ongeldige transformaties per SVG. De gecorrigeerde
gemengde proef levert 29,5% op. De oudere 74–80%-waarneming in
[de opslag/HTML-proef](storage-html-performance.md) bevatte dus ook kosten van
de gebrekkige proefanimatie. Het verschil is **geen bewezen verbetering van
de productie-app**. Ook de callbackfrequentie verschilt: nu circa 126 Hz.

Daarnaast bleek een echte appfout: de optionele verkleiningsstap tekende
geanimeerde WebP naar een PNG en zette daarmee de beweging stil. De nieuwe
browsertest faalde eerst op een `blob:`-PNG waar de bewegende WebP verwacht werd.
`prepareRasterArtwork` herkent nu het animatiekenmerk in de vaste WebP-header
en behoudt daarvoor de oorspronkelijke bron. Onbekende ingebedde WebP-headers
worden eveneens ongemoeid gelaten. Stilstaande lagen worden nog steeds verkleind.
De detectie leest alleen een korte header, geen volledige animatiepayload.
De headerindeling volgt de [officiële WebP-specificatie](https://developers.google.com/speed/webp/docs/riff_container).

Dit is een correctheidsreparatie aan de tijdelijke weergavebron. Opslag, artwork-
geometrie, walletgrenzen en de verantwoordelijkheid van het artwork voor zijn
eigen beweging blijven hetzelfde. Andere geanimeerde rasterformaten en externe
WebP-URL's zijn hiermee niet integraal onderzocht.

## Gelijke inhoud, gecontroleerde varianten

De echte eigenaar-editor is in productiemodus gebouwd. Elke run krijgt een eigen
browsercontext en lokale testopslag: 16 afbeeldingen, waarvan vier SVG's met
ieder acht WebP-beeldlagen, twaalf teksten met 144 paragrafen, 24 vormen, twee
HTML-artworks, een gedeelde Keeper in dock en een canvas van 4200 × 3200.
Er zijn acht opgeslagen Workbenches, waarvan één actief. De Keeper gebruikt
steeds hetzelfde oorspronkelijke gelaagde bestand, ook in de afgevlakte proef.

De SVG is hier dus een compositie van rasterlagen, zonder vectorpaden of filters.
De proefbeweging roteert zeven lagen rond hun bestaande draaipunten, met dezelfde
amplitude en sinusloop. CSS gebruikt vooraf berekende stappen; JavaScript schrijft
de actuele pose per update. De loop duurt 5655 ms. De WebP bestaat uit 170 op
30 fps bemonsterde browserbeelden van precies die beweging, op 512 × 512 pixels.

Negen basissituaties zijn elk driemaal gemeten, met omgekeerde volgorde in ronde
twee. CSS op 60 fps en CSS op 60 fps plus HTML zijn daarna elk driemaal gemeten:
**33 correcte runs**, plus drie expliciete diagnostische runs met de oude selector.
Tijdens de CPU-metingen draaiden geen andere door deze taak gestarte builds,
testsuites of encoders. De normale desktopomgeving bleef actief.

Machine: Windows, i5-12600KF, 16 logische processors, circa 32 GiB RAM,
Chrome 155.0.8059.85 headless, 1440 × 1000, DPR 1. Een smal viewport is aanvullend
visueel getest, niet als prestatietest op echte telefoonhardware.

## Metingen bij 30% zoom

Alle vier SVG's en beide HTML-frames zijn dan zichtbaar. Percentages zijn CPU-tijd
gedeeld door verstreken tijd, uitgedrukt ten opzichte van **één CPU-kern**.
De laatste kolom is CPU-verbruik van het GPU-proces, **geen GPU-hardwarebezetting**.
De tabel geeft medianen en de volledige spreiding over drie runs.

| Variant | Renderer-CPU | Spreiding | CPU van GPU-proces |
| --- | ---: | ---: | ---: |
| Alles stilstaand | 2,1% | 2,0–2,1% | 1,0% |
| Alleen twee HTML-animaties | 8,8% | 8,5–9,6% | 10,9% |
| SVG: JavaScript onbeperkt, circa 126 updates/s | 22,5% | 22,2–22,9% | 16,2% |
| SVG: JavaScript, 60 updates/s | 16,6% | 15,9–17,0% | 12,9% |
| SVG: JavaScript, 30 updates/s | 11,8% | 11,6–12,6% | 9,7% |
| SVG: CSS, 30 stappen/s | 6,0% | 5,8–6,2% | 7,9% |
| SVG: CSS, 60 stappen/s | 8,5% | 8,1–8,6% | 10,7% |
| SVG met geanimeerde WebP, 30 fps | 36,1% | 35,8–36,2% | 10,5% |
| JavaScript onbeperkt + HTML | 29,5% | 29,2–30,7% | 20,1% |
| JavaScript 30 updates/s + HTML | 18,4% | 17,9–19,5% | 14,3% |
| CSS 60 stappen/s + HTML | 18,9% | 15,1–21,5% | 16,2% |

De JavaScript-limieten zijn gecontroleerd via werkelijk uitgevoerde updates:
circa 30 respectievelijk 60 per seconde. De lichte rAF-planning blijft daarbij
op schermfrequentie lopen; vooral het aantal wijzigingen aan de beeldlagen daalt.
CSS voert geen JavaScript-animatielus per frame uit. Voor CSS en WebP zijn
veranderende zichtbare geometrie/pixels gecontroleerd; hun **daadwerkelijk
gepresenteerde aantal beelden** is niet met een beeld-voor-beeld opname gemeten.

De rAF-afstand in de hoofdapp blijft bij stil kijken doorgaans 8,1 ms op P95.
Dat bewijst geen 126 visuele beelden per seconde in ieder artwork. De hoofdthread
van de app gebruikt dan ongeveer 2% van één kern; het rendererproces omvat ook
andere threads en artwork-documenten. Een uitsplitsing naar decode, paint en
compositing is niet gemaakt.

## WebP: grootte, geheugen en detail

De verliesloze WebP-proef was 10.363.732 bytes, met exact behouden zichtbare
pixels en alpha. Ingebed als SVG overschreed die de bestaande hostlimiet van
8 MiB. Die limiet is niet verruimd.

De gemeten versie gebruikt WebP-kwaliteit 90 en verliesloze alpha:

| Bestand | Grootte |
| --- | ---: |
| Oorspronkelijke gelaagde SVG | 400.160 bytes |
| SVG met JavaScript 30-fps-proef | 401.751 bytes |
| SVG met CSS 30-fps-proef | 472.993 bytes |
| Geanimeerde WebP, 512 × 512 | 5.506.132 bytes |
| Die WebP plus stilstaande poster ingebed in SVG | 7.430.572 bytes |

Alle 170 gedecodeerde frames zijn met hun bron vergeleken. Alpha blijft exact;
de globale PSNR van gepremultipliceerde RGB is 44,8 dB. Die gemiddelde pixelmaat
vervangt geen visuele beoordeling. Op 120 pixels oogt de proef bruikbaar; bij
800 pixels en op het smalle DPR-2-viewport is de lagere bronresolutie duidelijk
zichtbaar. De lijnen worden zachter. De SVG-varianten behouden hun afzonderlijke
oorspronkelijke beeldlagen en reageren beter op vergroten.

De mediane private geheugencommit van de rendererprocessen ligt rond 474–536 MiB
voor de bewegende gelaagde proeven, en 878 MiB voor WebP. Dit zijn procesmetingen
na de zichtbaarheidscontroles, geen exacte rastercache- of GPU-geheugenmeting.
Working sets bevatten gedeelde pagina's en mogen niet als uniek appgeheugen
worden opgeteld. Eén volledig RGBA-frame van 512 × 512 is 1 MiB; alle 170 samen
zouden 170 MiB zijn. Dat is een rekensom, niet de bewering dat de browser al die
frames tegelijk bewaart. Kleinere WebP-resoluties, andere encoders en andere
artworks kunnen andere resultaten geven.

Visuele bewijzen: [SVG op 800 px](svg-animation-performance/svg-800.png),
[CSS op 800 px](svg-animation-performance/css-800.png),
[WebP tijdens afspelen op 800 px](svg-animation-performance/webp-playing-800.png),
[WebP-poster in dezelfde nulpose](svg-animation-performance/webp-poster-800.png),
[CSS smal](svg-animation-performance/css-narrow.png) en
[WebP smal](svg-animation-performance/webp-narrow.png).

## Opslaan, wisselen, beweging stoppen en navigeren

Alle 33 correcte runs controleren typen en opslaan, werkelijk uitgevoerde pan,
HTML-positiebehoud, behoud van inactieve composities, wisselen naar leeg en terug,
herladen met dezelfde opslaginhoud en het verwijderen van alle childframes bij
ontkoppelen. De lege Workbench houdt nul uitvoerbare artwork-frames over.
De mediane rendererbelasting daalt daar naar ongeveer 1,4–1,9% van één kern,
inclusief de meetlus en de blijvende interface. Dit gedrag bestond al en is
opnieuw bevestigd.

De aanvullende mediaproef controleert JavaScript 30, CSS 30, CSS 60 en WebP op
120 px, 800 px en 320 CSS-pixels bij DPR 2: beweging, stoppen, hervatten en reageren
op verminderde beweging. JavaScript en CSS behouden hun tijdlijn bij pauzeren.
WebP schakelt voor stoppen naar een poster. Terugschakelen geeft weer bewegende
pixels, maar is **geen framepreciese pauze/seek/hervatting**. De WebP-proef mist
ook de afzonderlijk aanpasbare beeldlagen.

Zoomen en slepen blijven een afzonderlijk aandachtspunt. Zelfs stilstaande
inhoud heeft hier een rAF-P95 van 24 ms en een grootste afstand van 64 ms.
CSS 60 heeft eveneens 24 ms P95, met een maximum van 72 ms. WebP heeft 24 ms P95
maar uitschieters tot 119,4 ms. Met slechts drie runs is dit geen betrouwbare
ranglijst van kleine navigatieverschillen. Er is wel duidelijk geen bewijs
dat een ander animatieformaat alle navigatiepieken oplost.

## Wat daadwerkelijk is gewijzigd en gecontroleerd

- App: uitsluitend de herkenning van geanimeerde ingebedde WebP in
  `src/artwork/prepareRasterArtwork.js`; stilstaande rasters blijven geoptimaliseerd.
- Proeven: gecorrigeerde selector, gescheiden animatievarianten, bewijs van
  zichtbare beweging, procesmetingen en afzonderlijk benoemde media.
- De nieuwe regressietest is opgenomen in de gewone browserrunner.
- Tien gerichte browsertests slagen: `animated-raster` (1), `artwork-document` (1),
  `svg-raster-quality` (4), `svg-lifecycle` (4). Daaronder vallen bestaande
  Keeper-rasterweergave, Inspect/Focus/Return en brede/smalle viewports.
- De twaalf unieke media-/viewportcombinaties slagen; de WebP-controles zijn
  aanvullend herhaald met opgeslagen afspeelbeelden. De encoder reproduceert
  de gemeten WebP byte voor byte.
- `npm run build` en `npm run build:check` slagen; de gemeten initiële JS-grootte
  is 822.007 bytes. De bestaande bundelwaarschuwingen blijven bestaan.
  Dit is geen releasecheckpoint; de volledige unit-suite is niet herhaald.

De vooraf vastgelegde 186 bestaande gewijzigde/nieuwe bestanden zijn opnieuw
gehasht. Geen bestand ontbreekt. Alleen de twee bewust uitgebreide benchmark-
bestanden en de browserrunner verschillen; de andere 183 zijn bytegelijk.
De oorspronkelijke Keeper-SVG blijft SHA-256
`b21e786cab2be4382a4b1fc3ac06d7a79df49d6e011a1108a7dbbb95b0799825`.
De bestaande Keeper-proef en opslag/HTML-wijzigingen zijn behouden.

De [CI-run voor de gecommitteerde HEAD](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131)
was groen. Dat zegt niets over deze niet-gecommitteerde wijzigingen; daarvoor
geldt het lokale bewijs hierboven. Er is geen nieuwe deployment uitgevoerd.

## Vervolgkeuze

Gebruik de **CSS-60-proef als uitgangspunt voor deze vaste loop**. Behoud JavaScript
voor beweging die werkelijk op instellingen, interactie of externe toestand
moet reageren, en begrens daar aantoonbaar overbodige beeldwijzigingen.
De Workbench hoort willekeurige NFT-scripts niet stilzwijgend te herschrijven.
Een algemene Canvas/WebGL-omzetting is op basis van deze proef niet nodig.
De volgende prestatievraag is het zoomen/pannen met gevulde inhoud; het
ruimtelijke overzicht en meerdere gelijktijdig actieve Workbenches blijven uitgesteld.

De [afzonderlijke proefbestanden](../../../output/svg-animation-study-2026-10-21/)
bevatten JavaScript zonder limiet, JavaScript 60/30, CSS 60/30 en een duidelijk
als afgevlakt benoemde WebP-kopie. Het zijn meetproeven, geen vervanging van
het originele artwork of een nieuw instelprotocol voor alle artworks.

## Bewijs en herhalen

[Hoofdmetingen](svg-animation-performance/benchmark-results.json),
[samenvatting](svg-animation-performance/benchmark-summary.json),
[CSS 60](svg-animation-performance/css-60-results.json),
[CSS 60 met HTML](svg-animation-performance/mixed-css-60-results.json),
[oude-selector-diagnose](svg-animation-performance/legacy-selector-results.json),
[mediagegevens](svg-animation-performance/media-manifest.json),
[browsertests](svg-animation-performance/browser-test-results.json),
[behoudcontrole](svg-animation-performance/preservation-after.json).

Voer vanuit de application checkout uit, met Node en Python/Pillow beschikbaar:

```powershell
node browser-tests/build-animation-study.mjs
$env:INSCAPE_PERF_SUITE='svg'
$env:INSCAPE_PERF_RUNS='3'
$env:INSCAPE_PERF_OUTPUT='.browser-test-runtime/svg-animation-study/benchmark'
node browser-tests/filled-workbench-performance.mjs
node browser-tests/summarize-animation-study.mjs
```

Voor de aanvullende situaties gebruikt de runner `INSCAPE_PERF_CASE` met
`css-60`, `mixed-css-60` of uitsluitend voor diagnose `legacy-selector`.
Gebruik per situatie een andere `INSCAPE_PERF_OUTPUT`. Verwijder die casefilter
voor een volledige herhaling. De optionele encoderinstelling
`INSCAPE_WEBP_LOSSLESS=1` reproduceert de grote verliesloze proef; die wordt
terecht niet als SVG toegelaten. Het standaardbestand gebruikt kwaliteit 90.

```powershell
node browser-tests/animation-study-quality.mjs
node scripts/runBrowserTests.mjs animated-raster artwork-document svg-raster-quality svg-lifecycle
npm run build
npm run build:check
```

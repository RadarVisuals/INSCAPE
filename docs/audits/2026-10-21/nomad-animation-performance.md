De echte Nomad kan zuiniger animeren zonder zijn bestaande doekvervorming te vervangen. In deze lokale meting bespaart een tekenlimiet van 60 beelden per seconde ongeveer 30% CPU-werk bij één bewegende Nomad en 23% bij vier. Een limiet van 30 bespaart respectievelijk 49% en 43%, met minder tussenbeelden. Het geheugengebruik en de haperingen tijdens navigeren vragen afzonderlijke maatregelen.

Dit is een afgeronde meetproef met afzonderlijke artworkkopieën. De toepassing en het originele artwork zijn niet aangepast. Alles blijft lokaal en ongecommit; er is niets gepusht, geüpload of gedeployd.

Gemeten op 21 oktober 2026, in de huidige vuile checkout op `codex/audit-checkpoint-2026-10-19`, HEAD `32d9418843d996afc2e5203afa4552a6cd2d459a`. De bestaande GitHub-run [Verify Inscape](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131) is opnieuw als geslaagd gelezen. Die controle geldt voor de commit, niet voor de huidige lokale wijzigingen.

**Wat daadwerkelijk is vergeleken.** Het bronbestand is `nomad-webp-svg/NOMAD-animated.svg` in de projectbovenmap: 908.082 bytes, SHA-256 `5151866ee081a24c36e82f8a34547569fb3e6c0fb13651e2a32e2d088366b083`. Het is een zelfstandig SVG met 39 stilstaande transparante WebP-lagen, een WebGL2-renderer in een canvas en een stilstaande SVG-terugval. Het is geen animatie van uitsluitend vectorpaden en geen geanimeerde WebP-loop.

De bestaande renderer doet per getekend frame 39 `drawElements`-opdrachten, samen 7.340 driehoeken, plus buffer-, textuur- en uniforminstellingen. De beeldlagen worden eenmaal per document geüpload. De kledingvervorming gebeurt in de bestaande shader; de brongeometrie wordt niet ieder frame opnieuw aangeleverd.

Dezelfde gevulde Workbench is hergebruikt: 4.200 × 3.200, acht opgeslagen Workbenches waarvan één actief, zestien afbeeldingen, twaalf teksten met 144 alinea's, 24 vormen, twee HTML-panelen en de bestaande Keeper. Vier beeldplaatsen bevatten de echte Nomad. In de één-Nomadproef bewegen er één en blijven de andere drie gepauzeerd; in de vier-Nomadproef bewegen ze alle vier. Zo blijft de hoeveelheid aanwezige inhoud gelijk. De HTML-panelen staan stil om het verschil door Nomad te isoleren. De Keeper gebruikt zijn ongewijzigde eigen bron.

Alle varianten gebruiken Fly en wind 35%. De proef met een limiet verandert alleen wanneer een nieuw beeld wordt getekend. De bestaande vliegklok, veerberekening en doekshader blijven doorlopen; de verstreken tijd wordt niet door het overslaan van tekenbeurten weggegooid. De standaardbron opent in Hover; voor deze vergelijking is de bestaande Fly-modus gekozen.

Er zijn 24 volledige meetlopen: acht gevallen, elk driemaal, met omgekeerde volgorde in de tweede ronde. Elke loop bevat 100% en 30% zoom, zoomen/slepen, typen, opslaan, wisselen naar een lege Workbench, terugkeren en herladen. Daarnaast zijn een eerste smokeproef, één afzonderlijke navigatieprofilering en één regressiecontrole van de eerdere CSS-proef uitgevoerd. Beeldcontroles liepen na de CPU-metingen. De browser had een eigen tijdelijk profiel en benaderde geen gebruikersopslag.

De machine: i5-12600KF, 16 logische CPU's, circa 32 GiB RAM, Chrome 155.0.8059.85, geautomatiseerd zonder zichtbaar venster. WebGL bevestigde echte hardwareversnelling via ANGLE/D3D11 op de NVIDIA RTX 2080, niet SwiftShader. Het Workbenchvenster was 1.440 × 1.000 met schermdichtheid 1. De aparte beeldcontrole omvatte ook 390 pixels breed met schermdichtheid 2. Dat is geen meting op een echte telefoon.

**Resultaat bij 30% zoom, wanneer alle vier exemplaren zichtbaar zijn.** Onderstaande cijfers zijn medianen over drie runs. CPU is de som van CPU-tijd in de Chrome-rendererprocessen en het Chrome-GPU-proces, gedeeld door de meetduur. 100% betekent één volledig bezette CPU-kern. Dit is geen percentage hardware-GPU-bezetting en geen percentage van de gehele computer. Mediane sommen zijn rechtstreeks per run berekend; ze hoeven niet gelijk te zijn aan de som van twee afzonderlijke medianen.

| Bewegende Nomads | Tekenen | CPU in deze Workbench | Minder dan huidige animatie |
| --- | --- | ---: | ---: |
| 0, alle vier gepauzeerd | Geen voortdurende tekenlus | 5,0% | — |
| 1 | Huidig, circa 125/s | 20,7% | — |
| 1 | Circa 60/s | 14,4% | 30% |
| 1 | Circa 30/s | 10,6% | 49% |
| 4 | Huidig, circa 125/s | 47,1% | — |
| 4 | Circa 60/s | 36,2% | 23% |
| 4 | Circa 30/s | 26,6% | 43% |
| 4 | Circa 60/s, 1× tekenresolutie | 33,9% | 28% |

De circa 125/s zijn gemeten tekenbeurten in deze browser, geen garantie over fysieke schermpresentaties. Bij een scherm/browser die al rond 60 callbacks/s draait, levert een 60-limiet vanzelf minder op. De totale CPU-kosten omvatten ook de rest van de Workbench. Dit zijn korte lokale meetvensters van 2,2 seconden, geen universele batterij- of mobiele prestatietest.

De afzonderlijke renderer-CPU bij vier bewegende Nomads daalde van 20,1% naar 15,3% bij 60/s en 11,6% bij 30/s. De CPU van het GPU-proces daalde van 26,9% naar 20,7% en 13,9%. De individuele meetbereiken staan in [de samenvatting](nomad-animation-performance/summary.json).

De vliegklok bleef bij alle lopende exemplaren tussen 0,9969 en 1,0032 seconde per echte seconde. De gemeten tekenfrequenties lagen rond 125,3, 59,9 en 30,0/s. De klok behoudt dus zijn snelheid. Het 95e percentiel van de afstand tussen tekenbeurten was circa 8,2 ms zonder limiet, 24 ms bij 60 en 40 ms bij 30. Een 60-limiet geeft op deze circa 125-Hz callbackcadans geen volkomen regelmatige 16,67 ms tussen ieder beeld. Een stilstaande afbeelding die gelijk blijft, bewijst daarom niet dat de beweging even vloeiend aanvoelt. De proef maakt die afweging zichtbaar in plaats van 30/s als kosteloze vervanging te behandelen.

**Resolutie en geheugen zijn verschillende kosten.** De huidige Nomad verlaagt zijn tekenbuffer al met de Workbenchzoom. Bij 30% waren de vier buffers ongeveer 217 × 242, 161 × 179, 163 × 181 en 217 × 242; de verschillen komen door de bestaande uitsnede en plaatsing. Bij 100% waren de eerste twee zichtbare exemplaren ongeveer 720 × 800 en 540 × 600. Er wordt dus niet permanent een enorme tekenbuffer gebruikt voor een klein figuurtje.

De 39 brontexturen bevatten daarentegen altijd 26.071.329 pixels. RGBA8 plus de bestaande mipmapketens vertegenwoordigt theoretisch ongeveer **132,54 MiB per Nomad**, circa 530 MiB voor vier afzonderlijke WebGL-contexten. Dit is een berekening uit de echte textuurmaten, geen directe VRAM-uitlezing; driveropslag, tijdelijke decodes, de terugvalafbeeldingen en overige buffers komen daar niet één-op-één in tot uitdrukking. De grootste enkele textuur is de body-core van 1.916 × 2.964 pixels. De SVG comprimeert goed als bestand, maar dat maakt de uitgepakte texturen niet klein.

Alle gevallen hadden dezelfde vier aanwezige Nomads. Gemeten privégeheugen van de rendererprocessen lag per geval rond 538–567 MiB; dat van het GPU-proces rond 1.461–1.789 MiB, inclusief browser- en driverallocaties voor de hele proef. Dit zijn geen zuivere per-Nomad- of VRAM-metingen. Ze onderbouwen geen geheugenbesparing door een framecap.

Van 1,5× naar 1× oversampling gaan verkleint de tekenbuffer met ongeveer 56% aan pixels, maar laat de brontexturen intact. Bij vier Nomads verbeterde de totale CPU-mediaan slechts van 36,2% naar 33,9%, ongeveer 6% extra. Er waren lichte rasterverschillen langs fijne lijnen. De huidige 1,5× scherptereserve behouden is daarom mijn voorkeur voor een eerste wijziging. De grafische timer is apart uitgelezen, maar de korte GPU-metingen wisselden sterk en waren niet consequent lager bij kleinere buffers. De GPU-klok werd niet vastgezet; deze samples worden bewaard, maar niet gebruikt als betrouwbare vergelijkende snelheidsclaim.

**De navigatiepieken zijn niet opgelost met minder frames.** Het 95e percentiel van de Workbenchcallbackafstand tijdens de zoom-/sleepproef bleef meestal rond 32–40 ms, zelfs met alle vier Nomads gepauzeerd. De grootste uitschieters in de matrix lagen tussen circa 120 en 160 ms, afhankelijk van het geval. Dat is een ander resultaat dan het rustige afspelen.

De extra navigatieprofilering registreerde twee nieuwe SVG-documenten tijdens de zoombeweging en het verwijderen van de documenten die uit beeld verdwijnen. Een opnieuw gemonteerde Nomad maakt zijn renderer en 39 textureuploads opnieuw aan. Binnen een bestaand document veroorzaakte een resolutiewijziging juist geen nieuwe textureuploads: dat is apart gecontroleerd.

Daarnaast zat ongeveer 475 ms van de samples in een navigatievenster van 3,81 seconden rechtstreeks in `getScreenCTM`. De sourcemap wijst naar `updatePixelScale` in `src/artwork/ProjectedSvgArtwork.jsx`, waar de host de actuele schermtransformatie voor artworkdichtheid leest. Het profiel toont ook veel browserwerk zonder gedetailleerde JS-toewijzing. Dit is dus bewijs van een duur hostmeetpad en opnieuw laden, niet het bewijs dat één functie alle haperingen veroorzaakt. Een volgende navigatieproef hoort de schermmetingen en het opnieuw initialiseren afzonderlijk te onderzoeken.

Bij wisselen naar de lege Workbench verdwenen in alle 24 runs alle uitvoerbare kinddocumenten. De gezamenlijke renderer-/GPU-proces-CPU zakte daar terug naar ongeveer 3,1–3,5% van één kern. Opgeslagen inhoud, HTML-posities en inactieve Workbenches bleven behouden; herladen behield het volledige opgeslagen record. Inactieve Workbenches hoeven voor deze oplossing niet mee te blijven draaien.

**Beeld en gedrag zijn gecontroleerd.** Twaalf combinaties zijn bekeken: onbeperkt, 60, 30 en 60 met 1× buffer, elk op 120 pixels breed/DPR1, 800 pixels breed/DPR1 en 320 pixels breed/DPR2. De bronafbeeldingen en hun eigenschappen zijn in alle proefvarianten identiek aan de 39 originele image-elementen. De gecontroleerde vaste houding heeft bij normale dichtheid exact dezelfde canvaspixels voor onbeperkt, 60 en 30. Bij dubbele dichtheid weken respectievelijk vier en twaalf kleurkanalen maximaal 1 op 255 af; de gemiddelde kanaalafwijking bleef onder 0,000003. Dit is een verwaarloosbaar renderafrondingsverschil, geen verdwenen onderdeel of andere houding. De canvaspixelinhoud verandert tijdens afspelen daadwerkelijk.

Pauzeren, opnieuw afspelen, een zichtbaarheidsstop vanuit de directe parent, hervatten, aanvankelijk ingeschakelde verminderde beweging, achteraf ingeschakelde verminderde beweging, twee onafhankelijk bestuurde kopieën, contextverlies met stilstaande terugval en een gewone `<img>`-weergave zijn gecontroleerd. Het bestaande gedrag bij uitschakelen van verminderde beweging blijft behouden: expliciet Play is nodig. Buffers blijven onder 4.096 per as en acht miljoen pixels. Zoomen in hetzelfde document behoudt de 39 uploads. De brede en smalle screenshots zijn visueel bekeken.

![Vier echte Nomads in dezelfde gevulde Workbench](nomad-animation-performance/filled-workbench.png)

![Vaste houding met de bestaande kledinglagen](nomad-animation-performance/nomad-wide.png)

Mijn voorgestelde vervolg is een kleine wijziging aan het artwork: 60 als eerste tekenlimiet, met de bestaande doekshader, vliegklok en 1,5× tekenresolutie. 30 kan een expliciete zuinige stand worden. Daarna is een afzonderlijke proef zinvol met brontexturen op een resolutie die bij de zichtbare maat past, terwijl de volledige bron voor vergroten/inspectie beschikbaar blijft. Dat moet de zwarte onderlagen, vaste kern, laagvolgorde en fijne lijnen behouden. Voor de navigatiehaperingen hoort een aparte hostproef de dichtheidsmetingen te beperken of te bundelen en het opnieuw initialiseren te meten. Geen van die vervolgstappen is hier stilzwijgend in de toepassing ingebouwd.

Er staan twee zelfstandig te openen proefkopieën onder `output/nomad-performance-study-2026-10-21`: `NOMAD-60fps-trial.svg` en `NOMAD-30fps-trial.svg`. Ze starten in Fly, behouden de oorspronkelijke bediening en bevatten geen meethooks of nieuwe instellingenintegratie. Beide geëxporteerde bestanden zijn ook zelf in Chrome geopend: 39 uploads, circa 60,34 respectievelijk 29,86 tekenbeurten/s, normale klok en werkende pauze. Ze zijn niet automatisch in een Workbench geïnstalleerd.

Van 247 aan het begin vastgelegde bestaande bestanden bleven er 245 bytegelijk. Alleen de twee gedeelde benchmarkbestanden zijn uitgebreid met de Nomad-proef. Het oorspronkelijke Nomad-bestand, de Keeperfixture, de Keeper-proef en alle andere vastgelegde wijzigingen bleven behouden. De nieuwe bestanden zijn meethelpers, rapportage, bewijs en proefkopieën; er is geen productiebron aangepast. Zie [de integriteitscontrole](nomad-animation-performance/preservation.json). De eerdere CSS-benchmark doorliep na de uitbreiding ook weer zijn volledige functionele controle. De specifieke Vite-benchmarkbuilds slaagden; er is geen nieuwe releasebuild of volledige releasesuite geclaimd.

Reproduceren vanuit de applicatiecheckout in PowerShell:

```powershell
$env:INSCAPE_PERF_SUITE = 'nomad'
$env:INSCAPE_PERF_CASE = ''
$env:INSCAPE_PERF_RUNS = '3'
$env:INSCAPE_PERF_OUTPUT = '.browser-test-runtime/nomad-study/benchmark'
node browser-tests/filled-workbench-performance.mjs
node browser-tests/summarize-nomad-study.mjs
node browser-tests/nomad-study-quality.mjs
node browser-tests/build-nomad-study.mjs
node browser-tests/nomad-study-export-check.mjs
```

De optionele navigatieprofilering gebruikt daarnaast `INSCAPE_PERF_DIAGNOSTIC=1`, `INSCAPE_PERF_CASE=nomad-4-60`, één run en een aparte uitvoermap. Voer geen andere zware browserproeven tegelijkertijd uit.

Bewijs: [alle 24 runs](nomad-animation-performance/results.json), [samenvatting](nomad-animation-performance/summary.json), [beeld- en levenscycluscontrole](nomad-animation-performance/quality.json), [exportcontrole](nomad-animation-performance/export-check.json), [navigatiegebeurtenissen](nomad-animation-performance/navigation.json), [navigatieprofiel](nomad-animation-performance/navigation.cpuprofile) en [regressiecontrole van de eerdere SVG-proef](nomad-animation-performance/previous-fixture-check.json).

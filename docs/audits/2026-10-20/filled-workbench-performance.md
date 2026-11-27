# Gevulde Workbench: lokale prestatieproef

20 oktober 2026. Makeropdracht: meerdere Workbenches behouden met één actieve;
het ruimtelijke overzicht uitstellen en eerst meten wat een goed gevuld canvas
werkelijk belast. Bestaande wijzigingen en Keeper-proef behouden. Geen commit,
push, upload of deployment.

**Resultaat:** één actieve Workbench is de juiste scheiding om te behouden.
Zichtbare animaties veroorzaken de grootste voortdurende belasting; extra
opgeslagen composities vergroten vooral de kosten van een kleine save
(4,9 naar 22,3 ms in deze proef). Zoomen/heropenen kent incidentele pieken.
Een aparte HTML-positiefout is vastgelegd. Er is nog niets geoptimaliseerd.

## Proefopstelling

De benchmark bouwt de bestaande eigenaar-editor met React/Vite in productiemodus
en bedient de echte modules, camera, editorlease, teksteditor, collectiestore en
browseropslag. Alleen de inhoud, lokale mediaserver en meetinstrumenten zijn
testcode. Geen ontwikkelmodusmetingen als productieclaim.

Vier situaties, elk drie keer in een nieuwe browsercontext:

| Situatie | Actieve inhoud | Opgeslagen Workbenches |
| --- | --- | --- |
| Klein, stilstaand | 4 afbeeldingen, 2 teksten, 4 vormen | 2: deze en een lege |
| Gevuld, stilstaand | 16 afbeeldingen, 12 teksten, 24 vormen, 2 HTML-werkjes | 2 |
| Gevuld, bewegend | Dezelfde inhoud; 4 SVG's en 2 HTML-werkjes bewegen | 2 |
| Gevuld, bewegend, meer opgeslagen | Dezelfde actieve inhoud | 8: zeven gevuld, één leeg |

Elk gevuld canvas is 4200 × 3200 eenheden. De twaalf teksten bevatten samen 144
paragrafen, ongeveer 95.000 tekens. De afbeeldingen gebruiken bestaande WebP's
en een bestaande SVG met acht ingebedde WebP-lagen; de proef voegt een
gecontroleerde animatie toe. De twee HTML-bestanden zijn eenvoudige, lokaal
bediende animatieproeven. Een gedeelde Keeper staat in zijn dock. Deze proef
test geen rondzwemmende Keeper of exploratiekamer; die bestaande proef is
ongewijzigd behouden.

Windows, Intel i5-12600KF, 16 logische processors, ongeveer 32 GiB RAM,
Chrome 155.0.8059.85, headless, venster 1440 × 1000, pixelverhouding 1.
De gemeten normale frameafstand ligt hier rond 7 ms. Dit is geen mobiele of
algemene hardwaregarantie. Media komen lokaal binnen; wallet, echte indexer,
IPFS/netwerkvertraging en publieke bezoekersroute zijn niet gemeten.

Per situatie: starten, rust op 100%, rust op 30%, zoomen en pannen, 24 tekens
typen met 65 ms tussen de toetsaanslagen, wisselen naar leeg en terug,
herladen, twaalf kleine store-opslagen zonder Undo-registratie, en ontkoppelen.
De actieve context gebruikt de echte browseropslag; iedere proefomgeving is
afzonderlijk. De persoonlijke opslag en de bestaande lokale appserver blijven
ongemoeid.

De startmeting eindigt zodra de wisselaar en eerste Text zichtbaar zijn; daarna
wacht de proef op media. Het is geen volledige startupmeting van de echte app.
Na inzoomen/uitzoomen worden vier geladen SVG's met elk acht beeldlagen
gecontroleerd. In de bewegende situatie moeten alle zes animaties aantoonbaar
uitgevoerd zijn.

## Wat de metingen wel en niet betekenen

Frameafstand en taken boven 50 ms komen uit de hoofdthread. Afzonderlijk wordt
de processortijd van alle rendererprocessen in deze geïsoleerde browser gemeten,
zodat de afgeschermde SVG/HTML-documenten niet buiten beeld blijven. Een gemeten
belasting van 100% betekent één volledig gebruikte CPU-kern, niet de hele pc.
De CPU-tijd van het GPU-proces is geen meting van de daadwerkelijke GPU-bezetting.

De tijd tussen een input-event en de volgende animatiecallback is een bruikbare
responsmaat, maar geen officiële INP-meting of gegarandeerd moment van zichtbare
pixels. De losse opslagproef meet alleen het store-pad zonder Undo; de
typproef omvat ook tekstbewerking, de echte opslag en UI-werk. De ruwe JS-heap
is opgenomen, maar bewijst niets over GPU-geheugen, gedecodeerde beelden of
langdurige geheugenlekken.

## Aangetroffen verantwoordelijkheden

De bestaande runtime monteert één actieve compositie. Een activatiewissel
ontkoppelt de oude moduleboom en maakt zijn schrijfhandle ongeldig. In de proef
blijven geen uitvoerbare SVG/HTML-frames van de gevulde compositie achter wanneer
de lege wordt geopend. Ontkoppelen van de hele editor verwijdert eveneens alle
onderliggende frames.

Bestaande zichtbaarheidbewaking beperkt uitvoerbaar artwork buiten beeld.
Bij 30% zoom zijn vier SVG-hosts en twee HTML-frames aanwezig; een SVG-host
bevat zelf nog een geïsoleerd document. Op 100% zijn minder SVG's zichtbaar.
Er wordt geen achtergrondcanvas voor de overige opgeslagen Workbenches
gemonteerd.

Opslaan is wel nog gekoppeld aan de hele collectie. De commit valideert de
actieve draft, valideert/projecteert vervolgens iedere opgeslagen Workbench,
maakt kopieën, serialiseert de verzameling en schrijft één browserrecord.
De CPU-profielen wijzen bij acht Workbenches onder meer naar
assertValidWorkbenchCollection, validateSystemWorkflowDraft, opschonen van
artwork-presentatie, kopiëren/vergelijking, encoding en setItem.
Alleen setItem uitstellen zou dus niet alle gemeten kosten wegnemen.

## Afzonderlijke bevinding: HTML-positie

De HTML-werkjes gebruiken MiniAppsWorkbench en geven hun WorkbenchWindow nog
geen viewId mee. Ze worden daardoor als schermvenster begrensd en volgen de
canvascamera niet zoals Image/Text/Shapes. In deze proef wordt een gezaaide
toppositie van 2450 bij wisselen opgeslagen als 523. Dit is reproduceerbaar;
het is geen verlies van de tekst of media-inhoud.

De benchmark legt beide posities expliciet vast. Hij controleert afzonderlijk
dat module-inhoud en inactieve composities behouden blijven, en dat herladen
het daadwerkelijk opgeslagen record exact behoudt. De verschuiving is niet
stilzwijgend als geslaagde layoutbehoudtest behandeld. Geen productfix aan
deze grens is in deze meetopdracht meegenomen.

## Bewijs en herhaling

Bronnen:

- [Proefrunner](../../../browser-tests/filled-workbench-performance.mjs)
- [Gevulde fixture](../../../browser-tests/filled-workbench-performance-fixture.jsx)
- [Ruwe resultaten](filled-workbench-performance/results.json)
- [Samengevatte meetwaarden](filled-workbench-performance/measurement-summary.json)
- [Uitvoer](filled-workbench-performance/benchmark.log)
- [Twaalf gerichte storetests](filled-workbench-performance/collection-tests.log)
- [CPU-profielen samengevat](filled-workbench-performance/profile-summary.json)
- [Gevuld canvas op 30%](filled-workbench-performance/filled-animated-2-30.png)
- [Gevuld canvas op 100%](filled-workbench-performance/filled-animated-2-100.png)

Herhalen vanuit de applicatiecheckout:

    node browser-tests/filled-workbench-performance.mjs

INSCAPE_PERF_RUNS, INSCAPE_PERF_CASE en INSCAPE_PERF_OUTPUT begrenzen de
herhalingen, situatie en uitvoermap. De standaarduitvoer staat onder
.browser-test-runtime en hoort niet bij de app. De benchmark sluit zijn eigen
browser en server. Er zijn geen nieuwe pakketafhankelijkheden.

## Werkstand

Alleen benchmarkbestanden en documentatie zijn voor deze opdracht toegevoegd
of bijgewerkt. Productcode, de bestaande ongecommitte wijzigingen en de
Keeper-proef zijn behouden. Branch codex/audit-checkpoint-2026-10-19,
basis-HEAD 32d9418843d996afc2e5203afa4552a6cd2d459a.
Geen commit, push of deployment. Externe CI op de basis-HEAD is geen bewijs
voor deze lokale proef of werkboom.

## Uitkomsten

Alle twaalf runs zijn voltooid: 84 meetfasen, geslaagde inhoud-/herlaadcontroles,
daadwerkelijk geladen/bewegende media, geen achtergebleven childframes en geen
page-errors of lokale HTTP-fouten. De twaalf gerichte collectiestoretests zijn
opnieuw geslaagd; de runner is ook op syntax gecontroleerd. De geïsoleerde
productiecompilatie is geslaagd. De volledige app-suite en reguliere
releasebuild zijn voor deze test-/documentatiewijziging niet opnieuw gedraaid.

De tabel toont medianen over de drie runs. Voor de losse save zijn alle 36
proefwrites per situatie samengenomen; bij de typerespons is het de mediaan
van de drie P95-waarden.

| Situatie | Renderer-CPU bij 30% zoom, in rust | Kleine save, mediaan | Typerespons, P95 |
| --- | ---: | ---: | ---: |
| Klein, stilstaand, 2 Workbenches | 2,8% van één kern | 1,1 ms | 5,8 ms |
| Gevuld, stilstaand, 2 | 3,5% | 3,7 ms | 9,8 ms |
| Gevuld, bewegend, 2 | 80,9% | 4,9 ms | 9,7 ms |
| Gevuld, bewegend, 8 | 87,7% | 22,3 ms | 28,9 ms |

Deze rustbelasting telt de rendererprocessen, inclusief de geïsoleerde
artwork-documenten. De eigen hoofdthread kost in de bewegende situaties
ongeveer 5–6% van één kern: alleen die bekijken zou veel activiteit missen.
De grote stijging ontstaat wanneer de zes zichtbare animaties gaan lopen.
De kleine afwijking tussen twee en acht Workbenches bewijst geen extra
achtergrondanimatie: de actieve inhoud en frames zijn gelijk; herhaalde
CPU-metingen variëren.

In de rustige meetfasen waren er geen hoofdthreadtaken boven 50 ms. Bij
zoomen/pannen van de gevulde compositie waren er wel korte uitschieters:
langste frameafstand 76,5 ms met twee Workbenches en 83,5 ms met acht.
Opnieuw openen van de gevulde compositie liep incidenteel op tot 104,3 ms
respectievelijk 201,6 ms. Dit zijn maxima, geen typische wisseltijden.
De gemeten fase omvat bovendien een vaste wachttijd; die faseduur is dus
niet de laadtijd van een wissel. Toewijzing van de navigatiepieken aan
layout, decodewerk of frameopbouw vraagt een gerichte vervolgtrace.

Na wisselen naar de lege compositie zijn er nul SVG/HTML-frames en zakt de
rendererbelasting in alle situaties naar ongeveer 3% van één kern.
Het actieve document bevat bij 30% ongeveer 2001 elementen met twee
Workbenches en 2007 met acht: alleen de extra selecteeropties komen erbij,
geen zes extra compositiebomen.

Het opgeslagen collectie-JSON groeit van ongeveer 146.000 naar 1.010.000
tekens. Een kleine save kost daarbij circa 4,6 keer zoveel. Alleen het
rechtstreeks schrijven naar browseropslag kost bij typen mediaan 0,1 versus
2,8 ms; de overige kosten zitten onder meer in de controle en verwerking
ervoor en erna. Dit bevestigt een opslaggrens die nog aan alle composities
is gekoppeld, ook al is het renderen correct tot één compositie beperkt.

## Concrete vervolgvolgorde

1. Meerdere Workbenches met één actieve behouden; het ruimtelijke overzicht
   blijft geparkeerd. Een allesomvattend canvas zou deze gemeten kosten niet
   automatisch oplossen.
2. Het save-pad onderzoeken en verkleinen: ongewijzigde composities niet bij
   iedere letter volledig opnieuw verwerken. Een eventuele verandering van
   opslagstructuur moet de atomische save, foutafhandeling, editorlease,
   herstel en scoped writes behouden. Geen los debounce-laagje dat al
   “opgeslagen” meldt voordat het werk veilig bewaard is.
3. De gevonden HTML-grens herstellen: authored canvaspositie en camera laten
   verlopen via dezelfde bestaande Workbench-geometrie als andere modules.
4. Daarna de navigatiepieken gericht profileren. Voor actief artwork moet het
   bestaande loslaten buiten beeld behouden blijven. Verdere limieten of
   kwaliteitsstappen pas kiezen op metingen met zwaardere echte bestanden
   en een minder krachtige machine.

Dit is een aanbeveling uit de proef, geen reeds uitgevoerde optimalisatie.

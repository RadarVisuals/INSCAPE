# Opslagpad en HTML-positie: lokale vervolgproef

21 oktober 2026. Expliciete makeropdracht: de twee bevindingen uit de
[vorige gevulde-Workbench-proef](../2026-10-20/filled-workbench-performance.md)
aanpakken en dezelfde inhoud opnieuw meten. Meerdere Workbenches, één actieve;
het ruimtelijke overzicht blijft uitgesteld. Bestaande wijzigingen en de
Keeper-proef behouden. Geen commit, push, upload, walletactie of deployment.

## Wat is veranderd

De collectiestore valideert een gewone bewerking eenmaal als actieve draft.
Reeds gevalideerde, bevroren inactieve composities blijven dezelfde objecten;
ze worden niet voor iedere toetsaanslag opnieuw geprojecteerd, gevalideerd en
gekopieerd. Dit gebruikt de bestaande onveranderlijke storetoestand en voegt
geen tweede gegevensbron of cache toe. Een wijziging aan gedeelde gegevens
valideert wel alle composities, inclusief hun afzonderlijke bytegrenzen.
Inladen, herstel, wisselen, aanmaken en hernoemen behouden hun volledige
collectievalidatie. Een nieuwe proef toont bijvoorbeeld dat een kleine actieve
Workbench geen gedeelde bio mag vergroten als een inactieve daardoor te groot
wordt.

Opslaan blijft één atomaire browseropslagbewerking: eerst valideren en vergelijken
met de laatst geaccepteerde bytes, dan werkelijk schrijven, pas daarna succes,
geschiedenis en meldingen aanpassen. Editorlease, generatiecontrole, detectie
van externe wijzigingen, Undo/Redo en herstel blijven actief. De volledige
collectie wordt nog steeds naar JSON omgezet en synchroon geschreven. Die
koppeling en de bijbehorende kosten zijn niet verdwenen. De UTF-8-collectiegrens
blijft gecontroleerd; de extra encoding wordt overgeslagen wanneer een veilige
bovengrens al past.

HTML-artwork gebruikt nu de bestaande canvasprojectie van WorkbenchWindow.
Zijn positie wordt niet meer naar het scherm begrensd. Het interne HTML-document
behoudt het authored formaat; de camera schaalt zijn pixels zonder de interne
pagina opnieuw te laten indelen. De zwevende bediening ligt over het artwork
en neemt geen hoogte van de afbeelding af. Gewone Mini Apps behouden hun
bestaande schermvensters. Het gedeelde owner/visitor-component is aangepast;
de gerichte geometrieproef gebruikt de ownerroute. Sandbox, walletscheiding en
zichtbaarheidsafhankelijke ontkoppeling zijn behouden.

## Herhaalde meting

De oorspronkelijke fixture is ongewijzigd: 16 afbeeldingen (waaronder vier
SVG's met ieder acht beeldlagen), twaalf teksten met samen 144 paragrafen,
24 vormen, twee HTML-werkjes, canvas 4200 × 3200 en gedeelde Keeper in dock.
Dezelfde vier situaties worden ieder driemaal uitgevoerd in een afzonderlijke
browsercontext: klein/stilstaand, gevuld/stilstaand, gevuld/bewegend met twee
en met acht opgeslagen Workbenches. De benchmark bouwt de echte eigenaar-editor
in productiemodus en gebruikt de echte browseropslag. De runner heeft alleen
extra controles gekregen: HTML-positiebehoud en, na de hieronder beschreven
diagnose, werkelijk uitgevoerde panbewegingen.

Zelfde machine en browser als de nulmeting: Windows, i5-12600KF, 16 logische
processors, circa 32 GiB, Chrome 155.0.8059.85, headless 1440 × 1000, DPR 1.
Geen gelijktijdige build of testsuite tijdens de meting. Persoonlijke browserdata
en de bestaande lokale appserver zijn niet gebruikt als testopslag.

Alle twaalf runs slagen. Per situatie is de opslagmediaan berekend over de
36 kleine storebewerkingen; de typmaat is de mediaan van drie P95-metingen.

| Situatie | Opslag vóór | Opslag na | Typen: input tot callback P95 vóór | Na |
| --- | ---: | ---: | ---: | ---: |
| Klein, stilstaand, 2 Workbenches | 1,1 ms | 0,4 ms | 5,8 ms | 6,0 ms |
| Gevuld, stilstaand, 2 | 3,7 ms | 2,3 ms | 9,8 ms | 7,0 ms |
| Gevuld, bewegend, 2 | 4,9 ms | 2,3 ms | 9,7 ms | 7,9 ms |
| Gevuld, bewegend, 8 | 22,3 ms | 6,8 ms | 28,9 ms | 12,7 ms |

Bij acht Workbenches daalt deze opslagbewerking circa 70%. De drie afzonderlijke
opslagmedianen zijn 7,1 / 6,7 / 6,7 ms; de typ-P95 is 12,7 / 12,4 / 13,1 ms.
De volledige opslag blijft circa 1,01 miljoen tekens, tegenover circa 146.000
bij twee Workbenches. Alleen de browserwrite tijdens typen kost nog mediaan
2,8 ms bij acht, tegenover 0,1 ms bij twee. De wijziging verwijdert dus vooral
herhaald validatie- en kopieerwerk; ze maakt de collectieopslag niet constant.

Zichtbare animaties blijven de grootste voortdurende belasting: op 30% ongeveer
74–80% van één CPU-kern voor de renderers, tegenover circa 3% bij de stilstaande
gevulde compositie. Wisselen naar leeg laat in alle runs nul uitvoerbare
artwork-frames achter; de rendererbelasting ligt daar rond 2% van één kern.
Ontkoppelen verwijdert eveneens alle childframes. HTML houdt in alle gevulde
runs zijn authored top van 2450, ook na wisselen en herladen; voorheen werd
523 opgeslagen.

### Belangrijke correctie bij de navigatievergelijking

De gecombineerde zoom/pan-P95 ligt nu rond 27,8 ms voor gevuld/bewegend, met
een grootste frameafstand van 69,5 ms. De oude gecombineerde P95 was 7,1 ms
bij twee en 13,9 ms bij acht. Die waarden zijn **niet rechtstreeks vergelijkbaar**:
de oorspronkelijke sleepbeweging startte op (1300, 700), binnen het verkeerd
geplaatste tweede HTML-frame. Dat iframe ving de invoer op; er werd niet op
dezelfde manier gepand. De oude screenshot toont die overlap en de oude
eindmetingen behouden alle zes hosts, waar de nieuwe pan ze uit beeld brengt.

Een afzonderlijke controle op dezelfde productiebuild reproduceert alleen
die oude schermrechthoek in de geïsoleerde testpagina. Dezelfde sleepbeweging
raakt dan het iframe en houdt camera-offset (0, 0). Met de gecorrigeerde positie
raakt zij het canvas en eindigt rond (-457, -229). Dit is bewijs voor het
invoerverschil, geen volledige isolatie van elke prestatiefactor. De runner
controleert voortaan expliciet dat de camera werkelijk is verplaatst; deze
extra controle is apart herhaald met de gevulde bewegende collectie van acht.

De actuele navigatiepieken blijven een meetpunt voor vervolgwerk. De grootste
wisselpiek in de twaalf vergelijkingsruns is 34,8 ms bij bewegend/twee en
48,7 ms bij bewegend/acht; stilstaand/twee had een uitschieter van 90,4 ms.
De aanvullende pancontrole had bij heropenen een piek van 104,2 ms. Dit is
geen garantie dat wisselen of zoomen altijd onder een framebudget blijft.

Een verschil in zichtbare inhoud is onderdeel van de correctie: op 100% staan
de HTML-werkjes nu terecht buiten beeld; op 30% zijn alle zes bewegende
documenten aanwezig en aantoonbaar actief. HTML neemt daar de juiste geschaalde
ruimte in. Een verschil in animatiebelasting kan dus niet uitsluitend aan het
opslagpad worden toegeschreven. De losse storeproef meet zonder Undo; typen
omvat daarnaast editor-, geschiedenis- en UI-werk.

CPU-percentages betreffen rendererprocessen, uitgedrukt als percentage van één
kern. Input tot de volgende animation callback is geen officiële INP of garantie
van zichtbare pixels. Incidentele framepieken zijn maxima, geen typische
reactietijd. De proef meet geen mobiele hardware, publieke bezoekersroute,
wallet/netwerkvertraging, GPU-bezetting of langdurige geheugenlekken.

## Gedrag en controles

- HTML start op canvaspositie (480, 2450), met formaat 400 × 300. Zoom en pan
  veranderen die opgeslagen waarden niet. Verplaatsen en vergroten via het
  toetsenbord blijven na wisselen en herladen behouden. Het HTML-document
  blijft bij 30% intern 400 × 300 en vult de correcte geprojecteerde rechthoek.
  Screenshots op 1440, 700 en 390 pixels zijn vastgelegd; breed en smal visueel
  gecontroleerd. De smalle cameraweergave is geen ontwerpgoedkeuring voor
  mobiel authoren.
- De drie nieuwe storetests dekken mislukte opslag/ongeldige input zonder
  gedeeltelijke wijziging, losgekoppelde invoer, behoud van inactieve inhoud,
  Undo/Redo/herladen, gedeelde wijzigingen naast een volle compositie en
  extern gewijzigde/corrupte collecties bij herstel. Vijftien collectietests
  slagen; de volledige Node-suite slaagt met 1287 tests.
- De laatste gerichte browserresultaten tellen 22 geslaagde tests: HTML-geometrie
  (1), gewone Mini Apps (1), lokale Workbenches (2), opslag (6), herstel (1),
  Text-herstel/positie (8) en Keeper-exploratie (3).
- Eén tussentijdse herhaling van de bestaande Mini App-proef liep vast op
  wachten op de nep-microfoon. Een eerdere en de laatste herhaling slagen;
  de laatste is zonder aanpassing van die proef uitgevoerd. Die intermitterende
  testuitkomst is geen bewezen HTML-regressie, maar wordt wel bewaard.
- Na de laatste HTML/CSS-correctie: geometrie en Mini Apps opnieuw groen,
  ontwerpinventaris bijgewerkt en gecontroleerd, tien gerichte ontwerptests
  groen, productiebuild en budgetcontrole groen (822007 initiële JS-bytes).
  De volledige Node-suite was eerder in deze beurt groen; de latere wijziging
  betrof alleen HTML-rendering/CSS en is met deze gerichte checks gecontroleerd.

## Bewijs en status

Bewijsbestanden staan in [storage-html-performance](storage-html-performance/):
[ruwe benchmarkresultaten](storage-html-performance/results.json),
[samenvatting](storage-html-performance/measurement-summary.json),
[voor/na](storage-html-performance/comparison.json), vier CPU-profielen,
[invoerdiagnose](storage-html-performance/navigation-hit-proof.json),
[browserchecks](storage-html-performance/browser-results.json), screenshots,
testlogs en buildlogs. De meetwaarden van 20 oktober zijn behouden.
Een [hashvergelijking](storage-html-performance/preservation.json) van 135 reeds
gewijzigde/nieuwe bestanden bevestigt dat 129 byte-identiek behouden zijn,
inclusief de Keeper-proef, de oorspronkelijke fixture en de oude meetresultaten.
De zes gewijzigde bestanden uit die set zijn uitsluitend de bedoelde store,
collectietests, meetrunner, browserrunner, ontwerpinventaris en actief contract.
De actuele branch blijft codex/audit-checkpoint-2026-10-19, op basiscommit
32d9418843d996afc2e5203afa4552a6cd2d459a, met lokale wijzigingen.

De externe [Verify Inscape #34](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131)
is opnieuw alleen-lezen gecontroleerd en geslaagd voor die basiscommit.
Dat is geen CI- of deploymentbewijs voor deze ongecommitteerde werkboom.
Er is niets gecommit, gepusht of gedeployd.

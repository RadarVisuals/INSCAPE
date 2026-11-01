# Layers, Transform en Color: verplaatsbare docks

Lokale implementatie op 21 oktober 2026, in
`remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. De wijzigingen zijn
ongecommitteerd; bestaande wijzigingen in deze checkout zijn behouden.
Er is geen deployment of externe CI-run voor deze lokale staat uitgevoerd.

## Gedrag en afbakening

Layers, Transform en Color beginnen op een breed scherm samen in één dock.
Iedere tab kan naar buiten worden gesleept als zelfstandig venster. Laat een
tab los op de tabstrook van een ander venster om hem daar te plaatsen; de
positie in de strook bepaalt de volgorde. De lege ruimte naast de tabs
verplaatst het hele dock. Ook een volledig dock kan op een andere tabstrook
worden samengevoegd.

De bestaande onzichtbare randen blijven werken voor vergroten en verkleinen.
Sluiten verbergt alleen de actieve tab; heropenen via Layers of Actions brengt
de tab terug in zijn bestaande dock. Rechtsklikken of Shift+F10 op een tab
opent de equivalente plaatsingsacties. Pijltjes/Home/End bedienen de tabs;
de bestaande toetsenbordbediening voor verplaatsen en resizen blijft behouden.
Escape, focusverlies en viewportwijzigingen breken een lopende sleep af.

De indeling bestaat alleen tijdens de huidige editorsessie. Herladen begint
weer met de standaardindeling. Op zeer smalle schermen starten de tools
gesloten volgens het bestaande beleid. Er is geen opgeslagen workspace-layout
toegevoegd. Een dockbewerking verandert geen artwork, selectie, compositie,
publicatie of Undo-geschiedenis.

Er is geen rotatieveld toegevoegd. Rotate en beide Mirror-acties blijven in
de Image-toolbar naast Crop, overeenkomstig de eerdere correctie. Images
hebben geen Color-instellingen. De inhoudelijke Transform- en Color-acties
blijven die van de bestaande modules.

## Verantwoordelijkheden

`workbenchToolDockState.js` bezit de tijdelijke indeling: groepslidmaatschap,
actieve tab, verborgen tabs, positie en afmeting. De oude losse Layers- en
vaste Transform/Color-vensterstatus is vervangen. De Owner-runtime leest
alleen de afgeleide zichtbaarheid van Layers voor zijn bestaande bediening;
pointerpositie-updates worden door de docks zelf gelezen.

`WorkbenchToolDocks.jsx` verbindt de drie bestaande toolinhouden met die
indeling. Iedere inhoud heeft één vaste portalcontainer die tussen docks
verplaatst wordt. `WorkbenchToolPanel.jsx` blijft de gedeelde eigenaar van
vensterbegrenzing, verplaatsen, onzichtbaar resizen en afbreken. Layers behoudt
zijn laagacties en verwijderbevestiging; Transform gebruikt de bestaande
geometriedoelen; Color gebruikt de bestaande modulebron en teksteditor.
Canvas-Delete kan ook een inactieve Layers-tab openen en de bevestiging focus
geven, nadat de inhoud zichtbaar is geworden.

Dit vervangt de vaste koppeling van Transform/Color, zonder een tweede editor
of kopie van de artworkdata te introduceren. De inhoud blijft gekoppeld aan de
bestaande Workbench-selectie en modulebronnen. Er is geen algemene
performanceclaim gemeten en geen generiek panelsysteem voor andere modules
gebouwd.

## Verificatie

De bewijsbestanden staan in [tool-docking/](tool-docking/).

- `npm test`: 1301 geslaagd, inclusief drie nieuwe indelingstests.
- Designsysteem: 10 controles geslaagd; inventaris opnieuw gegenereerd.
- Productiebuild met `npm run build -- --configLoader native` en
  `npm run build:check`: geslaagd. De native configuratielader vermijdt het
  lokale Windows-sandboxpadprobleem bij gebundelde Vite-configuratie.
- Browsercontrole gebruikt geïsoleerde testdata en de bestaande lokale server
  op poort 24970. Geen echte composities, walletacties of uploads gebruikt.
- Laatste gecombineerde browserrun: 16/16 geslaagd (Layers 7, gedeelde tools 3,
  docking 2, Text-artikeltools 3 en Image-fit 1); `acceptance-final.log`.

De gerichte browsercontrole omvat losmaken, tabvolgorde, samenvoegen van tabs
en hele docks, verplaatsen, afbreken, sluiten en terughalen, onzichtbaar
resizen aan alle kanten, viewportgrenzen, scrollbare inhoud en opruimen tijdens
een sleep. Ook gecontroleerd: tekstselectie behouden bij toetsenborddocking,
Color en Undo, Image zonder Color, bestaande Image-toolbaracties,
Canvas-Delete met focusherstel, opslagfouten, Text-herstel en Image-fit.

Een eerdere gecombineerde run gebruikte voor vier Image/Text-gevallen de
verkeerde standaardpoort; deze faalden al bij het laden van de fixture. De
vervolgrun met alle oorsprongen op 24970 slaagde 6/6. Eén voorafgaande
tekstselectierun gaf nog ongewijzigde tekst terug. Vier diagnostische herhalingen
met tussencontroles slaagden; de test wacht nu expliciet op de zichtbare
toestand `Selected text` vóór docking en controleert die toestand opnieuw na
losmaken. De daaropvolgende gecombineerde run slaagt eveneens. Er is voor
dit incidentele resultaat geen aparte fout in de productcode aangetoond.

Dit is gerichte browserdekking, geen volledige browser- of releasecertificatie.
De beperkingen van de eerdere brede moduletests blijven beschreven in
[shared-transform-color.md](shared-transform-color.md).

## Buildomvang

De laatste build meet 822.889 bytes initiële JavaScript (239.430 gzip) en
2.472.938 bytes core-JavaScript (791.701 gzip). Voor de nieuwe dockingbediening
is uitsluitend het core-gzipplafond verhoogd van 791.000 naar 793.000 bytes.
Het raw-plafond blijft 2.480.000; de initiële, owner- en walletplafonds zijn
ongewijzigd. De eerste dockingbuild overschreed het oude gzipplafond met
592 bytes. Dit is een expliciete featurebudgetwijziging.

## Visuele controle

Carbon en Mist zijn bekeken bij 1440 × 1000 en het compacte dock bij
760 × 540. De tabs gebruiken de bestaande kleuren, lijngewichten en
typografie. Een pointeractie laat geen toetsenbordkader om de tab achter.
Toetsenbordfocus blijft zichtbaar op de werkelijk gefocuste bediening.
Een laag dock houdt zijn inhoud binnen het venster; de onderste Color-velden
blijven bereikbaar door binnen het dock te scrollen.

![Drie zelfstandige vensters in Carbon](tool-docking/three-independent-carbon.png)
![De drie tabs samen in Mist](tool-docking/docked-mist-wide.png)
![Een compact dock met scrollbare inhoud](tool-docking/docked-carbon-narrow.png)

## Vervolg: focusmarkering in Color

De founder keurde het dockgedrag goed en vroeg om de focusrand bij muisklikken
en slepen in de kleurkiezer te verwijderen. Saturation/Lightness blijven op
zijn laatste expliciete verzoek staan. `Use inherited color` blijft dezelfde
tekststijl-reset; de werking is uitgelegd, niet veranderd.

Gereproduceerd: programmatische SVG-focus erft `:focus-visible` van een eerder
actief tekstveld en kan de kleurkiezer ook tijdens een muisgesture omlijnen.
De gedeelde kleurkiezer onthoudt nu alleen voor focusweergave dat de interactie
met de pointer begon. Navigatietoetsen herstellen de toetsenbordmarkering;
focus verlaten maakt de tijdelijke markering ongeldig. De SVG-doelen gebruiken
geen eigen browseroutline. Focus blijft behouden voor Escape en pijltoetsen.
Deze wijziging raakt zowel de app als het designsysteem, zonder wijzigingen
aan kleurwaarden, opslag, dockindeling of moduleverantwoordelijkheden.

Een nieuwe browserregressie faalde vóór de correctie en slaagt erna, inclusief
de overgang van toetsenbord naar muis op hetzelfde doel, Escape, toetsenbord
en hoog-contrastweergave. De gecombineerde gerichte browserrun slaagt 9/9:
focus 1, designsysteemkleur 3, gedeelde tools 3 en docking 2. De 10
designsysteemcontroles, native-configuratiebuild en buildbudgetcontrole slagen.
De volledige unitsuite is voor deze beperkte focuscorrectie niet herhaald.
De eerdere volledige run hierboven is geen nieuw resultaat van deze wijziging.

Carbon en Mist zijn bekeken op 760 en 1440 pixels breed. Beelden en actuele
logs staan in [colour-focus/](colour-focus/). Branch en HEAD blijven die bovenaan
dit verslag; de correctie is alleen lokaal en ongecommitteerd. Geen externe
CI of deployment gestart.

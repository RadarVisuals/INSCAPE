# Gedeelde Transform- en Color-tabs

Datum: 21 oktober 2026. Lokaal geïmplementeerd, niet gecommit of uitgerold.
Checkout: `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`.
Deze werkmap bevat ook eerder gemaakte, ongecommitteerde wijzigingen; dit
verslag beschrijft alleen de gedeelde tools en de bijbehorende controles.

## Gedrag en afbakening

- Transform en Color zitten samen in dezelfde platte Carbon/Mist-vensterbouw
  als Layers. Het venster is verplaatsbaar en heeft onzichtbare resize-randen
  en hoeken. Toetsenbordbediening blijft beschikbaar.
- Transform toont X/Y en breedte/hoogte van één geselecteerd onderdeel. De
  rotatie- en spiegelacties blijven op verzoek in de Image-toolbar. Waarden zijn
  canvascoördinaten en veranderen niet door camerazoom.
- Color gebruikt de bestaande ring en driehoek uit het designsysteem. Shape
  heeft kleur en dekking. Text heeft expliciete doelen voor geselecteerde
  woorden/cursor, standaardtekst, titel, achtergrond en tekststijlen. Image
  heeft geen Color-instellingen.
- De gekozen tab blijft staan bij een andere selectie. Geen selectie, meerdere
  onderdelen, gesloten onderdelen en niet-toepasselijke tools hebben eigen
  toestanden. Gesloten artwork kan vanuit het venster heropend worden.
- Een gesloten venster kan via Actions (Ctrl+K), Transform of Color weer open.
- Een kleurgebaar geeft een tijdelijke preview en schrijft pas bij afronding
  één bewerking. Escape, selectie/contextwisseling of sluiten annuleert die
  preview. Text behoudt zijn bereik/cursor en bestaande typegeschiedenis.

Docking, tabs losmaken/samenvoegen en verdere migratie van Image-, Shape- en
Text-tools zijn niet uitgevoerd. De overige oude Properties/Text-vensters
blijven bestaan. Image Fit/Fill/Crop blijft op zijn bestaande plek. Dit is geen
volledige mobiele authoring- of release-acceptatie.

## Eigenaarschap en vereenvoudiging

De productiecode in `src/colour/` is nu de gedeelde implementatie van de
kleurbediening; de designsysteemreferentie importeert diezelfde componenten.
Er is geen tweede kleurkiezer of nieuwe dependency toegevoegd.

Workbench bezit selectie, vensterhosting en de bestaande geometriecommando's.
Modules registreren hun eigen toolinhoud en blijven eigenaar van validatie,
opslag, foutafhandeling en geschiedenis. De registratie gebruikt aparte
notificaties voor toolinhoud zodat een kleurpreview geen nieuwe canvasgeometrie
hoeft op te vragen. Dit is een verantwoordelijkheidsgrens, geen gemeten
prestatieclaim.

De vervangen Shape/Image-afmetingsformulieren en kleurvelden uit de eigenaar-
Text-tools zijn verwijderd. Geïsoleerde Text/Display-toepassingen behouden hun
bestaande bediening. Tijdelijke previews zijn aan hun oorspronkelijke module
en versie gebonden. Een mislukte Text-opslag blokkeert kleurwijzigingen en biedt
herstel, in plaats van een geslaagde opslag te suggereren.

## Gecontroleerd bij de eerste implementatie

De browsercontroles gebruikten de bestaande lokale server op poort 24970 met
geïsoleerde testgegevens. Er zijn geen persoonlijke composities aangepast.
Bewijsbestanden staan in [de bewijsmap](shared-transform-color/).

| Controle | Resultaat | Bewijs |
| --- | --- | --- |
| Volledige unit-suite | 1298/1298 geslaagd | `unit-final.log` |
| Designsysteemcontroles | 10/10 geslaagd | `design-system-final.log` |
| Nieuwe gedeelde tools + bestaande Layers | 10/10 geslaagd in laatste run | `acceptance.log` |
| Referentiekleurkiezer, referentieworkspace en Layers | 20/20 geslaagd | `regression.log` |
| Gemigreerde Text article/parity/typography-controles | Alle 10 Text-gevallen geslaagd; dezelfde run had 1 oude Shape-volgordeassertie die daarna is aangepast | `migration-final.log` |
| Shape na aanpassing volgordeassertie | Geslaagd | `final-tools.log` |
| Productiebuild en budgetcontrole | Geslaagd | `build-final.log`, `build-check.log` |

De nieuwe acceptatie omvat selectie, geometrie-undo, één opslag per kleurgebaar,
annulering, wisselen naar Image, gemengde tekstkleuren, cursor/woordbereik,
typegeschiedenis, titel/achtergrond/stijlen, heropenen, opslagfout en retry,
Image-rotatie, zoomonafhankelijke maten en reload. Carbon en Mist zijn bekeken
op brede en smalle vensters. Op de smalle weergave scrollt de inhoud binnen het
kleiner gemaakte venster; het actieve venster komt voor Layers.

Eén tussentijdse run had een timeout bij synthetisch wisselen van selectie
tijdens een ingedrukte pointer. Een gerichte herhaling en de volledige laatste
acceptatierun slaagden. De retarget/annuleringsassertie is behouden; hiermee is
geen langdurige flakevrijheid aangetoond.

## Brede browsercontrole: resterende beperkingen

Een aanvullende modulecontrole eindigde op 5/13 geslaagd, 8 mislukt
(`module-migration.log`). Er is geen vergelijking met een schone baseline
uitgevoerd; deze fouten worden daarom niet als bewezen bestaande fouten
geclassificeerd.

- Image-module en twee Image-drop-gevallen wachten op een oude Library-knop
  voordat ze de gemigreerde velden bereiken. De huidige ingang zit onder Add.
- Twee Image-resize-gevallen veronderstellen dat een tweede afbeelding vrij
  aan te klikken is of dat al haar canvasgrepen in het smalle viewport passen.
  Dat botst in deze fixtures met de aanwezige vensters/canvasafmetingen.
- Eén Text-tools-resize-geval loopt vast bij de bestaande multi-Text-bediening.
- Twee Text-transfer-gevallen hebben in hun oude directe Runtime-fixture al
  verloren schrijftoegang en onopgeslagen tekst voordat ze Color gebruiken.
  Color blijft in die toestand terecht uitgeschakeld. De huidige
  reconciliation/editor-lease-fixture is hier nog niet overgenomen.

Deze bredere controles zijn dus niet groen. De gerichte acceptatie bewijst de
hierboven genoemde workflows, niet de volledige Image/Text/Display-regressie.
Er is geen productie- of externe CI-resultaat voor deze ongecommitteerde staat.
De bestaande verificatieworkflow is alleen geïnspecteerd, niet extern gestart.

## Buildomvang bij de eerste implementatie

De laatste build meet 822.889 bytes initiële JavaScript (239.428 gzip), gelijk
aan de eerder gemeten initiële route. De totale core-JavaScript meet 2.464.750
bytes (789.169 gzip). Het core-gzipplafond is voor de gedeelde tools aangepast
van 786.000 naar 791.000 bytes; het raw-plafond blijft 2.480.000. De initiële,
owner- en walletplafonds zijn niet verhoogd. De budgetcontrole slaagt met deze
expliciete aanpassing; dit is geen algemene snelheidsprestatieclaim.

Op deze Windows-omgeving is de build uitgevoerd met
`npm run build -- --configLoader native`, gevolgd door `npm run build:check`.
De native configuratielader omzeilt het lokale sandboxpadprobleem bij het
bundelen van de Vite-configuratie.

## Correctie op plaatsing (21 oktober)

De eerste implementatie verplaatste Rotate en beide Mirror-acties naar
Transform op basis van een aanname van de assistent. De founder heeft dat
afgewezen: de drie knoppen zijn teruggezet in de bestaande Image-toolbar naast
Crop. De gedeelde Transform-tab bevat alleen de afgesproken geometrievelden.
De module-eigen callbacks, opslag en foutafhandeling zijn behouden; de nu
ongebruikte uitbreiding voor extra Transform-controls is verwijderd.

Na de correctie slagen de drie gedeelde-tools-browsergevallen, inclusief
daadwerkelijk draaien en beide spiegelingen via de toolbar en de opgeslagen
uitkomst. Een extra gerichte run controleert ook bereikbaarheid van deze
knoppen en Crop bij 760 × 620. De tien designsysteemcontroles, productiebuild
en budgetcontrole slagen eveneens. Zie `toolbar-correction*.log` in de
bewijsmap. Er is geen nieuwe volledige unit- of brede browserrun uitgevoerd.

![Gecorrigeerde plaatsing: Image-acties in de toolbar](shared-transform-color/toolbar-correction-carbon.png)
![Image-toolbar op een smal venster](shared-transform-color/image-toolbar-narrow.png)

## Beelden van de eerste implementatie

Deze beelden dateren van vóór de correctie hierboven; de drie Image-acties
staan inmiddels weer in de toolbar.

![Transform in Carbon](shared-transform-color/transform-carbon.png)
![Color voor Shape in Carbon](shared-transform-color/color-carbon.png)
![Color voor Text in Mist](shared-transform-color/color-text-mist.png)
![Color in een smal, laag venster met scrollbare inhoud](shared-transform-color/color-text-narrow.png)

# Editor hardening — 6 september 2026

Technisch werkverslag na gebruikersopdracht tot versteviging en cleanup.
Geen nieuwe productautoriteit; actief contract en creative intent blijven leidend.

## Opslag

`systemWorkflowDraftStore.js` vergelijkt vóór schrijven en vóór bevestigd herstel
de actuele opgeslagen bytes met de laatst geaccepteerde bytes. De eerdere
generation-controle beschermde uitsluitend wijzigingen binnen dezelfde store.
Een andere editor kon intussen nieuw werk opslaan dat alsnog overschreven werd.
Ook een oude herstelbevestiging kon een inmiddels vervangen record verwijderen.

Bij conflict, een verwijderde record of een leesfout blijft de opgeslagen inhoud
ongemoeid. De geaccepteerde draft en generation schuiven niet door. Herladen
maakt voortwerken op de actuele opgeslagen versie mogelijk. Een mislukte
sessiecommit meldt nu dat opslaan niet lukte en dat opslag of een gewijzigde
draft de oorzaak kan zijn.

Dit is detectie van reeds zichtbare externe wijzigingen. localStorage biedt
geen atomische compare-and-swap: exact gelijktijdige schrijvers zijn hiermee
niet volledig geserialiseerd. Geen nieuwe samenwerking-, merge- of schemafunctie.

## Controller

`useOwnerSystemWorkflowController.js` koppelt foutmeldingen aan de actuele
store/sessie en selectie aan die sessie plus de actieve Grid. Selectie wordt
beperkt tot bestaande, zichtbare plaatsingen. Hiervoor wordt één Set gemaakt
in plaats van herhaald door de volledige plaatsingslijst te zoeken.

Oude operatiecallbacks mogen na een profielwissel of unmount niet meer schrijven.
Oude selectiecallbacks mogen de selectie van een nieuw geopende Grid niet wissen.
De bestaande gedeelde selectie tussen Stage en Layers blijft behouden.

## Afbeeldingsladen

`ownerSystemWorkflowAssetDimensions.js` scheidt één afbeeldingsdecode van de
fallback-volgorde en caching. Synchrone fouten bij aanmaken, bron instellen of
decode starten leveren een mislukte poging op in plaats van een permanent
afgewezen cache-entry. Timers en handlers worden opgeruimd; mislukte bronnen
blijven opnieuw probeerbaar. Gelijktijdige aanvragen delen een cached poging.

De cache bewaart maximaal 256 bronnen en vernieuwt de positie bij hergebruik.
Bij meer gelijktijdige bronnen kan een verwijderde lopende aanvraag opnieuw
gestart worden; dit is geen netwerkconcurrentielimiet. De cache bevat afmetingen
en promises, geen garantie over het totale afbeeldingsgeheugen van de browser.

## Verificatie

- Volledige `npm test`: 742 geslaagd, nul fouten.
- Vijf expliciete Edge-browsertests geslaagd: controller-isolatie,
  Library-plaatsing/selectie/herladen/Preview, shortcut-drop, annulering en
  tijdelijke laagzichtbaarheid. Bestaande viewportvarianten blijven getest.
- `npm run build` en `npm run build:check` geslaagd met ongewijzigde budgetten.
- De formatteringsgevoelige source-regex voor foutafhandeling is vervangen
  door een gemounte controller-gedragstest. De bestaande architectuurcontrole
  voor de geïsoleerde draft-store blijft behouden.

Testuitvoer staat lokaal in `.browser-test-runtime/hardening-tests-final.log`
en `.browser-test-runtime/hardening-build.log`.

Geen visueel herontwerp, nieuwe Layers-features, schemawijziging, upload,
walletactie of deployment. De tests gebruiken eigen fixtures en opslag;
de bestaande browsersessie en compositie van de gebruiker zijn niet aangepast.

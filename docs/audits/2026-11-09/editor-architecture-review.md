# Beoordeling van de huidige Inscape-editor

9 november 2026. Op verzoek van de founder: beoordelen hoe goed de eigen editor in elkaar zit, in het kader van de afweging tussen maatwerk en bestaande editorbouwstenen. Dit is een architectuur- en codereview, geen releasegoedkeuring, nieuwe productrichting of volledige bug-/securityaudit.

## Oordeel

De editor heeft een serieus opslag- en bewerkingsfundament, met betekenisvolle bescherming tegen mislukte saves, verouderde bewerkingen en verkeerde documentscopes. De interactie- en presentatielaag is minder samenhangend: verschillende bewegingsroutes, verschillende betekenissen van opgeslagen geometrie en omvangrijke coördinatie tussen modules maken uitbreidingen en regressiecontrole lastig.

Behoud en vereenvoudiging van deze basis is verdedigbaar. Een volledige vervanging is op basis van deze review niet onderbouwd. De sterkste aanleiding voor hergebruik ligt bij algemene objectbediening en UI-infrastructuur. De review bewijst niet dat een bepaalde library die functies goedkoper kan vervangen; daarvoor ontbreekt een geïntegreerde vergelijking.

## Bron en methode

- Applicatiecheckout: `remediation-2026-10-19-shared-checkpoint/work`.
- Branch: `codex/profile-work-index-2026-10-30`.
- HEAD: `08b4a7b871084780bafc89ad08404ca901e61f17`; het beoordeelde product is de gewijzigde lokale werkboom, niet alleen deze commit.
- Bij controle waren 182 bestaande bronbestanden onder `src` gewijzigd ten opzichte van HEAD; daarnaast zijn er nieuwe, ongetrackte bestanden. Bestaande wijzigingen zijn niet aangepast.
- Gelezen: actuele projectinstructies en relevante contractsecties, creatieve intentie, actuele bron en tests, en relevante recente auditbewijzen.
- Nagegaan: documentopslag en history; native en gezamenlijke beweging; moduleframes en layoutopslag; Reception-scope; selectie, inspector en centrale hosts; typecheckconfiguratie en browserresultaten.
- De 1.391 opgenomen bron-, test-, script-, package- en typecheckbestanden zijn byte voor byte gehasht tegen `cleanup-2026-11-09/delivery-source-manifest.json`: geen verschillen. De browser-baseline verschilt uitsluitend in drie inmiddels aangepaste browsertestbestanden; de retest uitsluitend in de latere cameratest. De productiebron komt overeen.
- De huidige GitHub-connector gaf voor HEAD geen commit-statussen en geen PR-getriggerde workflowruns terug. Die laatste endpoint beperkt zich tot PR-runs. Dit bewijst niet dat er nergens andere CI-runs bestaan, en levert geen goedkeuring voor de lokale wijzigingen of een deployment op.
- Geen nieuwe tests, builds of typecheck gestart. Het actieve contract vermeldt nog een pauze; de vraag om gerichte tests te hervatten had bij afronding geen antwoord. Bestaande resultaten zijn daarom als eerder uitgevoerd bewijs gebruikt, met bovenstaande broncontrole.
- Geen appcode gewijzigd, dependencies geïnstalleerd, gebruikerdata gewijzigd, commit/push of deployment uitgevoerd. Alleen dit rapport is toegevoegd. De beschermde handoff en de afzonderlijke E:-checkout zijn niet gebruikt.

## 1. Hoge onderhoudsprioriteit: beweging heeft geen uniforme opslagbetekenis

**Vastgestelde code-eigenschap.** [workbenchMoveOperation.js](../../../src/public/ownerSystemWorkflow/workbenchMoveOperation.js) kiest bij de eigenaar tussen `authored` en `presentation` op basis van onder andere Image-lidmaatschap, compositieblokken en Workbench-groepen. Een gewone selectie van losse Shapes kan alleen de lokale presentatie bijwerken; een Image of groep schrijft een documentbewerking met history. [workbenchMoveOperation.test.js](../../../src/public/ownerSystemWorkflow/workbenchMoveOperation.test.js) legt dit verschil expliciet vast. Het is dus geen veronderstelde bug die uitsluitend uit een ontbrekende test volgt.

Reception heeft voor zijn native inhoud altijd de documentroute nodig. In [WorkbenchView.jsx](../../../src/public/ownerSystemWorkflow/WorkbenchView.jsx), rond regels 623–636, wordt hiervoor tijdelijk een `reception:selection`-groep aan de operatie-input toegevoegd. Die groep wordt terecht niet opgeslagen. Zij is een concrete aanwijzing dat het algemene bewegingsmodel zijn opslagbeleid afleidt uit het soort selectie, terwijl de host eigenlijk expliciet moet aangeven welke bewerking dit is.

**Gevolg.** Dezelfde zichtbare handeling vereist kennis van module, groep, host, presentatie en history. Dat vergroot de kans op onbedoelde verschillen en maakt vervanging van objectbediening ingewikkelder.

**Gerichte verbetering.** Maak de betekenis van de beweging expliciet in het bestaande operatiecontract. Laat de host kiezen voor een documentbewerking of tijdelijke bezoekers-/vensterpresentatie, en laat module-adapters hun geometrie leveren. Dit is geen toestemming om bestaande Undo-semantiek zonder productbesluit te veranderen.

## 2. Hoge onderhoudsprioriteit: meerdere eigen gesturelevenscycli

De gedeelde [workbenchGestures.js](../../../src/public/ownerSystemWorkflow/workbenchGestures.js) heeft een zorgvuldig begin/preview/commit/cancel-model. Het ruimt listeners en pointer capture op, behandelt Escape, blur en verborgen documenten, en voorkomt een tweede commit van dezelfde pointeractie.

Daarnaast houdt [ImageWindow.jsx](../../../src/imageModule/ImageWindow.jsx), rond regels 51–119, een eigen `gesture` bij met `begin`, `move`, `finish`, preview, capture en annulering. [DisplayInstrumentWindow.jsx](../../../src/public/ownerSystemWorkflow/DisplayInstrumentWindow.jsx) heeft eveneens een eigen levenscyclus voor native vensterbediening. Native objectbediening en expliciete Workbench-selectie bereiken daardoor verschillende implementaties van algemene inputafhandeling.

**Gevolg.** Een correctie aan annulering, pointercapture of afhandeling bij contextwisseling moet langs meerdere routes worden gecontroleerd. De review bevestigt die overlap; zij reproduceert geen nieuwe pointerfout.

**Gerichte verbetering.** Deel waar mogelijk de bestaande gesturelevenscyclus en behoud modulegebonden crop-, resize- en geometrieberekeningen achter hun eigen adapters. Een library is pas een verbetering wanneer deze routes werkelijk verdwijnen, zonder een extra parallelle laag.

## 3. Middelhoge onderhoudsprioriteit: de editorhost coördineert te veel verschillende verantwoordelijkheden

[WorkbenchView.jsx](../../../src/public/ownerSystemWorkflow/WorkbenchView.jsx) telt 1.346 regels en combineert registraties, selectieprojectie, camera-/navigatiekoppeling, objectkeuze, focusherstel, toetsenbord- en pointerrouting, Reception-voorwaarden en selectiebediening. [OwnerSystemWorkflowRuntime.jsx](../../../src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx) telt 1.116 regels en verbindt de module- en presentatie-eigenaars met de werkruimte.

De lengte alleen is geen kwaliteitsfout. De concrete onderhoudslast ontstaat doordat voorwaarden over cellen, moduletypen, groepen, inspectie en navigatie samenkomen in dezelfde inputrouter. Voorbeelden zijn de pointerroute vanaf regel 915 en de beweging-adapter vanaf regel 623 van WorkbenchView.

Er zijn al nuttige grenzen: aparte selectieovergangen, gesturefuncties, operaties en modules. Alleen bestanden kleiner maken lost het probleem daarom niet op. De volgende verbetering moet een verantwoordelijkheid werkelijk verplaatsen, bijvoorbeeld het bepalen van de opslagbetekenis van een beweging, met een kleiner contract aan de host.

## 4. Hoge verificatieprioriteit: groen op units is geen bewezen groene editor

De [onderhoudsronde van vandaag](../../../../../cleanup-2026-11-09/README.md) rapporteert en de logs bevestigen:

- 1.771 unit-/scripttests geslaagd, nul fail/skip/cancel/todo.
- Lint, gerichte typecheck en productiebuild/budget geslaagd.
- Laatst bekende browserstand: 18 suites groen en 17 rood, verspreid over opeenvolgende bronmomenten; geen gecombineerde releasepass.
- De volledige browserreleasegate is niet opnieuw afgerond.

De bronhashcontrole maakt deze resultaten relevant voor de huidige productiecode. Het aantal rode suites is geen telling van bewezen appbugs.

Twee nader gelezen voorbeelden laten zien waarom triage nodig is:

1. `owner-profile-routing` faalt op een exacte vergelijking van opgeslagen JSON. In het getoonde verschil veranderen uitsluitend de Display-breedte en -hoogte tussen `960`/`960.0000000000001` en `540.0000000000001`/`540`. Dat is een minieme geometrie-roundtrip, geen bewijs van verdwenen composities. Of die ongevraagde save geheel moet verdwijnen, vraagt beoordeling bij de geometry-/save-eigenaar.
2. Een Layers-case slaagt eerst op de daadwerkelijke selectie van `image:eyes`, en faalt daarna op het ontbreken van een zichtbare inspector. De resterende selectie- en herstelassertions worden daardoor niet bereikt. Het log bewijst die geblokkeerde gedragsdekking, niet dat de voorafgaande selectie fout was.

Text/Display-pixelchecks bevatten daarnaast concrete niet-nul-naadmetingen bij zoom 0,56. Die zijn nog niet in deze review visueel gereproduceerd of tot een huidige root cause teruggebracht. Display is bovendien een geparkeerde module; dit resultaat mag niet als bewezen fout in alle gewone Image/Bento-paden worden gepresenteerd.

**Gerichte verbetering.** Beoordeel de rode suites per oorzaak, werk werkelijk achterhaalde opstellingen bij en behoud de oorspronkelijke gedragsassertions. Sluit minstens bewegen, annuleren, Undo, save failure, reload en documentwisseling via de echte UI. Dit is nodig om architectuurverbeteringen betrouwbaar te kunnen beoordelen.

## 5. Middelhoge verificatieprioriteit: typeveiligheid is bewust beperkt

[tsconfig.contracts.json](../../../tsconfig.contracts.json) gebruikt `allowJs: true`, `checkJs: false` en noemt acht productie-entrypoints voor de huidige gerichte contractscontrole. De checker probeert bovendien bewust ongeldige calls en productiemutaties; dat is sterker bewijs dan een lege TypeScript-run.

Het is echter geen volledige typecheck van alle 569 productie-JS/JSX/TS/TSX-bestanden. Grote coördinerende React-bestanden vallen niet vanzelf onder dezelfde strikte bescherming. Het lintresultaat accepteert daarnaast 46 vastgelegde hook-dependency-observaties. Dat zijn geregistreerde uitzonderingen, geen 46 aangetoonde runtimebugs.

**Gerichte verbetering.** Verbreed controle langs de eerst aangepaste grenzen, vooral operatie-inputs, frameregistraties en inspector-/modulecontracten. Een algemene TypeScript-herschrijving is door deze bevinding niet onderbouwd.

## Wat aantoonbaar goed is

- **Opslag wordt pas geaccepteerd na een succesvolle write.** [systemWorkflowDraftStore.js](../../../src/systemWorkflow/systemWorkflowDraftStore.js), vanaf regel 587, controleert toegang, generatie, documentvaliditeit en wijzigingen in bestaande opslag. `setItem` gebeurt vóór het doorschuiven van de geaccepteerde snapshot en history. Undo verplaatst zijn geschiedenis ook pas na een geslaagde save.
- **Fouten worden niet als lege documenten behandeld.** De store onderscheidt afwezig, geldig, corrupt en onbeschikbaar. Herstel en overschrijven hebben afzonderlijke controles.
- **Documentscopes zijn daadwerkelijk begrensd.** De Workbench-scope verloopt bij activatiewisseling; Reception krijgt een beperkt handle dat veranderingen aan de canvasinhoud tegenhoudt. Dit is uitvoerende code, niet alleen een architectuurcommentaar.
- **Tekst heeft een werkbuffer met foutbehoud.** [textEditSession.js](../../../src/text/textEditSession.js) bewaart een mislukte edit voor herstel voordat de host wordt geïnformeerd. De geaccepteerde documentstore blijft daarvan onderscheiden.
- **Er bestaan betekenisvolle gedragsgerichte unitchecks.** Onder meer [systemWorkflowSaveBoundary.test.js](../../../src/systemWorkflow/systemWorkflowSaveBoundary.test.js) en [workbenchGestures.test.js](../../../src/public/ownerSystemWorkflow/workbenchGestures.test.js) testen failure, stale generation, annulering en enkelvoudige commits, niet alleen de aanwezigheid van bronregels.
- **Er is al gerichte performancezorg.** De camera maakt onderscheid tussen schaalabonnees en pannen; de view deelt één ResizeObserver voor modulegeometrie. De store hergebruikt ongewijzigde takken. Dit zijn gunstige implementatiekeuzes, geen nieuwe prestatiebenchmark.
- **Oude auditfouten mogen niet opnieuw als actueel worden gemeld.** De eerdere dubbele eigenaar van de actieve Reception-cel is vervangen door een store-abonnement in EditorCellsContext. Verwijderen van een private cel zet behouden leden nu expliciet op PRIVATE in receptionEditorDocument. Deze review heeft die correcties in de bron gezien; zij heeft hun browserreproducties niet opnieuw uitgevoerd.

## Grenzen voor prestaties en library-adoptie

Een normale documentcommit serialiseert nog steeds het hele profielrecord naar JSON en schrijft het synchroon naar localStorage. Structureel delen voorkomt niet al dat werk. De praktische grens bij grotere collecties en langdurige geanimeerde composities is hier niet opnieuw gemeten; een algemeen oordeel dat de editor snel of traag is zou te ver gaan.

De actuele buildmeting uit de brongebonden onderhoudsronde geeft 2.741.274 raw core-JS-bytes bij een grens van 2.744.000: 2.726 bytes marge. Dit is het bestaande budget, geen meting van ervaren snelheid. Een editorlibrary toevoegen vraagt dus een vergelijking van wat daadwerkelijk verwijderd wordt en wat er inclusief integratie voor terugkomt. Alleen een npm-pakketgrootte is daarvoor onvoldoende.

## Aanbevolen volgorde

1. Herstel de bruikbaarheid van de relevante browserregressies, zodat veranderingen beoordeeld kunnen worden op werkelijk gedrag.
2. Maak het contract voor beweging, opslag en Undo expliciet en consequent; behoud bestaande gebruikersdata en onderscheid tijdelijke bezoekerspresentatie.
3. Verminder overlappende gestureafhandeling langs één concrete objectroute.
4. Vergelijk pas daar een bestaande bouwsteen met het vereenvoudigde eigen pad, inclusief werkelijk verwijderde code, artworkgedrag en productieomvang.

Deze beoordeling corrigeert de eerdere algemene indruk dat veel eigen code op zichzelf de verkeerde keuze bewijst. Er is aantoonbaar waardevolle eigen infrastructuur. Het huidige probleem is de samenhang en verificatie van de editorlaag, en daar moet de afweging over hergebruik op worden gericht.

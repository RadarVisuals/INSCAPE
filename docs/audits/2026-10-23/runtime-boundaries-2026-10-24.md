# Runtime: publicatiepaneel, presentatie en build

Uitgevoerd door één agent op expliciet verzoek van de founder. Lokaal, niet
gecommit, gepusht of gedeployed. De bestaande gebruikersserver is behouden.

## Verandering

- `useWorkbenchPublicationPanel.js` beheert openen, sluiten, aanwezigheid en
  focusherstel van het publicatiepaneel. Het gebruikt de bestaande gedeelde
  focusroutine, die een nieuwere focuskeuze respecteert en uitgestelde callbacks
  annuleert. Voorbereiding en publicatie blijven bij hun bestaande controller.
- `useWorkbenchPresentation.js` beheert de eenmalige layoutrestauratie per keyed
  sessie en de presentatieprojectie. Preview, publicatie, backup en wisselen blijven
  dezelfde gevalideerde projectie gebruiken. De bestaande opslag- en herstelcode
  blijft eigenaar van de layoutcache; er is geen tweede inhoudsmodel toegevoegd.
- Moduleverslagen zijn gegroepeerd per bestaande modulemogelijkheid. Gedeelde
  doelopvraging verwijdert herhaalde lussen en blijft actuele refs lezen.
- Activiteit-fixturelogica en de oude activiteit-/identiteitsrepositories worden
  uit productie verwijderd bij het bouwen. Ontwikkeling en directe Node-tests
  behouden de fixtures. De artifactcontrole bewaakt hun concrete markers in alle
  uitgegeven JavaScript-chunks. De productie-limieten zijn niet gewijzigd.

Runtime telt nu 800 regels, tegenover 904 bij aanvang van deze vervolgopdracht
en 1.460 vóór de eerdere opsplitsing. De inhoudelijke winst is het scheiden van
levensduur, focus en presentatie van de centrale samenstelling. Runtime verbindt
nog steeds providers, chrome en acties over meerdere oppervlakken. Er is geen
module of productfunctie verwijderd en geen CSS gewijzigd.

## Controle en bewijs

- De definitieve `npm run build` en `npm run build:check` slagen. Core-JavaScript:
  **2.515.184 raw / 808.840 gzip bytes**, onder **2.519.500 / 809.500**.
  De gzipruimte blijft klein (660 bytes); dit is geen grote performanceverbetering.
- 19 gerichte unitchecks voor activiteit, presentatie, layoutopslag en documentflow
  geslaagd; vervolgens 32 checks voor fixture-identiteiten, activiteitopslag en
  productie-artifactgrenzen geslaagd.
- Activity 13/13 en Workbench-lifecycle 8/8 geslaagd na de twee extracties.
  Na het groeperen van de module-interface en aanpassen van de Library-invoer:
  publicatie 1/1, Library 1/1, lokale Workbenches 3/3 en herstel 1/1 geslaagd.
  Dit zijn gerichte hercontroles, geen volledige regressiematrix.
- De publicatietest bewaakt aanvullend dat vertraagd focusherstel een nieuwe
  canvasfocus niet overschrijft. De eerste versie van die nieuwe test stuurde
  Escape buiten het paneel; de test is gecorrigeerd om de sluitknop te focussen.
  De oorspronkelijke publicatieasserties zijn behouden.
- Definitieve lint: 466 bronbestanden, 92 bestaande gemotiveerde observaties.
  Alleen de bestaande Activity-cacheobservatie is aan de verplaatste bron gekoppeld.
  Typecontractcontrole geslaagd: 17 ongeldige aanroepen en 3 mutaties afgewezen.
- Library-screenshots op 1440×900 en 390×720 visueel bekeken. Geen volledige
  pixelvergelijking of uitspraak over alle appschermen.

De laatste productie-fixtureguards zijn na de browsercontroles toegevoegd; hun
Node-gedrag en productie-artifacts zijn afzonderlijk gecontroleerd. Ze wijzigen
geen ontwikkelpad of UI. De tijdelijke mislukte buildpogingen blijven als
historische logs bewaard; `build-verified.log` en `build-check.log` zijn definitief.

Bronidentiteiten, logs en screenshots:
[runtime-boundaries-2026-10-24](../../../../../technical-regie-2026-10-23/continuation/runtime-boundaries-2026-10-24/).

Deze afgesproken vervolgopdracht is afgerond. De volledige dertigstappenaanpak
en een releasecontrole zijn daarmee niet automatisch afgerond; de founder vroeg
uitdrukkelijk één agent en beperkte verificatie.

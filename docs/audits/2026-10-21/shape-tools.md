# Shape-venster in het gedeelde docksysteem

**Vervolg later op 21 oktober:** FX is inmiddels na expliciete goedkeuring
gebouwd met Grain en Blur voor Shapes. De uitspraken hieronder dat FX nog
ontbreekt zijn historisch; zie [de actuele FX-controles](fx-tools.md).

**Latere correctie op 21 oktober:** de oprichter heeft Show shape en Grain
strength uit Shape laten verwijderen. De eerste migratie en controles hieronder
zijn historisch; de actuele bijstelling staat onderaan bij
[Shape vereenvoudigd](#shape-vereenvoudigd-later-op-21-oktober).

Lokale wijziging op 21 oktober 2026 na de goedgekeurde volgorde Shape, FX en
Text als laatste. Checkout: `remediation-2026-10-19-shared-checkpoint/work`,
branch `codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. Ongecommitteerd en niet gedeployed.
De bestaande lokale wijzigingen zijn behouden. De verify-workflow is opnieuw
gelezen; een externe CI-run kan deze ongecommitteerde staat niet bevestigen.

## Resultaat en verantwoordelijkheid

Shape is de vijfde tab naast Layers, Transform, Color en Image. Het gebruikt
dezelfde vensters, onzichtbare resize-randen, detach/rejoin-bediening en
verplaatsbare docks. Actions → Shape settings heropent een gesloten tab.
Selectiewijzigingen kiezen geen andere tab. Andere moduletypen en meervoudige
selecties krijgen een selectiebericht zonder achtergebleven Shape-velden.

De bestaande Shape-keuze, naam, rechthoek-grain, Grid-snap/afstand/lijndikte,
texture-sterkte/schaal, Show shape en publicatiekeuze behouden hun volgorde.
Color en Transform houden kleur en geometrie; de bestaande toolbar houdt
dupliceren, ordenen en verwijderen. Er zijn geen nieuwe instellingen of
shape-soorten toegevoegd. Texture-bediening is bestaande ondersteunde
recordbediening, geen nieuw creatiecommando.

`ShapeWorkbench` leverde al Color via de gedeelde tool-source. Diezelfde bron
levert nu Shape. De module blijft eigenaar van tijdelijke presentatie,
validatie, opslaan en Undo. Het oude Properties-paneel bevat geen tweede kopie
meer. De geselecteerde module bepaalt de velden; een root-key voorkomt dat een
onbevestigd invoerveld bij het wisselen van Shape naar een andere Shape lekt.
Gesloten Shapes blijven via hun bestaande Show shape-keuze terug te halen.

Fouten blijven module-state, met de oorspronkelijke bediening als bestemming:
Shape-fouten in Shape, Color-fouten in Color en actiemeldingen in de toolbar.
Hierdoor verdwijnen fouten niet met het oude Properties-paneel en verschijnt
een instellingsfout niet nogmaals wanneer Color apart openstaat. Er is geen
nieuwe inhoudsstore, generiek moduleframework of parallel opslagpad gemaakt.

Vijf tabs passen niet altijd binnen een klein venster. De titelstrip kan daarom
horizontaal scrollen; geselecteerde tabs worden zichtbaar bij selectie en
toetsenbordnavigatie. Sluitknop en vrije sleepzone blijven bereikbaar. De inhoud
scrollt binnen het bestaande venster. De referentie van het oude Properties-
voorbeeld behoudt expliciet haar eigen veldlayout na verwijdering van de oude
productiestijlen.

## Beeld- en gedragscontrole

De twee nieuwe browsergevallen gebruiken geïsoleerde fixturedata achter de
gewone editor/reconciliatiegrens op poort 24970. Ze controleren naam, grain,
publicatie, Undo, opslagfalen/herstel, een actiemelding bij verborgen Shape,
één controle-instantie, losmaken/herdocken, sluiten/heropenen en selectie volgen.
Grid-controles testen snapping, geldige/ongeldige waarden, geometrie na spacing,
Undo en gesloten artwork. Texture-controles testen sterkte en schaal zonder
andere Shapes te wijzigen. De kleine dock test Home/End, zichtbare geselecteerde
tabs, bereikbare sluitknop en verticale inhouds-scroll zonder horizontale overflow.

De bestaande Shape-browsercontrole is aangepast om de nieuwe tab te openen en
na Escape opnieuw expliciet artwork te selecteren. Zij behoudt haar controles
voor aanmaken, kleuren, grain, dupliceren/ordenen, canvas-resize, opslag, reload
en de echte bezoekersrenderer. Andere regressies verbergen aanvullende tabs
alleen waar ze bewust een eerdere drie-tabindeling onderzoeken. De nieuwe Shape-
en Image-controles starten met de werkelijke vijf-tabstandaard.

Mist (1440 × 1000) en Carbon (760 × 620) zijn visueel bekeken. Het smalle dock is
tot 280 pixels breed verkleind; de texture-opname toont bewust de inhoud na
scrollen naar de onderste controles. De top blijft via dezelfde scroll bereikbaar.

![Shape in het dock](shape-tools/shape-mist-docked.png)
![Shape los naast Color](shape-tools/shape-mist-independent.png)
![Grid in een smal Carbon-dock](shape-tools/shape-carbon-grid.png)
![Texture met gescrolde inhoud](shape-tools/shape-carbon-texture.png)

## Grenzen en volgende stap

Definitieve controles:

- `npm test`: **1.309/1.309 geslaagd**, inclusief de echte productiebuild naar
  een alternatieve outputmap. [Log](shape-tools/unit.log).
- Gerichte browserreeks: **15/15 geslaagd**, met Shape, Image, gedeelde tools,
  docking, Color-focus, Image-fit en Text/Article-regressies.
  [Log](shape-tools/acceptance.log).
- De bestaande Shape Properties-referentiecontrole: **1/1 geslaagd**.
  [Log](shape-tools/reference.log).
- Design-system-inventaris opnieuw gegenereerd; **10/10 checks geslaagd**.
  [Log](shape-tools/design-system.log).
- `npm run build -- --configLoader native` en `npm run build:check` geslaagd.
  [Build](shape-tools/build.log), [budgetcontrole](shape-tools/build-check.log),
  [bundlerapport](shape-tools/bundle-report.json).

De native configloader is de bestaande Windows-aanpak. De definitieve build
meet 2.476.208 raw / 792.696 gzip core-JavaScript; initieel blijft het
822.889 raw / 239.436 gzip. Geen budgetplafond is voor deze Shape-stap gewijzigd.
De core-marge blijft klein. De aangepaste bestanden hebben geen whitespacefouten
volgens de gerichte diffcontrole.

Dockindeling blijft sessiestaat. Eén herlaadactie initialiseert de nieuwe
vijf-tabindeling in een eerder geopende app. Geen hot-reloadadapter toegevoegd.
Dit is geen volledige release-, publicatie- of algemene performance-audit.
Er zijn geen gebruikerscomposities, uploads of walletacties uitgevoerd.

FX is nog geen bestaand productie-venster: `design-system/selectionPanels.jsx`
toont Grain en Blur uitsluitend op voorbeelddata. De eerdere beschrijving van
FX als een venster met bestaande productiefuncties was te stellig. De gewenste
effecten en doelmodules moeten worden afgestemd voordat het echte gedrag wordt
gebouwd. Deze Shape-stap verplaatst grain daarom niet alvast naar FX. Text wacht
zoals afgesproken tot het laatst.

## Shape vereenvoudigd, later op 21 oktober

De oprichter vroeg Show shape en Grain strength uit Shape te verwijderen,
omdat zichtbaarheid al via Layers wordt bediend en grain straks één gedeelde
bediening in FX moet krijgen. Beide controles zijn verwijderd uit de echte
Shape-tab en het Shape Properties-voorbeeld in het designsysteem.

De Shape-renderer en opgeslagen grain-waarde blijven behouden. De renderer
importeert zijn oppervlakstijl nu rechtstreeks, zonder afhankelijk te zijn van
de verwijderde slider-import. Het oogje in Layers behoudt zijn tijdelijke
editorzichtbaarheid; de bestaande Reopen-actie in Layers opent gesloten artwork.
Er is geen tweede zichtbaarheidspad toegevoegd of opslaggedrag gewijzigd.

De afspraak voor de volgende stap is duurzaam vastgelegd in het actieve
contract: **FX krijgt één Grain-bediening voor de geselecteerde Shape**, met
de bestaande Shape-data, validatie, opslag en Undo. FX is in deze opruiming nog
niet gebouwd. Blur, Image- of Text-effecten worden niet stilzwijgend toegevoegd.

De gerichte browsercontroles zijn aangepast aan de nieuwe bediening en
controleren ook dat reeds ingestelde grain blijft renderen, Shapes via Layers
kunnen worden verborgen/getoond zonder opgeslagen inhoud of publicatie te
wijzigen, en gesloten Shapes via Layers terugkomen. De eerdere slider-editchecks
wachten op de FX-implementatie; zij worden hier niet als actuele dekking geclaimd.

Actuele controles voor deze correctie: **3/3 Shape-browsergevallen**, **1/1
Shape-referentiegeval**, **10/10 design-systemchecks**, native productiebuild en
buildbudgetcontrole geslaagd. Mist breed en Carbon smal zijn opnieuw visueel
bekeken. De volledige unitreeks is voor deze verwijdering niet opnieuw gedraaid;
de 1.309-resultaten hierboven horen bij de eerdere migratie. Ook deze correctie
is lokaal, ongecommitteerd en ongepubliceerd.

[Browserlog](shape-cleanup/browser.log), [referentie](shape-cleanup/reference.log),
[design system](shape-cleanup/design-system.log), [build](shape-cleanup/build.log),
[budgetcontrole](shape-cleanup/build-check.log).

![Opgeschoonde Shape-tab in Mist](shape-cleanup/shape-mist-docked.png)
![Opgeschoonde Grid-instellingen in Carbon](shape-cleanup/shape-carbon-grid.png)

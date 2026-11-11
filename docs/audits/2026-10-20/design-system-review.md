# Inscape designsysteem en gedeelde werkruimte

Inspectie en bespreking van 20 oktober 2026. De gekozen workspace is een bruikbare ontwerpgrondslag, maar nog geen volledig definitief interactieontwerp. De referentie bevat tijdelijke Display-voorbeelden en mist onderdelen van de bestaande applicatie. Alleen documentatie en bewijsbestanden zijn toegevoegd; de UI is niet gewijzigd.

**Latere richting in dezelfde bespreking:** [meerdere benoemde Workbenches](multiple-workbenches.md) vervangen één overvol canvas als organisatorische basis. Oude Workbench-groepen/stacks hoeven daarom geen vereiste van de nieuwe UI te blijven. De eerdere aanbeveling hieronder om ze als basis te behouden is hiermee achterhaald; de bronanalyse beschrijft nog wel het bestaande gedrag. Layers-compositieblokken blijven gekozen binnen elke Workbench. Eerst de compositie-/opslaggrens uitwerken vóór de hier voorgestelde Layers-implementatie. Eén gedeelde Keeper reist mee; Reception is nog niet definitief ontworpen.

## Vastgelegde keuzes uit deze bespreking

- De eerste gezamenlijke Layers-lijst omvat **Images, Text en Shapes, met bestaande groepen als uitklapbare rijen**. Library, Identity, Keeper en Mini Apps houden voorlopig hun eigen bediening.
- **Groepen in Layers zijn compositieblokken.** Hun leden vormen één aaneengesloten blok in de laagvolgorde en blijven binnen de groep afzonderlijk bewerkbaar. Dit vervangt de eerdere voorkeur in dit rapport om uitsluitend de organisatorische betekenis te behouden. De aansluiting op bestaande Workbench-groepen staat hieronder uitgewerkt; automatische omzetting is niet besloten.
- **Artwork info krijgt een eigen tab en kan worden losgemaakt.** Broninformatie blijft onderscheiden van bewerkbare module-eigenschappen.
- Het **oogje verbergt alleen tijdelijk in de editor**. Opnemen in publicatie blijft een afzonderlijke keuze.
- **Mobiele authoring wordt apart onderzocht**. Deze samenvoeging richt zich op desktop. De smalle referentie is bewijs van huidig gedrag, geen goedgekeurde mobiele editor. Bereikbaarheid van bediening bij een smaller desktopvenster blijft relevant.
- Display blijft geparkeerd. Geen herintroductie via tabs, Grids-navigatie of Add als onderdeel van deze migratie.

De eerste drie keuzes zijn expliciete antwoorden van de opdrachtgever in deze chat. De mobiele afbakening volgt diens aansluitende verduidelijking. De voorstellen verderop zijn nog geen genomen besluiten.

## Actuele basis en bewijs

Gelezen: projectroot AGENTS.md, checkout AGENTS.md, het actieve contract en de creative intent. Gebruikte checkout: `remediation-2026-10-19-shared-checkpoint/work`; branch `codex/audit-checkpoint-2026-10-19`; HEAD `32d9418843d996afc2e5203afa4552a6cd2d459a`. Bij aanvang was de werkboom schoon. E:/vscode/inscape en de uitgesloten continuation handoff zijn niet gebruikt.

De GitHub-connector rapporteerde voor dit exacte HEAD **Verify Inscape, run 34, completed/success**. [CI-run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131). De [workflow](../../../.github/workflows/verify.yml) draait `npm run verify`; dit is geen afzonderlijke live acceptatie van de toekomstige UI of bewijs dat de huidige preview-deployment exact dit HEAD serveert.

De recente [canvas Fit-audit](canvas-fit-edges.md) en [publicatie-audit](publication-confirmation.md) zijn geraadpleegd. Oudere aantallen en fouten in het designhandboek zijn gedateerde records en overschrijven deze exacte CI-status niet.

Deze ronde draaide daarnaast de bestaande `browser-tests/design-system-workspace.browser.mjs`: **10 geslaagd, 0 mislukt, 0 overgeslagen**. De suite controleert onder meer beide thema's op 1440/390/320 px, selectie, groepen, ordening, verwijderbevestiging, lege/read-only voorbeelden, lange lijsten, toetsenbordtabs, Navigator en Text. Geen volledige applicatiesuite of nieuwe releasebuild gedraaid voor deze documentatieronde.

Visueel bekeken: de actuele `/design-system.html#components`, Layers, Color in Mist op 390 px, de gegenereerde brede workspace en lange smalle Layers-lijst, en de bestaande Image-productiecomponenten in de geïsoleerde tool-chrome fixture. Die fixture toont ook een behouden Display-experiment en is geen bewijs dat Display via gewone creatie beschikbaar is.

- [Brede gekozen workspace](design-system-review/workspace-carbon-1440.png)
- [Brede Layers-referentie](design-system-review/layers-carbon-1440.png)
- [Lange smalle Layers-referentie](design-system-review/layers-mist-390.png)

## Definitief, referentie en experiment

| Status | Onderdeel | Beoordeling en bewijs |
| --- | --- | --- |
| Gereed als richting | Gedeelde compacte tools, tabs behouden hun plaats bij selectiewissels; losmaken, hergroeperen en verbergen | Expliciet gekozen in het [actieve contract, Workbench composition direction](../../INSCAPE_ACTIVE_CONTRACT.md#workbench-composition-direction-2026-10-19). Docking is nog niet geïmplementeerd. |
| Gereed als visuele basis | Carbon/Mist, 5 px controls en 9 px shells, neutrale selectie en afzonderlijke focus | [Foundations](../../design-system/FOUNDATIONS.md), [tokens](../../../src/inscapeTokens.css), [flat materiaal](../../../src/public/ownerSystemWorkflow/workflowFlat.css). Creation bar, camera en contextbalken zijn reeds gedeeltelijk gemigreerd; overige vensters niet automatisch. |
| Gereed als gedragsreferentie | Layer-volgorde voor/achter, invoegmarkering, groep samen verplaatsen, inline verwijderbevestiging, Escape/focusherstel | [Layers-preview](../../../design-system/layersPreview.jsx), [workspace-adapter](../../../design-system/workspaceLayers.js), [browserchecks](../../../browser-tests/design-system-workspace.browser.mjs). Dit zijn tijdelijke Display-placements, geen opgeslagen Workbench-volgorde. |
| Gereed als dekking, niet als eindlayout | Bestaande Properties-specimens en echte productiecomponenten | [Properties](../../../design-system/propertiesSamples.jsx), [handboek](../../design-system/README.md). Behouden als inventaris van bediening; niet blind naast de gekozen workspace implementeren. |
| Onduidelijk | Navigation sidebar, Navigator en zijdenpresentatie | Sidebar is als exploratie beschreven; Navigator heeft werkende voorbeeldinteractie, maar nog geen bewezen productie-integratie. Image-zijdenpresentatie wordt expliciet nog beoordeeld. [Contract](../../INSCAPE_ACTIVE_CONTRACT.md#shared-creative-workspace-direction-2026-10-14). |
| Bewust geparkeerd | Display-tab, Display-Grids en bijbehorende tools | Behouden referenties mogen niet terugkeren als gewone route. De workspace toont ze nog wel; voor de migratie moeten ze buiten het gewone ontwerp vallen. |
| Buiten eerste stap | Gemeenschappelijke FX/blur, eyedropper, generieke moduleverbindingen, live minting | De preview demonstreert mogelijkheden, geen goedgekeurde productiefunctionaliteit. De FX-code noemt dit zelf voorgesteld. [Selectiepanelen](../../../design-system/selectionPanels.jsx). Bestaande module-eigen grain blijft bestaande functionaliteit. |
| Bewust apart | Mobiele authoring | De huidige stapeling werkt technisch zonder horizontale pagina-overloop, maar vraagt veel scrollen. Een eigen mobiele werkvorm volgt later. |

## Wat ontbreekt of botst

| Status | Onderwerp | Bevinding en noodzakelijke uitwerking |
| --- | --- | --- |
| Ontbrekend | Workbench Layers | De adapter filtert uitsluitend `parent === 'display'`. Een geselecteerde solo Image staat daardoor niet als gelijkwaardig item in dezelfde Layers-lijst. Productie meldt nog “Select a Display to see its layers.” [Adapter](../../../design-system/workspaceLayers.js), [toolbar](../../../src/public/ownerSystemWorkflow/OwnerWorkbenchToolbar.jsx). |
| Ontbrekend | Gezamenlijke opgeslagen tekenvolgorde | Shapes gebruiken hun eigen collectievolgorde; Images en Text hebben eigen CSS-stapeling. Een geselecteerd venster activeren is geen authored laagvolgorde. Gemeenschappelijke volgorde moet hetzelfde betekenen bij renderen, opslaan, Undo/Redo, reload en publicatie. [Shape](../../../src/shapes/ShapeWorkbench.jsx), [Image CSS](../../../src/imageModule/imageModule.css), [Text CSS](../../../src/text/text.css). |
| Ontbrekend | Docking en herstel | Geen echte tab detach/rejoin, meerdere tabgroepen, verbergen of algemeen “toon panelen/reset indeling” in de workspace. Productie heeft wel losse toolvensters met registratie en focusherstel; dat is een bruikbaar aanknopingspunt, geen volwaardig dock. [SharedDisplayTools](../../../src/public/ownerSystemWorkflow/SharedDisplayTools.jsx), [workspace](../../../design-system/workspacePreview.jsx). |
| Ontbrekend | Artwork info in gedeelde selectie | De preview toont hiervoor alleen een melding dat informatie apart blijft. Dat botst met de nu gekozen eigen dockbare tab. In productie registreert Display metadata voor zijn selectie; ImageWorkbench registreert geen eigen shared metadata-panel. Bronreferenties van de actieve Image-zijde moeten een gewone route naar info krijgen. [Workspace](../../../design-system/workspacePreview.jsx), [Image](../../../src/imageModule/ImageWorkbench.jsx), [Display metadata-registratie](../../../src/public/ownerSystemWorkflow/DisplayModule.jsx). |
| Ontbrekend | Volledige Image-bediening in eindontwerp | Preview beperkt toevoegen tot 8 zijden; productie ondersteunt 32. Preview mist de bestaande verwijderknop voor één zijde. Maak “verwijder Image” en “verwijder zijde” ondubbelzinnig. Ook lege Image, laden, mislukte zijdewisseling en herstel moeten mee. [Selectiepanelen](../../../design-system/selectionPanels.jsx), [Image-model](../../../src/imageModule/imageModule.js), [Image-bediening](../../../src/imageModule/ImageWorkbench.jsx), [zijdenlifecycle](../../../src/imageModule/ImageSides.jsx). |
| Onduidelijk | Fit, Cover, Fill en Center | Workspace toont Fit/Cover/Center; solo Image gebruikt Fit inside/Fill canvas. Leg het doel vast: bron passend in Image versus module in Workbench versus camera focus. Een extra Fill naast Cover heeft zonder andere betekenis geen reden. [Contract](../../INSCAPE_ACTIVE_CONTRACT.md#shared-creative-workspace-direction-2026-10-14), [Image](../../../src/imageModule/ImageWorkbench.jsx). |
| Ontbrekend | Multiselectie-eigenschappen | Preview biedt bij meerdere lagen een melding “Choose one layer”, geen gemengde waarden of gemeenschappelijke Color/Transform-velden. Wel bestaan selectieacties en groepen. Voorstel eerste uitvoering: gemeenschappelijke volgorde/verwijderen, individuele eigenschappen vragen één selectie; geen stilzwijgende toepassing op één willekeurige laag. [Selectiepanelen](../../../design-system/selectionPanels.jsx). |
| Gekozen richting; aansluiting open | Groepen en stacks | Layers-groepen zijn nu gekozen als aaneengesloten compositieblokken. Bestaande Workbench-groepen regelen lidmaatschap, stacks en navigatie, zonder dat laagblok af te dwingen. Zie de aansluitingsanalyse hieronder. [Groepen](../../../src/public/ownerSystemWorkflow/WorkbenchGroups.jsx), [groepsdomein](../../../src/systemWorkflow/domain/workbenchGroups.js). |
| Onduidelijk | Lock en verborgen selectie | Definieer of lock alleen geometrie of alle edits blokkeert, of een verborgen laag geselecteerd blijft, en hoe Color/Info zich daarbij gedragen. Voorstel: info blijft leesbaar, blokkering krijgt een reden en ontgrendelen/zichtbaar maken blijft bereikbaar. Preview kent al een lock-uitleg en uitgeschakelde velden, maar geen volledige Workbench-regel. |
| Ontbrekend | Verwijdering en herstel samen | Het artwork-X sluit nu een Image naar een shortcut; het verwijdert geen inhoud. Verwijderen bestaat al via het shortcutmenu en de gevalideerde, undoable domeinoperatie. Vervang de sluitroute pas zodra Layers verwijderen, bevestigen, Undo en focus na verwijdering volledig werken. Geen verwijdering uit Library of van het bronasset. [Image](../../../src/imageModule/ImageWorkbench.jsx), [shortcutmenu](../../../src/public/ownerSystemWorkflow/useModuleShortcutMenu.jsx), [verwijderoperatie](../../../src/systemWorkflow/removeWorkbenchModule.js). |
| Image beslist op 21 oktober; overige aansluiting uitwerken | Color per moduletype | De founder heeft expliciet besloten: **Image heeft geen kleurbediening**. Geen tinting, recoloring of bronafhankelijke kleurbewerking toevoegen. Dit vervangt de eerdere open Image-vraag. Shape-kleur/opacity en Text-kleurdoelen sluiten aan op de gedeelde Color-tab. Een Image-selectie houdt de gekozen tab vast, zonder toepasbaar kleurdoel of achtergebleven bewerkbaar Shape/Text-doel. [Actief contract](../../INSCAPE_ACTIVE_CONTRACT.md#workbench-composition-direction-2026-10-19), [Shape](../../../src/shapes/ShapeWorkbench.jsx), [tekstselectie](../../../design-system/textColourSelection.js). |
| Ontbrekend | Lege en toestandafhankelijke tools | Referentie heeft leeg, locked, read-only en verkeerd type, maar de algemene lege melding verwijst naar “Reset the example”. Productie heeft nodig: niets geselecteerd, geen toepasbare eigenschap, meerdere selecties, laden, bron onbekend, fout/stale resultaat, savefout en editing lock. Houd het paneel vindbaar, met uitleg en relevante herstelactie. [Selectiepanelen](../../../design-system/selectionPanels.jsx), [toegankelijkheid](../../design-system/ACCESSIBILITY.md). |
| Ontbrekend | Toetsenbord voor nieuwe paneelacties | Tabpijlen/Home/End en Escape zijn aanwezig in voorbeelden. Nieuwe docking heeft ook menuacties nodig: losmaken, naar tabgroep, verbergen, opnieuw openen, standaardindeling. Laagordening moet zonder slepen kunnen; focus na verwijderen en paneelverplaatsing moet voorspelbaar blijven. Canvas Delete mag nooit in een schrijvend Text-veld ingrijpen. [Contexttoolbar](../../../src/public/ownerSystemWorkflow/ContextToolbar.jsx), [toegankelijkheid](../../design-system/ACCESSIBILITY.md). |

## Aanvullende ontwerpgevallen die vooraf benoemd moeten zijn

1. **Selectie versus actieve tekstcursor.** Klikken in Color mag het tekstbereik niet verliezen. Wisselen van selectie houdt de gekozen tab vast. Bij wissen van de selectie blijven Layers en het panelenmenu bereikbaar.
2. **Verschillende eenheden en grenzen.** Transform-preview gebruikt voorbeeldcoördinaten; solo Image heeft 32–4096 px en eigen proportie/crop-regels. Text reflowt; een Grid Shape bepaalt snapping. Eén generiek resize-formulier mag deze betekenissen niet vervangen.
3. **Geknipte of onzichtbare objecten.** De recent geïntroduceerde canvascrop verwijdert inhoud niet. Layers moet ook objecten buiten de canvasgrens vindbaar houden; “in beeld brengen” is camera-navigatie, niet verplaatsen van het artwork. [Canvas-audit](canvas-fit-edges.md).
4. **Tijdelijke presentatie versus auteurswerk.** Paneelpositie, dockindeling, verborgen tools, tijdelijke laagzichtbaarheid en camera zijn geen publicatiekeuzes. Volgorde en verwijderen zijn authored edits. Een savefout mag geen succesvolle wijziging suggereren.
5. **Onafhankelijke bronnen en zijden.** Twee Images kunnen hetzelfde asset gebruiken. Verwijderen van de ene mag de andere niet raken. Artwork info volgt de actieve zijde en laat ontbrekende bronfeiten onbekend.
6. **Visitor en Preview.** De gedeelde renderer behoudt artworkvolgorde; de bezoeker krijgt geen eigenaar-Layers of schrijfbare eigenschappen. Broninformatie mag leesbaar blijven volgens bestaande toegangsgrenzen.
7. **Paneelherstel.** Voorstel: permanent vindbare actie “Panelen” met vinkjes, “Alle tools tonen” en “Standaardindeling herstellen”. Reset alleen de werkruimte-indeling, nooit de compositie. Losse panelen na schermwissel binnen het bereikbare venster houden.
8. **Smaller desktopvenster.** Ontwerp voor begrensde toolbreedtes, eigen scrollgebied, bereikbare tabs en menu's. De huidige lange telefoonpagina is geen eindoplossing. Zoom, grotere tekst, lange laagnamen, bronadressen, reduced motion en forced colours blijven te controleren bij echte migratie.

## Nog te bespreken ontwerpkeuzes

- **Aansluiting op bestaande groepen:** het compositieblok is gekozen. Nog open zijn de expliciete omzetting van een bestaande navigatiegroep, de ankerpositie bij groeperen van verspreide lagen en de behandeling van gemengde groepen met Keeper/Display. Zie de concrete voorstellen hieronder.
- **Herstel na verwijderen:** bestaande inline bevestiging plus Undo gebruiken, of een echte prullenbak met bewaartermijn? Voorstel: bevestiging met aantal, één Undo-stap en duidelijke foutmelding; geen nieuwe prullenbak voor de eerste stap. Een Image verwijderen omvat alle zijden; een groep verwijderen vraagt expliciet of alleen de groep of ook de leden worden bedoeld.
- **Beginindeling:** alle tools in één tabgroep of standaard Layers zichtbaar naast een groep met Color/eigenschappen/info? Voorstel: Layers als eigen zichtbare groep en daarnaast de overige tabs; beide mogen daarna hergroeperen. Dit voorkomt dat men tijdens ordenen telkens eigenschappen moet wegklikken. Het huidige ene-tabvak blijft een toegestane persoonlijke configuratie.

## Eerste afgebakende implementatiestap

**Voorstel: Workbench Layers voor Images, Text en Shapes met compositieblokken, binnen de huidige vensterhost.** Dit is een eerste functionele stap naar de gekozen workspace, geen onmiddellijke migratie van alle losse vensters. Eerst de aansluiting op bestaande navigatiegroepen hieronder vastleggen en de reeds afgesproken stabilisatie/releasevoorwaarden respecteren.

De stap levert één betrouwbare Layers-weergave van dezelfde Workbench-selectie, expliciete voor/achter-volgorde, compositieblokken, tijdelijke oogjes en verwijderen met Undo. Bestaande navigatiegroepen worden niet ongemerkt omgezet in blokken. Module-eigen instellingen, Text-editor en bronassetdata blijven bij hun huidige eigenaar. De X op deelnemend artwork verdwijnt pas wanneer de vervangende verwijder/herstelroute compleet is. Niet-deelnemende vensters houden hun lifecycle.

Technische afhankelijkheid: Workbench beheert selectie/registratie en vensterpresentatie; modules beheren hun inhoud en domeinoperaties; de draftstore beheert gevalideerd opslaan en geschiedenis; publieke projectie beheert publicatie. Nodige vereenvoudiging is de aantoonbaar verspreide artworkvolgorde samenbrengen in één authored volgorde. Geen kopie van de Display-placementlijst en geen tweede selectie introduceren. De bestaande contextportal en verwijderoperatie kunnen inhoud en acties blijven hosten; docking krijgt later een presentatie-eigenaar en wordt niet in artwork opgeslagen.

Acceptatie van deze stap:

- Twee Images, een Text en Shape overlappen; Layers en canvas tonen dezelfde voor/achter-volgorde. Selecteren en focus veranderen die volgorde niet.
- Ordenen werkt met slepen én knoppen/toetsenbord. Undo/Redo, reload en publieke projectie behouden dezelfde authored volgorde.
- Verborgen lagen blijven in Layers vindbaar; het oogje verandert de publicatievlag niet. Objecten buiten de canvascrop blijven bereikbaar.
- Verwijderen benoemt het aantal en het object, annuleert met Escape en keert met Undo terug inclusief zijden, bronnen, groepsrelaties en relevante layout. Bevestigd falend opslaan laat de vorige compositie intact.
- Eén gedeelde selectie; meerdere selecties krijgen geen willekeurige individuele eigenschappen. Text-bewerking behoudt zijn eigen invoer en Undo.
- Gesloten bestaande Images hebben een expliciete herstelroute tijdens de overgang. Het verwijderen van de oude X-route veroorzaakt geen onbereikbare inhoud.
- Owner, Preview en Visitor delen de juiste renderorde; Visitor kan geen eigenaarbewerking opslaan.

Volledige docking, Artwork info als gedeelde tab, Color-migratie en definitieve beginindeling volgen daarna als een afzonderlijke samenhangende stap, met selectie als reeds bewezen basis. Dat voorkomt dat de grootste workflow-onzekerheid verstopt raakt onder nieuwe vensterchrome. Mobiele authoring en Display blijven buiten beide stappen.

## Compositieblokken en bestaande Workbench groepen

Vervolginspectie na het expliciete besluit van de opdrachtgever op 20 oktober. De gekozen semantiek is vastgelegd in het [actieve contract](../../INSCAPE_ACTIVE_CONTRACT.md#layers-composition-groups-decision-2026-10-20). Onderstaande aansluiting is een voorstel, geen reeds werkende functionaliteit.

### Wat de huidige implementatie werkelijk doet

| Verantwoordelijkheid | Huidige eigenaar en gedrag | Gevolg voor compositieblokken |
| --- | --- | --- |
| Lidmaatschap | [workbenchGroups.js](../../../src/systemWorkflow/domain/workbenchGroups.js): één groep per module; geen geneste groepen; lege groepen toegestaan; Images, Text, Shapes, Keeper en behouden Display-instanties. Mini Apps zitten niet in deze ledeninventaris. | Naam, stabiele module-ID's en unieke lidmaatschapsregels zijn bruikbare bouwstenen. Niet elke bestaande groep past in de gekozen eerste Layers-scope. |
| Wijzigen en geschiedenis | [workbenchGroupSession.js](../../../src/systemWorkflow/workbenchGroupSession.js): create/rename/members/visibility/position/ungroup committen via dezelfde profile-bound draftstore. Groeperen wijzigt nu uitsluitend de groepsrecords. | Een compositiegroep maken of wijzigen moet daarnaast de aaneengesloten artworkvolgorde waarborgen, in dezelfde atomische operatie. Een extra losse save zou tussenstaten of half geslaagde acties opleveren. |
| Ledenvolgorde | [WorkbenchGroups.jsx](../../../src/public/ownerSystemWorkflow/WorkbenchGroups.jsx): de pijlbediening herschikt `memberIds`. [WorkbenchGroupScene.jsx](../../../src/public/ownerSystemWorkflow/WorkbenchGroupScene.jsx) gebruikt die volgorde voor bladeren en tijdelijke presentatie. | Deze lijst is nu lees-/navigatievolgorde, geen globale z-order. Niet automatisch omkeren of voortaan als laagvolgorde gebruiken: dat zou Vorige/Volgende en presentatie veranderen. |
| Stack | Optionele `position` slaat alleen het anker van de compacte stack op. Leden blijven gemount; hun authored geometrie blijft behouden. | Een stack is een presentatievorm, geen compositieblok en geen flattening. De opgeslagen stackpositie kan niet dienen als groepsgeometrie voor body/eyes/effects. |
| Openen | [workbenchGroupLayout.js](../../../src/public/ownerSystemWorkflow/workbenchGroupLayout.js) schaalt leden tijdelijk naar tegels met 32 px tussenruimte. De scene houdt deze transforms en de camera buiten het draftmodel. Tijdens die presentatie is de normale bewerking beperkt. | Ongeschikt als standaard “open compositiegroep”: lichaam en ogen zouden uit elkaar vallen. Compositiegroep openen moet toegang tot onderdelen geven terwijl hun overlap behouden blijft; concreet interactieontwerp volgt later. |
| Gekoppelde Text-frames | `workbenchMemberIds` leidt frame-ID's terug naar het Text-module-ID; `workbenchGroupWindowIds` breidt dat bij presentatie weer uit. | Geen afzonderlijke kopie van hetzelfde artikel per laaggroep maken. De exacte tekenvolgorde van gekoppelde frames moet in de latere orderimplementatie expliciet worden bepaald. |
| Publicatie | [publishedWorkbenchGroups.js](../../../src/profileDocument/domain/publishedWorkbenchGroups.js) publiceert alleen opt-in PUBLIC-groepen, gefilterd tegen reeds publieke modules. Een private groep kan publieke leden hebben. | Compositievolgorde moet ook correct blijven wanneer de organisatorische groepsnaam privé is. Niet de hele laagstructuur aan de bestaande Public group-vlag koppelen. Privéleden blijven uitgesloten; publieke overblijvende leden behouden hun visuele volgorde. |
| Verwijderen | [removeWorkbenchModule.js](../../../src/systemWorkflow/removeWorkbenchModule.js) commit moduleverwijdering; [reconcileRemovedWorkbenchMembers](../../../src/systemWorkflow/domain/workbenchGroups.js) ruimt verwijzingen naar werkelijk verwijderde modules op. Ungroup verwijdert uitsluitend de groep. | “Groep opheffen” en “groep met inhoud verwijderen” blijven aparte handelingen. Een nieuwe blokoperatie moet beide via dezelfde draft-/Undo-grens behandelen; Library-assets blijven bestaan. |

### Aanbevolen aansluiting

Behoud voorlopig de bestaande Workbench-groepen als herkenbare navigatie-/stackfunctie. Ontwerp de compositiegroep als de authored samenhang in Layers, zonder de navigatieactie “groep openen” stilzwijgend te vervangen. Dit is een scheiding van betekenis, geen besluit om twee gesynchroniseerde kopieën van hetzelfde lidmaatschap of een generiek groepsframework te bouwen. De concrete gegevensstructuur volgt uit de afgesproken gebruikershandelingen.

Een toekomstig expliciet “Maak compositiegroep van deze groep” kan een geschikte bestaande groep hergebruiken of omzetten. Dat is nog geen opdracht tot een conversiefunctie of legacy-adapter. Eerst beslissen of de bestaande navigatiefunctie naast het blok nodig blijft. Een bestaande gemengde groep met bijvoorbeeld Images en Keeper mag niet ongemerkt zijn Keeper verliezen of een buiten-scope Keeper in de Layers-volgorde trekken.

Concreet voorbeeld, van achter naar voor: **landschap, lichaam, mist, ogen**. Lichaam en ogen zijn nu lid van de Workbench-groep Personage. Dat lidmaatschap verandert de huidige tekenvolgorde niet. Als Personage een compositieblok wordt, kan mist niet langer tussen die twee blijven staan zonder lid te worden. **In de aansluitende bespreking goedgekeurd:** behoud de onderlinge volgorde van lichaam en ogen en plaats het blok op de positie van het voorste geselecteerde lid. Dan wordt het **landschap, mist, [lichaam, ogen]**. De canvasposities blijven gelijk; de overlap verandert bewust. Groepering en volgorde worden één undoable auteursbewerking. Undo herstelt de volledige vorige toestand. Verankeren bij het achterste lid is niet de gekozen regel.

### Wat de gekozen blokregel al bepaalt

- Een blok naar voren/achteren verplaatsen verandert de volgorde van het geheel, niet de ruimtelijke plaats van zijn onderdelen.
- Een onderdeel binnen de groep herschikken blijft binnen dat blok. Een buitenstaander tussen groepsleden plaatsen vereist expliciet toetreden tot de groep of een lid eruit halen.
- Inklappen van de Layers-rij verbergt alleen de lijst met onderdelen. Dit is niet het oogje, Stack, camera-Focus of het sluiten van artwork.
- De groep is geen nieuwe bronafbeelding. Zijdes, teksten, crop en asset-identiteit blijven bij hun modules.
- Geneste groepen en gezamenlijke effecten volgen niet automatisch uit deze keuze. De eerste scope hoeft ze niet te introduceren.

### Besloten selectiegedrag

De opdrachtgever heeft het volgende voorstel goedgekeurd, zonder UI-implementatie in deze ronde:

- Eén canvasclick selecteert het compositieblok; slepen verplaatst de onderdelen samen.
- Dubbelklik focust het hele blok. Het opent geen onderdelenmodus en verandert geen laagvolgorde.
- “Bewerk onderdelen” of Enter op het geselecteerde blok gaat expliciet de groep binnen, buiten actieve tekst-/formulierinvoer. Een klik op een oog selecteert dan alleen dat onderdeel. Een zichtbare contextaanduiding toont bijvoorbeeld `Personage > Ogen`.
- Escape sluit eerst de actieve bewerking of handeling volgens diens bestaande gedrag af. Anders verlaat Escape de groep en selecteert het hele blok.
- Via Layers kun je de groep uitklappen en rechtstreeks Ogen selecteren. Alleen uitklappen verandert de compositie niet.

### Overige keuzes en voorstellen

1. **Bestaande groepen:** voorstel is expliciete omzetting wanneer gewenst, met behoud van de huidige navigatie/stackroute totdat daarvoor een vervanger is gekozen. Geen automatische omzetting bij laden of bij het openen van Layers.
2. **Groeperen van verspreide lagen — besloten:** het voorste geselecteerde lid is het anker, met behoud van interne tekenvolgorde en canvasgeometrie. Eén Undo herstelt de vorige groepering en volgorde.
3. **Ungroup en verwijderen:** voorstel is “Groep opheffen” dat de onderdelen op hun huidige plaats in de globale volgorde laat staan, naast “Verwijder groep en onderdelen” met aantal en bevestiging. Lege navigatiegroepen blijven bestaande dropdoelen; of een lege compositiegroep zinvol is, is nog niet gekozen.
4. **Groepsselectie — besloten:** één klik selecteert het blok, dubbelklik focust het blok, expliciet “Bewerk onderdelen”/Enter gaat naar de inhoud en Layers geeft rechtstreeks toegang. Zie de uitgewerkte regels hierboven; dubbelklik krijgt geen tweede betekenis voor groepsinvoer.

### Acceptatiegevallen voor latere implementatie

- De voorbeeldvolgorde met mist controleert expliciet de gekozen ankerregel, groepsvorming en Undo/Redo. Zonder expliciete groepsactie verandert geen bestaande compositie.
- Verplaatsen in Layers houdt het blok aaneengesloten; groepsleden blijven individueel bewerkbaar. Selectie of paneelinklappen wijzigt geen opgeslagen volgorde.
- Klik/slepen, dubbelklik-Focus, expliciete groepsinvoer, directe onderdeelkeuze via Layers en Escape-terugkeer volgen de gekozen regels. Tekstinvoer en lopende handelingen behouden hun eigen toetsenbordgedrag; de contextaanduiding volgt de actuele selectie.
- Bestaande Groups, Stack/Unstack, leesvolgorde en camera-Back blijven werken volgens hun gedeclareerde betekenis. Compositiebewerking spreidt onderdelen niet onverwacht uit.
- Eén atomische save omvat groepsstructuur én globale volgorde; een stale of mislukte save bewaart de vorige geaccepteerde compositie.
- De publieke renderorde blijft correct bij publieke leden in een private groep en bij private leden in een gedeelde groep. Geen private namen of leden lekken mee.
- Verwijderen, Ungroup, linked Text-frames, gesloten Images en groepen buiten de eerste modulescope krijgen gerichte regressiegevallen.

Deze vervolginspectie heeft broncode en bestaande tests geraadpleegd. Er zijn geen nieuwe gedragsclaims getest, omdat alleen documentatie is aangepast. De eerder gerapporteerde tien previewchecks en CI horen bij de oorspronkelijke bronversie, niet bij een geïmplementeerd compositieblok.

## Grenzen van deze inspectie

De lokale browsercontroles gebruiken tijdelijke voorbeeldinhoud, geen private compositie of echte wallet. De nieuwe dockinteracties bestaan nog niet en zijn dus niet getest. Schermlezer, echt touchapparaat, grote representatieve media-composities en prestaties van de toekomstige workspace zijn hiermee niet gecertificeerd. De bewijsbeelden tonen het huidige voorbeeldontwerp; de dossierkeuzes hierboven verduidelijken de volgende uitvoering.

# Meerdere Workbenches aanmaken wisselen opslaan en publiceren

Ontwerpuitwerking van 20 oktober 2026. **Gekozen:** meerdere benoemde Workbenches per profiel, elk een zelfstandig compositiecanvas; een overzicht en wisselen voor eigenaar én bezoeker. De Library blijft gedeeld. De workflows hieronder zijn voorstellen waar niet uitdrukkelijk als besloten aangeduid. Alleen documentatie is gewijzigd.

**Latere visuele verduidelijking:** [de bundel met 19 screenshots](../../design-references/2026-10-20-inscape-vision/README.md) vult Reception in als vrij te branden bento-grid en toont een afzonderlijke optionele wereldingang rechts ervan. De compositieroute gaat naar overzicht en canvas met camera-index. Keeper krijgt een eigen habitat en kan ook begeleiden; de eerder hieronder vastgelegde ene altijd meereizende Keeper is daarmee te beperkt. Aantal, plaatsing en visitorgedrag zijn nog open. De hier beschreven opslagscope is geen reden om deze nieuwe habitatkeuzes alvast te implementeren.

## Vaststaande richting

- Profiel: identiteit, gedeelde Library en een overzicht van Workbenches.
- Workbench: een eigen naam, canvasformaat, module-instanties, authored posities, Layers en compositieblokken. Eén actieve Workbench tegelijk.
- Layers: de reeds gekozen blokregel, anker bij het voorste geselecteerde lid en expliciete onderdeelbewerking blijven gelden, nu binnen één Workbench.
- Visitor: overzicht en wisselen tussen gepubliceerde Workbenches. Private composities en ongepubliceerde edits blijven buiten het publieke document.
- **Aansluitend besloten:** één profielbrede Keeper reist mee tussen Workbenches. Geen zelfstandige Keeper-configuratie kopiëren naar elke compositie. Hoe die gedeelde Keeper publiek verschijnt en waar zijn dock hoort, wordt nog uitgewerkt.
- **Aansluitend verduidelijkt:** Reception is een gewenste richting, maar vorm en standaard profielingang blijven open. Die keuze blokkeert aanmaken, lokaal opslaan en wisselen niet.
- **Aansluitend gekozen:** vóór publicatie kiest de eigenaar de omvang: huidige Workbench, afzonderlijk aangevinkte andere Workbenches of alle lokale wijzigingen. Voorstel voor de standaardselectie: alleen de huidige Workbench. Iedere betrokken compositie en eventuele eerste publieke opname moet zichtbaar zijn vóór bevestiging.
- De oude Workbench-groepen waren bedoeld als mapjes/stapels die uitklappen. Ze hoeven geen verplichte organisatorische laag in de nieuwe UI te blijven. Ze zijn niet hetzelfde als compositieblokken.
- Display blijft geparkeerd; mobiel krijgt een aparte ontwerpronde. Meerdere Workbenches betekent geen terugkeer van Display-Grids, geen modulemarktplaats en geen automatische cloudsynchronisatie.

[Actieve richting](../../INSCAPE_ACTIVE_CONTRACT.md#multiple-named-workbenches-direction-2026-10-20). Dit besluit vervangt de oude beperking tot één Workbench en de eerdere aanbeveling om navigatiegroepen als vereiste te behouden. Het verleent geen toestemming om de huidige compositie of groepen te wissen.

## Voorbeeld dat de workflows bijeenhoudt

Nadine heeft drie Workbenches: **Lunar Desert**, **Resident Zero** en **Studies**. Lunar Desert en Resident Zero hebben al een gepubliceerde versie; Studies is privé. Ze wijzigt Resident Zero lokaal, wisselt naar Lunar Desert en publiceert alleen Lunar Desert. In het voorgestelde model ziet de bezoeker de nieuwe Lunar Desert en de laatst gepubliceerde Resident Zero. Studies en de nieuwe lokale Resident Zero blijven privé.

## Aanmaken

Voorstel: vanuit het overzicht of de Workbench-wisselaar kiest de eigenaar **Nieuwe Workbench**. Een compacte invoer vraagt een naam en biedt Vrij, Liggend, Staand, Vierkant en eigen afmetingen. De exacte presets en grenzen volgen uit de bestaande canvasbetekenis; geen nieuw Display-formaat ernaast introduceren. Vrij betekent een ruim beginformaat dat later aangepast kan worden, geen stilzwijgende oneindige opslagruimte.

Na bevestiging wordt een lege, private compositie opgeslagen, met een stabiele identiteit onafhankelijk van de naam. Pas na geslaagd opslaan verschijnt en opent zij als nieuwe Workbench. Annuleren maakt niets; bij opslagfout blijft de invoer beschikbaar en blijft de huidige Workbench intact. Een tijdelijke naam zoals “Naamloze Workbench” maakt snel beginnen mogelijk. Naam en formaat blijven later aanpasbaar.

Een nieuwe Workbench erft geen modules, tekst, laagselectie of publieke status van de vorige. De Library blijft beschikbaar. Hetzelfde bronasset opnieuw plaatsen creëert een zelfstandige module; het wijzigen van crop, zijden of tekst in de ene compositie wijzigt de andere niet. Canvasgrenzen aanpassen blijft niet-destructief en herschaalt bestaande inhoud niet automatisch.

Dupliceren is een bruikbare vervolgstap, maar geen vereiste van de eerste aanmaakroute. Voorstel bij latere toevoeging: een onafhankelijke private kopie, zonder gedeeld bewerkbaar artikel of overgenomen live publicatiestatus. Verplaatsen/kopiëren tussen Workbenches vraagt een expliciete actie; geen verborgen koppelingen.

## Wisselen

Voorstel eigenaar: zowel overzicht als een compacte wisselaar toont naam, visueel herkenningsbeeld en lokale/publicatiestatus. Selecteren opent de gekozen Workbench in dezelfde werkruimte. De laatst gebruikte Workbench kan lokaal worden onthouden. Eén mislukte compositielading is geen reden om een lege vervanger te maken of de vorige compositie weg te schrijven.

Een wissel voltooit of annuleert eerst lopende modulehandelingen volgens hun bestaande regels. Bevestigde edits worden opgeslagen vóór de oude bewerkcontext wordt vrijgegeven. Een onopgeslagen Text-fout blokkeert de wissel met de bestaande opties opnieuw opslaan of tekst veilig kopiëren/exporteren; de wissel mag herstel niet verliezen. Een tijdelijke crop/drag vraagt afronden of annuleren en wordt niet impliciet een andere bewerking. Bij laadfout van het doel blijft de oude geaccepteerde Workbench behouden, met Opnieuw proberen of Terug naar overzicht.

Na een geslaagde wissel verwijzen Layers, eigenschappen, Artwork info, Undo en asynchrone resultaten uitsluitend naar de nieuwe Workbench. De vorige selectie en tekstcursor worden niet overgenomen. Een vertraagde Library-drop of bronrespons uit A mag nooit B wijzigen. Alleen de actieve module-runtime blijft actief; timers, listeners, media en gesprekken worden volgens hun levenscyclus vrijgegeven of onderbroken. Inactieve composities hoeven geen verborgen draaiende canvassen te zijn.

Voorstel: camera per Workbench tijdelijk binnen de sessie onthouden; bij eerste bezoek Fit canvas gebruiken. Wisselen is geen Undo-stap en geen wijziging aan publicatie. Toolindeling blijft een lokale werkruimtevoorkeur, zodat niet elke compositie een andere dockopstelling afdwingt. Camera en dockindeling zijn geen automatisch publieke auteurskeuzes.

Visitor wisselt alleen tussen publieke versies. Browser Terug brengt de vorige Workbench/context terug. Directe links gebruiken stabiele Workbench-identiteit, zodat hernoemen links niet verbreekt. Een onbekende of niet langer publieke bestemming toont een begrijpelijke onbeschikbaarmelding met het publieke overzicht, zonder private namen of een willekeurig vervangend canvas te suggereren. Waar de gewone profielingang landt, is nog een expliciete keuze.

## Opslaan en herstel

Voorstel: automatische lokale opslag per Workbench, met heldere statussen Opslaan, Lokaal opgeslagen en Opslaan mislukt. De overzichtslijst is afgeleid van geaccepteerde compositierecords; het toevoegen, hernoemen en verwijderen mag geen verweesde of half aangemaakte records opleveren. Een lijstitem is geen tweede kopie van de inhoud.

| Omvang | Bevat | Bevat niet |
| --- | --- | --- |
| Profiel | identiteit/Reception, gedeelde Keeper-configuratie, Workbench-identiteiten en overzicht, gedeelde Library-toegang | één gemengde inhoudslijst voor alle canvassen |
| Workbench | naam, formaat, modules, laagvolgorde, compositieblokken en authored layout | inhoud van andere Workbenches of walletcredentials |
| Lokale presentatie | actieve Workbench, tijdelijke camera per Workbench, gedeelde toolindeling | publieke publicatiekeuzes |
| Geschiedenis | Undo/Redo van de bijbehorende Workbench binnen de sessie | Undo op een andere compositie of een on-chain publicatie ongedaan maken |

De gedeelde Keeper hoort qua identiteit/configuratie bij het profiel. Zijn lokale gesprek en roaming blijven tijdelijke toestand. Welke dockpositie en publieke instelling profielbreed zijn, moet worden bepaald zonder dat wisselen die instelling tot compositie-inhoud maakt. De tabel wijst verantwoordelijkheden toe; ze is geen nieuwe Reception-layout.

**Opslaan is niet publiceren.** Bij A bewerken, naar B wisselen en B bewerken blijven beide lokale revisies bewaard. Er is geen beperking tot één opgeslagen Workbench. Voorstel voor de zichtbare status per item: **Privé · lokaal opgeslagen**, **Live · geen lokale wijzigingen**, **Live · lokale wijzigingen** of **Opslaan mislukt**. Alleen de actieve Workbench toont lopende invoer; het overzicht leidt de geaccepteerde status van alle composities af. Een publicatiefout mag niet als verlies van de lokale opslag worden voorgesteld.

Voorstel: de bestaande één-editor-per-profielregel blijft gelden, ook als twee tabbladen verschillende Workbenches willen bewerken. Dat houdt profieloverzicht en publicatie coherent. Parallel bewerken vraagt later een afzonderlijk ontwerp; meerdere canvassen zijn geen autorisatie om die beveiliging te verwijderen. Lokale opslag blijft browser-/origin-afhankelijk en is geen cloudbackup.

Backupvoorstel: een expliciete export van de huidige Workbench en later een hele-profielexport. Importeren voegt standaard een nieuwe private Workbench toe; het overschrijft niet ongemerkt alle composities. Een gerichte vervanging benoemt het doel, vereist bevestiging en controleert profiel/versie/inhoud. Maak bij de uiteindelijke overgang eerst een expliciet besproken backup van de huidige echte compositie. De ontwikkelpolicy vereist geen algemene legacy-migratielaag.

Verwijderen is een aparte vervolgkeuze: lokaal verwijderen en publiek uit het overzicht halen zijn verschillende gevolgen. Een publieke Workbench lokaal weggooien mag niet stilzwijgend een publicatietransactie starten. Ontwerp herstel/backup en een expliciet bevestigde verwijderroute voordat de actie wordt aangeboden.

## Publiceren

**Gekozen:** geef vóór publicatie een expliciete keuze van de omvang. Voorstel: het publicatieoverzicht vinkt standaard de huidige Workbench aan, toont andere Workbenches met lokale wijzigingen met een eigen vinkje en biedt **Alle lokale wijzigingen selecteren**. De eigenaar kan ook een deel kiezen. Voorbereiden toont de namen, publieke inhoud, eventuele uitsluitingen, naam/herkenningsbeeld voor bezoekers en wat er sinds de laatste publicatie verandert. Nieuwe composities beginnen privé. Er is nooit automatische publicatie door aanmaken, wisselen, opslaan of alleen een vinkje: de bestaande afzonderlijke upload-/publicatiebevestiging blijft nodig.

Voorbeeld van het overzicht: **Lunar Desert — live bijwerken** (aangevinkt), **Resident Zero — live bijwerken** (niet aangevinkt), **Studies — voor het eerst publiceren** (niet aangevinkt). Alleen Lunar Desert kiezen bewaart de oude publieke Resident Zero. Beide aanvinken werkt beide publieke versies bij. Alle lokale wijzigingen selecteren neemt ook Studies op als expliciet aangekondigde eerste publicatie; een lege of niet-publiceerbare compositie krijgt een reden in plaats van stilzwijgende opname. Per-module publieke uitsluitingen blijven gelden. Bij een wijziging van de selectie wordt de exacte voorbereiding opnieuw gevalideerd.

Voorbeeld: bij Publiceer Lunar Desert mag het nieuwe lokale Text-artikel in Resident Zero niet meekomen. De publieke verzameling bestaat uit de nieuwe expliciet gekozen Lunar Desert plus de laatst bevestigde publicaties van andere Workbenches. Als een betrouwbare vorige publieke versie niet beschikbaar is, stopt de voorbereiding met herstelactie; ze valt niet terug op de huidige private draft van die andere compositie.

Een mogelijke technische vorm is één publiek profieldocument dat een lijst benoemde Workbenches bevat of naar geverifieerde composities verwijst. De exacte opslagvorm en versie worden pas bij implementatie vastgesteld, na controle van documentgroottes en gedeeltelijke laadfouten. Er is hier geen besluit tot nieuwe profielkeys of een nieuw contract. Gericht publiceren is een gebruikersbetekenis; de profielpublicatie kan daarvoor nog steeds als geheel worden bijgewerkt.

De bestaande stappen blijven herkenbaar: **voorbereiden → upload → walletbevestiging → bevestigde publicatie en teruglezen**. Een geslaagde upload alleen is geen live publicatie. De voortgang is aan profiel, Workbench en voorbereide revisie gebonden. Annulering, walletafwijzing, uploadfout of gewijzigd materiaal bewaart de vorige publieke versie en de lokale edits. De bestaande expliciete toestemming voor echte uploads en walletacties blijft vereist.

Als de gebruiker tijdens een lopende bevestiging wisselt, blijft de publicatie de oorspronkelijke Workbench/revisie betreffen. Een melding noemt die naam en markeert nooit de inmiddels actieve compositie als gepubliceerd. Verder werken na een afgeronde upload verandert de al voorbereide bytes niet: na succes kan de status dus meteen “Live, met nieuwe lokale wijzigingen” zijn. Het definitieve interactiebeleid tijdens die stappen moet die veiligheid zichtbaar houden.

**Uit publicatie halen** is een bewuste update van het publieke overzicht, geen wissen van de private Workbench. Een directe profielroute naar die compositie wordt daarna onbeschikbaar. Eerder gepubliceerde onveranderlijke bestanden kunnen via hun eigen verwijzing blijven bestaan; uit het profiel halen is geen belofte van wereldwijde verwijdering.

Profielbrede wijzigingen, zoals Reception of de volgorde van het publieke overzicht, krijgen een expliciete eigen publicatieomvang. Ze mogen niet ongemerkt alle compositiedrafts publiceren. Voorstel: de controle vóór bevestiging vermeldt elk profielbreed onderdeel dat ook verandert.

## Nog te kiezen

Drie hoofdkeuzes zijn in deze ronde voorgelegd:

1. **Publicatieomvang — gekozen:** de eigenaar krijgt vóór publicatie de optie voor alleen de huidige Workbench, afzonderlijke andere Workbenches of alle lokale wijzigingen. Lokale opslag bewaart alle composities onafhankelijk van die selectie. Standaard alleen de huidige aanvinken is het uitwerkingsvoorstel; welke Workbenches nieuw publiek worden staat expliciet in het overzicht. Profielbrede wijzigingen krijgen een herkenbare eigen selectie, met nog uit te werken details voor Reception/Keeper.
2. **Profielingang — uitgesteld:** Reception is de voorkeur als richting, maar nog niet voldoende ontworpen. Nu geen standaard landing vastleggen en geen Reception-herbouw toevoegen. Directe compositielinks en het overeengekomen publieke overzicht blijven onderdeel van de multi-Workbench-uitwerking.
3. **Keeper — besloten:** één Keeper reist mee tussen Workbenches. Dit vervangt het eerdere voorstel voor onafhankelijke Keepers. Library, identiteit en accountinstellingen blijven in het voorstel profielbreed; publieke Keeper-presentatie volgt apart.

Aanvullende voorstellen voor de volgende bespreking: handmatig gekozen overzichtsbeeld versus automatisch canvasbeeld; volgorde van publieke Workbenches; wat de eigenaar opent na herladen (laatst gebruikte aanbevolen); backupimport als nieuwe compositie; verwijder-/herstelbeleid. Geneste groepen, cross-Workbench-links en dupliceren zijn geen automatische eerste-stapvereisten. Exacte aantals-, opslag- en mediagrenzen worden technisch onderzocht en niet als onbeperkt beloofd.

## Technische aansluiting en bewijs

Bronbasis: branch `codex/audit-checkpoint-2026-10-19`, HEAD `32d9418843d996afc2e5203afa4552a6cd2d459a`. De werkboom bevat de eerdere lokale ontwerpdocumentatie; die is behouden. Dit is broninspectie, geen nieuwe CI- of deploycontrole.

- [Draftstore](../../../src/systemWorkflow/systemWorkflowDraftStore.js): opslagkey en geschiedenis hangen nu aan profieladres; één `currentDraft` en generatie bewaken gevalideerde commits. Dit moet expliciet kunnen onderscheiden welke Workbench wordt gewijzigd.
- [Layoutopslag](../../../src/public/ownerSystemWorkflow/workbenchLayoutStorage.js): één profielkey, gekoppeld aan de huidige draft-layout. Voorkom dat layout van A modules in B herintroduceert of toolindeling een tweede authored waarheid wordt.
- [Editorlease](../../../src/systemWorkflow/profileEditorLease.js): één profielgebonden schrijfrecht. Behoud die autoriteit los van de actieve compositie.
- [Backup](../../../src/systemWorkflow/workbenchBackup.js): huidige export omvat de volledige ene profieldraft en de restore vervangt die. Niet herlabelen als losse Workbench-import zonder een andere, gevalideerde grens.
- [Publicatie](../../../src/profileDocument/domain/profileDocumentPublication.js): canonieke profielbytes, hash en contextvalidatie. [Publicatiestate](../../../src/profileDocument/state/useProfileDocumentPublication.js) en [reconciliatie](../../../src/profileDocument/storage/ownerDraftReconciliation.js) beoordelen nu een profielpublicatie/draft. Zij moeten doel- en revisiegebonden blijven en geen andere private drafts overnemen.
- [Bestaande groepen](../../../src/systemWorkflow/domain/workbenchGroups.js) en [tijdelijke groepweergave](../../../src/public/ownerSystemWorkflow/WorkbenchGroupScene.jsx): geen kant-en-klaar model voor meerdere composities. Hernoemen van groepen naar Workbenches zou hun tijdelijke tegelpresentatie en module-inhoud verkeerd hergebruiken.

## Afgebakende vervolgstap

**Update na deze ontwerpronde:** de maker heeft de lokale stap hieronder
geautoriseerd en die is uitgevoerd. Zie [lokale implementatie en bewijs](local-workbenches.md).
De oorspronkelijke technische beschrijving en slotstatus hieronder zijn
historisch; publieke multi-Workbench-projectie blijft vervolgwerk.

Na de hoofdkeuzes eerst een gegevens- en gedragscontract voor profieloverzicht en afzonderlijke composities vastleggen, vóór Layers/docking verder wordt geïmplementeerd. Daarna één verticale lokale stap: twee benoemde lege Workbenches aanmaken, eigen inhoud opslaan, veilig wisselen en herladen, met bestaande save-/Text-herstelgrenzen intact. Publieke multi-Workbench-projectie en visitorwisselen vormen daarna een afzonderlijk te verifiëren stap; geen half werkende echte publicatie aanbieden.

Latere acceptatie moet bewijzen: A bewerken verandert B niet; dezelfde bron in A/B deelt geen mutable module-inhoud; Undo na terugkeer werkt alleen op de juiste compositie; een vertraagde respons van A wijzigt B niet; falend opslaan blokkeert verliesgevende wissels; publiceren van A behoudt de laatst gepubliceerde B zonder private edits; bezoeker ziet geen private composities; hernoemen behoudt directe links; gedeeltelijke laadfouten worden niet als lege compositie opgeslagen; backupimport overschrijft geen ander werk; naamwijziging/verwijderen tijdens publicatie verwisselt het doel niet.

Er zijn in deze ronde geen runtimewijzigingen, nieuwe tests, uploads, walletacties of deployments uitgevoerd. Documentverwijzingen en diff worden gecontroleerd. De bestaande app blijft de huidige single-Workbench-implementatie totdat een afzonderlijke implementatie wordt uitgevoerd.

# Inscape codekwaliteit in dertig uitvoerbare stappen

Opgesteld op 23 oktober 2026 op verzoek van de founder. Dit is het volledige technische uitvoerplan voor gerichte verbetering van onderhoudbaarheid, styling en verificatie. De founder heeft vervolgens de technische regie en lokale uitvoering geautoriseerd, inclusief het verdelen van afgebakende taken over nieuwe chats. De actuele uitvoeringsstatus staat uitsluitend in [code-quality-progress.json](code-quality-progress.json).

De laatste verduidelijking van de founder vervangt de aanvankelijke formulering 'niets verwijderen': aantoonbaar overbodige en vervangen implementatie mag worden verwijderd. De huidige bedoelde compositiewerking, Library met slepen naar het canvas, aanwezige modules, inhoud en UI-vormgeving moeten behouden blijven. Geen bestaande module of functie verwijderen om de code eenvoudiger te laten lijken. Verwijderingen vereisen bewijs van bereikbaarheid, een eventueel vervangend actief pad en passende regressiecontrole. Er is geen doel voor het aantal te verwijderen regels.

Werk uitsluitend in `C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work`. Lees bij uitvoering eerst de toepasselijke `AGENTS.md`, het [actieve contract](../../INSCAPE_ACTIVE_CONTRACT.md) en de [creative intent](../../INSCAPE_CREATIVE_INTENT.md). Het actieve contract blijft de productautoriteit. Dit plan verandert geen productkeuzes en activeert geen toekomstige functies. De lokale uitvoering en technische regie zijn in dit gesprek al geautoriseerd; vraag niet telkens opnieuw toestemming voor werk binnen de vastgelegde behoudgrenzen. Externe publicatie-, wallet- en deploymentgrenzen blijven gelden.

De eerste uitgevoerde tranche en haar precieze beperkingen staan in de
[gezamenlijke integratie-uitkomst](../code-quality/integration/result.md).
Gebruik die samen met de voortgangslijst; begin niet opnieuw met een algemene audit.

## Wat dit plan moet opleveren

Een werkruimte waarvan selectie, camerabeweging, module-inhoud, vensters, opslag en publicatie ieder een duidelijk verantwoordelijke eigenaar hebben. Een stylingstructuur waarin de huidige bedoelde vormgeving rechtstreeks verklaarbaar is. Een verificatieproces dat nieuwe functies daadwerkelijk meeneemt en de geteste bronversie vastlegt. Een volgende agent moet een wijziging kunnen uitvoeren zonder telkens de hele applicatie opnieuw te reconstrueren.

Een korter bestand, meer hooks, minder CSS-regels of meer tests is op zichzelf geen acceptatiecriterium. Elke structurele wijziging moet een concrete afhankelijkheid, dubbele verantwoordelijkheid of aantoonbare onderhoudslast verminderen. Als inspectie aantoont dat een bestaande grens al voldoet, behoud die en lever het bijbehorende bewijs. Verplaats geen ongewijzigde wirwar naar een nieuw bestand om een stap af te vinken.

`Owner` in `OwnerSystemWorkflowRuntime` betekent hier de omgeving van de bevoegde bewerker tegenover de bezoeker. Met een architecturale eigenaar bedoelen we de ene plek die een gegeven of beslissing beheert. Deze twee betekenissen moeten onderscheiden blijven.

## Feitelijk vertrekpunt

Bij inspectie: branch `codex/audit-checkpoint-2026-10-19`, HEAD `32d9418843d996afc2e5203afa4552a6cd2d459a`, 476 gewijzigde of ongetrackte Git-statusregels vóór toevoeging van dit plan. Dat is geen telling van defecten. De huidige lokale bron is het vertrekpunt; teruggaan naar HEAD zou eerder werk verliezen.

- `OwnerSystemWorkflowRuntime.jsx` en `WorkbenchView.jsx` bevatten ieder circa 53 kB broncode. Inspectie toont veel samenkomende verantwoordelijkheden en compacte presentatie. De bestandsgrootte is een signaal, geen zelfstandig bewijs van een fout.
- De draftstore heeft expliciete validatie, foutafhandeling, editorbevoegdheid en activeringsgebonden schrijfhandles. In deze gesprekssessie zijn 37 gerichte tests voor opslag, Workbenches, Undo, layout, voorkeuren, editorlease en publicatieherstel opnieuw uitgevoerd: alle geslaagd. Dit vervangt geen volledige releasecontrole.
- `scripts/runBrowserTests.mjs` selecteert standaard 66 suites uit 229 aanwezige `*.browser.mjs`-bestanden. Onder andere `workbench-tool-docking`, `workbench-shared-tools`, `workbench-image-tools`, `workbench-shape-tools`, `destination-panels` en vijf designsysteemsuites staan buiten die standaardlijst. Dat bewijst een dekkingsgat in de standaardselectie; het betekent niet dat alle overige suites actueel zijn of nooit afzonderlijk zijn gedraaid.
- `package.json` en `scripts/verifyRelease.mjs` bevatten geen afzonderlijke lint- of typecheckstap. Er zijn zowel gedragstests als tekstpatroontests op broncode.
- Flat, tactile en bevel hebben nog actieve toepassingen. `workflowFlat.css` kiest expliciet flat varianten; dat is niet automatisch ongewenste reparatie-CSS. `libraryWorkspace.css` bevat onder andere `!important` op de zoekveldopmaak. Welke daarvan overbodig zijn moet per selector en toestand worden bewezen.
- [De laatste aanvullende opruiming](neutral-cleanup.md#aanvullende-broncontrole-en-opkuis) rapporteert 1.256 unit-tests, 53 browserchecks, 10 designsysteemtests en geslaagde builds. De eerdere afwijkende aantallen in datzelfde rapport horen bij eerdere rondes. Het rapport behoudt de Library-focusafwijking en vensteroverlap op smalle schermen als open kwesties.
- De geraadpleegde [CI-run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131) en Netlify-previewstatus horen bij de genoemde HEAD, niet bij alle lokale wijzigingen.

Deze inventaris is een gerichte bronbeoordeling. Het plan schrijft geen volledige herschrijving, nieuwe renderer, generiek pluginframework, frameworkmigratie of algehele TypeScript-conversie voor.

## Uitvoering en afronding

Voer de stappen standaard in nummerorde uit. Een stap mag over meerdere werksessies lopen. Werk in één gedeeld bronbestand niet gelijktijdig met meerdere schrijvende agents. Een afzonderlijke beoordelaar kan na een afgebakend resultaat onafhankelijk lezen en testen. Extra bevindingen krijgen een concrete vervolgplek; ze mogen het plan niet telkens vervangen door een nieuwe algemene audit.

De eigenaar van een stap levert:

1. Het aangetroffen probleem met bestanden en concrete afhankelijkheden, plus een korte uitleg van de gekozen wijziging.
2. De werkelijke wijziging tegenover de beginsituatie van deze stap, inclusief verwijderd oud pad. Bewaar bestaande wijzigingen van andere taken.
3. Gedraaide opdrachten, uitkomsten en blijvend vindbaar bewijs, gekoppeld aan de broninhoud waarop ze draaiden.
4. Visueel bewijs wanneer uiterlijk, geometrie, focus of interactie geraakt wordt.
5. Resterende beperkingen, met ernst en de stap die ze afhandelt.
6. Expliciete status: lokaal, gecommit, gepusht of gedeployd. Geen ervan mag uit een andere worden afgeleid.

Gebruik `pending`, `in_progress`, `implemented`, `verified` en `blocked` in de voortgangslijst. `implemented` is nog geen afgeronde stap. `verified` vereist dat alle acceptatiecriteria bewijs hebben. Een al adequate grens mag `verified` worden met `no_change_needed` en concrete inspectie- en testbewijzen. Een fout buiten de stap blokkeert alleen afhankelijke vervolgstappen; onafhankelijke stappen mogen verdergaan. De totale afronding blijft onvolledig zolang vereiste criteria openstaan.

Leg resultaten per stap vast onder `docs/audits/code-quality/step-NN/`. Maak die mappen pas bij uitvoering. Gebruik één kort `result.md` met links naar logs, bronmanifest, relevante beelden en eventuele review. Zet status niet tevens in meerdere documenten. Een bronwijziging maakt bewijs van de geraakte grens opnieuw te beoordelen; een wijziging aan alleen voortgangstekst vraagt geen volledige testrun.

Bij fouten: onderscheid productiebug, verouderde verwachting, onbetrouwbare test en omgevingsfout. Bewijs een verouderde verwachting tegen de afgesproken werking voordat de test wordt gewijzigd. Niet weglaten, overslaan of herhaald proberen totdat een toevallig groene run ontstaat. Los flakiness aantoonbaar op; bewaar de oorspronkelijke mislukking en verklaar de herhaling.

Bewaar bestaande vormgeving en interactie tijdens structurele stappen. Een noodzakelijke gedragsreparatie krijgt een eigen reproduceerbaar geval en expliciete beschrijving; nieuwe ontwerpkeuzes worden aan de founder voorgelegd. Gebruik Carbon en Mist, brede, smalle en lage viewports en relevante toestanden. Een behoudvergelijking moet ook vóór en na dezelfde inhoud en laadstatus hebben. Bewegende kunst mag geen excuus zijn om onverklaarde verschillen te negeren.

Respecteer het beschermde bestand `docs/INSCAPE_ALPHA_CONTINUATION_HANDOFF.md`: nooit openen, hashen, kopiëren, bewerken, stagen of meenemen in een snapshot. Blijf uit `E:/vscode/inscape`. Geen walletactie, upload, publicatie, push of deployment uit hoofde van dit plan. Ook een commit blijft onder de bestaande sessieautorisatie vallen; een lokaal herstelbaar snapshot is beschikbaar als commits niet zijn toegestaan.

## De gewenste verantwoordelijkheden

| Gegeven of handeling | Verantwoordelijke grens | Wat daarbuiten blijft |
| --- | --- | --- |
| Bewerkbevoegdheid en profielwissel | Bestaande editorlease en profielgrens | Vensterfocus is geen schrijfbevoegdheid |
| Opgeslagen composities en Undo | Draftstore en compositiegebonden operaties | Camera en editorvoorkeuren |
| Betekenis van module-inhoud | Image, Text, Shape, Keeper en andere bestaande modules | De host interpreteert geen creatieve parameters |
| Selectie op de Workbench | Eén expliciete Workbench-selectiegrens | Tekstcursor en selectie binnen een Display behouden hun eigen betekenis |
| Actief gereedschapsdoel | Afgeleid uit selectie en expliciete activatie | Geen tweede stilzwijgend gesynchroniseerde selectie |
| Camera | Bestaande `WorkbenchCamera` en navigatiecontroller | Opgeslagen artworkgeometrie |
| Docks en schermvensters | Editorvoorkeuren en bestaande venstercontrollers | Inhoud van een compositie |
| Publieke voorstelling | Expliciete gevalideerde projectie en publicatiestroom | Privécollecties, editorvoorkeuren en tijdelijke bezoekersacties |
| Vormgeving | Tokens, materiaalvarianten, venstergeometrie en lokale inhoudsstijlen | Reparatieregels zonder verklaarde eigenaar |

## Stap 01 Bewaar het echte vertrekpunt

**Waar:** Git-werkboom, `scripts/releaseEvidence.mjs`, huidige lokale bron en toegestane assets.

**Opdracht:** leg branch, HEAD, toegestane gewijzigde/ongetrackte bestanden, Node-versie en lockfile vast. Maak een herstelbaar lokaal snapshot van de actuele inhoud met een expliciete bestandslijst. Hergebruik de broninventaris waar passend; voeg benodigde lokale productdocumenten gericht toe. Sluit secrets, caches, buildoutput, andere checkouts en het beschermde handoffbestand uit. Test herstel in een aparte tijdelijke map zonder de werkboom terug te zetten.

**Klaar wanneer:** vergelijking van bestandshashes bevestigt dat alle opgenomen bestanden uit de tijdelijke herstelkopie gelijk zijn. De exclusions en locatie zijn vastgelegd. Een volgende agent kan de precieze lokale beginsituatie terugvinden. Geen `git reset`, globale stash of ongecontroleerde `git add .`.

## Stap 02 Maak de bestaande controles reproduceerbaar

**Waar:** `package.json`, `.node-version`, `scripts/verifyRelease.mjs`, `scripts/browserEnvironment.mjs` en bestaande testlogs.

**Opdracht:** voer met de vastgelegde runtime `npm run verify` uit tegen de actuele lokale bron. Bewaar de uitvoer en inventariseer welke suites de opdracht werkelijk start. Reproduceer fouten afzonderlijk. Maak een lijst met concrete oorzaken en verantwoordelijke vervolgstappen; verander nog geen productiegedrag om de nulmeting groen te krijgen.

**Klaar wanneer:** de baseline is volledig gerapporteerd, inclusief mislukte of niet uitgevoerde onderdelen, bronidentiteit, browser en commando's. De testomgeving kan dezelfde gekozen scenario's opnieuw uitvoeren. Een falende baseline is bruikbaar bewijs, geen geslaagde release.

## Stap 03 Dicht de gaten in de standaard testselectie

**Waar:** `scripts/runBrowserTests.mjs`, `scripts/verifyRelease.mjs`, de 229 bestaande browserbestanden en `.github/workflows/verify.yml`.

**Opdracht:** geef ieder browserbestand een expliciete bestemming: actuele releasecontrole, gerichte/modulecontrole, prestatiemeting, historische kandidaat of gemotiveerd vervallen. Maak één machineleesbare suitecatalogus en laat de runner daaruit selecteren. Neem de actuele docking-, Layers-, shared-tools-, Navigator-, sidebar-, bestemmings- en designsysteemstromen mee in de relevante releasecontrole. Bewijs functionele vervanging voordat een oude suite vervalt. Nieuwe ongeclassificeerde suites moeten de cataloguscontrole laten falen.

**Klaar wanneer:** elk aanwezig bestand is verantwoord, geselecteerde bestanden bestaan en een bewust tijdelijk toegevoegde ongeclassificeerde testsuite wordt door de controle gedetecteerd. CI gebruikt dezelfde catalogus. De nieuwe selectie is gedraaid; de 30-minutengrens van de workflow is gemeten en zo nodig door verantwoorde verdeling opgelost, zonder dekking stil te schrappen.

## Stap 04 Leg eigenaarschap en regressies vast

**Waar:** `OwnerSystemWorkflowRuntime.jsx`, `WorkbenchView.jsx`, `WorkbenchViewContext.js`, draftstore, layoutcache, voorkeuren, Library en publicatie.

**Opdracht:** traceer per gegeven de bron, schrijvers, lezers, tijdelijke kopieën en invalidatie. Maak een compacte kaart met bestaande imports en verantwoordelijkheden. Koppel elk gevonden conflict aan precies één volgende stap. Maak een vaste regressiematrix voor profiel A/B, Workbench A/B, single/multiselect, owner/visitor, opslagfout, Undo, reload, inspectie, docking en smalle schermen. Hergebruik bestaande fixtures en vul alleen echte gedragsgaten aan.

**Klaar wanneer:** elke risicovolle overgang een bestaand of toegevoegd testscenario heeft en ieder structureel probleem een bestemming in dit plan. Bekende afwijkingen staan zichtbaar in de baseline. De kaart beschrijft de huidige code; ze wordt geen tweede productcontract.

## Stap 05 Voeg gerichte statische controles toe

**Waar:** `package.json`, lockfile, nieuwe beperkte lintconfiguratie en de normale verificatie.

**Opdracht:** voeg controles toe op ongeldige React-hookaanroepen, hookafhankelijkheden, ongedefinieerde namen, onbereikbare code en ongebruikte imports. Inspecteer meldingen inhoudelijk. Leg bestaande uitzonderingen met reden en exacte locatie vast; nieuwe of gewijzigde code mag geen nieuwe onverklaarde meldingen toevoegen. Kies minimale onderhouden ontwikkelafhankelijkheden en documenteer hun nut. Geen geforceerde dependency-fixes of bulk-autofix.

**Klaar wanneer:** `npm run lint` bestaat, in verificatie is opgenomen en een doelbewust geïntroduceerde relevante fout detecteert. Meldingen in de te bewerken kernbestanden zijn opgelost of aan een concrete stap toegewezen; een blanket-disable telt niet als oplossing. De exceptionlijst kan niet ongemerkt groeien.

## Stap 06 Maak de centrale code leesbaar

**Waar:** eerst `OwnerSystemWorkflowRuntime.jsx`, `WorkbenchView.jsx`, daarna alleen de direct bij uitvoering betrokken bestanden.

**Opdracht:** scheid statements, maak voorwaarden en JSX leesbaar en geef niet-triviale beslissingen een beschrijvende naam. Houd deze mechanische wijziging los van gedrag en architectuur. Leg een consistente formatteringsafspraak vast zonder de hele repository opnieuw te formatteren. Als een helper extra gedrag of een nieuwe afhankelijkheid introduceert, verplaats die wijziging naar de inhoudelijke stap.

**Klaar wanneer:** een afzonderlijke diff laat precies de leesbaarheidswijziging zien. Relevante bestaande checks blijven gelijk; bronpatroontests worden uitsluitend wegens aantoonbare vormwijziging aangepast. Bestandsgrootte is geen doel. Geen onbedoelde stylesheet- of Identity-wijzigingen.

## Stap 07 Maak gedeelde gegevensafspraken controleerbaar

**Waar:** draftstore-scope, `WorkbenchViewContext.js`, toolregistraties, modulepresentaties en `workbenchPresentationCapture.js`.

**Opdracht:** beschrijf de bestaande grensobjecten met JSDoc-typen en controleer ze met een afgebakende typecheck. Start met module-ID, Workbench-scope, selectie/activatie, presentatie, toolregistratie en opslagresultaat. Beschrijf expliciet nullable, unavailable en disposed situaties. Hergebruik domeinmodellen; runtimevalidatie blijft vereist voor opgeslagen of externe invoer. Geen volledige TypeScript-migratie.

**Klaar wanneer:** `npm run typecheck` de genoemde grenzen controleert en een opzettelijk verkeerde module-ID/argumentvorm waar de typen onderscheid maken faalt. Concrete callers zijn meegenomen; brede `any`-velden mogen de gecontroleerde afspraken niet uithollen. Uitbreiding naar meer bestanden volgt alleen waar een latere stap die raakt.

## Stap 08 Sluit verouderde Workbench-schrijvers expliciet uit

**Waar:** `systemWorkflowDraftStore.js:getWorkbenchScope`, `profileEditorLease.js`, `workbenchCollection.test.js`.

**Opdracht:** vervang de huidige constructie die alle API-methoden kopieert en sommige schrijvers achter een namenlijst beschermt door een expliciete beperkte scope-interface. Verouderde scopes mogen alleen hun bedoelde oude leesbeeld houden; schrijven, herstel, Undo en contextwissel moeten expliciet actuele bevoegdheid vereisen. De bestaande lease blijft de eigenaar van bewerkbevoegdheid.

**Klaar wanneer:** A → B → A, profielwissel, editorrelease, late retries en oude callbacks geen nieuwe context kunnen wijzigen. Tests bestrijken iedere geëxposeerde schrijfmethode. Een nieuw API-lid komt niet automatisch op een oude scope terecht. De bestaande 37 kerncontroles en gerichte browserwisseltests slagen.

## Stap 09 Verduidelijk het pad van bewerking naar opgeslagen toestand

**Waar:** `systemWorkflowDraftStore.js`, `workbenchCollection.js`, module-sessionbestanden, geschiedenis en backup.

**Opdracht:** traceer `commit` en `persistCollection`; maak de gedeelde voorwaarden en het acceptatiemoment expliciet. Verwijder alleen werkelijk dubbele logica. Behoud afzonderlijke semantiek voor gewone edits, contextwissel en herstel. Valideren, limietcontrole en succesvolle opslag moeten vóór het bekendmaken van de nieuwe geaccepteerde toestand komen. Module-inhoud blijft door de module gevalideerd. Behoud de gemeten optimalisatie voor ongewijzigde inactieve composities.

**Klaar wanneer:** quota-/lees-/schrijffouten, externe wijzigingen, gedeelde profielgegevens, Undo en backups aantoonbaar dezelfde garanties houden. Fouten onderscheiden oorzaak en herstelactie. Geen tweede store, nieuwe opslagengine of hypothetische migratielaag. Als de bestaande grens al voldoet, bewijs dat en behoud haar.

## Stap 10 Maak layout en opslag begrijpelijk vanuit één pad

**Waar:** `workbenchLayoutStorage.js`, `useWorkbenchLayoutPersistence.js`, `workbenchPresentationCapture.js`, `WorkbenchViewContext.js` en modulepresentaties.

**Opdracht:** leg de keten vast van tijdelijke sleepgeometrie naar voltooide modulegeometrie, lokale heropening en expliciete publicatie. Verduidelijk de voorrang van live presentatie, opgeslagen compositie en layoutcache. Verwijder aantoonbaar dubbele onafhankelijke schrijvers of redundant bijgehouden velden; behoud noodzakelijke tijdelijke previews en herstelcaches met hun invalidatieregel. Verander geen huidige save-semantiek zonder afzonderlijk onderbouwde bugreparatie.

**Klaar wanneer:** verplaatsen/resizen, Undo, sluiten/heropenen, Workbench-wissel, reload, backupherstel en mislukte opslag ieder een eenduidig resultaat hebben. Verwijderde modules keren niet terug uit een cache. Publicatie gebruikt de bedoelde vastgelegde presentatie. Een nieuwe module kan dezelfde bestaande route volgen zonder een extra onafhankelijke layoutwaarheid.

## Stap 11 Geef Workbench-selectie één duidelijke eigenaar

**Waar:** selectie in `WorkbenchView.jsx`, `activeModuleId` in `OwnerSystemWorkflowRuntime.jsx`, `WorkbenchLayers.jsx`, `ContextToolbar.jsx` en moduleactivatie.

**Opdracht:** maak expliciete acties voor enkel selecteren, toevoegen/verwijderen, leegmaken, een compositieblok binnengaan en selectie verliezen na verwijdering. Leid het gereedschapsdoel waar mogelijk af uit deze selectie. Leg afzonderlijk vast wanneer een module alleen geactiveerd wordt voor typen of inspectie. Behoud tekstcursor, Display-interne placements en Library-selectie als andere begrippen. Verwijder de dubbele beslissingen die dezelfde Workbench-selectie proberen te corrigeren.

**Klaar wanneer:** muis, toetsenbord, Layers en contextbediening dezelfde geselecteerde artworkgroep opleveren. Multi-select toont geen oude enkelvoudige Info; focus op een andere kandidaat vernietigt geen expliciete groep. Verwijderen, Undo en Workbench-wissel laten geen zwevend gereedschapsdoel achter. Deze gevallen zijn gedragstests.

## Stap 12 Geef modules een klein expliciet gereedschapscontract

**Waar:** `WorkbenchViewContext.js`, `WorkbenchSharedTools.jsx`, `SharedDisplayTools.jsx`, `sharedDisplayToolRegistry.js`, Image, Shape en Text.

**Opdracht:** beschrijf alleen de werkelijk gedeelde mogelijkheden, zoals lezen van Transform/Color, bewerken, annuleren en broninformatie leveren. Modules blijven eigenaar van inhoud en validatie. Maak registratie en uitschrijving activeringsgebonden. Verenig alleen werkelijk overlappende registraties; behoud het bezoekerpad en Display-specifieke instruments waar die ander gedrag dragen. Corrigeer misleidende Display-namen waar generieke verantwoordelijkheden verhuizen, met alle imports aangepast en zonder permanent aliaspad.

**Klaar wanneer:** selectie van Image, Shape, Text, Display en meerdere objecten direct het juiste gereedschap en de juiste beschikbaarheid geeft. Detachen of hergroeperen maakt geen tweede editorinstantie. Verwijderen of wisselen verwijdert de oude registratie. Geen nieuw generiek pluginsysteem of centrale tabel met creatieve modulelogica.

## Stap 13 Haal bewerkingsgebaren uit de centrale view

**Waar:** `WorkbenchViewControls` in `WorkbenchView.jsx`, `WorkbenchPlacement.jsx`, `systemWorkflowResize.js`, `resizeWorkbenchSelection.js` en snapping.

**Opdracht:** maak een afgebakende gebarencontroller met starten, tijdelijk bijwerken, bevestigen en annuleren voor marquee, bewegen en resizen. Gebruik bestaande geometriefuncties en opslagoperaties. Houd tijdelijke transform en opgeslagen wijziging afzonderlijk. Verwijder de verplaatste listeners en beslissingen uit de oude view; geef de controller alleen selectie, geometrie en concrete commit/cancel-acties.

**Klaar wanneer:** pointer-up bewaart precies eenmaal; Escape, blur, visibilitychange, captureverlies, preview en unmount ruimen de interactie op. Falen van opslag herstelt de juiste tijdelijke toestand. Groepsverplaatsing, snapping, tekstframes en hoekresizes blijven werken. De nieuwe controller ontvangt geen compleet runtimeobject als verborgen afhankelijkheid.

## Stap 14 Bewaak de bestaande cameragrens

**Waar:** `WorkbenchCamera.jsx`, `useWorkbenchNavigation.js`, `useWorkbenchCameraMotion.js`, Navigator en inspectie.

**Opdracht:** behoud de al bestaande scheiding tussen camera en auteurgegevens. Maak de nog benodigde samenwerking met de gebarencontroller expliciet via beperkte acties. Verwijder dubbele lock-, schaal- of offsetbeslissingen als stap 04 die aantoonde. Zorg dat Navigator, F-inspectie, Home, pan en zoom dezelfde camera gebruiken. De exploratietrial behoudt zijn eigen afgebakende wereldcamera.

**Klaar wanneer:** navigatie wijzigt geen compositie-inhoud en voegt geen authoring-Undo toe. Inspectie heen/terug, snelle omkering, reduced motion, kleine viewport en afgebroken beweging herstellen correct. Pannen triggert niet onnodig alle module-editors. Als deze grenzen al voldoende zijn, behoud ze en rond af met verificatie.

## Stap 15 Scheid schermgereedschap van compositievensters

**Waar:** `editorPreferencesStore.js`, `workbenchToolDockState.js`, `WorkbenchToolDocks.jsx`, `useWorkbenchUtilityWindow.js`, Text, Navigator en Keeper-dock.

**Opdracht:** laat de bestaande voorkeurenstore de gedeelde dockindeling en schermposities beheren. Laat compositiemodules hun eigen authored geometrie behouden. Verwijder eventuele overlappende opslag van dezelfde voorkeur uit layoutcache of lokale componentstate. Tijdelijke sleepvoorbeelden blijven tijdelijk. Consolidatie mag de bestaande uitzondering voor Text of Keeper niet stilzwijgend in een andere productfunctie veranderen.

**Klaar wanneer:** detach, rejoin, stapelen, sluiten, heropenen en reload dezelfde indeling herstellen. Workbench-wissel behoudt profielvoorkeuren; profielwissel mengt ze niet. Een kleinere viewport maakt vensters bereikbaar zonder opgeslagen kunstgeometrie te wijzigen. Opslagfouten en externe veranderingen behouden de bestaande zichtbare herstelmogelijkheid.

## Stap 16 Maak focus en invoerprioriteit voorspelbaar

**Waar:** tool-docks, `useOwnerSystemWorkflowPanels.js`, contextmenu's, keyboardhandlers, destination panels en onafhankelijke vensters.

**Opdracht:** leg per actieve interactie vast wie Escape, sneltoetsen, pointercapture en focusterugkeer afhandelt. Hergebruik concrete focushelpers waar meerdere paden dezelfde regel implementeren. Een nieuwer door de gebruiker gekozen focusdoel mag niet door een vertraagde callback overschreven worden. Reproduceer de gerapporteerde overlap op kleine schermen; herstel onbereikbare noodzakelijke bediening met de bestaande vensterregels. Een andere gewenste indeling is een afzonderlijke ontwerpkeuze.

**Klaar wanneer:** tekst typen activeert geen canvascommando; Escape sluit of annuleert de bedoelde bovenste interactie; gesloten/verborgen UI ontvangt geen focus. Close, Back, herstel en Publish-acties blijven bereikbaar op 390×844, 844×390 en 320×320. Werkende toetsenbordbediening vervangt geen controle op bereikbaarheid met de muis waar die is bedoeld.

## Stap 17 Maak de Library-grenzen expliciet

**Waar:** `src/library/state/useLibraryStore.js`, repositories en opslag onder `src/library`, `useBrowserWorkspace.js`, `OwnerSystemWorkflowLibraryPresenter.jsx` en drag/drop-targets.

**Opdracht:** traceer netwerkdata, profielgeneratie, cache, categorieorganisatie, bewaarde voorkeuren en tijdelijke selectie. Haal alleen aantoonbaar verkeerd geplaatste verantwoordelijkheden uit de presenter/store. Netwerkresultaten blijven aan hun oorspronkelijke profiel en aanvraag gekoppeld. De Library levert bronmateriaal; de ontvangende module bepaalt interpretatie en bewerkbare inhoud. Verwijder dubbele filter- of voorkeurstaat waar die dezelfde betekenis heeft.

**Klaar wanneer:** late netwerkresultaten na profielwissel worden genegeerd, mislukte refresh toont geen geslaagde lege inventaris, en lokale organisatie wordt pas als opgeslagen gemeld na bevestiging. Een vertraagde drop kan geen andere module treffen. Hergebruik van één bron in twee Workbenches deelt geen mutable crop, tekst of afmetingen. Bestaande bronrelaties en provenance blijven onderscheiden.

## Stap 18 Houd preview en publicatie buiten de bewerkingscoördinatie

**Waar:** `useWorkbenchPreview.js`, `workbenchPresentationCapture.js`, `OwnerSystemWorkflowPublicationRack.jsx`, `profileDocumentV9Builder.js` en owner/visitor-grenzen.

**Opdracht:** maak de verbinding tussen de bewerker en preview/publicatie beperkt tot een expliciete gevalideerde snapshot, status en acties. Houd voorbereiden, upload, verificatie, walletbevestiging en herstel bij hun bestaande eigenaren. Hostnavigatie mag deze stappen niet stil starten. Verwijder dubbele projectie- of bevestigingsbeslissingen als die in de host zijn achtergebleven.

**Klaar wanneer:** preview maakt geen publicatie of verborgen save, privégegevens/editorvoorkeuren blijven buiten het publieke document, en een vertraagde bevestiging blijft bij haar oorspronkelijke profiel/snapshot. De bestaande blokkade op publicatie van lokale multi-Workbenchcollecties blijft correct zichtbaar. Deze stap bouwt geen nieuw publicatieformaat en publiceert niets live.

## Stap 19 Sluit resourcelevenscycli af

**Waar:** module-registraties, `ArtworkSvgDocument.jsx`, `ProjectedSvgArtwork.jsx`, `useArtworkVisibility.js`, `HtmlArtworkFrame.jsx`, Keeper-motion en Text-editors.

**Opdracht:** inventariseer per geraakt onderdeel listeners, timers, animation frames, observers, object-URL's, aanvragen en mediaframes. Koppel acquisitie en vrijgave aan module, profiel en Workbench-activering. Repareer concrete ontbrekende cleanup of late callbacks. Gebruik bestaande runtime-isolatie; introduceer geen algemene lifecyclemanager zonder meerdere aantoonbare gelijke behoeften.

**Klaar wanneer:** herhaald openen/sluiten en A → B → A geen stijgende aantallen achtergebleven frames/listeners of doorlopende onzichtbare animatie veroorzaken. Geannuleerde downloads en verouderde registraties kunnen geen nieuw doel wijzigen. Test met echte ondersteunde animated SVG/HTML en Text, inclusief foutpad en gedeelde Keeper; alleen een lege canvas telt niet.

## Stap 20 Maak de runtime een leesbare samensteller

**Waar:** `OwnerSystemWorkflowRuntime.jsx`, `WorkbenchView.jsx` en de in stappen 08–19 aangepaste eigenaren.

**Opdracht:** verwijder resterende overbodige doorgeefketens, duplicated state en oude listeners nadat de nieuwe concrete grenzen werken. De runtime kiest de actieve sessie, koppelt eigenaren aan beperkte inputs en rendert bestaande onderdelen. Hij bevat geen eigen alternatieve selectie-, opslag-, Library- of publicatielogica. Hernoem verplaatste onderdelen alleen als dat hun echte functie verduidelijkt.

**Klaar wanneer:** voor elk type beslissing uit de verantwoordelijkheidstabel is één actuele eigenaar aanwijsbaar. Een reviewer kan de route van selectie naar gereedschap en van edit naar opslag volgen zonder vijf verschillende lokale kopieën te reconstrueren. De regressiematrix slaagt. Geen streefaantal regels, mega-hook met dezelfde inhoud, mapverplaatsing als enige winst of duplicaatpad dat voor de zekerheid blijft staan.

## Stap 21 Breng de actieve styling precies in kaart

**Waar:** `src/index.css`, `inscapeTokens.css`, `ownerSystemWorkflow.css`, `workflowTactile.css`, `workflowFlat.css`, `workbenchToolChrome.css`, `workbenchWindowChrome.css`, module-CSS en designsysteemreferentie.

**Opdracht:** leg imports, laadvolgorde, materiaalopt-ins, tokens, specificity en werkelijk winnende regels vast voor de behouden oppervlakken. Neem owner, visitor, portalled menu's, standalone Discover en de referentie mee. Maak een lijst met iedere onderzochte `!important` en override: bedoelde variant, toegankelijkheidsregel, tijdelijke projectie of reparatie van een verkeerde basistoepassing. Gebruik browsermetingen en statische bronanalyse samen.

**Klaar wanneer:** iedere migratiesurface een benoemde materiaal- en geometrie-eigenaar heeft. De custom Identity-kaart en overige bewust behouden tactile/bevel-oppervlakken staan expliciet bij behouden gedrag. Er is een concrete lijst van te verwijderen/conflicterende regels, plus gerechtvaardigde uitzonderingen. Geen automatische aanname dat `!important`, een CSS-variant of `@layer` op zichzelf een defect is.

## Stap 22 Verduidelijk tokens zonder de vormgeving te veranderen

**Waar:** `inscapeTokens.css`, materiaalbestanden, `design-system/registry.js`, `scripts/designSystemInventory.js` en componenttokens.

**Opdracht:** geef bestaande kleuren, typografierollen, controlmaten en materiaalwaarden een expliciete bron. Verwijder werkelijk dubbele definities met dezelfde betekenis. Behoud verschillende waarden met verschillende functies, ook als ze toevallig gelijk zijn. Laat geometry bij het component en materiaal bij het materiaal. Behoud de afgesproken fontrollen, waaronder de scoped Inter-creationbar. Hergebruik de bestaande inventaris; maak geen tweede parallel tokensysteem.

**Klaar wanneer:** gewijzigde oppervlakken in beide thema's dezelfde bedoelde computed styles hebben, alle tokenreferenties oplossen en app/referentie de gedeelde bron gebruiken. Gegenereerde bestanden zijn actueel. Geen palette- of fontverandering en geen ongefundeerde samenvoeging van artwork- en UI-waarden.

## Stap 23 Laat vensters hun juiste basis direct gebruiken

**Waar:** `WorkbenchToolPanel.jsx`, `WorkbenchDestinationPanel.jsx`, `OwnerSystemWorkflowDetachedWindow.jsx`, bijbehorende CSS en de huidige consumers.

**Opdracht:** haal gedeelde structuur, titelbalk, scrollbegrenzing en controls uit werkelijk dubbele implementaties. Gebruik de bestaande primitives als vertrekpunt. Maak materiaalkeuze expliciet zodat een flat venster niet onnodig meerdere bevel-recepten moet neutraliseren. Houd docking, schermpositie en authored modulegeometrie bij hun eigen controllers; gelijk uiterlijk betekent niet identiek gedrag.

**Klaar wanneer:** de vastgelegde vensterlijst ieder één verklaarbare route voor structuur en materiaal heeft. Verwijderde oude regels verdwijnen in dezelfde wijziging. App en referentie blijven gelijk; smalle/lage vensters houden bereikbare kop-, sluit- en primaire acties. Custom Identity-bronbestanden en rendering blijven behouden, met een expliciete controle op veranderingen door gedeelde CSS.

## Stap 24 Verwijder reparatie-overrides aan hun oorzaak

**Waar:** de concrete lijst uit stap 21, in het bijzonder `libraryWorkspace.css` en de gedeelde workflow-/toolregels.

**Opdracht:** behandel iedere ongewenste override door de te brede basisselector, verkeerde opt-in of onduidelijke importverantwoordelijkheid te corrigeren. Verwijder de overbodige regel in dezelfde diff. Reproduceer apart het versmallende Library-zoekveld bij focus, bepaal welke regel dat veroorzaakt en herstel dat gedrag volgens de bestaande bedoelde geometrie. Bewaar noodzakelijke regels voor verborgen inhoud, reduced motion en tijdelijke cameraprojectie. Stap niet blind over op globale cascade layers.

**Klaar wanneer:** iedere onderzochte override is verwijderd met voor/na-bewijs of behouden met functie en eigenaar. Focus, hover, pressed, selected, disabled, menu-open, forced colors en reduced motion zijn gecontroleerd op de geraakte bediening. Geen extra specificity of nieuwe `!important` als onverklaarde pleister. De Library-fix heeft een eigen gedragstest en wordt niet verstopt in een behoudclaim.

## Stap 25 Rond ongebruikte code en styles af met een sluitende lijst

**Waar:** bereikbare app- en referentie-entrypoints, dynamische imports, scripts, tests, publieke assets en CSS-klasseconstructies.

**Opdracht:** hergebruik de bestaande import-/designinventaris en de eerdere cleanupbevindingen. Maak voor iedere kandidaat een beslissing met bewijs: verwijderen, echte runtimegebruiker, testfixture, ontwikkelingstool of bewust behouden variant. Zoek ook dynamische namen, data-attributen, DOM-selectors, portalled content en assetverwijzingen. Verwijder dode paden samen met hun exclusieve CSS, exports, fixtures en obsolete tests; behoud noodzakelijke huidige testdekking.

**Klaar wanneer:** alle kandidaten uit de afgebakende inventaris zijn verantwoord en beide builds werken. De bronzoekactie naar verwijderde symbolen en de grafiekcontrole bevestigen dat geen nieuw restpad is achtergebleven. Geen codeverwijdering puur wegens ontbrekende letterlijke klassenaam. De eindclaim noemt de onderzochte entrypoints en beperkingen, niet 'nergens meer dode code'.

## Stap 26 Vervang broze gedragclaims in tests

**Waar:** onder andere `OwnerSystemWorkflowShell.test.js`, `ownerSystemWorkflowPolish.test.js`, relevante CSS-/bronpatroontests en de suites uit stap 03.

**Opdracht:** classificeer tekstpatroontests op hun doel. Behoud zinvolle statische grenzen zoals verboden imports, ownercode in publieke chunks en beveiligingsconfiguratie. Vervang tests die gebruikersgedrag beweren door uitvoerbare scenario's van dat gedrag. Hergebruik bestaande browser-/modeltests waar ze hetzelfde al bewijzen; verwijder redundant geworden assertions met een expliciete mapping naar hun vervanger. Voor tests die nieuwe regressierisico's afdekken: toon met een kleine tijdelijke fout aan dat de test het verkeerde gedrag detecteert, en herstel die fout daarna.

**Klaar wanneer:** hernoemen of formatteren van een interne callback breekt geen gedragstest, terwijl de bedoelde fout wel faalt. Geen snapshots of regexen die alleen de actuele implementatie bevestigen. Minder tests mag alleen met aantoonbaar behouden gedragdekking; aantallen zijn geen kwaliteitsscore.

## Stap 27 Meet prestaties op representatieve inhoud

**Waar:** `filled-workbench-performance.mjs`, de bijbehorende fixture, eerdere metingen van 20/21 oktober, camera, modules en opgeslagen collectie.

**Opdracht:** herhaal de bestaande gevulde workload met één actieve en meerdere opgeslagen Workbenches, inclusief bewegend artwork, langere Text en HTML. Meet afzonderlijk edit/save, typen, wisselen, pan/zoom, actieve frames en CPU-/framebelasting. Vergelijk dezelfde browser, content, viewport en buildvorm. Gebruik de eerdere meetcorrectie voor HTML/pan. Repareer alleen reproduceerbare regressies of concrete onnodige arbeid; behoud benodigde media- en beeldkwaliteit.

**Klaar wanneer:** de oorspronkelijke meetdefinitie, ruwe resultaten en spreiding beschikbaar zijn, er geen onverklaarde verslechtering is en inactieve composities geen uitvoerbare artworkframes behouden. Buildbudgetten blijven gehandhaafd. Geen budgetverhoging, onzichtbare resolutieverlaging, extra cache of nieuwe renderer om een slechte meting te maskeren. Een blijvende schaalgrens, zoals synchrone collectieopslag, blijft expliciet benoemd.

## Stap 28 Verifieer bevoegdheid en publieke isolatie

**Waar:** profiel/editorgrens, `publicBoundary.test.js`, `ownerRuntimeIsolation`, productie-CSP, artworkhost, publicatieprojectie en herstel.

**Opdracht:** voer de bestaande beveiligings- en standaardencontroles uit en vul concrete gaten toe die de herstructurering raakte. Controleer dat visitorinteractie geen ownerdata schrijft, privégegevens en editorvoorkeuren niet in publicatie belanden, en artworkcode geïsoleerd blijft. Lees vóór LUKSO-gerelateerde wijzigingen de bestaande engineeringbaseline en controleer relevante actuele officiële standaarden. Gebruik gecontroleerde wallet-/uploadfixtures; maak geen live transacties.

**Klaar wanneer:** account- en profielwissel, ingetrokken bewerkbevoegdheid, oude snapshots, corrupte externe documenten en vertraagde publicatiebevestiging de afgesproken grenzen houden. `npm run test:lukso-standards`, relevante browserchecks, beveiligingstests en productiebuild slagen. De publicatieblokkade voor lokale collecties blijft behouden. Deze stap levert regressiebewijs, geen claim van een volledige onafhankelijke securitycertificering.

## Stap 29 Draai de volledige actuele eindcontrole

**Waar:** de bijgewerkte `npm run verify`, de suitecatalogus, productie-startup, standalone designsysteembuild en bewijsmanifesten.

**Opdracht:** controleer de uiteindelijke stabiele bron met unit-, browser-, lint-, type-, standaarden-, designsysteem-, buildbudget- en productie-startuptests. Draai ook `npm run design-system:build`. Controleer de gehele actuele regressiematrix en inspecteer relevante screenshots; alleen fixture-unittests zijn onvoldoende. Leg bron-, lockfile- en artifactidentiteit vast met bestaande release-evidence. Verifieer dat de catalogus alle vereiste suites daadwerkelijk heeft uitgevoerd.

**Klaar wanneer:** alle verplichte controles slagen op de bedoelde bron, er geen onverklaarde skips zijn en iedere bekende afwijking een expliciete status heeft. Een falend onderdeel wordt gericht gerepareerd en passend opnieuw getest. Als code na deze run verandert, moet het geraakte bewijs worden vernieuwd en moet de definitieve releasecontrole de uiteindelijke bron dekken. Geen externe CI- of deployclaim zonder bewijs van precies die versie.

## Stap 30 Laat het resultaat onafhankelijk beoordelen en draag het over

**Waar:** uiteindelijke diff sinds stap 01, verantwoordelijkheidstabel, suitecatalogus, uitzonderingen en bewijs uit de voorgaande stappen.

**Opdracht:** laat een andere reviewer/agent eerst de bron en acceptatiecriteria beoordelen, daarna de uitvoerdersrapporten vergelijken. Laat die expliciet zoeken naar verplaatste complexiteit, tweede toestandsbronnen, achtergebleven paden, CSS-reparaties, ontbrekende tests en te ruime afrondingsclaims. De reviewer inspecteert ook omgekeerd: van bestaande entrypoints en styles naar de inventaris, zodat ontbrekende inventarisregels zichtbaar worden. Nieuwe bevindingen krijgen een ID en gaan terug naar hun verantwoordelijke stap; herschrijf niet het hele plan. Na reparaties volgt gerichte herbeoordeling en zo nodig vernieuwing van stap 29.

**Klaar wanneer:** de review heeft geen open blokkerende bevindingen binnen de afgesproken scope, alle dertig stappen hebben verifieerbare uitkomsten, en resterende productkeuzes of technische grenzen zijn afzonderlijk benoemd. Lever één actuele leeswijzer naar eigenaarschap, standaardcommando's en het bewijs. Voeg aan `AGENTS.md` alleen een korte verwijzing toe als de founder dit uitvoertraject als blijvende werkwijze heeft gekozen; kopieer het hele plan niet naar die instructies. Rapporteer nauwkeurig wat lokaal, gecommit, gepusht of gedeployd is. Een release/deployment blijft een afzonderlijke geautoriseerde actie.

## Verificatie tijdens de stappen

Gebruik de volgende bestaande kerncontrole bij wijzigingen aan opslag, scope of herstel. Breid haar alleen uit waar de wijziging extra grenzen raakt:

```powershell
node --test --test-reporter=spec src/systemWorkflow/workbenchCollection.test.js src/systemWorkflow/draftStoreIsolation.test.js src/systemWorkflow/systemWorkflowDraftStore.history.test.js src/systemWorkflow/profileEditorLease.test.js src/public/ownerSystemWorkflow/editorPreferencesStore.test.js src/public/ownerSystemWorkflow/workbenchLayoutStorage.test.js src/profileDocument/storage/publicationRecovery.test.js
```

Browserchecks lopen via de bestaande runner, die zelf een beschikbare lokale poort kiest. Bijvoorbeeld voor een wijziging aan tools:

```powershell
node scripts/runBrowserTests.mjs workbench-artwork-layers workbench-shared-tools workbench-tool-docking workbench-image-tools workbench-shape-tools editor-preferences
```

Voor camera/navigatie onder andere:

```powershell
node scripts/runBrowserTests.mjs workbench-navigation-boundary workbench-focus-toggle workbench-focus-motion workbench-inspection-keyboard workbench-inspection-lock workbench-navigator
```

Verifieer bij uitvoering dat namen en doelen nog actueel zijn. De catalogus uit stap 03 wordt de selecterende bron; deze voorbeelden zijn geen tweede volledige suitecatalogus. Bij productiegrenswijzigingen blijven `npm run build` en `npm run build:check` verplicht. Bij een releasecheckpoint draait de volledige `npm test`; stap 29 controleert het complete eindresultaat. Draai niet voor iedere tekstwijziging de gehele suite.

## Opdracht die de founder per stap kan hergebruiken

```text
Voer stap NN uit van:
docs/audits/2026-10-23/code-quality-plan.md

Werk in C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work.
Lees de verplichte projectinstructies, het plan en code-quality-progress.json.
Controleer eerst dat de vereiste eerdere resultaten nog bij de huidige bron horen.
Rond de beschreven stap volledig af, inclusief de noodzakelijke verwijdering van
vervangen code en de voorgeschreven tests. Behoud productrichting, bestaande
bedoelde styling en werk van andere taken. Neem routinekeuzes zelf; vraag alleen
om een echte nieuwe productkeuze of ontbrekende, noodzakelijke autorisatie.

Leg resultaat en bewijs vast onder docs/audits/code-quality/step-NN/ en werk de
voortgangslijst bij. Beschrijf welke verantwoordelijkheid aantoonbaar eenvoudiger
werd, wat is verwijderd en welke beperkingen resteren. Geen ongefundeerde claim
dat de hele applicatie nu schoon is. Geen commit, push, upload, walletactie of
deployment zonder al aanwezige expliciete autorisatie. Als uitvoering geblokkeerd
is, geef de concrete oorzaak en de eerstvolgende uitvoerbare stap.
```

Een reeks kan met dezelfde opdracht worden gegeven: vervang de eerste regel door bijvoorbeeld `Voer stappen 01 tot en met 05 in volgorde uit`. De agent hoort binnen die geautoriseerde reeks verder te gaan zonder na elke routinehandeling opnieuw toestemming te vragen. Onafhankelijk schrijfwerk kan alleen parallel wanneer geen gedeelde bestanden of afhankelijkheden worden geraakt; één integrerende agent blijft verantwoordelijk voor het gezamenlijke resultaat.

## Opdracht voor de onafhankelijke beoordelaar

```text
Beoordeel het resultaat van stap NN van docs/audits/2026-10-23/code-quality-plan.md.
Gebruik de actuele bron, de stapdelta, beginsituatie en concrete acceptatiecriteria.
Inspecteer eerst zelf de geraakte verantwoordelijkheid en testdekking; lees daarna
het uitvoerdersrapport. Wijzig geen code tijdens deze beoordeling.

Controleer of het oorspronkelijke pad echt is vervangen, de afhankelijkheden
eenvoudiger zijn, bestaande bedoelde UI en gedrag behouden zijn en de tests bij
de uiteindelijke bron horen. Zoek ook naar ontbrekende inventaris-items en tests
die alleen de implementatie nadoen. Rapporteer uitsluitend concrete bevindingen
met bestand, gevolg, reproduceerbaar scenario en herstelrichting. Benoem expliciet
wat je niet hebt kunnen verifiëren. Geef geen algemene schoonverklaring.
```

## Hoe een afgeronde stap moet worden uitgelegd

Een bruikbaar resultaat is bijvoorbeeld: 'Info en Transform gebruiken nu dezelfde expliciete Workbench-selectie. De tweede synchronisatiecallback en het oude pad zijn verwijderd. Deze zeven selectieovergangen en de relevante browserchecks slagen op bronmanifest X. De Display-interne selectie blijft module-eigen. De wijziging is lokaal.'

Onvoldoende zijn: 'alles opgeschoond', 'alle tests groen' zonder selectie en bronversie, 'architectuur modulair' na alleen bestanden splitsen, of 'UI ongewijzigd' zonder de geraakte toestanden te vergelijken. De founder hoeft geen extra technische trefwoorden te raden om dit bewijs alsnog te krijgen.

De dertig stappen hebben een einde: de afgesproken eigenaarschap-, styling- en verificatiecriteria zijn aangetoond; relevante open bevindingen zijn afgehandeld of expliciet buiten scope geplaatst met onderbouwing. Latere nieuwe productfuncties vormen nieuw werk. Ze zijn geen reden om dit hele traject opnieuw te beginnen.

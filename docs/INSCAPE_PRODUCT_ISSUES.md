# Inscape — centrale uitvoeringslijst

23 november 2026 · De founder bepaalt de richting. Alleen de coördinerende hoofdagent schrijft in deze brief, deelt taken uit en vinkt ze af. Uitvoerende agents leveren code, testresultaten en resterende problemen aan. Nieuwe ontdekkingen komen eerst in deel 2. De hoofdagent koppelt ze aan een stap zodra de aanpak duidelijk is.

## Deel 1 — Wat we doen, in welke volgorde

Een vinkje betekent lokaal gecontroleerd. Publicatie en deployment worden afzonderlijk vermeld. Een geslaagde test van de oude werking bewijst geen opruiming. Bij elke verwijdering controleren we de normale gebruikersingang, achterliggende aanvragen en opslag, achtergebleven verwijzingen en de tests die de oude functie verplichten.

**Geen achterwaartse compatibiliteit.** De founder is de enige gebruiker. Oude documenten, backups en historische URLs mogen ophouden te werken. Verwijder verouderde readers, redirects, conversies en compatibiliteitstests. Test huidig gedrag met huidige documenten. Dit geeft geen opdracht om een daadwerkelijk profiel, bestand, publicatie of browseropslag te wissen.

### 1. Aanmelden en landen op Profile — lokaal gecontroleerd

- [x] 1a. Kale aanmelding. Toon alleen de aanmeldactie. Geen Discover, cover, uitgelichte artiest, lege coverplek of bijbehorende data-aanvraag.
- [x] 1b. Ingelogde root opent eigen Profile. Een expliciete artiestlink blijft bij die artiest na aanmelden. Uitloggen vanaf de eigen werkruimte opent de kale ingang.
- [x] 1c. Eigen, ongepubliceerd Profile opent normaal met een weg naar Studio. Een mislukte netwerkopvraag blijft als fout herkenbaar. P05.
- [x] 1d. Eigen profiel/account rechts. De linkerstrip toont uitsluitend iemand die je bezoekt. Tippen alleen aangemeld op andermans profiel. Bij geweigerde klembordtoegang is het volledige adres selecteerbaar. Verwijder Exhibition. P07–P10.

### 2. Eén Preview voor de huidige compositie — lokaal gecontroleerd

- [x] 2a. Studio → Preview toont de geopende compositie. Gebruik de huidige publieke compositieweergave waar die dezelfde inhoud rendert. Verwijder omvorming enkel om te kunnen previewen.
- [x] 2b. Verwijder de Reception-header, paginastijl-editor, bestemmingenmenu en oude viewportbediening uit deze preview. Een toekomstige breedteproef krijgt pas vorm na een nieuwe ontwerpkeuze.
- [x] 2c. Controleer een werk met vrije en geplaatste inhoud. Terug herstelt document, selectie en focus. Kijken verandert de conceptversie niet.

### 3. Discover, covers en mini-apps volledig verwijderen

- [x] 3a. Verwijder directory, zoeken, route, ingangen, netwerkcontroller en herstel-/terugkeerpaden. Houd actuele directe artiestlinks en algemene navigatie bruikbaar.
- [x] 3b. Verwijder de huidige coverketen van opbouw en publicatie tot validator, herstel en renderer. Er komt nu geen vervangend coverformaat.
- [x] 3c. Verwijder mini-apps uit creatie, uitvoering, Studio, publieke viewer, opslag en celrestricties. Verwijder ook apart HTML-entrypoint, iframe/bridge en exclusieve build-, release- en testregels. Oud S02 is hiermee vervangen.
- [x] 3d. Controleer lege aanmelding op DOM en netwerk, check buildmanifest, zoek productiecallers en test huidige composities met tekst, beeld en vormen.

### 4. Display, Reception en het oude Identity-venster tot aan de bron opruimen

- [ ] 4a. Verwijder Display-scènes, Grids, tekstkoppelingen, sleepdoelen, inspecteurcommando’s en metadata uit het huidige model. Verwijder bijbehorende publicatie-, Writing- en herstelpaden. Behoud zelfstandig doorlopende tekstframes en paginering als geavanceerde tekstfuncties. S04.
- [ ] 4b. Verwijder Reception als route, apart document, publicatiekandidaat, pagina, herstelactie en navigatiebestemming. Verplaats gebruikte geometrie en laagfuncties naar Studio. Controleer juist het huidige Profile en huidige Studio-werken. P01.
- [ ] 4c. Verwijder Identity-module, venster, launchers, afzonderlijke kaartlayout en moduleopslag. Breng de informatie die de huidige profielkaart wél gebruikt onder bij Profile. P02–P03 vervangen oud S01.
- [ ] 4d. Werk handleiding, publicatieoverzicht, toetsenbordlabels, testfixtures en releasechecks bij. Houd een lijst van gevonden oude namen met het resultaat van de callercontrole.

### 5. Eén Studio zonder modusschakelaars

- [ ] 5a. Verwijder conversie, “Use canvas modules”, keuzedwang en mode-afhankelijke commando’s. Eerste/laatste cel is een gewone toevoeging/verwijdering. Gebruik actuele objecten in beide invoegvolgordes. S07–S09.
- [ ] 5b. Ontkoppel vormbudget van celbudget en zoek andere blokkades door ongerelateerde objecten. Controleer met een afbeelding, vrije tekst, vorm, groep en cel naast elkaar: rangschik, bewaar, heropen, Undo, Preview en publiceer via fixture.
- [ ] 5c. Dezelfde teksttools en overflow voor hetzelfde object. Voorstel voor nieuwe vrije tekst: vaste breedte en groei naar beneden tot de maker zelf een hoogte kiest. Nog geen goedgekeurde standaard. S03.
- [x] 5d. Verwijder “Find resize corner” inclusief exclusieve camera-actie en testverwachting. Verifieer toetsenbordfocus en directe canvasvergroting. S05.
- [ ] 5e. Maak canvasafmetingen, uitlijningsraster, snapping, rastervorm en eigenschappen van een geselecteerd object eenduidig. Werkzoekfunctie, contextmenu en publicatie moeten hetzelfde vermogen bieden voor dezelfde situatie. S06, S09.

### 6. Overige Profile-acties en afronding

- [ ] 6a. Controleer elke publieke instelling in drie situaties: afgemeld, aangemeld op eigen profiel, op andermans profiel. Verwijder Studio-only instellingen uit publieke Settings. P04.
- [ ] 6b. Onderzoek intern volgen met extern zichtbare follow-status. Verifieer het actuele gedeelde protocol en ontwerp de gebruikersactie voordat er wordt geïmplementeerd. P06.
- [ ] 6c. Volg de complete routes van aanmelden tot Profile, Studio, Preview en terug. Controleer huidige publicatie- en herstelstromen, volledige regressiesuite, productiebuild en budgetten. Noteer apart welke build daadwerkelijk is gedeployed.

- [x] 6d.1. Diagnose en herstelroute voor de eigenaar lokaal gecontroleerd. Vanaf een afgewezen document opent Studio de publicatiecontrole. Selecteer de gewenste lokaal opgeslagen werken en bevestig expliciet welke selectie de oude publicatie vervangt.
- [ ] 6d.2. Optionele persoonlijke reset, uitsluitend op afzonderlijk verzoek. Inventariseer dan eerst de eigen lokale composities en herstelkopieën. Een reset is geen vereiste voor publicatieherstel.
- [x] 6d.3. Formaatcontrole en herhaalgedrag lokaal getest. Geteste uploadfunctie en publieke lezer op Netlify-preview 5 gezet. De bestaande lokale Studio gebruikt deze preview.
- [x] 6d.4. De founder bevestigde dat publiceren weer werkt. De directe profiellink op preview 5 is opnieuw geopend in een afgemelde sessie en toont de profielkaart van nomad.

### 7. Writing als zelfstandig blog

- [x] 7a. Verwijder de automatische opname van compositie- en profieltekst in Writing. Controleer hetzelfde gepubliceerde werk in Gallery en Writing.
- [ ] 7b. Geef Writing een eigen artikelredacteur en opslag. De auteur kan zelfstandige artikelen schrijven en aan Writing vastpinnen. Publieke lezers zien de vastgepinde artikelen.

## Deel 2 — Bevindingen, vragen en bewijs

| ID | Bevinding | Bestemming |
| --- | --- | --- |
| B01 | Studio, publicatie en herstel deelden een verborgen covergrid. De aanmaak, de aparte editorweergave en het publicatieveld zijn verwijderd. Het oude grid-ID wordt aan de validatiegrens geweigerd. | 3b afgerond |
| B02 | Studio Preview kiest tussen ReceptionEditorPreview, een tijdelijk geconverteerde compositie en de publicatieviewer. Page appearance kan de oude Reception-header terugbrengen. | 2 |
| B03 | Publicatie bouwt uit Reception een aparte kandidaat “Bento”. Backup kan die terugplaatsen. Writing leest er apart uit. | 4a–b |
| B04 | De Gallery-index kan zichtbaar “Edit” zeggen, als “Studio” worden voorgelezen en onEditReception aanroepen. Controleer de werkelijke gebruikersroute. | 4b |
| B05 | De gedeelde navigatie en Gallery-overgangen uit profileDiscovery staan nu in src/navigation. DisplayInstrumentWindow bevat nog het gedeelde venster van onder meer Text en Shapes. Controleer die gebruikers bij het verwijderen van Display. | 3a afgerond, 4a open |
| B06 | Galeriemodellen tellen Displays, tekstsleepinstructies verwijzen naar een unlocked Display en publiceren belooft Public Grids en Identity. Tests kunnen deze oude werking nog afdwingen. | 4a, 4d |
| B07 | Vormslots bepalen mede of er nog een cel kan worden toegevoegd. Bestaande groepen, camera-index en geavanceerde tekst kunnen toevoegen blokkeren. | 5a–b |
| B08 | Dupliceren verdwijnt voor een cel. Een transform elders kan meerdere inspecteur-/laagacties tijdelijk uitschakelen. Reproduceer uitgestelde of blijvende blokkades. Nesten is een afzonderlijke ontwerpvraag. | 5b |
| B09 | Writing haalde tekstblokken en gekoppelde passages uit composities en de oude profielindeling. Besluit: tekst in een werk blijft bij dat werk. Writing krijgt eigen artikelen die de auteur expliciet vastpint. | 7a-b |
| B10 | Profile details en Keeper zitten in één publicatiekeuze. Controleer waarom een profielwijziging een onafhankelijke module raakt. | Onderzoeken bij 4d |
| B11 | Identity-velden met waarde maar zonder label kunnen bij publiceren wegvallen. De oude kaart verbleef in P02/P03; check tijdens ontkoppeling welke velden de huidige kaart werkelijk gebruikt. | 4c |
| B12 | Inventaris: mini-apps hebben ook een afzonderlijk productie-entrypoint, walletbridge en release/headercontroles. De inventarisatie van 245 Git-gevolgde JSON-bestanden vond geen niet-lege documentvelden onder de onderzochte sleutels. De gepubliceerde nomad-revisie 1 bevat twee werken en nul miniApps-velden. Persoonlijke browseropslag is niet onderzocht. | 3c |
| B13 | Een apart werk aanmaken of hernoemen, toolbeschikbaarheid en herstelmeldingen dragen nog oude Canvas/Bento/Workbench-benamingen. Controleer betekenis en caller per naam. | 4d, 5a |
| B14 | Uitgelogde gebruikers konden een tipbedrag invoeren, een eigenaar kon zichzelf links zien en clipboard-falen verwees naar een andere site. | 1d |
| B15 | De oude parameter `?profile=` kon zowel de route als de initialisatie van Library en Signals beïnvloeden. De actuele expliciete artiestlink gebruikt `?view=`; bij embedden komt de profielcontext van de host. Oude fallback verwijderd en ondersteuningstests aangepast. | 1b |
| B16 | De volledige lintcheck meldt openstaande punten in SourceCardGrid, useEnvioSourceSearch, WorkbenchCanvasControls en TextWorkbench. De waarschuwing in de gewijzigde previewhook is opgelost. | Aparte kwaliteitscontrole bij 6c |
| B17 | Na uitloggen bleef de zichtbare aanmeldknop ongevoelig voor muisklikken. De klikafhandeling op het aanmeldscherm is hersteld. | 3a |
| B18 | Brede browsercontroles melden vier open punten buiten Discover: twee Library-tests verwachten een verborgen zoekveld in de DOM, een typografietest zoekt een oude canvas-selector en Settings wijkt af van de verwachte achtergrondkleur. Controleer per geval de actuele bediening en ontwerpafspraak. | 6c |
| B19 | De Studio Inspector zegt bij openen nog 'Select a cell or artwork to see its settings.' Controleer hoe de inspector voor elk selecteerbaar onderdeel dezelfde werkruimte beschrijft. | 5a |
| B20 | Bij rechtstreeks openen van Studio ontbrak de stylesheet voor de herstelknop bij geblokkeerde editortoegang. De editor laadt die nu zelf. In vier hersteltoestanden opent een echte klik opnieuw Studio. | 3a gecontroleerd |
| B21 | De walletstore en het Identity-model leveren nog een achtergrondadres uit de externe profielmetadata. Dat adres komt uit LSP3 en staat los van de Inscape-cover. Traceer bij de verwijdering van Identity welke velden de huidige profielkaart gebruikt. | 4c |
| B22 | De browsercatalogus beschrijft Display nog als geparkeerd en bevat tests voor de verwijderde Display-stage. Verplaats controles voor gedeelde Studio-functies naar hun huidige ingang en verwijder tests die uitsluitend de oude stage verplichten. | 4a |
| B23 | Het Display-griddomein eist een bestaande Display om een nieuwe scène te maken en blokkeert verwijdering van het laatste grid. Controleer bij de ontmanteling welke aanroepers nog bestaan. Een blokkade voor gewone Studio-objecten is hiermee niet aangetoond. | 4a |
| B24 | Op een vensterbreedte van 940 px overlapt de Information-actie het midden van een Gallery-tegel. Klikken op het artwork opent het werk. Controleer de klikvlakken bij de Gallery-controle. | 6c |
| B25 | Publieke revisie 8 (CID bafkreifshlkqw5sp6klijku4bpmp5nwyfnphd32uoqhk4n3zsgjpon5nlm) bevat metadata: {} op het profiel en in canvases[0].content. Beide zijn oude cover-velden zonder ingestelde cover. De huidige validator weigert het document al op het eerste veld (unexpected_fields). De twee werken zijn Kukabura en Nomad. Een lokale wipe verandert de publicatie niet. Herstelroute vanuit het eigenaarsprofiel lokaal getest. De openbare publicatie en persoonlijke composities zijn ongemoeid gelaten. | 6d.1 |
| B26 | Screenshot van het publiceren op localhost: INVALID_PROFILE_DOCUMENT bij IPFS_UPLOAD. De service weigert het nieuwe document al tijdens de upload. De lokale build op poort 8980 gebruikt de gehoste Netlify-preview. De lokale client vereist nu vóór de handtekening de actuele formaatcode uit de uploadservice. Een geslaagde upload bewaart de CID voor een nieuwe controle. Netlify-preview 5 is nu bijgewerkt. De founder bevestigde het herstel; de publieke profielkaart is onafhankelijk gecontroleerd. | 6d.3 |

### Controlelogboek

- 23 november 2026 — Inventaris van afhankelijkheden ontvangen. De implementatie start met afgebakende opdrachten voor aanmelding, navigatie, profielstrook en de onafhankelijke cameraknop. Basispunt ca73dd1e, met bestaande lokale wijzigingen. Uitkomsten van deze ronde komen hieronder.
- 1a lokaal gecontroleerd op 1440×900 en 940×640 in Chromium met de productie-ingang. Eén zichtbare aanmeldknop; geen afbeelding, wereldkaart, externe aanvraag, directory- of Grid-rendererchunk. De broncode splitst de ingang van de nog te verwijderen directory. Stap 3a blijft open.
- 1d lokaal gecontroleerd in Chromium met de volledige profielfixture en beide thema's. Gast, eigenaar en bezoeker hebben de juiste strip en tipactie; drie publieke tabs. Bij geweigerd kopiëren is het 42 tekens lange adres geselecteerd en keert de toetsenbordfocus terug. Geen wallettransactie uitgevoerd.
- 5d lokaal gecontroleerd. Knop, camerasprong en icoon verwijderd. Acht browsercontroles (vier schermmaten in twee thema’s) en negen sessietests geslaagd. Breedte instellen, pijltjestoetsen, direct slepen, Fit en focusterugkeer gecontroleerd. Browsercontroles liepen rechtstreeks via Playwright nadat de standaard Windows-procesmonitor vóór uitvoering faalde.

- 1b/1c lokaal gecontroleerd met de gebundelde app, Chromium 156 en geïsoleerde profiel-/walletfixtures. Aanmelden als A opent diens ongepubliceerde kaart met Studio; terug uit Studio en uitloggen opent de kale ingang. Vanaf een expliciete link naar artiest B blijft aanmelden als A op B. Netwerkfouten houden hun eigen statuspad. De bestaande profiel- en autorisatietests zijn mee gecontroleerd.
- Eerste ronde lokaal: volledige Node-suite 2044/2044 geslaagd (concurrency 2); de 14 routetests ook afzonderlijk na de laatste uitlogcorrectie. Productiebuild en build:check geslaagd (699561 initiële JS-bytes). Geen deployment of transactie. Volgende hoofdtaak: stap 2a, één compositiepreview.

- Stap 2 lokaal gecontroleerd. Studio gebruikt één dialoog met de publieke compositieweergave, gevoed met een tijdelijke projectie van het geopende werk. Geen eerste-celconversie, profielheader, paginabewerker, breedtemenu of bestemmingenmenu. Geavanceerde tekst, actieve geometrie en de afzonderlijke herstelcontrole blijven bij hun huidige gebruikers.
- Chromium: klassiek werk vanuit Gallery en na herladen; gemengd werk op 900 en 1440 pixels. Privélagen en inhoud van een privécel blijven buiten beeld. Terug en Escape herstellen editor, selectie en focus; URL en opgeslagen snapshot blijven gelijk. Onafhankelijke herstelcontrole op beide breedtes geslaagd. Fouten bij een niet-aangekoppelde runtimefunctie en een onklikbare terugknop zijn tijdens verificatie gecorrigeerd.
- Build en build:check geslaagd, 699561 initiële JS-bytes. Wijzigingen lokaal, ongecommit en niet gedeployed. Eerstvolgende hoofdtaak: 3a, de huidige Discover-directory en haar resterende ingangen verwijderen.

- Volledige Node-testsuite in deze ronde: 2048/2048. Zeven gerichte browsergevallen voor laagvolgorde, privé-inhoud, interactieve slides, transparantie en cameraterugkeer geslaagd. De screenshot van de gemengde compositie toont uitsluitend het werk en de knop Back to editing. De gewijzigde previewhook is lint-schoon; vier andere bestanden houden de volledige lintcheck rood (B16).
- In 17 Chromium-gevallen voor typografie, tegels, paginaweergave en StrictMode zijn de aangepaste controles geslaagd. Twee tests vergelijken de volledige opgeslagen JSON van acht lagen bij openen, terugkeren en herladen. Zowel het losse werk als de collectie bleef byte voor byte gelijk.

- Stap 3a lokaal gecontroleerd. Directory, zoekopdracht, resultaten, route en ingangen in profiel, Gallery en Studio zijn verwijderd. De gedeelde navigatie en Gallery-overgangen staan in src/navigation. Broncode en productie-output gecontroleerd op de oude directory en query; de productiebundel bevat geen directory. Covers in publicatie en herstel vallen onder 3b.
- Chromium met een gesimuleerde wallet en publicatiebron: kale login, eigen profiel, direct artiestbezoek, afmelden, opnieuw aanmelden, Gallery naar Studio en terug. Bij direct bezoek wordt alleen de gevraagde artiest opgezocht. De login laadt de walletconnector pas na een klik. De routecontrole is op 390 en 1440 pixels uitgevoerd. B17 hersteld en gecontroleerd.
- De volledige Node-suite slaagt met 2032/2032 tests. Build en build:check geslaagd (696004 initiële JS-bytes). Twee bredere browsersuites bevatten nog open controles (B18). De wijzigingen zijn lokaal. Eerstvolgende hoofdtaak is 3b, de coverketen verwijderen.

- De startup-browsertest slaagt ook bij directe Studio-start en herstel van editortoegang (13 scenario's). De herstelknop bleef eerder onklikbaar tot een profiel eerst de gedeelde stylesheet had geladen. Dit is bij de editor zelf opgelost (B20).
- Na de laatste wijziging aan de herstelknop slaagden 2031 van 2032 Node-tests in dezelfde run. De buildtest liep tijdens het kopiëren van een afbeelding vast op een volle tijdelijke schijf. De volledige groep productiebouwtests is opnieuw uitgevoerd en slaagde (24/24).

- 3b lokaal gecontroleerd. Studio maakt geen verborgen 25e grid aan. Het aparte coverkader van 768 bij 432 pixels, de cameraregels, coverselectie en aparte pointerprojectie zijn verwijderd. Gewone gridgeometrie en de uitsnede van een Gallery-miniatuur blijven werken.
- Publicatie schrijft geen cover-envelop op het profiel of aanvullende composities. De lokale uploadfunctie accepteerde twee composities zonder dat veld en weigerde de oude envelop voor externe I/O. Herstel houdt actuele privégrids intact. Oudere publicaties met het voormalige metadata-veld kunnen niet meer worden geopend. De conceptstore weigert het oude gereserveerde grid-ID zonder naar opslag te schrijven. Er zijn geen persoonlijke gegevens gewijzigd.
- Chromium op 940 en 1440 px: kale login, publiek werk openen, vanuit Gallery bewerken, herladen en terugkeren. Privéwerk bleef identiek. Afzonderlijk gecontroleerd: scènenavigatie, Undo en onafhankelijke bewerkingen. De oude Display-browsersuites zijn niet integraal uitgevoerd (B22).
- Volledige Node-suite 2028/2028. Typecheck, productiebuild, build:check en vijf LUKSO-baselinecontroles geslaagd. In de uitvoerbare bron en bundel is de enige overblijvende world-cover-verwijzing de weigering van het oude grid-ID. Productiecode +85/-283 regels; tests en fixtures +65/-145; gegenereerde designinventaris +17/-17. Lokaal, ongecommit en niet gedeployed. Volgende stap: 3c, mini-apps verwijderen.

- 6d.1. Chromium op 940 en 1440 px met gesimuleerde accounts: bij INVALID_DOCUMENT krijgt alleen de eigenaar de herstelactie. Getest met een gast, een ander account en een afwijkende documenthash. De review vraagt afzonderlijk om selectie en toestemming. Op een leeg toestel verschijnt het standaardwerk niet als herstelbare compositie. Een vervanging op basis van lokale werken start op revisie 1. Tijdens de controle zijn geen documenten geüpload en geen walletacties gestart.
- 6d.1. Volledige Node-suite 2028/2028 geslaagd; productiebuild en build:check geslaagd (696464 initiële JS-bytes). De herstelactie is lokaal beschikbaar en niet gedeployed.

- 6d.3. De productiebuild en build:check slagen (696329 initiële JS-bytes). De pagina op 127.0.0.1:8980 serveert de nieuw gebouwde ingang. Gerichte integratietests met een gesimuleerde wallet en opslagdienst controleren één uploadhandtekening, verificatie en de aparte profieltransactie. De versie van de draaiende Netlify-functie is niet onafhankelijk vastgesteld.
- Preview 5 is gekoppeld aan GitHub-branch codex/audit-checkpoint-2026-10-19 (basis 2352d762). Geïsoleerde kandidaat met 23 bestanden en 190 geslaagde gerichte tests. De huidige Studio en de preview-lezer zijn met zes composities en een gesimuleerde upload vergeleken. De volledige lokale studiosuite slaagt met 2028/2028. De afgebakende previewcontrole heeft 16 openstaande Windows-harnastests. Deploystatus wordt afzonderlijk bijgehouden.
- De preview-app zelf slaagde voor alle 1759 brontests. Chromium opende een document met zes werken en wisselde tussen de twee slides. De previewbuild telt 694424 initiële JS-bytes.

- 6d.3. Previewbranch codex/audit-checkpoint-2026-10-19 bijgewerkt met commit e5456670aa681693bbfd6d4f0f7ad6e3ebfd742a; Git-tree identiek aan de geteste kandidaat. Netlify meldt success voor preview 5 en twee gedeployde functies (deploy 6b049c9f0844bb6ee0fcd56b). De publieke route voor het nog ongewijzigde profiel opent het verwachte foutscherm; een echte uploadhandtekening en transactie zijn niet uitgevoerd. De afzonderlijke HTTP-proef van de live challenge vanuit de testomgeving werd door netwerktoegang geblokkeerd.

- 7a. In Chromium bleef het bijschrift in het werk zichtbaar op Profile en Gallery. Zowel eigenaar als bezoeker zag een lege Writing-pagina. Terug naar Studio opende hetzelfde werk. Twee browserscenario's en 18 profielcomponenttests slaagden. Productiebuild en build:check geslaagd (696290 initiële JS-bytes). Zelfstandige artikelen schrijven en vastpinnen staat open onder 7b.

- 3c lokaal gecontroleerd. Mini-apps zijn verwijderd uit Studio, opslag en herstel, publicatie, viewer, creatiemenu, vensterindeling en de aparte HTML-host met walletbridge. Het productiemanifest bevat alleen index.html. De zelfstandige kunstwerkviewer en WalletConnect-verificatie hebben nog hun eigen frames. In de gebundelde leverancierscode blijven twee treffers voor externe walletfuncties over.
- 2015/2015 lokale Node-tests, typecheck, build en build:check geslaagd. Chromium bevestigde compositietekst op Profile en Gallery en de lege Writing-tab voor eigenaar en gast. De huidige openbare nomad-publicatie (revisie 1, twee werken) bevat nul miniApps-velden. De aparte previewbuild slaagde. De volledige previewtestsuite heeft 1980 geslaagde en 16 falende tests in het Windows-build-/procesharnas. Previewpatch voor 3c en 7a voorbereid; uitrol wordt afzonderlijk geregistreerd.

- 3c en 7a uitgerold naar Netlify-testpreview #5 met commit cf009b584cb7fbf98bf4bb24b611b21bef235266 (87 bestanden). Netlify bevestigde de deploy. Op het profiel van nomad toonde Writing alleen 'No published writing yet.'. Gallery opende Kukabura met het oorspronkelijke bijschrift en vermeldde ook Nomad. Stap 7b blijft open.

- 3d lokaal gecontroleerd. Twee schone Chromium-sessies (940 en 1440 px) toonden alleen de aanmelding. Per sessie zes verzoeken naar de eigen oorsprong voor HTML, JavaScript, CSS en lettertypen. Geen media, externe verzoeken of WebSockets. Het buildmanifest en de HTML-uitvoer hebben één ingang. In de uitvoerbare bron resteert voor de oude cover alleen de expliciete weigering van het gereserveerde grid-ID. 47 gerichte tests voor compositiemodel, opslag en publieke weergave slaagden.

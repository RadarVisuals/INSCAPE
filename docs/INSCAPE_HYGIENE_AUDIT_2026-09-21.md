# INSCAPE hygiene-audit — 21 september 2026

Status: lokale onderzoeksbevindingen, geen productautoriteit of releasegoedkeuring.
De bevindingen hieronder beschrijven de audit vóór reparatie; de uitgevoerde
reparaties en hun verificatie staan in de aanvulling onderaan.
De active contract en creative intent zijn de gebruikte productcontext.
Geen historische audits of continuation handoff gebruikt als richting.

## Oordeel en bereik

De opslag- en domeinlaag bevatten bruikbare, geteste grenzen. De belangrijkste
gevonden problemen zitten in de levensduur van tijdelijke UI-acties en hersteldata.
Die verdienen voorrang boven hernoemen, formatteren of een brede herbouw.

Onderzocht: Workbench → Display/Text → profielopslag; tekstherstel; undo;
previewvoorbereiding; afspelen bij preview; interne navigatie en runtime-montage;
lokale vensteropslag; bestaande tests en productiebuild.
Dit is een gerichte audit, geen volledige beveiligings-, toegankelijkheids-,
LUKSO-, dependency- of performance-audit.

## 1. Hoge prioriteit: hersteldata overleven de Workbench niet

**Bewijs: browserreproductie plus inspectie van navigatie.**

- Sla `Saved sentence.` op, laat daarna draft-opslag falen en schrijf
  `Unsaved audit sentence.`. De Retry-knop verschijnt terecht.
- Ontkoppel de volledige Workbench en monteer hem opnieuw met hetzelfde profiel
  en dezelfde opslag, zonder browserreload.
- Resultaat: `Saved sentence.` keert terug, de nieuwe zin en herstelmelding zijn weg.

`src/text/textEditRecovery.js:3` bewaart hersteldata in een WeakMap per store-object.
`src/public/ownerSystemWorkflow/useWorkbenchController.js:13` maakt bij een nieuwe
montage een nieuwe store. De herstelbuffer heeft daardoor een kortere levensduur
dan het werk dat hij moet beschermen.

`src/text/useTextRecovery.js:11` beschermt alleen via beforeunload.
`src/profileDiscovery/useApplicationNavigation.js` wisselt routes zonder die
buffer te raadplegen. `src/App.jsx:187` en de owner-boundary wisselen/groeperen
de runtime op bestemming en profiel. Alleen Discover openen behoudt de
achtergrond; daadwerkelijk een ander profiel bezoeken kan die runtime vervangen.

De diagnostiek reproduceert de runtime-remontage rechtstreeks, niet een volledige
walletgestuurde profielroute. Het verband met die route volgt uit code-inspectie.
Dit is geen bewijs dat reeds succesvol opgeslagen tekst verloren gaat.

**Vervolg:** geef onverwerkte hersteldata een expliciete profielgebonden levensduur
buiten de verwijderbare Workbench, zonder ze tot een tweede opgeslagen draft te
maken. Interne navigatie, terugkeer, accountwissel en disconnect moeten dezelfde
afspraak respecteren. Bewijs met een echte route-overgang dat herstel bij terugkeer
werkt en dat een ander profiel de tekst niet kan gebruiken. Een harde reload bij
falende opslag blijft een afzonderlijke, reeds gedocumenteerde beperking.

## 2. Middelhoge prioriteit: Preview accepteert een verouderde voorbereiding

**Bewijs: browserreproductie met vertraagde lokale module-import.**

- Klik Preview en vertraag het laden van de previewmodule.
- Bewerk intussen het openbare tekstmodule; de wijziging slaat succesvol op.
- Laat de voorbereiding verdergaan.
- Resultaat: de opgeslagen draft bevat `Saved while preview was loading.`,
  de Visitor-preview toont nog `Saved sentence.` zonder melding.

`src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx:326` legt via de
closure de oude draft vast. Na de imports en mediawachttijden controleert de code
tekstherstel, maar niet of request, draft-generatie en presentatie nog actueel zijn.
De editor blijft tijdens voorbereiding beschikbaar. Een snapshot nemen is op zich
correct; een inmiddels achterhaalde voorbereiding stilzwijgend als huidige preview
presenteren is de onduidelijkheid.

**Vervolg:** maak previewvoorbereiding één expliciete, annuleerbare Workbench-actie.
Bind resultaat aan verzoek, profiel, draft-generatie en presentatie-input. Een
nieuwer verzoek of relevante wijziging maakt het oude resultaat ongeldig. Toon
laden en een zinvolle herstart wanneer de input verandert. Dezelfde afspraak
toetsen bij vertrek, fouten en herhaalde Preview-klikken. Geen extra draftkopie
als blijvende bron van waarheid introduceren.

## 3. Middelhoge prioriteit: extra Display speelt door achter Preview

**Bewijs: browserreproductie met twee Displays met elk meerdere Grids.**

- Start Play Grids op beide Displays en open Preview.
- Het eerste Display verliest zijn Pause-knop; het extra Display behoudt die.
- De diagnostiek wacht ook op een andere actieve Grid in het verborgen extra
  Display: die overgang treedt daadwerkelijk op terwijl Preview open staat.

De eerste Display ontvangt `active={!preview && ...}` in
`src/public/ownerSystemWorkflow/OwnerSystemWorkflowRuntime.jsx:434`.
De extra instantie gebruikt `active={presentation.open && !shared.panelOccupied}`
in `src/public/ownerSystemWorkflow/OwnerDisplayInstance.jsx:43`.
Preview maakt panelOccupied niet waar. `DisplayModule.jsx:120` gebruikt active
om afspelen te stoppen. De host levert dus verschillende lifecycle-input voor
hetzelfde moduletype. Dit verandert tijdelijke navigatie, niet de artworkgeometrie.

**Vervolg:** laat de Workbench één expliciet suspend-signaal leveren aan alle
Display-instanties; Display beëindigt zelf playback, momentum en lopende interacties
volgens zijn eigen regels. Focus/actief-doel en uitvoerbaarheid apart houden.
Test pauzeren, terugkeren uit Preview en behoud van camera-/Gridpositie voor beide
instanties. Voorkom nog een losse uitzondering alleen voor Play Grids.

## Wat behouden moet blijven

- Eén profiel-draftstore met generatiecontrole en bevestigde writes.
- Afzonderlijke Workbench- en Display-acties; Display-projecties zijn geen eigen
  opslagbronnen. Verwijderde modules mogen niet door oude sessies terugkeren.
- Herstel dat externe, niet-conflicterende wijzigingen behoudt en voor conflicterende
  tekst expliciet vervangen verlangt.
- De bestaande inspection-hook bindt asynchrone resultaten al aan request, scope,
  montage en nog bestaande elementen. Dit is een concreet lokaal voorbeeld voor
  preview, geen reden om een algemeen framework te bouwen.
- Compatibiliteits- en privacychecks bij publicatieprojectie en herstel.

## Onderhoudbaarheid en verificatie

De centrale runtime kent veel module-, layout-, selectie-, preview- en herstelpaden.
Dat is onderhoudsdruk, maar bestandsgrootte alleen bewijst geen fout. De hierboven
bewezen verschillen bepalen waar een grens eerst eenvoudiger moet worden.

Een deel van de UI-tests matcht brontekst, bijvoorbeeld
`ownerSystemWorkflowPolish.test.js:15`. Behoud zulke checks alleen voor zinvolle
statische grenzen; belangrijke overgangen vereisen browsergedrag als bewijs.
`npm test` is `node --test` en is geen runner voor alle `*.browser.mjs`-bestanden.
Ook prototype-tests kunnen door de automatische Node-discovery worden meegenomen;
het totaalaantal is dus geen dekkingspercentage van de productieapp.

Uitgevoerd onder de projectversie Node 24.20.0:

- `npm.cmd test`: 901 geslaagd, 0 gefaald.
- `npm.cmd run build`: geslaagd, budgetten en runtime-isolatie geslaagd.
- `npm.cmd run build:check`: geslaagd; 784770 initial JS bytes.
- `browser-tests/workbench-recovery.browser.mjs`: 1 geslaagde browsertest;
  geen pageerrors. Screenshots na reload op 1440×1000 en op 390×844 bekeken.
  Dit is een eenvoudige herstel-fixture, geen visuele of prestatietest met
  representatieve, volle artworkscènes.
- `browser-tests/hygiene-audit-2026-09-21.mjs`: de drie beschreven observaties
  gereproduceerd, inclusief echte verborgen Grid-overgang; geen pageerrors.
  Dit script rapporteert bestaand gedrag en is nog geen regressietest die het
  gewenste, gerepareerde gedrag afdwingt.

De build meldt grote chunks, een gemengde statische/dynamische import van
PublicEntryPortal en weggehaalde pure-annotaties in dependencies. De expliciete
budgetcontrole slaagt; er is hier geen gemeten performanceconclusie aan verbonden.
De eerste build/testserverpoging stuitte op sandbox-schrijfbeperkingen; herhaling
met toegestane lokale schrijftoegang slaagde. Geen applicatiefout.

De diagnostiek gebruikt alleen lokale testgegevens, blokkeert externe browser-
requests en vraagt geen walletactie. Voor herhaling: start
`node browser-tests/text-scenes.server.mjs` (poort 5189), voer daarna
`node browser-tests/hygiene-audit-2026-09-21.mjs` uit met Node 24.
Voor de bestaande hersteltest is `INSCAPE_TEXT_ROOT=http://127.0.0.1:5189` nodig.

## Werkstatus en eerstvolgende stap

Alleen dit verslag en de diagnostiek zijn toegevoegd. Productiecode is niet
gewijzigd; er is nog geen architectuur vereenvoudigd of probleem gerepareerd.
Werk staat lokaal, niet gecommit of gepusht. Bestaande gebruikersbestanden blijven
behouden; er is niets gepubliceerd, geüpload of gedeployd.

Eerst hersteldata beschermen bij runtime-/routewissel, daarna previewverzoeken
begrenzen en Display-suspensie uniform maken. Voor elke reparatie eerst een
falende gedragstest, dan de kleinste wijziging aan de bewezen eigendomsgrens,
dan de relevante bestaande workflows en productiechecks. Algemene code-opmaak en
verdere opsplitsing komen pas daarna waar ze de leesbaarheid aantoonbaar helpen.

## Uitgevoerde reparaties — 21 september 2026

Na opdracht van de gebruiker zijn de drie bevindingen lokaal gerepareerd:

1. De bestaande herstelbuffer wordt door Workbench-stores verbonden aan één
   profielgebonden buffer voor de duur van de pagina. Een nieuwe store na interne
   navigatie leest dezelfde onverwerkte wijzigingen, maar laadt de opgeslagen
   draft opnieuw. Er wordt dus geen tweede draft bewaard. De buffer bezit ook de
   beforeunload-waarschuwing, totdat de laatste herstelwijziging bevestigd is
   opgeslagen. De dubbele editor-/Workbench-waarschuwingen zijn verwijderd.
2. `useWorkbenchPreview` bezit voorbereiding, request-identiteit, acceptatie,
   annulering en focusterugkeer. Alleen het actuele verzoek met dezelfde profiel-,
   draftgeneratie- en presentatie-input mag openen. Een achterhaalde voorbereiding
   vraagt om opnieuw Preview te openen; laden heeft een zichtbare Cancel-actie.
3. De host geeft eerste en extra Displays dezelfde `suspended`-input. Display
   beëindigt eigen playback, crop/inspection en tijdelijke menu's. De Canvas
   blokkeert interacties en pauzeert de camera zonder de tussenpositie te wissen.
   Het verschillende gebruik van `active` voor afspelen is verwijderd; actief
   Display-doel/focus blijft een afzonderlijke hostverantwoordelijkheid.

De browserregressie bracht tevens een afhankelijke fout aan het licht: Tiptap
`setEditable` stuurt standaard een content-update. Alleen openen, Read/Write of
suspenderen kon daardoor opslaan en herstel wissen. De bestaande editor gebruikt
nu de ondersteunde `emitUpdate=false`-optie voor die interactiewijziging.

Dit vereenvoudigt concrete eigendomsgrenzen, niet de volledige UI-architectuur.
De centrale runtime blijft modulepresentaties, assets en publicatie verbinden.
Er zijn geen nieuwe dependencies, opslagkeys, schemas of migraties toegevoegd.
De terugkeer-fixture leest dezelfde eerder opgeslagen draft en behoudt de
bestaande conflictdetectie; bestaande oude-data- en publicatiechecks blijven groen.

Verificatie na reparatie onder Node 24.20.0:

- Volledige `npm.cmd test`: **902 geslaagd, 0 gefaald**.
- Productiebuild en `build:check`: geslaagd, inclusief bundelbudgetten en isolatie.
- Gerichte browsersuite: **6 tests geslaagd**: twee lifecyclechecks, bestaande
  Workbench-recovery, Text-transfer op 100% en 50%, en Grid-unlock/navigatie op
  brede en smalle schermen.
- De lifecycle-suite is daarna uitgebreid en opnieuw geslaagd voor normale
  beweging: een gedeeltelijk verschoven Grid behoudt zijn cameratransform tijdens
  Preview én na Return. De eerste check toetst ook een volledige playbackperiode
  bij reduced motion, zodat alleen een gewijzigde knop geen bewijs kan zijn.
- Late, vervangen en geannuleerde Preview-verzoeken, late fouten na disposal,
  presentatieverandering en herstel na een fout zijn gecontroleerd.
- Navigatie gebruikt de echte `useApplicationNavigation` met een lokale
  test-authority: ander profiel bezoeken, eigenaar-Workbench ontkoppelen en
  terugkeren; herstel en leave-page guard blijven behouden tot Retry slaagt.
  Dit is geen live wallet/accountintegratietest. Profielisolatie is apart getest.
- Screenshots van de nieuwe laad-/annuleermelding op 1440×1000 en 390×844 bekeken;
  de melding blijft binnen de viewport boven de dock en gebruikt bestaande stijl.
- `git diff --check` geslaagd.

De oorspronkelijke diagnostiek is omgezet in
`browser-tests/workbench-lifecycle.browser.mjs`. Start dezelfde lokale testserver
op poort 5189 en gebruik `npm.cmd run test:browser:workbench-lifecycle`.
De nieuwe tests dwingen gewenst gedrag af in plaats van alleen observaties te loggen.

Beperkingen: herstel blijft geheugenstate en overleeft geen geforceerde reload
bij falende opslag. Geen live wallettransactie, upload, deployment of nieuwe
performanceclaim. De bestaande buildwaarschuwingen blijven zichtbaar.
Alle wijzigingen zijn lokaal, niet gecommit of gepusht. Gebruikersbestanden en de
beschermde continuation handoff zijn niet gewijzigd.

## Vervolg: bevestigde Display-publicatiekeuzes

Bij verdere inspectie van opslagfouten bleek één Display-actie nog rechtstreeks
in de UI te schrijven: de keuze om een extra Display in publicatie op te nemen.
Een afgewezen commit gaf `false` terug, waarna de controller zijn foutmelding
wiste. De gebruiker kreeg dus geen uitleg waarom de keuze niet was opgeslagen.
De actie draaide bovendien een actuele waarde om in plaats van de weergegeven
bestemming expliciet toe te passen.

Die directe UI-mutatie is vervangen door `setDisplayModuleVisibility` in de
bestaande Display-actielaag. De actie controleert profiel, module, verwachte
visibility en expliciete bestemming, en schrijft via de bestaande draftstore.
De controller meldt afwijzing. Zowel het venstermenu als het shortcutmenu gebruikt
nu expliciete include/exclude-commando's. Een herhaalde oude opdracht kan de keuze
daardoor niet terugdraaien. Root Display, ontbrekende modules en ongeldige waarden
worden geweigerd. Bestaande schema's, opgeslagen waarden en publieke snapshots
veranderen niet zonder een geslaagde gebruikersactie.

De gerichte domeintest controleert opslagfalen, ongewijzigde draft en geschiedenis,
opnieuw opslaan, heropenen, publieke projectie, stale acties, profielgrenzen en undo/redo.
De browser-lifecyclecheck controleert nu ook de zichtbare foutmelding en succesvol
opnieuw proberen via de shortcut, gevolgd door uitsluiten via het venstermenu.
Beide lifecycle-browsertests zijn geslaagd.

Volledige verificatie van dit vervolg: **903 Node-tests geslaagd**, productiebuild
en `build:check` geslaagd. De acht Display-sessietests zijn na toevoeging van
expliciete publieke-projectieasserties opnieuw geslaagd. `git diff --check` is
schoon. Ook dit vervolg staat alleen lokaal, zonder commit, push of deployment.

De eerder genoemde beperking bij geforceerd herladen en onbruikbare opslag blijft
expliciet bestaan; er is geen tweede persistente opslagroute geïntroduceerd.

## Contextueel gereedschapsdock

De bewerkingsknoppen waren gemonteerd binnen de inhoud van het gedeelde
Layers-venster. Sluiten van Layers verwijderde daardoor ook de bediening voor
transformeren, stapelvolgorde, crop en frame/mat. De Display-controller en
draftstore waren al de eigenaar van die acties; die grens hoefde niet opnieuw
gebouwd te worden.

De Workbench heeft nu één module-onafhankelijke `ContextToolbar`-host. Display
levert de inhoud via een portal vanuit zijn bestaande selectiecomponent.
Layers en het dock zijn afzonderlijke bestemmingen; de selectiecomponent blijft
gemonteerd wanneer Layers sluit. Crop en frame/mat vervangen de dockinhoud,
zonder de Layers-lijst te vervangen. Doelwissels beëindigen onvoltooide invoer.
De host dupliceert geen selectie, artwork, controller of draftgegevens.

De bestaande venstershell verzorgt verplaatsen en toetsenbediening. Zijn
inhoudsmeting houdt nu rekening met padding en schuift het venster omhoog als
de inhoud nabij de schermrand groter wordt. Crop onderschept de pijltoetsen van
de slider en docktitel niet langer. Het dock herstelt toetsfocus wanneer een
tijdelijke bediening verdwijnt. De vensterpositie blijft sessielokaal.

Grenzen: de Display-specifieke actieopbouw staat nog in de selectiecomponent;
alleen hosting en zichtbaarheid zijn ontkoppeld. Andere module-editors zijn nog
niet op dit dock aangesloten. De gevraagde zelfstandige afbeeldingsmodule met
vrij formaat, meerdere zijden en Lift is hiermee nog niet geïmplementeerd.

Verificatie: 903 Node-tests geslaagd; vier browsertests voor gedeelde tools,
Display-vensters en lifecycle geslaagd. De uitgebreide docktest controleert
transformeren en crop met gesloten Layers, doelwisseling zonder cross-editing,
native sliderbediening, focusherstel, toetsenbordverplaatsing en Visitor zonder
authoringdock. Screenshots op 1440 en 390 pixels zijn bekeken; frame/mat blijft
binnen de beschikbare hoogte. Productiebuild en budgetcontrole geslaagd.
Wijzigingen blijven lokaal, zonder commit, push of deployment.

## Zelfstandige Image-module

Het vervolg sluit Image daadwerkelijk aan op het gedeelde dock. Het Workbench-
doel heet nu module in plaats van Display; de bestaande Display-controller
blijft uitsluitend verantwoordelijk voor zijn eigen compositie. Image bewaart
afmetingen en één canonieke Library-asset per zijde, met eigen crop/transform.
Er zijn geen lagen of Display-Grids toegevoegd aan deze module.

De opslaggrens is een optionele `imageModules`-collectie in draft v4 en publiek
v9. Positie/open staan apart in de bestaande Workbench-layout; afmetingen hebben
maar één opgeslagen eigenaar. Validatie, publieke filtering, referentielimieten,
herstel, verwijderen en undo nemen de nieuwe module mee. Oudere documenten
blijven leesbaar; herstel wist geen ontbrekende lokale Images. Mislukte of
verouderde commits veranderen de opgeslagen compositie niet. De crop blijft
beschikbaar om Done opnieuw te proberen wanneer opslaan faalt.

Image gebruikt de bestaande Workbench-venstershell, cropgeometrie,
transformatieknoppen en Lift-renderer. Een kleine gedeelde transformatiefunctie
vervangt de vroegere plaatsingsspecifieke mutatie. De venstershell ondersteunt
nu ook gecontroleerde afmetingen en commit bij einde resize. Visitor gebruikt
dezelfde Image-renderer zonder authoring, crop of resize. Flip blijft tijdelijke
leesstate, draait steeds dezelfde kant op en loopt terug naar de eerste zijde.
IPFS-media gebruikt de bestaande URL-resolver. Ontbrekende afmetingen worden
uit de exacte afbeelding gelezen; verouderde of afgesloten verzoeken schrijven
niet alsnog naar een andere module of profiel.

Verificatie: **907 Node-tests geslaagd**, vijf browsertests voor Image,
gedeelde tools, Display-vensters en lifecycle geslaagd. Image is daarna gericht
opnieuw gecontroleerd, inclusief ontbrekende mediageometrie en slepen binnen
crop. Verder getest: meerdere echte Library-drops, vrije stripafmetingen,
slepend resizen, transformaties, opslagfalen/herstel, flip-wrap, Lift-terugkeer,
Preview, herladen en doelwisseling. Screenshots op 1600 en 390 pixels bekeken.
Productiebuild en `build:check` geslaagd; initial-entry-budget blijft 784770 bytes.

Grenzen: eerste versie ondersteunt Library-afbeeldingen, maximaal 16 modules
en 32 zijden, met canvasafmetingen 32–4096 pixels per as. Geen tekstzijdes,
lagen, automatische diavoorstelling of algemene bestandsimport toegevoegd.
Geen live upload, walletactie, publicatie of deployment uitgevoerd. Alle
wijzigingen staan lokaal, niet gecommit of gepusht.

## Aanvulling: Display-overgang herwerkt na drag-en-loslaten

De melder bedoelde vooral het uitrollen na loslaten: een korte stilstand bij de
Grid-naad, zichtbaar wanneer de beweging vertraagt. Ook Play vertoonde het.
Alleen documentkopieën en rendertijd verminderen was geen afdoende oplossing.
De bestaande camera moest voor iedere visuele stap op de editorthread wachten,
terwijl diezelfde thread bij een naad selectie en voorbereide inhoud bijwerkte.
Instrumentatie vond daarbij geen expliciete stop of positiereset.

De browser bezit nu één native beweging voor de hele uitrol of Play-run.
Selectie observeert de klok van die beweging; een Grid-overgang start geen nieuwe
animatie. Vastpakken, pauzeren, suspensie en opruimen nemen dezelfde positie over
en annuleren dezelfde eigenaar. Gekoppelde Text volgt die klok. De uitrolcurve
behoudt de beginsnelheid en begrensde afstand en bereikt geleidelijk nul, zonder
afkapdrempel. Stilstand tussen Grids en discrete reduced motion blijven bestaan.

De renderbaan bevat maximaal vijf fysieke verschijningen. Ook bij twee Grids
staat de volgende verschijning vooraf klaar; een zichtbaar element hoeft niet
bij de naad naar de andere kant te verhuizen. De onderliggende authored Grid
blijft één object. Alleen de actieve verschijning krijgt bewerkrefs en cropstate.
Visitor-inspectie verwijst expliciet naar die actieve verschijning, zodat een
voorbereide kopie buiten beeld nooit het inspectiedoel wordt. Media-inhoud staat
apart van de wisselende interactieshell. Controller-navigatie leest het bestaande
geaccepteerde snapshot in plaats van opnieuw de gehele draft te kopiëren.

Visueel bewijs: de JavaScript-aangedreven referentie met dezelfde uitrolcurve
bleef hangen tijdens een geforceerde threadblokkade. De native beweging blijft
in werkelijk opgenomen browserbeelden vooruitgaan. De permanente regressie
test zestien combinaties van uitrollen/Play, twee/zes Grids, owner/Visitor en
1440/390 pixels met echte lagen en zeven Image-modules. Tijdens een blokkade van
300 ms over de naad blijft zowel beweging als volledige beelddekking behouden.
Acht aanvullende gevulde wrapgevallen vonden geen open stroken en geen
verplaatsing van zichtbare oppervlakken bij vooruit/achteruit rondlopen.

Verder geslaagd: volledige motion-interactie inclusief Play-wrap, opnieuw
vastpakken en reduced motion; offset behouden bij unlock, Layers, crop en
resize; gedeelde toolbar/Metadata met expliciete doelen; Display-tekst;
scenegekoppelde Text; onafhankelijke Images; route/Preview-lifecycle. Verouderde
browsertestverwijzingen naar Crop in Layers en een afzonderlijke Layers-knop
zijn bijgewerkt naar de al bestaande contexttoolbar en Tools-keuze.

Dit vereenvoudigt de verantwoordelijkheid voor beweging en fysieke verschijning.
Het maakt niet de hele Workbench onafhankelijk van React: geselecteerde Grid
en verre inhoudsvoorbereiding renderen nog steeds via React. De exacte sessie
en hardware van de gebruiker zijn niet beschikbaar; het bewijs betreft de
hier beschreven representatieve scènes en gecontroleerde blokkade. Er zijn
geen schema-, opslagkey-, publicatie- of dependencywijzigingen nodig voor deze
herwerking. Onderzoek en bewijs staan uitgebreider in
`docs/research/GRID_TRANSPORT_MEK_INSPECTION_2026-09-21.md`.

Eindcontrole: **909 Node-tests geslaagd**, productiebuild en `build:check`
geslaagd; initial JavaScript blijft 784770 bytes. Alle hierboven genoemde
browsertests zijn uitgevoerd en geslaagd. De wijzigingen staan lokaal en zijn
niet gecommit, gepusht of gedeployed.

### Exact landen na loslaten — aanvullende gebruikersrichting

De bestaande Display-camera kiest bij loslaten een gehele Grid-positie op basis
van positie en snelheid. Eén begrensde curve eindigt exact op die naad; een
stilgehouden sleep kiest de dichtstbijzijnde naad. Er is geen tweede snapanimatie
of aparte Text-besturing toegevoegd. Vastpakken onderbreekt de beweging; een
expliciete pauze of annulering kan de tussenpositie behouden. De actieve
contracttekst beschrijft deze gewijzigde releasebetekenis. Opgeslagen documenten
en tekstinhoud veranderen niet.

De inspectiestatus volgt nu de werkelijke tussenpositie en beweging, zowel bij
owner als Visitor. Een aanwezige railovergang is op zichzelf geen bewijs meer
dat de camera tussen Grids staat. Navigatie en verre inhoud blijven React-werk;
dit is geen ontkoppeling van de hele Display.

Tijdens deze wijziging meldde de gebruiker een flits van de vorige Grid bij de
landing. De nieuwe browserregressie reproduceerde dat concreet: Grid 1 was al
zichtbaar, waarna Grid 0 opnieuw verscheen op het animatie-einde. De afsluitende
bewegingsstatus haalde de nog wachtende Grid-navigatie in. De status wordt nu in
dezelfde React-transitie afgehandeld als die navigatie, zodat de camera geen
onterechte externe reset uitvoert. Dezelfde test slaagt na die correctie voor
vooruit/achteruit, owner/Visitor en 1440/390 pixels, met vertraagde verwerking.

De eerder gemelde visuele hapering blijft afzonderlijk onbewezen/opengelost;
exact landen en deze gereproduceerde eindflits zijn geen bewijs dat die hapering
in de gebruikerscompositie verdwenen is.

Verificatie van de uiteindelijke correctie: 910 Node-tests, productiebuild en
`build:check` geslaagd. De landingsregressie, motion-interacties en beide
scenegekoppelde Text-varianten zijn opnieuw geslaagd in Chrome. Daarnaast
slaagden de offsetbewerkingen, gedeelde inspectietools en zestien gevallen van
gevulde beweging onder een geblokkeerde editor-thread. Die laatste test gebruikt
nu een release en blokkeermoment die de nieuwe, kortere landingscurve omvatten;
hij wacht ook op de native animatie. Brede en smalle eindbeelden zijn bekeken.
De wijziging is lokaal beschikbaar op de bestaande ontwikkelserver; niet
gecommit, gepusht of gedeployed.

### Aangrenzende Grid-randen en gepauzeerde naden

Een regressie reproduceerde dat beide buren na exact landen nog één pixel in
de viewport staken. De rail gebruikt nu volledige Grid-breedtes, zonder de
oude overlap of bijbehorende Visitor-achtergrondcompensatie. Pointerafstand en
het bestaande bewegingssignaal voor Text volgen dezelfde volledige breedte.
Text-inhoud en Text-besturing zijn hiervoor niet gewijzigd.

De gebruiker verduidelijkte dat daarnaast een lijn zichtbaar bleef bij Play
gevolgd door Pause tussen Grids. De oorspronkelijke pixelcontrole detecteerde
alleen vrijwel volledig open pixels en miste gedeeltelijke achtergrondlekkage.
De strengere controle reproduceerde die gedeeltelijke lekkage op fractionele
afmetingen. Grids staan nu als vaste layoutvlakken op één bewegende rail, zonder
eigen geforceerde transformtexturen. Hun complementaire antialias-randen worden
binnen een geïsoleerde rail additief samengevoegd (`plus-lighter`), zodat twee
dekkingsfracties samen de naad vullen. De inhoudelijke lagen binnen elke Grid
behouden hun gewone onderlinge compositie. De camera blijft de enige bewegende
transform; de landingsinstellingen van de gebruiker zijn behouden.

Dit betreft randdekking en verandert geen opslagformaat. De eerder gemelde
bewegingsschok is hiermee nog niet verklaard. De aparte Grid-vlakken en de
voorbereiding van verre scènes blijven bestaande verantwoordelijkheden; er is
geen nieuwe renderer of tweede camera toegevoegd.

De daarop gemelde witte lijn is met uniforme grijze bronbeelden afzonderlijk
gereproduceerd: één kolom week bij het wisselen van renderwijze sterk af van
de grijze beelden. Displays met meerdere Grids houden nu één stabiele
railtextuur, ook bij starten, Pause en landen. Dezelfde grijze controle slaagt
daarna voor owner/Visitor op breed/smal scherm, inclusief meerdere Play/Pause-
posities. De test controleert alle kleurkanalen, zodat ook een lichte of donkere
lijn faalt; hij sluit open contextmenu's uit van de artworkmeting.

Verder zijn de acht gevallen met werkelijk beeldmateriaal en gedeeltelijke
achtergrondlekkage, de zestien native-bewegingsgevallen, de landingsflitsregressie,
motion-interacties en beide Text-scenario's geslaagd. Een aparte contrastrand-
controle vindt na landen geen blauwe buur-kleur door de buitenrand. Brede en
smalle screenshots zijn bekeken. Deze regressies vervangen geen bevestiging
van de gebruikerscompositie; de oorspronkelijke bewegingsschok blijft open.

De gebruiker zag daarna nog een witte lijn. De lokale F8-opname en een eenmalige
stijlmeting bevestigden de actuele code en exact aansluitende Grid-vlakken. Het
verschil met de eerste fixtures was een geselecteerd, gespiegeld achtergrondbeeld
in een vergrendelde Display met carbon-surface: op het beeld zelf stond een lichte
`drop-shadow`. Stoppen gebeurde door op het beeld te klikken, waardoor ook de
selectie actief werd. Een fixture corrigeerde bovendien een onbedoelde Space-
activatie van de nog gefocuste Lock-knop; daardoor was die test eerder niet
daadwerkelijk de hele tijd vergrendeld gebleven.

Met de publieke landschapafbeelding, de gemeten 1632 × 918 Display en 2560 × 1305
viewport werd de lichte kolom op die stopactie gereproduceerd. Selectiefilters
zijn nu gesuspendeerd zolang de camera beweegt of op een tussenpositie staat.
Dit is een DOM-presentatiekenmerk dat rechtstreeks uit de bestaande camera wordt
afgeleid in dezelfde paint, zonder tweede navigatie- of selectiestatus. De
selectie zelf blijft behouden; de gewone aanduiding keert terug bij exact landen.
Dezelfde pixelregressie slaagt na de correctie, inclusief een zwarte-luchtmeting
die ook lichte naden detecteert. De tijdelijke stijlopname-import en helper zijn
weer verwijderd. De eigen landingssnelheid van de gebruiker is niet gewijzigd.

Eindcontrole van deze correctie: 910 Node-tests, productiebuild en `build:check`
geslaagd. De browsercontroles voor zes grijze owner/Visitor-schermcombinaties,
de daadwerkelijke landschapscène, selectieherstel, landen, offsetbewerking en
gekoppelde Text zijn geslaagd. Een verouderde exacte CSS-selectorassertie is
vervangen door die browsercontrole van selectiegedrag en beeldpixels. Alles is
lokaal opgeslagen; niet gecommit, gepusht of gedeployed.

### Selectie-glow en inspectie na Grid-navigatie

Op verzoek is de selectie-glow volledig verwijderd, inclusief de ongebruikte
handoff-glow en het tijdelijke camera-attribuut dat de glow onderdrukte.
Selectie, crop en bewerkingshandgrepen blijven bestaan. De camera hoeft nu geen
selectie-effect meer te beheren. De eerdere beschrijving van een terugkerende
glow bij exact landen is daarmee vervangen.

Display-grain blijft één bestaande modulelaag. Lift rendert zijn beeld via een
portal in de Stage op laag 35, niet in de oudere inspection-host op laag 30.
De eerste correctie naar laag 31 was daarom onvoldoende; de pixelregressie gaf
terecht nul verschil met uitgeschakelde grain. Laag 36 legt grain boven Lift en
onder de bediening. Deze correctie blijft Display-specifiek; Text verandert niet.

Inspectie zette daarnaast de navigatie op disabled, wat de behouden railpositie
reset. De nieuwe controle na meerdere swipes reproduceerde die camerawijziging.
Owner en Visitor suspenderen nu de bestaande camera tijdens inspectie in plaats
van haar te resetten. De controle per frame slaagt voor openen en sluiten op
1440- en 390-pixel viewports, ook met vertraagde CPU. Grain-pixelcontroles en
screenshots zijn voor beide renderers op dezelfde schermbreedtes gecontroleerd.
Dit bewijst deze inspectieovergangen, niet dat de eerder gemelde intermitterende
bewegingshapering in alle omstandigheden verdwenen is. Geen schemawijziging.

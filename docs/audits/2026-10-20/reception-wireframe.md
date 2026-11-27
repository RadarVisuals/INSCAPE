# Reception vervangen door de eerste wireframe

20 oktober 2026. Op expliciet verzoek is de oude Reception-presentatie vervangen. Geen tweede versie achter een schakelaar: de oude carrousel, uitbreidende identity/artworkkaart, inspectiehost en Reception-keuze/crop-editor zijn verwijderd.

## Resultaat

- Een leesbare bento-wireframe met identiteit/persona, portret, bio, links en bestaande profielvelden uit de geverifieerde publicatie. Plaatshouders zijn herkenbare toekomstige inhoud, geen gegenereerde metadata of statistieken.
- Rechts Explore naar een aparte lege proefruimte. Terugknop en Escape herstellen toetsenbordfocus op Explore. De tijdelijke ruimte wordt niet opgeslagen of gepubliceerd.
- Onder Enter Inscape, uitgeschakeld met de uitleg dat het compositieoverzicht later volgt.
- Geen automatische artworkfeed, shaderachtergrond, Reception-editor of galerie-inspectie. Portret is voorlopig gewone beeldweergave. De volledige branding-/bento-editor, bronartwork voor de wereld, beweging, camera-follow en collision zijn nog niet gebouwd.
- Eigenaar behoudt Back to my Workbench; directe publieke modulelinks gaan naar de bestaande canvasrenderer. Ontbrekende doelen geven uitleg in de nieuwe Reception.

## Verantwoordelijkheden en verwijderde code

[ProfileOverview](../../../src/profileDocument/components/ProfileOverview.jsx) bezit alleen tijdelijke presentatie en ruimtekeuze. Het bestaande identity-viewmodel levert profielinhoud; de geverifieerde publicatie blijft de gegevensbron. Er wordt geen draftstore, edit-lock of publicatiebewerking in Reception gemount. [ProfileDocumentV9Preview](../../../src/profileDocument/components/ProfileDocumentV9Preview.jsx) bepaalt de bestaande publieke canvas-/profielroute. [PublishedProfileBoundary](../../../src/profileDocument/components/PublishedProfileBoundary.jsx) behoudt status, stale-feedback en terugkeer naar de eigenaar.

Verwijderd: OwnerReceptionEditor, ReceptionImagePreview, useReceptionCarousel, BentoStage, BentoDisplayFrame, BentoLinkedText, ProfileWorkViewer, de specifieke styles en ongebruikte stage-geometrie. De ongebruikte saveReceptionSelection-editoractie en oude terugkeerstate zijn eveneens verwijderd. Oude browserfixtures/tests voor de vervallen galerij/editor zijn vervangen door checks van de nieuwe gedragsgrens. De designregistry en afgeleide tokeninventaris zijn bijgewerkt.

Huidige documentvelden `reception` en `receptionCrop` blijven uitsluitend binnen bestaande validatie/projectie/herstel en de bijbehorende documenttests. Deze stap verwijdert geen inhoud uit bestaande lokale composities of publieke documenten en voert geen schemaherontwerp in. Er is geen nieuwe legacy-adapter toegevoegd. Een toekomstige bento-editor moet een eigen afgebakend inhoudsmodel krijgen; deze tijdelijke indeling wordt niet als tweede opgeslagen configuratie bijgehouden.

## Verificatie

- De nieuwe Reception-suite controleert Carbon op 1440/640/390 px en Mist op 1440/390 px: toegang, toetsenbordfocus, heen/terug/Escape, geen horizontale overflow, ontbreken van de oude galerij/editor en geen mutatie van publicatie/localStorage. Een zesde geval controleert bestaande directe werklinks en onbeschikbare doelen.
- De echte App-routeringssuite controleert onder meer de eigenaar → Reception → proefruimte → Reception → eigenaar op 1440/640/390 px, zonder uitloggen of private opslagtoegang tijdens publiek navigeren. Overlapcontrole accepteert beide ruimtelijke richtingen, maar vereist niet-overlappende rechthoeken.
- Alle Node-tests, design-systemchecks, productiebuild en buildbudgetcontrole zijn uitgevoerd. De precieze eindresultaten staan in [het verificatierecord](reception-wireframe/verification.txt).
- De gebouwde-app-startcontrole verifieert 1440/390 px en afgescheiden eigenaar-/walletruntimes. Er is geen release/deploy of echte walletactie uitgevoerd.

Eerste browserpogingen hadden een ongeldig media-URL in de vernieuwde fixture en daarna een niet-passende buttonnaamselector. De definitieve fixture gebruikt een zelfvoorzienende SVG en de normale publicatievalidator. Er zijn geen productvalidaties versoepeld. De eerste directe routeringstest miste browserconfiguratie; de normale browserEnvironment-instap is daarna gebruikt.

## Beeldbewijs

De voorbeelden gebruiken fictieve profielgegevens en een eenvoudige fixturefiguur. Ze zijn geen weergave van nieuw gepubliceerde eigen inhoud.

![Reception desktop](reception-wireframe/reception-1440-carbon.png)

[Smalle Mist-weergave](reception-wireframe/reception-390-mist.png) · [Lege verkenruimte](reception-wireframe/exploration-1440-carbon.png)

## Grenzen en volgende stap

Dit is de ingang en de heen-/terugroute. Het is geen definitieve bento-layout of volwaardige exploratiemap. De verkenruimte heeft nog geen browsergeschiedenis/deeplink, actor of achtergrondkaart. Een volgende afzonderlijke stap kan één bestuurbare actor, wereldcoördinaten, camera-follow en een paar botsingswanden toetsen, met echt herhaald bronartwork en gemeten rendertijd.

De wijzigingen zijn lokaal op de bestaande branch; niet gecommit, gepusht of gedeployd. Eerdere ontwerpdocumentatie is behouden.

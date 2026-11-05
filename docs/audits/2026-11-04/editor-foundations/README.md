# Open source bouwstenen voor de Inscape editor

4 november 2026. Bewaarde vergelijking op verzoek van de founder. Bestaande
bouwstenen verdienen onderzoek voordat algemene editorbediening verder zelf wordt
gebouwd. Een groter functieaanbod bewijst geen betere codekwaliteit, kleinere
browserbundel of geschiktheid voor Inscape.

## Vastgelegde afweging

De founder koos na deze verkenning om eerst verder te werken aan de bestaande
Inscape-editor en die bruikbaar af te werken. De onderstaande opties blijven
referentiemateriaal. Hervat een vergelijking wanneer een concreet probleem er
aanleiding toe geeft; begin geen parallelle editorvervanging op basis van deze lijst.

Onderzoek drie mogelijkheden: een bestaande library gebruiken, gericht code of
ontwerpprincipes hergebruiken, of de huidige implementatie behouden en verbeteren.
De afweging omvat bediening, onderhoud, licentie, integratiewerk en netto omvang
na verwijdering van daadwerkelijk vervangen code. De bestaande bundelgrenzen
blijven gelden. Een nieuwe editorbasis is nog niet gekozen.

De downloadbare editor van Bento.page is een voorbeeld van editorcode en
compositiegegevens samen in een HTML-bestand. Dat principe kan ook met eigen
Inscape-code worden onderzocht; het vereist geen overname van Bento. Een
HTML-export verhelpt bestaande tekstbediening niet automatisch en levert geen
nieuwe animatie-engine. Bij overgenomen MIT-code blijven de vereiste copyright-
en licentieteksten aanwezig; MIT schrijft geen zichtbaar logo in de interface voor.

## Snappingvergelijking

De lokale vergelijking betreft de gewijzigde werkboom op branch
`codex/profile-work-index-2026-10-30`, HEAD
`15193cf8cf20b3a0216523555863fbd031ed6308`. Het is een statische vergelijking,
geen nieuwe verklaring over CI, runtimeprestaties of deployment.

- [workbenchEdgeSnap.js](../../../../src/public/ownerSystemWorkflow/workbenchEdgeSnap.js)
  bevat compacte berekeningen voor randen, ingestelde tussenafstand en gridlijnen,
  onafhankelijk van React. Een rand wordt binnen 10 schermpixels aangetrokken en
  kan als bestaande match tot 18 pixels behouden blijven.
- [workbenchPatchSnap.js](../../../../src/public/ownerSystemWorkflow/workbenchPatchSnap.js)
  kiest lokale grids en beperkt bij een actief grid randmatches tot
  `min(10, grid.step * 0.35)`. Bij een stap van 24 schermpixels is dat 8,4 pixels.
  [WorkbenchPlacement.jsx](../../../../src/public/ownerSystemWorkflow/WorkbenchPlacement.jsx)
  past deze beperking na de kernberekening toe. Daardoor geldt de 18-pixelgrens
  niet meer wanneer die beperking ingrijpt. De beperking voorkomt dat uitlijning
  bij uitzoomen meerdere gridcellen overbrugt; de verdeling van deze regels over
  verschillende lagen verdient verduidelijking. Dit is geen in de browser
  gereproduceerde foutmelding.
- Moveable verzamelt verschillende soorten hulplijnen voor zijn snapberekening,
  waaronder randen, middenlijnen, grids en afstanden tussen objecten. Het ondersteunt
  ook uitgebreidere rotatie- en transformatieberekeningen. Zijn onderdelen hangen
  samen met de eigen geometrie en editorstate; een bestand kopieren geeft niet
  automatisch een zelfstandige snappinglibrary.
- Alleen voor onze huidige basissnapping is volledige Moveable-integratie nog niet
  gerechtvaardigd. Voor een bredere vervanging van objectbediening blijft
  Moveable met Selecto een kandidaat. Snelheid en netto browseromvang zijn onbekend.

Bronnen: [Moveable snapberekening](https://github.com/daybrush/moveable/blob/master/packages/react-moveable/src/ables/snappable/snap.ts),
[hulplijnen](https://github.com/daybrush/moveable/blob/master/packages/react-moveable/src/ables/snappable/getTotalGuidelines.ts),
[Moveable MIT](https://github.com/daybrush/moveable/blob/master/LICENSE),
[Bento MIT](https://github.com/nyblnet/bento/blob/main/LICENSE).

## Pakketomvang

Het publieke npm-archief van `react-moveable@0.56.0` is in het geheugen gemeten:
824.283 bytes archief, 4.622.431 bytes uitgepakte inhoud, 136 bestanden. De losse
ES-module is 595.589 bytes, of 108.111 bytes met gzip niveau 9. Dit is geen
geoptimaliseerde Inscape-bundle: externe afhankelijkheden, bundeling, minificatie,
gedeeld React, ongebruikte code en verwijderde eigen code veranderen de uitkomst.
De pakketten zijn niet in de app geinstalleerd en hun code is niet uitgevoerd.

## Eerste selectie voor verder onderzoek

De toepassingskolom is een inschatting voor Inscape, geen integratiebesluit.

| Basis | Wat het levert | Mogelijke toepassing en grens |
| --- | --- | --- |
| [Scena Studio](https://github.com/daybrush/scena) | MIT-editorproject uit het Daybrush-ecosysteem, met Moveable, Selecto, guides, viewer en Scene.js. | Relevant referentieproject voor vrije composities en motion. Het editorpakket gebruikt onder meer React 17 en een oudere buildopzet; actuele integratiegeschiktheid is niet vastgesteld. |
| [Puck](https://puckeditor.com/docs) | MIT React-editor die eigen componenten via configuratie bewerkbaar maakt, met velden, categorieen en viewportvoorbeelden. | Kandidaat voor een profielpagina met bestaande Inscape-componenten. Geen bewezen vervanging voor alle vrije canvastransformaties. De hosted AI-diensten staan los van de open-source kern. |
| [GrapesJS](https://grapesjs.com/docs/) | Webbuilder met blokken, layers, stijlen, assets en opslag; kern onder BSD-3-Clause. | Relevant voor de HTML-profielroute. Het eigen documentmodel en de aansluiting op bestaande modules vragen onderzoek. Het gepromote Studio SDK is een afzonderlijk aanbod. |
| [Craft.js](https://craft.js.org/docs/overview) | MIT React-bouwstenen voor componenten, drag-and-drop en serializeerbare editorstate. | Veel vrijheid, maar de editorinterface moet grotendeels zelf worden opgebouwd. Minder direct voordeel als juist een afgewerkte UI de behoefte is. |
| [FlexLayout](https://github.com/caplin/FlexLayout) | MIT React-layoutmanager voor tabs, splitsingen, docking, zwevende panelen en vensters. | Gericht op de werkruimte rond de compositie: bijvoorbeeld Layers, Properties en Library. Geen artworkrenderer of objecttransform-engine. |
| [Radix Primitives](https://www.radix-ui.com/primitives/docs/overview/introduction) | MIT-bouwstenen voor onder meer menus, dialogs, sliders en toolbars, met focus- en toetsenbordbediening en zonder opgelegde styling. | Past als kandidaat onder de bestaande Inscape-vormgeving. Geen complete editor. |
| [shadcn/ui](https://ui.shadcn.com/docs) | MIT-componentcode met uitgewerkte standaardstyling, lokaal aanpasbaar. | Bruikbaar als UI-basis of referentie. Gekopieerde componenten hebben nog steeds afhankelijkheden, bundelkosten en onderhoud; aansluiting op onze styling moet gericht gebeuren. |
| [Dockview](https://dockview.dev/docs/overview/licence/) | MIT-kern voor docking en panelen, plus een apart commercieel Enterprise-aanbod. | Alternatief voor FlexLayout. Controleer per gewenste functie de grens tussen de open-source kern en Enterprise. |

Aanvullende licentiebronnen: [Scena](https://github.com/daybrush/scena/blob/master/LICENSE),
[GrapesJS](https://github.com/GrapesJS/grapesjs/blob/dev/packages/core/LICENSE),
[Craft.js](https://github.com/prevwong/craft.js/blob/master/LICENSE),
[FlexLayout](https://github.com/caplin/FlexLayout/blob/master/LICENSE),
[Radix](https://github.com/radix-ui/primitives/blob/main/LICENSE),
[shadcn/ui](https://github.com/shadcn-ui/ui/blob/main/LICENSE.md).
Scena-versiecontext: [editorpakket](https://github.com/daybrush/scena/blob/master/packages/react-editor/package.json).

## Status

Alleen documentatie opgeslagen. Geen productcode vervangen, dependencies
geinstalleerd, tests gedraaid of wijzigingen gecommit, gepusht of gedeployed.
Dit onderzoek selecteert geen nieuwe visuele stijl en wijzigt geen bestaande drafts.

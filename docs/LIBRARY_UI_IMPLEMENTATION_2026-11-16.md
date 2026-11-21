# Library UI-implementatie — 16 november 2026

Status: lokaal opgeslagen; niet gecommit, gepusht of gepubliceerd. De huidige werkboom bevat daarnaast bestaand werk van andere rondes.

## Gedrag

- Eén klein bolletje per dockkolom verbergt of herstelt de volledige kolom. Geen blijvende iconenrail; open panelen, kolombreedte en toetsenbordfocus blijven behouden.
- Library heeft een benoemde mappenboom met secties, mappen en submappen, een mappenoverzicht met covers en een broodkruimelpad. All Assets en Unsorted blijven beschikbaar.
- Een volledige NFT kan vanuit de verzamellijst naar een map worden gesleept. Een uitgeklapte afbeelding kan apart worden ingedeeld. De coverbadge blijft een nummer zonder extra afbeeldingsicoon.
- Afbeeldingen tonen op verzoek hun naam en origineel formaat; andere bestanden verschijnen als benoemde links met formaat. Metadata blijft bepalen welke bestanden werkelijk beschikbaar zijn.
- De Library kiest rasterpreviews op basis van kaartgrootte en schermdichtheid. SVG/GIF behouden hun originele bron. De opgeslagen plaatsing verwijst naar het origineel; een tijdelijke preview kan tijdens het laden zichtbaar zijn. De overgang verandert de geplaatste geometrie niet.
- Scrollbars zijn verborgen maar scrollen blijft werken. De navigatiescheiding en thumbnailbreedte verspringen niet wanneer overloop ontstaat.
- Replace image gebruikt nu de bestaande schermlaag voor tools, zodat de picker aanklikbaar blijft boven het canvas.

## Verantwoordelijkheden en opruiming

De bestaande Library-domainlaag blijft eigenaar van indeling; de bestaande storage-laag bewaart die indeling. De browseradapter leidt previews af uit metadata. De tijdelijke previewcache is begrensd en wordt niet onderdeel van de opgeslagen compositie. De Image-module blijft eigenaar van laden en renderen van het origineel.

Verwijderd: de compacte iconenrail voor deze Library, de bijbehorende collapsed-selectors en prop, boxed reopen-controls en de kolomchevrons per afzonderlijk paneel. De vaste minimale previewkeuze van 640 px is vervangen door een grootteafhankelijke keuze. Er zijn geen resterende verwijzingen naar workbench-side-dock-reopen, workbench-tool-panel-collapse, collapseControl of library-compact-sidebar-width gevonden.

Gedeelde browser- en toolbarstructuur met andere consumenten blijft bestaan. De bestaande term category blijft intern de mapidentiteit; dit is geen tweede organisatiesysteem. Ontwikkelfixtures blijven apart van productiegegevens. De nieuwe helpers verzorgen begrensde previewselectie en het lezen van intrinsieke afbeeldingsmaten; geen nieuwe dependency of verhoogd bundelbudget.

## Omvang

Onderstaande getallen meten de afgebakende werkboom tegenover HEAD. Ze bevatten ook wijzigingen die al aanwezig waren; er is geen betrouwbare beginmeting om alles aan deze ronde toe te schrijven. De nieuwe verslagtekst zelf is niet meegerekend.

| Onderdeel | Toegevoegd | Verwijderd |
| --- | ---: | ---: |
| Gevolgde productiecode binnen scope | 565 | 299 |
| Nieuwe productiehelpers | 113 | 0 |
| Gevolgde tests en fixtures binnen scope | 275 | 46 |
| Nieuwe tests en browsersuite | 94 | 0 |
| Actief contract en suitecatalogus | 730 | 97 |
| Gegenereerde design-tokeninventaris | 2727 | 811 |

De noodzakelijke groei zit in submapvalidatie, het onderscheid tussen preview en origineel, gemengde bijlagen en regressiedekking. De grote contract- en inventarisdiff is een cumulatieve werkboomdiff, geen maat voor uitsluitend dit Library-werk.

## Verificatie

- Volledige unit-/contractsuite: 1918 geslaagd, nul mislukt of overgeslagen.
- Gerichte Library-, metadata-, storage-, dimensie- en LUKSO-controles: 267 geslaagd.
- Browsercontroles: 12 geslaagd, verdeeld over NFT-uitklappen/plaatsen/herladen, vertraagde originele media, Replace image, native Image-drop, indeling, splitter en volledige kolomverberging.
- Browserdekking omvat brede en smalle computervensters, donker/licht, focus, lokale opslag, Undo, annuleren en onveranderde plaatsingsgeometrie.
- Visueel gecontroleerd: mappenboom, badges, divider, verborgen scrollbars, panelen en randbolletjes. Browsercontroles gebruiken gecontroleerde testgegevens en waar nodig gemockte afbeeldingsresponses.
- Productiebuild, build:check, lint en strikte typechecks geslaagd. Initiële JS: 727568 bytes; bestaande budgetten behouden.
- Afgebakende git diff --check geslaagd. Geen opschoning van niet-gerelateerde werkboomwijzigingen.

## Resterende beperking

Bij openen van de gewone lokale applicatie toont de bestaande opgeslagen werkruimte LOCAL_DRAFT_UNAVAILABLE / validation_failed. De interface geeft geen specifiekere validatiefouten. Die compositie is niet gewist, gereset of vervangen. Deze fout blokkeert de eindcontrole met de persoonlijke werkruimte; de geslaagde browsertests bewijzen niet dat die opgeslagen compositie opent.

In de browser is daarom de echte component-testwerkruimte geopend op http://127.0.0.1:5173/browser-tests/library-images-fixture.html. Dit zijn testgegevens, geen nieuwe import van de persoonlijke collectie. Sommige uitgeklapte afbeeldingen in deze fixture gebruiken test-URL's die alleen de geautomatiseerde tests van responses voorzien; de fixture is geen volledige demonstratie van live collectiemedia.

De lokale Vite-server draait op 5173 met bestandsbewaking uitgeschakeld nadat de gewone watcher vastliep. Bij verdere bronwijzigingen moet die server herstart worden om de nieuwe modules te laden. Er is geen productconfiguratie gewijzigd om dit af te dwingen.

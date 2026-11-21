# Reception: actueel renderprofiel en onveranderde beelden

Status: lokale productaanpassing, geen commit/push/deployment/publicatie.

## Afgebakende meting na de eerdere optimalisaties

De nieuwe proef bevat de navigator-, draftkopie- en gedeelde beeldvoorbereiding-
wijzigingen. Dezelfde mixed-16-fixture bevat 16 afbeeldingen, twee herhaalde
WebP-bronnen en 16 vaste tekstframes met elk 24 paragrafen. In de eerste tekst
zijn 200 echte keyboard-inputevents uitgevoerd. Layout en de overige vijftien
teksten bleven gelijk; de getypte prefix bereikte de opgeslagen testdraft.

Het nieuwe bewijs is een **render-invocationprofiel**, geen nieuw Chrome CPU-
samplingprofiel. Een tijdelijke Vite-plugin voegt in een afzonderlijke,
productiegeminificeerde fixture tellers toe aan WorkbenchWindow, TextInstance,
ImageArtworkAttempt en editorCellWindow. Productiebronbestanden bevatten die
instrumentatie niet. Het script controleert dat alle vier doelen gevonden zijn.

Twee aanvankelijke pogingen tot een enkele 200-tekenactie liepen tegen de
browserbedieningstijdslimiet aan. Zij zijn niet als volledige meting gebruikt.
Beide voltooide vergelijkingen gebruiken acht reeksen van 25 tekens. Tijd tussen
bedieningsacties en diagnostische overhead is niet gecontroleerd. De verzamelde
walltime/rAF/Event Timing-samples zijn daarom niet gebruikt om een latency- of
FPS-winst te claimen, en worden niet vergeleken met de oude CDP-run.

Evidence onder output/reception-typing-profile-2026-11-12:
build-probe.mjs, serve-check.mjs, before/source-manifest.json,
after/source-manifest.json, before-counts.json en after-counts.json.
De twee synthetische loopbackfixtures gebruikten dezelfde oorspronkelijke
publieke HTTPS-WebPs. Geen gebruikerscompositie is gelezen of bewerkt.

| Functie-invocations tijdens 200 tekens | Voor deze stap | Na deze stap |
| --- | ---: | ---: |
| ImageArtworkAttempt, alle 16 beelden | 3200 | 0 |
| TextInstance, alle 16 teksten | 3401 | 3401 |
| WorkbenchWindow | 6801 | 6801 |
| editorCellWindow | 630.287 | 630.287 |

Elke niet-bewerkte tekst rendeerde 200 keer; de bewerkte tekst 401 keer,
inclusief een focusgerelateerde extra invocation. Dit zijn React-renderpogingen,
geen evenveel DOM-vervangingen of onafhankelijk optelbare CPU-kosten.

## Kleine productvervanging op basis van deze gegevens

De beeldrenderer had een adequate inhoudsgrens maar werd bij iedere render van
zijn omliggende Image opnieuw aangeroepen. De grens gebruikt nu React.memo met
de **standaardvergelijking van alle props**. Er worden geen callback-, bron-,
crop-, grootte-, inspectie- of herstelprops genegeerd.

Twee noodzakelijke inputs worden bij hun bestaande eigenaar gestabiliseerd:

- ImageWindow geeft een gememoiseerde contentRectangle door, afhankelijk van
  de actuele breedte en hoogte. Authored geometry en camera blijven hun
  bestaande eigenaren houden; de geometry-subscription blijft actief.
- ImageInstance houdt de bestaande celanchorberekening stabiel zolang cel/id
  gelijk zijn en gebruikt een stabiele recoverycallback die de actuele DOM-ref
  leest. De inline-versie is verwijderd; er is geen dubbel focuspad.

Bron-/crop-/transformwijzigingen blijven nieuwe props leveren. Echte
resolutiewijzigingen worden door de bestaande geometrieobservatie afgehandeld;
retry en media-readiness blijven eigen componentstate en worden niet door memo
geblokkeerd. Er is geen eigen gelijkheidsfunctie, documentcache, debounce,
voorkeur, schema- of IPFS-wijziging toegevoegd.

Ten opzichte van de snapshots bij aanvang: 16 productieregels toegevoegd en
13 verwijderd in drie bestanden. De reeds aanwezige grotere Git-diffs zijn
behouden en worden niet als wijziging van deze stap voorgesteld.

## Gedragscontroles en beperkingen

In de aangepaste productiegeminificeerde fixture:

- 200 getypte tekens opgeslagen; andere teksten en saved layout gelijk.
- Een echte Crop-zoomwijziging veroorzaakte weer een beeldrender en veranderde
  de geschilderde breedte van 110 naar 480. Done slaagde, Undo herstelde 110 en
  Redo opnieuw 480. De memo-grens blokkeert die wijziging dus niet.
- 200% camerazoom: alle 16 Editor-beelden ready.
- Preview: alle 32 Editor/Preview-beelden ready; inspectie gebruikt de originele
  HTTPS-WebP. Drie voorbereide URLs na deze interacties zijn verklaarbaar door
  de afwijkende crop/resolutie van de bewerkte afbeelding; geen vast twee-URLplafond.
- Terugkeer en sluiten: geen console-errors, nul Image-elementen na unmount.
- Volledige testselectie: 1854/1854 geslaagd, nul fouten of skips.
- Lint geslaagd met dezelfde 46 bestaande hookobservaties.
- Productiebuild en aparte build-check geslaagd: 726.263 initial JS bytes;
  alle bundelplafonds behouden. Diff-whitespacecontrole geslaagd.
- Beide testtabs en eigen testservers zijn gesloten.
- De bronmanifesten van de vergelijkingsbuilds verschillen uitsluitend in
  ImageArtwork.jsx, ImageWindow.jsx en ImageWorkbench.jsx.

Er zijn geen nieuwe release-browserasserties of gewijzigde producttests; de
bestaande tests blijven gelijk. De tijdelijke instrumentatie plus gepaarde
browserproef leveren het gerichte renderbewijs. Dit is geen volledige
release-browsergoedkeuring en geen bewijs voor een algemene typsnelheidsfactor.

## Nog gekoppeld

WorkbenchView combineert documentinhoud met geometrie/hosttoestand. TextInstance,
ImageInstance en diverse gedeelde hooks lezen die context. EditorCellsContext
bevat daarnaast generationgebonden previewacties. Alleen WorkbenchWindow in een
memo stoppen zou die contextbroadcast niet oplossen en zou door nieuw gemaakte
children/props vaak niet eens overslaan.

De brede venster-/tekstupdates en de vele geometry lookups zijn dus nog niet
weg. De volgende grotere stap vereist gerichte abonnementen of een aparte
stabiele host/geometriecontext, met behoud van actuele tools, selectie,
celpreview, camera, Undo en recovery. De tellergegevens wijzen dit onderzoek
concreet aan, maar verdelen de actuele CPU-tijd niet over deze functies.

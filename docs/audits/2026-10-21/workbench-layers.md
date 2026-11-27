# Workbench Layers — eerste lokale UI-migratie

21 oktober 2026. Lokaal, ongecommit en niet gedeployd.

## Opdracht en uitgangspunt

De UI-migratie begint met echte Layers voor Images, Text en Shapes. De gekozen
Carbon/Mist-richting en compositieregels zijn toegepast op de bestaande
Workbench. De vervolgstap met gedeelde Color/Transform/Artwork info en
detach/rejoin is nog niet uitgevoerd. Reception, Library, de Keeper-proef,
meerdere lokale Workbenches en bestaand artwork zijn behouden.

Werkplek: `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. De bestaande werkboom was al ruim
gewijzigd; deze stap bevat geen reset, commit, push, upload of deployment.
De bestaande server op 24970 is hergebruikt; geen tweede server gestart.

De GitHub-run voor het opgeslagen HEAD,
[Verify Inscape 39416407131](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131),
is opnieuw als geslaagd opgehaald. Die historische run valideert deze lokale
werkboom niet en bewijst geen actuele live deployment.

## Verantwoordelijkheden en vereenvoudiging

- Modules blijven eigenaar van inhoud, zijden, bronreferenties en lokale
  venstergeometrie. De Workbench beheert registratie, selectie en canvasprojectie.
- De gevalideerde draftstore blijft eigenaar van opslaan, conflictdetectie,
  Workbench-scoping en Undo/Redo. Er is geen tweede Layers-store of selectie.
- Voorheen concurreerden vaste Image/Text-zwaarden, Text-activatie en de
  Shape-arrayvolgorde. De canvasprojectie leidt de onderlinge tekenvolgorde nu
  af van één opgeslagen `artworkLayers`-veld. Shape-volgordeknoppen gebruiken
  dezelfde bewerking. Standalone vensterstijlen blijven alleen fallback voor
  hosts zonder deze projectie; zij bepalen de Workbench-artworkvolgorde niet.
- `activeModuleId` blijft de bestaande eigenschappendoelkeuze. Layers koppelt
  de bestaande selectie eraan; de eigenschappentools zelf zijn nog niet
  gemigreerd. Gewone selectie behoudt modulehandles en actieve Text-invoer;
  Shift/marquee blijft de expliciete meervoudige selectie met hosthandles.
- Oude navigatiegroepen behouden hun eigen membership/stack/spread. Ze worden
  niet automatisch in compositieblokken omgezet.

## Opgeslagen en tijdelijke toestand

`artworkLayers` bevat achter→voor module-ID's of blokken met `id`, `name` en
`children`. Alleen de geordende children bezitten de ledenvolgorde; een tweede
groepsledenlijst bestaat niet. Validatie vereist exact één vermelding van ieder
Image/Text/Shape, unieke blok-ID's, geldige namen en geen lege/geneste blokken.
Alleen een daadwerkelijk voltooide moduletoevoeging/verwijdering past de lijst
aan. Een ongeldige geladen draft gaat door de bestaande herstelgrens en wordt
niet stilzwijgend als lege Workbench gepresenteerd.

Oogjes, uitklappen en onderdeelmodus zijn tijdelijk. Ze veranderen geen
publicatiekeuze. Selectie, activering, focus en camera schrijven geen laagvolgorde.
Text-vervolgframes delen de laag van hun Text en verplaatsen mee.

De publieke projectie bevat uitsluitend de vlakke volgorde van toegestane
modules. Private leden en lokale bloknamen worden weggelaten. Een herstel van
dezelfde publieke volgorde behoudt de lokale blokindeling. Dit blijft een
projectie van één compositie; multi-Workbench-publicatie is nog toekomstig werk.

## Bediening

Layers toont voor→achter, met ordeningsknoppen, Alt+Up/Down en rij-drag/drop.
Blokken ontstaan op de positie van het voorste geselecteerde lid, zonder
geometriewijziging. Interne ordening blijft binnen het blok. Ungroup en Remove
part behouden alle inhoud. Een bestaande groep uitbreiden kan via ungroup en
opnieuw groeperen; automatische drag-to-join is niet toegevoegd.

Een canvasclick selecteert het blok; slepen verplaatst de leden in één
opslagbewerking, ook verborgen of gesloten leden. Gesloten modules volgen een
opgeslagen verplaatsing/Undo voordat ze heropenen. Dubbelklik focust; Enter of
Edit parts geeft toegang tot leden. Layers kan rechtstreeks een uitgeklapt lid
selecteren. Escape respecteert eerst Text of een actieve handeling. Een actieve
canvasbeweging ontvangt Escape ook wanneer de selectie buiten de canvascrop
verdwijnt en daardoor toetsenbordfocus verliest.

Verwijderen vraagt inline bevestiging met terugkerende focus bij annuleren.
Canvas Delete opent Layers indien nodig en grijpt niet in een tekstveld in.
Eén Undo herstelt moduleinhoud, zijden, bronreferenties, vastgelegde geometrie
en memberships. Opslagfouten en verouderde acties laten geen halve bewerking
achter. Een Image met dezelfde bron en het Library-asset worden niet verwijderd.
De owner-Image heeft geen hover-X meer; gesloten Images zijn heropenbaar.

De companion gebruikt na de clean-window-verfijning hieronder een eigen kleine
toolhost, is verplaatsbaar en via onzichtbare randen resizable, met eigen lijstscroll.
Desktop start met Layers open; onder 600 px gesloten.
De creation-toolbar opent het paneel opnieuw. Paneellayout wordt nog niet
opgeslagen; deze stap maakt geen volledige dock/tab-layout. De bestaande
eigenschappentools kunnen met Layers overlappen en blijven verplaatsbaar.

## Clean-window-verfijning (21 oktober, lokaal)

Op verzoek van de founder is Layers losgemaakt van `WorkbenchWindow` en de
bijbehorende artwork-, camera-, resize- en detached-window-opbouw.
`WorkbenchToolPanel` bezit alleen tijdelijke schermpositie/grootte, viewportbegrenzing,
verslepen, resizen en toetsenbordbediening. De inhoud houdt selectie, opslag en acties.
De tien oude CSS-overrides voor de geërfde vensterhost zijn verwijderd.
De gedeelde legacy-host is hiervoor niet gewijzigd; andere tools zijn nog niet
naar de nieuwe basis overgebracht. Dezelfde Carbon/Mist-tokens blijven gelden.

De titel is nu een gewone knop: pointergebruik veroorzaakt geen focusmarkering;
Tab toont wel focus en pijlen verplaatsen het paneel. Escape, pointercancel,
focusverlies en viewportwijziging annuleren een lopende drag. Sluiten herstelt
focus naar Layers in de creation-toolbar. Listeners en pointer capture worden
opgeruimd als de editor sluit. De paneelpositie en -grootte worden niet opgeslagen.

De zichtbare resize-markeringen, `Front → back` en de vaste visibility-uitleg zijn verwijderd.
Het oogje verbergt een laag tijdelijk tijdens het bewerken; publicatie verandert
er niet door. Dat staat nog in de tooltip. Het aantal gebruikt nu `1 layer`.
De founder heeft daarna ook de Undo-footer laten verwijderen. De lijst krijgt
die ruimte terug; gedeelde Ctrl+Z/Redo en Workbench-commando's blijven werken.

Een nieuwe test op 760 × 500 vond dat de navigatie de sluitknop kon bedekken,
en daarna dat de minimumhoogte van de lijst de toenmalige Undo-knop buiten het paneel duwde.
De host ontvangt nu een expliciete referentie naar de blijvende navigatie plus
de bestaande ondergrens van de camera/creation-tools. De lijst kan verder
krimpen en blijft de scroll-eigenaar; titel en acties blijven bereikbaar.
Uitgeklapte New/Rename-formulieren blijven afzonderlijke navigatie-overlays.

De founder verduidelijkte daarna dat alleen de zichtbare handles weg moesten:
resizen moet behouden blijven. Vier transparante randzones (6 px) en vier
hoekzones (14 px) herstellen die bediening binnen de nieuwe paneelhost.
Alleen de cursor verraadt ze bij pointergebruik; rechtsonder is ook met Tab
en pijlen te bedienen, met een focusmarkering uitsluitend voor het toetsenbord.
De bestaande resize-geometriefunctie begrenst elke richting, behoudt de tegenoverliggende
rand en hanteert een minimum van 280 × 240 px binnen de beschikbare viewport.
Verplaatsen en resizen delen één tijdelijke framewaarde en dezelfde annulering.

## Verificatie van de eerste Layers-slice

- Volledige `npm test`: **1.298 geslaagd, 0 mislukt**.
- Nieuwe domeintests: **11 geslaagd** voor vorming, ordening/drop, ongeldige
  blokken, savefouten/stale acties, batchverwijdering en herstel, public/private
  filtering, actieve Workbench-scoping en atomaire beweging met live geometrie.
- Nieuwe browsergevallen: **5 geslaagd** voor echte paintvolgorde, selectie,
  vorming/onderdelen, drag/keyboard, oogjes, delete/Undo/reload, gesloten en
  verborgen leden, native Text Delete/Undo, buiten-canvasfocus, savefouten,
  Visitor en Carbon/Mist met scroll op 760 en 1440 px.
- Definitieve gecombineerde browsercontrole: **25 geslaagd, 0 mislukt**.
  Dit omvat de vijf nieuwe gevallen plus bestaande lokale Workbench-wissels,
  Text-herstel/detach op 390/1440/1600 px, activatie, canvascrop/Fit,
  navigatiegroepen, pixelnaden bij fractionele zoom en owner/Visitor
  selectie-vergroting, verplaatsing, toetsenbordbediening en annulering.
  Uitgevoerd met `INSCAPE_TEXT_ROOT` en `INSCAPE_TEST_ORIGIN` op de bestaande
  server `http://127.0.0.1:24970`, via `scripts/browserEnvironment.mjs` en
  testconcurrency 1. Bestanden: `workbench-artwork-layers`,
  `workbench-activation`, `workbench-groups`, `text-recovery-position`,
  `workbench-canvas-crop`, `workbench-view-scale` en `local-workbenches`
  onder `browser-tests/` (allemaal `.browser.mjs`).
- `npm run build` liep eerst tegen de beperkte Windows-configbundler-toegang
  aan. `npm run build -- --configLoader native` slaagde; de productiegrenzen
  slaagden. Na de laatste codewijziging zijn build en `build:check` opnieuw
  geslaagd (822.889 initiële JS-bytes binnen de bestaande grens).
  De bestaande waarschuwing over grote
  chunks blijft zichtbaar; er zijn geen limieten verhoogd.
- Tokeninventaris is opnieuw gegenereerd; de inventariscontrole is opgenomen
  in de geslaagde volledige tests.
- De relevante wijzigingsdiff heeft geen whitespacefouten. Branch/HEAD zijn
  aan het einde ongewijzigd; de bestaande server antwoordt HTTP 200 met de
  INSCAPE-titel en Vite-client.

De oudere view-scale-fixture werd bijgewerkt om de echte owner-editorgrens te
mounten, het Layers-paneel voor onbelemmerde canvasmetingen te sluiten, en
pixel-/bewegingsmetingen aan de bestaande canvascrop te koppelen. Ze ging nog
uit van verplicht binnen-canvas houden en een vast schermpunt dat bij uitzoomen
buiten de crop ligt. Die fixturecorrecties vervangen geen productgedrag.

## Verificatie van de clean-window-verfijning

- Gecombineerde browsercontrole: **17 geslaagd, 0 mislukt** voor de zes
  Layers/paneelgevallen, activatie, acht Text-herstelgevallen en twee lokale
  Workbench-gevallen. Log: `.browser-test-runtime/workbench-artwork-layers/browser-clean-panel-final.log`.
- Na verwijdering van de Undo-footer: alle **zes Layers-browsergevallen opnieuw
  geslaagd**, inclusief echte Ctrl+Z voor ordenen, verwijderen en herstel van
  gesloten delen. Log: `browser-no-footer.log` in dezelfde map.
- Laatste design-system-controle: **10 geslaagd**; tokeninventaris bijgewerkt.
- Laatste `npm run build -- --configLoader native` en `npm run build:check`
  geslaagd; **822.889 initiële JS-bytes**, bestaande budgetten ongewijzigd.
- Pointer- en toetsenbordfocus, Carbon/Mist op 1440 en 760 px, eigen scroll en
  de korte 760 × 500-viewport visueel gecontroleerd. Deze opnamen vervangen
  de eerdere Layers-opnamen hieronder en bevatten geen Undo-footer.
- Branch/HEAD ongewijzigd; wijzigingen alleen lokaal, niet gecommit/gepusht of
  gedeployed. Bestaande server op 24970 geeft HTTP 200 met INSCAPE/Vite.
  De eerdere volledige unit-suite is voor deze verfijning niet herhaald.

## Visuele controle

Na de verduidelijking over onzichtbare resize handles zijn **7 browsergevallen**
geslaagd (`browser-invisible-resize.log`), plus **10 design-system-controles**.
Het extra geval bedient alle acht randen/hoeken, controleert ankers, minimum,
cursor en transparantie, pointergebruik na toetsenbordresizing, Escape/focusverlies,
viewportgrenzen, ongewijzigde artworkopslag en cleanup tijdens sluiten.
De laatste native-config build en `build:check` slagen opnieuw met 822.889
initiële JS-bytes. De compacte 280 × 240-paneelweergave is op breed en smal
gecontroleerd; dit blijft lokaal en ongepubliceerd.

- [Onzichtbaar resizen, compact op 1440 px](workbench-layers/layers-resized-carbon-1440.png)
- [Onzichtbaar resizen, compact op 760 px](workbench-layers/layers-resized-carbon-760.png)

De onderstaande opnamen zijn gemaakt in geïsoleerde testcontexts; echte
browseropslag en gebruikerscomposities zijn niet gewijzigd. De lijst, selectie,
knoppen, afkapping, eigen scroll en vensterranden zijn visueel geïnspecteerd.

- [Mist, 1440 px](workbench-layers/layers-1440.png)
- [Mist, 760 px](workbench-layers/layers-760.png)
- [Carbon, 1440 px](workbench-layers/layers-carbon-1440.png)
- [Carbon, 760 px, lange lijst](workbench-layers/layers-carbon-760-scroll.png)
- [Carbon, na pointerdrag zonder focusrand](workbench-layers/layers-clean-pointer.png)
- [Carbon, focus bij toetsenbordbediening](workbench-layers/layers-clean-keyboard.png)
- [Carbon, laag venster 760 × 500](workbench-layers/layers-clean-760-short.png)

Nog niet bewezen of uitgevoerd: volledige productbrede browserrelease-suite,
nieuwe performance/RAM-meting, wallet/publicatie of live deployment. Deze stap
claimt geen afgeronde mobiele authoring of volledige gedeelde-panelenmigratie.

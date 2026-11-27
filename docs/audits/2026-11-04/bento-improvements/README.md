# Bento-verbeteringen — 4 november 2026

De goedgekeurde verbeteringen uit de [deep review](../bento-deep-review/README.md) zijn lokaal geïmplementeerd. Native modules, Reception-opslag en undo blijven de bestaande eigenaren. De generator en native celgeometrie zijn behouden.

## Resultaat per bevinding

- **F1 — inhoudsgrenzen:** celbewerkingen houden rekening met de minimum- en maximummaten van hun Text, Image en Shape-inhoud. Shared-edge resize stopt op die grenzen. Split en nieuwe indelingen geven een inhoudelijke fout voordat ze worden opgeslagen. + Text en + Image verklaren via hun tooltip waarom een te kleine/grote cel niet geschikt is. De native validators zijn niet versoepeld.
- **F2 — celstijl:** wijzigen van maat of gutter bewaart verschillende radii. De globale radius toont Mixed bij verschillende waarden; alleen een expliciete radiuswijziging past alle cellen aan. Een nieuwe indeling behoudt bestaande celstijlen. Selected cell heeft een eigen radiusactie, met undo.
- **F3 — gestures:** Bento gebruikt `createWorkbenchGestures`. De eigen pointermove/up/cancel/lostcapture- en Escape-afhandeling is verwijderd. De gedeelde afronding geeft de camera vrij, ook bij mislukte capture, annuleren en mislukte opslag. Document- en paneelpreviewbewaking blijven bij Reception: dat is een andere verantwoordelijkheid dan de pointerlifecycle.
- **F4 — formulier:** Current grid en New layout hebben afzonderlijke tijdelijke invoer. Een gekozen voorstel met acht cellen blijft acht wanneer je de huidige grid met twee cellen groter maakt. Het voorstel wordt tegen de actuele inhoud gecontroleerd. Lege Reception start met Create your Bento; de hoofdactie staat in een vaste paneelvoet.
- **F5 — verificatie:** `npm test` ontdekt expliciet de echte testmappen, inclusief `.test.mjs`. Historische testkopieën onder output worden niet meer als applicatietests uitgevoerd. De design-system-inventory is opnieuw gegenereerd. Verwijderde coupling-controls zijn vervangen door tests voor de huidige split/merge- en celstijlacties.

## Styling en maakflow

De ene actiestrook staat buiten de geselecteerde cel, boven de resize-interactielaag en binnen het scherm. Eigen 26/28-pixel button/input-recepten zijn verwijderd; Bento gebruikt de gedeelde flat controls, maten en focusstijlen. De naam is consequent Bento settings. De geselecteerde cel toont een ingang naar dezelfde split/merge-commands die het contextmenu gebruikt; Color en Shape blijven de bestaande routes voor kleur, outline en naam.

De desktoppreview schaalt radius en clipping via één projectie. In het gevulde voorbeeld wordt een radius van 64 op een 1440-pixel canvas bij 900 px precies 40 px, voor achtergrond én clip. Bestaande phone-reflow en de leesbare, wrappende Text-lettergrootte zijn behouden. Het paneel verwijst naar Preview om tekst op smallere presentatiebreedtes te controleren.

Visueel gecontroleerd: lege start, beide paneeltaken, vaste hoofdactie, kleine cellen, Light/Dark, echte artwork, gemengde radii en 900/1280/1440-pixel computervensters. De reeds bestaande Shape-regressie op 390 px is ook uitgevoerd; er is geen nieuwe mobiele authoringflow toegevoegd.

- [Lege start in Light](../../../../output/bento-improvements-2026-11-04/acceptance/reception-native-editor/layout-generator-900-light.png)
- [Kleine cel met bereikbare actiestrook](../../../../output/bento-improvements-2026-11-04/acceptance/reception-native-editor/small-cell-limits.png)
- [Gemengde radii in de desktoppreview](../../../../output/bento-improvements-2026-11-04/acceptance/reception-native-editor/mixed-radius-900.png)
- [16 cellen met geladen artwork en Text](../../../../output/bento-improvements-2026-11-04/filled-16-cells.png)

## Concrete vereenvoudiging

De React-host herschrijft geen nieuwe Text-records meer in een `cellStore`-wrapper. `addTextModule` ontvangt een expliciet frame en appearance; `commitInCell` bewaakt atomair lidmaatschap. Preview, opgeslagen geometry en locked-contentcontrole delen nu `projectReceptionMember`. Het lege-celminimum heeft één benoemde eigenaar; native grenzen worden uit de bestaande validatiemodules betrokken.

Verwijderd zijn de parallelle Bento-gesturelisteners, de React Text-kandidaatmutatie, herhaalde proportionele projectieformules, de eigen controlkleuren/states/maten en het gedeelde formulier dat voorstel en huidige indeling door elkaar haalde. De eerdere celgenerator en partitionering blijven in gebruik. Native modulevalidatie blijft de laatste opslagcontrole, naast de voorafgaande Bento-planning; dat is bewust geen vervanging van de opslaggrens.

Ten opzichte van de opgeslagen werkboom aan het begin van deze implementatie: **productiecode +350/−208 regels**, tests +270/−57, bestaande contractdocumentatie +27/−1, tooling +7/−3 en gegenereerde inventory +22/−20. Dit nieuwe verslag valt buiten die vergelijking. De netto productiegroei komt vooral door expliciete inhoudsgrenzen, onafhankelijke formulierinvoer en de geselecteerde-celbediening. Er is geen nieuwe dependency toegevoegd.

[Exacte wijzigingsstatistiek](../../../../output/bento-improvements-2026-11-04/change-statistics.json) en [reviewpatch ten opzichte van de beginwerkboom](../../../../output/bento-improvements-2026-11-04/implementation.patch). De patch is geen diff tegen HEAD: de werkboom bevatte al omvangrijke, behouden wijzigingen.

## Verificatie

| Controle | Resultaat |
|---|---|
| Gerichte Reception/gesture-tests | 108/108 |
| Volledige `npm test` | **1710/1710** |
| `npm run lint` | Geslaagd; 78 bestaande geregistreerde hook-observaties |
| `npm run typecheck` | Geslaagd; bestaande beperkte contractsuite, 39 ongeldige calls en 9 productiemutaties geweigerd |
| Reception native editor | **29/29** |
| Reception cell interaction | **3/3** |
| Reception layer order | **3/3** |
| Reception reader | **4/4** |
| Gewone Shape-resize | **2/2** |
| Workbench input recovery | **2/2** |
| Laatste `build` en `build:check` | Geslaagd |

De gezamenlijke acceptatierun telt **43/43 browserchecks**. Deze bevat echte pointer- en keyboardacties, opgeslagen inhoud, undo/redo, reload, foutieve opslag, annuleren en gedeelde rendering. De extra regressies controleren verschillende radii, voorstelbehoud, kleine Text-cellen, losgelaten muisknoppen en mislukte pointercapture.

Tijdens de controles zijn ook verouderde testaannames hersteld: fractionele Image-fixtures, navigatie via een verborgen sidebar, paint-hit-testing door een Bento-interactielaag, rotatievergelijking zonder rekening met camera-afmetingen, oude camera-CSS-variabelen en schermpixels die als canvaspixels werden geteld. De uiteindelijke assertions blijven werkelijk gedrag controleren. Testvensters worden gesloten waar zij het te bedienen artwork bedekken; er worden geen geforceerde clicks gebruikt om dat te omzeilen.

De gevulde controle gebruikt 16 werkelijk geladen Images uit zeven lokale WebP-artworks en acht gevulde Text-modules. Een afzonderlijke lokale synthetische drag gaf 263 frame-intervallen: mediaan 7 ms, p95 20,9 ms, maximum 34,8 ms. Dit is indicatief development/headless-bewijs, geen 60-fps-garantie voor andere computers of complexere assets. Een eerdere meting draaide tegelijk met andere tests; alleen `scale-probes-solo.log` hoort bij deze cijfers.

Alle [logs en scripts](../../../../output/bento-improvements-2026-11-04/) zijn bewaard. De finale browserresultaten staan onder `acceptance/`; eerdere runs zijn diagnostiek. De 1356 gecontroleerde bron-, script- en browsertestbestanden zijn na de acceptatierun ongewijzigd: [integriteitscontrole](../../../../output/bento-improvements-2026-11-04/verification-integrity.json).

## Build en lokale status

Core JavaScript: 2.737.346 → 2.742.838 raw bytes (+5.492), gzip 905.189 → 907.004 (+1.815). De aggregate budgetgrens is hiervoor onderbouwd begrensd op 2.744.000 raw / 909.000 gzip. Initial JS blijft **800.014 bytes**. Startup-, wallet-, CSS-, asset- en isolatiegrenzen zijn behouden. De bestaande waarschuwing over grote chunks blijft zichtbaar; `build:check` slaagt.

Branch: `codex/profile-work-index-2026-10-30`. Lokale HEAD en gecontroleerde remote branch staan nog op `82837f1d76debe98f1597cf69d5bd95aac5f2659`. De laatste [CI-run op die commit](https://github.com/RadarVisuals/INSCAPE/actions/runs/41333804853) is mislukt en bevat deze lokale verbeteringen niet. Er is geen nieuwe deployment geverifieerd of uitgevoerd.

Alles is lokaal, ongecommit en ongepusht. Bestaande wijzigingen zijn behouden. De tijdelijke fixture-server is gestopt. Er zijn geen live gebruikersdrafts, walletacties, uploads of publicaties uitgevoerd.

De implementatie is gecontroleerd binnen de huidige productgrenzen, waaronder 16 nieuw aangemaakte cellen en de native modulecapaciteiten. De tests omvatten de getroffen editorpaden; dit is geen claim dat alle browsersuites van de hele applicatie of elke mogelijke artistieke compositie zijn geverifieerd. Exacte celverhoudingen en extra templates blijven latere productkeuzes.

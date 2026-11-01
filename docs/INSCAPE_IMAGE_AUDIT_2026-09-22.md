# Image-module audit — 22 september 2026

De normale Image-workflows werken en de gecontroleerde opslag- en publicatiegrenzen houden stand. Er zijn vijf concrete verbeterpunten, alle met prioriteit P2: interacties worden te breed geannuleerd, mediafouten blijven onzichtbaar, kleine canvassen verliezen klikruimte, externe opslagconflicten hebben geen werkende herstelroute en Image kan niet via het toetsenbord met Library-artwork worden gevuld. Er is in deze audit geen P0/P1-probleem, verlies van reeds opgeslagen Image-inhoud of publicatie van private Images aangetoond.

Dit is een audit van de lokale werkversie, inclusief de al aanwezige gewijzigde en untracked Image-, Display- en Workbench-bestanden. Het is geen beoordeling van een gepushte release. Productrichting: `INSCAPE_ACTIVE_CONTRACT.md`; betekeniscontext: `INSCAPE_CREATIVE_INTENT.md`. Oudere audits en de beschermde continuation handoff zijn niet als richting gebruikt.

**1. P2 — Een ongerelateerde save beëindigt crop en inspectie.**

In `src/imageModule/ImageWorkbench.jsx:30` geldt een cropsessie alleen zolang `cropState.expected === record`. Het effect op regels 39–43 wist crop, flip en inspectie bij iedere nieuwe `record`-referentie. De gedeelde draftstore accepteert na een commit een opnieuw gevalideerde/kopieerde draft. Daardoor krijgt ook ongewijzigde Image-inhoud een nieuwe objectreferentie.

Reproductie: start Crop, zet zoom op 200%, voeg via dezelfde store een andere Image toe zonder de tooltarget te wijzigen. De crop verdwijnt; de opgeslagen eerste Image is byte-inhoudelijk ongewijzigd. Open vervolgens inspectie en commit opnieuw een andere module: inspectie sluit. Beide effecten zijn in de browser bevestigd. Dezelfde invalidering raakt volgens het codepad ook een nog lopende dimension-decode (`imageRequest` en `latest.current !== current`); die asynchrone variant is niet afzonderlijk gereproduceerd.

Dit koppelt een tijdelijke Image-interactie aan iedere wijziging in het hele profiel. Dat is ruimer dan de contractregel om te stoppen bij een wijziging van het betreffende doel of de betreffende inhoud. Aanpak: bind tijdelijke interacties aan profiel, module, side en relevante inhoud/revisie. Behoud de bestaande stale-writecontrole; voorkom dat een ongerelateerde commit als Image-inhoudswijziging geldt. Hiervoor is geen tweede opslagmodel nodig.

**2. P2 — Een onbereikbaar beeld heeft geen laad-, fout- of hersteltoestand.**

`src/imageModule/ImageArtwork.jsx:15` rendert rechtstreeks een SVG `<image>` zonder load/error-state. Zolang een side bestaat, noemt de canvas zichzelf “Inspect …”, ook als de URL faalt. `src/public/ownerSystemWorkflow/DisplayLiftArtwork.jsx:64` vangt een mislukte decode af zonder foutmelding; de Lift-copy blijft verborgen.

Reproductie: gebruik een geldig opgeslagen asset met bekende afmetingen, maar blokkeer zijn media-URL. Het canvas blijft leeg zonder status of alert. Klikken opent “Inspect Image” met Return, zonder beeld of uitleg. De browserproef bevestigt nul status-/foutmeldingen. Dit is iets anders dan een daadwerkelijk lege Image of transparant artwork. Owner en Visitor delen deze renderer en dus dit codepad.

Aanpak: één mediastatus per actuele bron, met zichtbare unavailable/error-state en een retry die werkelijk opnieuw laadt. Late load/error-resultaten moeten aan de oorspronkelijke side/URL blijven gebonden. Bewaar de bestaande assetidentiteit en opgeslagen crop bij fouten.

**3. P2 — Toegestane kleine canvassen worden door hun bediening afgedekt.**

De canvas mag 32 × 32 pixels zijn. `src/imageModule/imageModule.css:3`, `:8` en `:21` gebruiken ondertussen een header van 28 pixels, een resizevlak van 20 × 20 en een Next-knop met 28 pixels minimumhoogte en 24 pixels rechteroffset. `ImageWindow.jsx:98` legt de header over de canvas. Een header met opacity 0 blijft pointer-events onderscheppen.

Gemeten bij 100%: een canvas van x=140 tot x=172 krijgt een Next-knop van circa x=97,55 tot x=148. De knop steekt dus ruim buiten de linkergrens. Bij 25% Workbench-zoom wordt dezelfde canvas 8 × 8 schermpixels. Een hit-test van alle 64 pixelcentra vindt **nul** punten waar de canvas de pointer ontvangt. Inspectie via klikken is daar onmogelijk; toetsenbordfocus op de canvas blijft een aparte route. Het probleem betreft de bediening, niet de correct bewezen afbeeldingsranden.

Aanpak: laat de bediening reageren op de werkelijk getoonde canvasmaat, met bereikbare bediening buiten of naast te kleine oppervlakken en behoud van focus. Verander daarvoor niet stilzwijgend de opgeslagen minimummaat of canvasgeometrie. De uiteindelijke visuele keuze vereist een concrete vergelijking met de bestaande vormtaal.

**4. P2 — “Try the edit again” herstelt een externe opslagwijziging niet.**

`src/imageModule/ImageWorkbench.jsx:63` maakt van iedere mislukte save dezelfde melding. `imageModuleSession.js:13` gebruikt uitsluitend `commitCompletedOperation`; `systemWorkflowDraftStore.js:233` weigert die zolang de actuele opslag niet meer overeenkomt met de eerder gelezen bytes. Image gebruikt de beschikbare `retryCompletedOperation`-route niet.

Reproductie: verander de opgeslagen naam van een andere Image zoals een tweede tab dat zou doen. Probeer daarna de breedte van de eerste Image van 32 naar 64 te wijzigen. Drie opeenvolgende pogingen geven dezelfde melding; de breedte blijft 32. De weigering beschermt de externe wijziging terecht. De aangeboden instructie geeft alleen geen herstel en maakt geen onderscheid tussen tijdelijk volle opslag en een blijvend stale record. Dit is geen bewijs van verloren opgeslagen data.

Aanpak: onderscheid commit-faalredenen. Bied opnieuw lezen en veilig herbaseren van ongerelateerde wijzigingen; vraag alleen een vervangingskeuze als dezelfde Image-inhoud conflicteert. Houd de niet-opgeslagen invoer beschikbaar en meld pas succes na bevestigde opslag.

**5. P2 — Library heeft geen toetsenbordroute naar Image.**

Dit is vastgesteld door het volledige inputpad te volgen. Image registreert `acceptImage` alleen als module-dropdoel (`ImageWorkbench.jsx:90`). `OwnerSystemWorkflowLibraryWorkspace.jsx:40` stuurt gewone activatie via `placementTargetRef`; de module-targets worden uitsluitend in pointer-drag afgehandeld. `OwnerSystemWorkflowRuntime.jsx:190` resolveert die gewone plaatsing naar een Display. De Enter-actie voor een uitgeklapte beeldvariant (`OwnerSystemWorkflowLibraryImages.jsx:31`) bereikt dus ook de Display-route. Op de primaire Library-tegel selecteert Enter alleen het item via de button-click; Image heeft geen eigen selecteer/toevoegactie.

Gevolg: iemand die uitsluitend het toetsenbord gebruikt kan een Image aanmaken en de tools bedienen, maar geen eerste side toevoegen of een side vervangen. De keuzelijst “Library drop” verandert alleen het gedrag van slepen. Aanpak: een expliciete, toetsenbordbereikbare actie met het concrete Image-doel; hergebruik `acceptImage`, validatie en save in plaats van een tweede importpad. Dit punt is codebevestigd, niet als volledige toetsenbord-E2E gereproduceerd.

**Architectuur en verantwoordelijkheden.**

| Grens | Eigenaar en auditbevinding |
| --- | --- |
| Inhoud | `imageModule.js` valideert modules, sides, crop, transforms en de canonieke asset. Geen layers of geneste compositie. Afmetingen staan eenmaal in de module. |
| Aanmaken/bewerken | `imageModuleSession.js` gebruikt de profielstore, checkt profiel en verwachte inhoud, en commit één undoable operatie. |
| Tijdelijke interactie | `ImageWorkbench.jsx` bezit sideselectie, flip, crop, inspectie en dropmodus. Dit is de plaats van de te brede invalidatie uit punt 1. |
| Venster | `ImageWindow.jsx` heeft een eigen borderless surface en pointer-/keyboardafhandeling. Camera, registratie, bounds en snapping komen uit de Workbench. Dit is gedeeltelijk gedeeld venstergedrag, geen volledig gedeelde vensterimplementatie. |
| Rendering | Owner en Visitor laden dezelfde ImageWorkbench lazily. SVG-projectie bewaart alpha; Lift hergebruikt Display. Die gedeelde afhankelijkheid omvat ook het ontbreken van decode-feedback. |
| Publicatie | De builder projecteert alleen PUBLIC Images en filtert hun windows mee. Bronmetadata blijft los van crop/transform. Assetreferenties en totale JSON-bytes tellen mee. |
| Herstel | Niet in de publicatie voorkomende lokale Images blijven private. Overschrijding van modulecapaciteit faalt zonder truncatie. |
| Toegang | Visitor krijgt geen store en geen authored resize/tools; flips en vensterbeweging zijn tijdelijk. Image introduceert geen upload-, signing- of walletactie. Dit is een lokale codegrenscontrole, geen nieuwe live LUKSO-standaarden- of securitycertificering. |

Er is geen architectuur gewijzigd of opgeschoond tijdens de audit. De bestaande scheiding van inhoud, publicatie en host is bruikbaar. De concrete verbeteringen horen bij interactie-invalidering, mediastatus, inputrouting en opslagherstel; de bevindingen rechtvaardigen geen generiek moduleframework of herschrijving van de Workbench.

**Uitgevoerde verificatie.**

| Controle | Resultaat |
| --- | --- |
| Complete bestaande testsuite, `node --test` onder Node 24.20.0 | 909/909 geslaagd, circa 39 seconden. Dit was vóór toevoeging van de drie nieuwe domeinchecks hieronder. |
| Bestaande Image-domeintests plus nieuwe `imageModule.audit.test.js` | 7/7 geslaagd. De drie nieuwe checks bewijzen 16 × 32 sides/publicatie/herstel, weigering van herstel boven capaciteit en toepassing van de JSON-bytelimiet. |
| `image-module.browser.mjs` | Geslaagd: Library-drop, append/replace/remove, resize/cancel, crop/transforms/Native fit, save failure, undo, flip/wrap, Lift/Escape, reload en owner/Visitor-pixelpariteit. |
| `image-pixels.browser.mjs` | Geslaagd: 32–4096 canvasmaten, camera .25–2, densities 1/1.25/2, alle randen en hoeken, alpha en asymmetrische quarter-turn/mirror-controles. |
| Nieuwe `image-audit-probes.browser.mjs` | Geslaagd als **defectreproductie**: bevestigt het huidige foutgedrag uit punten 1–4. Dit is nadrukkelijk geen bewijs dat die fouten opgelost zijn. |
| `npm run build -- --outDir output/image-audit-build` | Geslaagd; bestaande Rollup-annotatie-, chunkgrootte- en gemengde importwaarschuwingen aanwezig. |
| `npm run build:check -- output/image-audit-build` | Geslaagd; 784770 initial JavaScript bytes, binnen de ingestelde budgetten. |
| Screenshots | Bestaande brede/smalle Image-shots en aanvullende 1200 × 800 / 390 × 844 probes visueel bekeken. De geïsoleerde probes gebruiken niet de volledige productiehost/theming; zij bewijzen geometrie en fouttoestanden, geen algemene stijlafkeuring. |

De eerste startpogingen gebruikten de lokale standaard-Node 18 en liepen tegen sandboxrechten aan. Daarna is expliciet de vereiste aanwezige Node 24.20.0 gebruikt; Vite/Edge/build draaiden na automatische goedkeuring buiten de sandbox. De eigen browserfixture is tweemaal gecorrigeerd (ESM-defaultimport en overlap van testvensters) en daarna succesvol uitgevoerd. Die fixturefouten zijn niet als productgebrek geteld.

De browserproeven gebruiken lokale fixtures en afgevangen netwerkverzoeken. Er is niets geüpload, gepubliceerd, gesigneerd of gedeployed. Chromium/Edge is getest; Firefox, Safari, echte touchhardware en screenreadergebruik zijn niet bewezen. De 16 × 32-check bewijst opslagcapaciteit, niet vloeiende rendering van zestien grote echte artworks. Er is geen representatieve GPU/geheugen/netwerk-stresstest uitgevoerd. Grote bronnen worden rechtstreeks gerenderd; een prestatiegarantie volgt niet uit groene pixeltests. De algemene LUKSO-test maakt deel uit van de bestaande suite; live standaardverificatie was geen onderwerp van deze lokale Image-audit.

Auditmateriaal: `output/image-audit-2026-09-22/probes.json`, `missing-media.png`, `minimum-canvas-wide.png`, `minimum-canvas-narrow.png`; reproduceerbare controles in `browser-tests/image-audit-probes.browser.mjs` en `src/imageModule/imageModule.audit.test.js`. De productiecode en reeds aanwezige gebruikerswijzigingen zijn intact gelaten. Alleen dit verslag, de auditchecks en lokale uitvoer zijn toegevoegd; niets is gecommit of gepusht.

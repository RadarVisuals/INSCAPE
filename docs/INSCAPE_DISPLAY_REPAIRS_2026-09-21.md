# Display-herstel — 2026-09-21

Uitgevoerd op verzoek van de gebruiker na de onafhankelijke Display-audit.
De gebruiker verwijderde vervolgens expliciet het volledige artworkpaneel:
mats, frames, achtergrondkleur en Transparency. Artwork behoudt zijn eigen
transparantie. Text-vormgeving, Grid-achtergrond en Display-windowvormgeving
blijven afzonderlijke functies. De actieve productafspraak is bijgewerkt.

## Resultaat per auditbevinding

| Audit | Uitgevoerd | Bewijs |
| --- | --- | --- |
| F1 — teksttoetsen wijzigen/verwijderen een laag | Compositietoetsen negeren tekstinvoer, native controls, afgehandelde events, IME en modifiers. De plaatsing zelf behoudt pijltjes/Delete. | Echte Text-editor, opgeslagen tekst en plaatsingsgeometrie, 1440 en 390 px. |
| F2 — owner/Visitor-presentatieverschil | Het volledige artworkpresentatiepaneel, bewerkactie en decoratieve renderpaden verwijderd. Owner en Visitor delen `projectArtworkInRectangle`. Inspectie kreeg een eigen begrensde actie. | Pixels, domeinchecks, publicatie/restore en echte Discover-covers. |
| F3 — rasteruitloop over een buurbeeld | De owner-mediaopening knipt de rasteruitloop af aan de plaatsingsrand, gelijk aan Visitor. Interne rasteruitloop blijft beschikbaar tegen naden. | Rood/groene grenspixel identiek in owner en Visitor bij DPR 1, 1.25 en 2. |
| F4 — thumbnail zichtbaar achter transparante bron | Thumbnail verdwijnt zodra de volledige bron gereed is. Bronwisseling vervangt de laadstatus atomair; fout houdt een zichtbare fallback over. De reset-effectrace bij snelle loads verdwijnt. | Transparante hoek toont hetzelfde blauw in owner en Visitor; gewijzigde/falende bron toont fallback. |
| F5 — achtergebleven crop-gebaren en verouderde baseline | Eén crop-operation-ID, afsluiten verwijdert listeners/refs, commit gebruikt de oorspronkelijke plaatsingssnapshot. Alleen de eigen resize mag die baseline bijwerken. Andere content-, Grid-, module- of storewissels stoppen de preview. | Hookregressie voor cancel → nieuwe crop en externe cropwijziging; echte UI voor Done, Cancel, buitenklik, Native fit, nudge en resize gevolgd door cropcommit. |
| F6 — tegengestelde groepsrotatie | Plaatsingsgeometrie draait dezelfde kant op als de beelden. Spiegelassen draaien mee, zodat ook gespiegelde leden als één compositie draaien. | Asymmetrische beeldpunten voor alle vier rotaties en spiegelcombinaties; vier rotaties herstellen de oorspronkelijke transform. |
| F7 — mat-opening wijkt af tijdens Lift | Mat-openingen en backplates bestaan niet meer. De hele plaatsing is de opening; het bewegende beeld zit binnen die clip. | Focusgeometrie, Image-domeinchecks en owner/Visitor-inspectie op breed/smal, met grain behouden. |
| F8 — reduced motion kiest al een Grid tijdens vasthouden | Beweging verzamelt alleen afstand; loslaten kiest maximaal één buur-Grid. | Owner en Visitor: meerdere Stage-breedtes vasthouden verandert niets; release kiest precies één buur, opgeslagen draft onveranderd. |

## Opslag en de tijdens herstel gevonden Discover-regressie

Oude schrijvers namen ook ongebruikte artworkpresentatievelden mee. De private
draftlezer accepteert het oude uitgeschakelde mat-default en oude frame/backing/
transparency-waarden, en verwijdert die uit de gelezen draftkopie. Lezen schrijft
niet naar opslag. Nieuwe saves en nieuwe publicaties bevatten de velden niet.
Geometrie, beelden, Text, andere modules en bestaande storage keys blijven intact.

Mijn eerste aanpassing verwijderde die velden ook uit de publieke validatie-uitkomst.
Dat was onjuist: de immutable publicatie kwam daardoor niet meer overeen met de
oorspronkelijke canonical bytes. De gebruiker zag INSCAPE-fallbacks in Discover.
Dit is hersteld: publieke validatie bewaart de oorspronkelijke velden exact voor
de bestaande byte- en hashcontrole; renderers gebruiken ze niet. Alleen de
draftgrens verwijdert ze bij herstel. De integriteitseisen zijn niet versoepeld.

Een regressietest maakt historische canonical bytes onafhankelijk van de nieuwe
serializer en leest ze via de echte publicatierepository met gesimuleerde I/O.
Daarna is Discover daadwerkelijk met publieke gegevens geopend in een geïsoleerde
browser: residentzero (2/2 beelden) en VXCTXR (3/3 beelden), beide toegankelijk,
geen page errors. De screenshot toont de paarse figuur en de vogels. Geen nieuwe
publicatie, walletactie of externe schrijfoperatie uitgevoerd.

## Controles en grenzen

- Node 24.20.0, volledige `node --test` (hetzelfde testcommando als `npm test`): **902/902**.
- Nieuwe browserregressies: **4/4**; grain/inspectie: **1/1**; bestaande crop: **2/2**;
  gedeelde tools: **1/1**; owner/Visitor-landing: **1/1**. Chrome, geïsoleerde sessies.
- Breed/smal en DPR-pixelscreenshots bekeken. Bestaande cropfixture selecteert nu
  expliciet met het toetsenbord en focust de plaatsing voor nudges; een slider
  behoudt zijn native pijltjestoetsen.
- `npm run build` en `npm run build:check`: geslaagd; bestaande bundelbudgetten
  ongewijzigd, initial JS 784770 bytes. Bestaande dependency/chunkwaarschuwingen
  zijn geen nieuwe Display-fout. `git diff --check` geslaagd.
- Bewijs: `output/display-repairs-2026-09-21/`. De eerdere auditmap blijft
  historische auditdata; alleen zijn inventory-script is hernoemd omdat Node
  `test-inventory.mjs` ten onrechte als test uitvoerde.

De oorspronkelijke sporadische hapering is hiermee **niet bewezen opgelost**.
De bestaande owner/Visitor-landingcontrole slaagt, maar dat verklaart niet elke
fysieke compositorhapering. Geen algemene camera-rewrite of ongefundeerde
performancewijziging uitgevoerd. De matgerelateerde Lift-fout vervalt door de
verwijderde functie; dit is geen claim over iedere mogelijke eerste Lift-frame.

Alles staat lokaal, niet gecommit of gepusht. Bestaande user-wijzigingen behouden.
De beschermde continuation handoff is niet gelezen of gewijzigd. De bestaande
devserver op 5194 is niet gestopt of vervangen.

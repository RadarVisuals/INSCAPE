# Eerste omgevings- en botsingsproef — 20 oktober 2026

Expliciet gevraagd: één echt stuk omgeving met een eerste botsingsgrens, plus
herstel van de bestaande kapotte dockminiatuur. Lokale wijziging op
`codex/audit-checkpoint-2026-10-19`; niet gecommit, gepusht of gedeployd.

## Bron en weergave

Makerexport: projectroot `exploration-environment.svg`, 1.899.278 bytes,
viewBox `0 0 2000 2000`. Statisch vectorwerk, geen scripts of ingesloten images.
De hoekvorm toont een stevige horizontale bovenbalk en rechterrand, met rode,
ivoren en grijze illustratie. Het origineel is intact; een identieke kopie staat
bij [de referenties](../../design-references/2026-10-20-inscape-vision/environment-source.svg).
SHA256 van beide: `07D79F84BCC8C7C7101FC87A23E9D28C92F06B65B84559B2E889F1F5571754FD`.

De ruwe SVG in public overschreed het bestaande assetbudget. Daarom volgt dit
de inscape-artwork-workflow voor een afzonderlijke statische renderpass:
Chromium rendert het volledige SVG-tekenvlak op 1200 × 1200 met transparante
achtergrond; Pillow converteert die PNG naar lossless WebP met exact alpha.
Gedecodeerde RGBA-bytes zijn identiek aan de PNG; de bronrender is ook visueel
vergeleken met het SVG. Geen onafhankelijke animatielagen afgevlakt: deze
export bevat geen animatie. Runtimebestand: `public/exploration/environment.webp`,
420.746 bytes. Maximumweergave is 320 CSS-px, zonder wereldzoom.
Dit onderbouwt geen kwaliteit bij onbeperkt vergroten.

## Proefgedrag en verantwoordelijkheid

Een exemplaar staat tijdelijk linksonder in de eigenaar-proefkamer. De
gestippelde bovenrand markeert de enige botsingsgrens. Het is een handmatig
gekozen rechthoek over de stevige balk, geen pixelcollision of automatisch uit
de illustratie afgeleide wereldgeometrie. Uitsteeksels en rechterrand zijn nog
doorlaatbaar. De gewone Workbench krijgt geen nieuwe colliders.

De kamer levert een expliciete elementref in viewportcoördinaten aan de
bestaande Keeper-beweging. `keeperCollision.js` begrenst per integratiestap de
verplaatsing met een lichaamsomtrek van 30% van de weergegeven Keepermaat per
richting; tentakels bepalen de grens niet. Stop alleen de snelheid loodrecht op
de rand, zodat de actor erlangs kan bewegen. Bij resize-overlap herstel naar
de dichtstbijzijnde zijde. Geen zwaartekracht, routeplanner of nieuwe engine.
De Return-knop vliegt bewust rechtstreeks terug, ook door de proefgrens:
herstel blijft mogelijk zonder nu een terugkeerrouteplanner te bouwen.

De kapotte rigminiatuur in `KeeperWorkbench.jsx` is vervangen door een kleine
statische weergave van de al ingelezen rigdelen via `KeeperRigArtwork`.
Geen extra parser, duplicaatrequest of animatielus voor de miniatuur.
Gewone ongerigde beelden behouden hun bestaande laad-/retry-pad.

## Verificatie en grenzen

Gerichte bewegingstests dekken stoppen aan beide kanten, glijden, dunne muren,
langs een uiteinde bewegen, overlapherstel en gelijkwaardig gedrag op
30/60/120 Hz. De kamerbrowsertest dekt werkelijke Library-drop, miniatuur,
stoppen onder de balk, langs de rechterkant omhoog, terugroepen, heropenen en
smalle instellingen. Vlucht verandert het opgeslagen document niet. Bestaande
Keeper-, selectie-, dialoog-, Reception- en eigenaarroutering blijven gecontroleerd.

Finale resultaten: 1.266/1.266 algemene tests; tien ontwerpcontroles; twee
kamerchecks; vijf eigenaarroutechecks; drie bestaande Keeperchecks, één
selectiecheck, drie dialoogchecks en zes Receptionchecks geslaagd. Build,
assetbudget en initiële JS-budgetcontrole (821.965 bytes), plus één gebouwde
instapcheck geslaagd. De eerdere mislukte budget-/inventariscontroles zijn
opgelost met de WebP en een bijgewerkte inventaris; bovenstaande resultaten
komen van de finale uitvoering. Basis-HEAD-CI blijft eerder gecontroleerd;
voor deze lokale wijzigingen is geen externe CI of deployment uitgevoerd.

Bewijs: [tegen de balk](exploration-collision/wall-stopped.png),
[langs de balk](exploration-collision/around-beam.png),
[smalle instellingen](exploration-collision/settings-390.png).
Geen volle-map-
benchmark, collision-editor, cameravolgen, zoom, tweede ruimte of publicatie.

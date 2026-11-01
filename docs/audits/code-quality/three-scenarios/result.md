# Drie integratiescenario's: gerichte reparatie

De drie eerder falende scenario's slagen samen met de aanvullende dockingcontrole: **25/25**, zonder skips of annuleringen. De actuele status blijft in [de voortgangslijst](../../2026-10-23/code-quality-progress.json). Dit is geen volledige releasecontrole.

| Grens | Bewezen oorzaak en correctie | Gezamenlijke browsercontrole |
| --- | --- | --- |
| Opstart | De tijdelijke editorlease meldde de bestemming te vroeg gereed. Alleen een terminale toegangsweergave of de gemounte Workbench meldt nu readiness. Herstel bewaart keyboardfocus in de stabiele applicatiecontainer. | 16/16 |
| Bestemmingen | De test verstuurde focus en Shift+Enter in één synthetische callback. Met dezelfde doelnode, afzonderlijke echte invoer en de bestaande renderafwachting blijft expliciete selectie correct. Geen productwijziging. | 3/3 |
| Shape-tabs | Actieve tab veranderde direct, focus pas in een later frame. Snelle pijltoetsen bleven daardoor op de oude tab rekenen. Bestaande tabs krijgen direct focus; plaatsing en menuherstel behouden hun frame-afwachting. | 2/2 |
| Dockingbehoud | Bestaande plaatsing, herschikking, herstel en keyboardbediening. | 4/4 |

Bewijsroot: `technical-regie-2026-10-23/continuation/` in het bovenliggende project. De rapporten `startup/README.md`, `destinations/README.md` en `shape-keyboard/README.md` bewaren before-versies, rood/groen, exacte deltas en beelden. `three-browser-02/` bevat de gezamenlijke selectie, logs en screenshots. `three-browser-02/identity.json` bevestigt dezelfde bron als `integration-03/source-manifest.json`: SHA-256 `115780c9045ba48604b541c00d99c72778f59fa00808f2362481dfdd851d1254`.

De eerste twee volledige unitcontroles en de derde na leesbaarheidsvereenvoudiging bewaren hun falende resultaten in `integration-01` tot en met `integration-03`. De laatste heeft **1259/1260** geslaagd; de enige failure is de productiebuild in de alternatieve-outDir-test: core-JavaScript gzip **809511 > 809500**, dus 11 bytes boven het onveranderde budget. De daaropvolgende volledige builds zijn daardoor niet uitgevoerd. Dit is een meetbare open integratiegrens, geen onverklaarde testfailure en geen aanleiding om het budget te verhogen.

De onafhankelijke bestemmingsreview heeft geen bevindingen. De startup/Shape-review vond een testdiagnostiekpad dat bij een screenshotfout browsercleanup kon overslaan; dat krijgt een afzonderlijke correctie en hercontrole. De productgrenzen en definitieve parent-vereenvoudiging worden eveneens beoordeeld. Alleen lokale wijzigingen; niets gecommit, gepusht of gedeployd. Geen CSS, module of productmogelijkheid is in deze drie reparaties verwijderd of opnieuw ontworpen.

Aanvulling: de definitieve startup/dockbron is onafhankelijk akkoord bevonden en gekoppeld aan de gezamenlijke 25-test-run. Het Shape-diagnostiekpad gebruikt nu de bestaande deadlinehelper, bewaart de oorspronkelijke fout en sluit de browser via `finally`; de twee Shape-scenario's slagen opnieuw. Zie `continuation/reviews/startup-shape-review.md` en `continuation/shape-keyboard/review-cleanup/README.md`.

De volgende afgebakende baselinezaak `text-recovery-position` is eveneens afgehandeld: 8/8 op stabiele betrokken bron. De oorspronkelijke twee smalle hitfouten en de dragfout kwamen door Navigator, sidebar en later Info over het bedoelde testdoel. De test verplaatst/sluit die vensters met bestaande bediening, behoudt echte pointer/touch/drag, controleert onveranderde compositie bij vensterverplaatsing en behoudt alle concurrentie-/rich-text-/reloadassertions. Geen Text-productiecode of CSS gewijzigd. Het volledige rood/groen-bewijs staat in `continuation/text-recovery/README.md`.

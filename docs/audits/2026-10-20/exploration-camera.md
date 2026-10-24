# Grotere kamer en camera-follow — 20 oktober 2026

Laatste feedbackronde: maker merkte bij bewegen/zoomen en muurcontact een
tegenwerkende camera. Naast de aparte zoomklok bleek de lensbegrenzing op
50% de camera tegen de kamerzijde te houden terwijl Keeper een metalen muur
bereikte. De lens is nu onbegrensd rond de fysiek begrensde actor, met exacte
focus op Keeper. Geen tweede follow-veer; de bestaande actorbeweging blijft
vloeiend. Zo kan buiten de kamer wat lege ruimte zichtbaar zijn zonder dat de
actor uit het midden schuift. Kernmarge nu 8% in plaats van 16%. Dit is geen
pixelcollision; de metalen rechthoeken en vrije organische binnenkant blijven.
Unitcheck bewaakt schermfocus gedurende 240 bewegingsframes inclusief contact,
uit-/inzoomen en een camera die buiten de fysieke kamer kijkt. Browsercheck
dekt F op 50% bij daadwerkelijk muurcontact en terug naar 100%.

Laatste correctie: F vervangt J in beide richtingen, op verzoek van de maker.
De timing/curve van de Workbench-inspectie wordt hergebruikt (460ms). De eerste
geanimeerde versie gaf bij bewegen sprongetjes: een afzonderlijke zoomklok
zette iedere sample de camera opnieuw centraal. Vervangen door zoom op de
bestaande Keeper-bewegingsklok met behoud van het actuele schermanker; normale
follow-demping blijft actief. Geen aparte zoom-RAF meer. Docked/reduced motion
wisselt onmiddellijk. Unitcheck dekt starten/omkeren zonder sprong; browsertest
wisselt F heen/terug terwijl rechts sturen ingedrukt blijft, naast typen en
gewone zoomcontrole. Historische J-beschrijving hieronder is hiermee vervangen.

Vervolg op dezelfde dag: maker koos één echte 100%/50%-wissel met **J** in
beide richtingen. Start 100%; zichtbare knop toont bestemming en sneltoets.
Geen muiswielzoom of inzoomen boven 100%. Sceneprojectie, inputomrekening en
Keeperweergave schalen samen; fysieke maat/snelheid en botsingsbalken in de
wereld blijven gelijk. Tijdelijke zoom schrijft niet naar het document.
J wordt genegeerd bij typen, Library, modifiers, herhaling en tekstcompositie;
luisteraar wordt verwijderd bij verlaten. Gerichte unit-/browsercontrole dekt
heen/terug, halve actorweergave en invoerveldbescherming.

Status: lokaal op `codex/audit-checkpoint-2026-10-19`, boven basis-HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`; niet gecommit/gepusht/gedeployd.
Maker vroeg een grotere kamer met camerafocus en verduidelijkte: alleen de
rechte metalen platformen horizontaal/verticaal botsbaar, binnenwerk vrij.
Na uitproberen bevestigde hij nadrukkelijk dat camera-follow goed aanvoelt.

## Gerealiseerd

- Tijdelijke kamer van 2800 × 1800. Twee 600 × 600 exemplaren van dezelfde
  1200px WebP; geen nieuwe artworkdownload per exemplaar. Bron-SVG intact.
- Camera volgt gedempt op vaste schaal. Klik kiest een wereldbestemming;
  rechts vasthouden stuurt continu, ook zonder de muis verder te bewegen.
  Pijltjes via de bestaande Keeper-headbediening blijven bruikbaar.
- Bestaande beweging/snelheid in wereldcoördinaten. Kameraanpassing verandert
  geen actorpositie, snelheid, bronmetadata of opgeslagen parameters.
- Alleen bovenste metalen balk en rechte rechterbalk van ieder exemplaar
  botsbaar. Organische binnenkant expliciet doorlaatbaar. Bodymarge 16% van
  weergegeven Keepermaat, compacter dan de eerdere 30%; geen pixelprecisie.
- Dock, Library en instellingen blijven vaste bediening. Return vliegt direct
  terug naar de start, onafhankelijk van colliders, en herstelt het startbeeld.
  Kamer verlaten ruimt beweging, camera en editorlease op. Geen scene-save.

## Scheiding en beperkingen

`explorationSpace.js` bezit kamergeometrie en projectie; `useKeeperMotion`
houdt één bestaande animatielus. De optionele motion-space-invoer vervangt de
eerdere losse proefmuurref. Geen tweede physicsloop of per-frame Reactstate.
Gewone Workbench-Keepers krijgen geen wereld of cameragedrag. Dialoogankers en
rig-reacties gebruiken schermprojectie; gerichte reacties terug naar wereld.
Reduced motion behoudt de bestaande stilstaande presentatie.

Geen zoom, volwaardige collision-editor, routeplanning, habitatpublicatie,
meerdere persistente Workbenches of brede performanceclaim. De voorgestelde
metalen balken zijn nog handmatig gekozen rechthoeken. De gemeten test
bewijst functionele beweging en projectie, geen fpsgarantie op alle apparaten.

## Bewijs

Algemene tests: 1268 geslaagd. Gerichte unitchecks bewijzen projectie-inversie,
ongewijzigde wereldpositie onder camera-updates, resize, camera-eindgrenzen,
vrije organische binnenruimte en metalen collision op 30/60/120 Hz.
Kamerbrowsercheck: echte Library-drop, compacte verticale botsingsrand,
continu rechts sturen tot voorbij één beeld, camera-follow, tweede artwork
bereiken, recall, geen draftwrites tijdens vlucht, geen duplicatie,
bezoekerafscherming, tabbladlease en smalle instellingen.
Ontwerpinventaris en tien ontwerpchecks geslaagd; bouw-/browserresultaten
worden hieronder vastgelegd na de finale run.

Visuele bestanden in `exploration-camera/`: `metal-collision.png`,
`second-artwork.png`, `settings-390.png`. Ze tonen fixture-Keeper-artwork en
de daadwerkelijke makerexport voor de omgeving.

Finale run: 20/20 gerichte browserchecks geslaagd (kamer 2, Keeper 3,
selectie 1, dialoog 3, Reception 6, eigenaarroutering 5). Productiebuild,
assetbudget en JS-budgetcontrole (821965 initiële bytes) geslaagd; gebouwde
instapcheck 1/1 geslaagd. Werk blijft lokaal, geen externe CI/deployment voor
deze wijzigingen. Basis-HEAD-CI was eerder gecontroleerd; geen nieuwe remote
release geïmpliceerd.

Finale regressie na F/zoom/muurfocus-correctie: alle 1271 algemene tests groen;
5 gerichte camera/zoom-unitchecks groen. Eerdere J-toets en gedempte/geclampte
focus zijn vervangen, geen parallelle oude camerastand behouden. Exacte
100/50-schaal en F-typbescherming blijven bewaakt in de kamerbrowsertest.
Finale kamerbrowsercheck: 2/2 geslaagd, inclusief F tijdens sturen en 50%-focus bij metalen muurcontact. Finale build/budget geslaagd (821965 initiële JS-bytes). Lokaal; geen push/deployment.

# Keeper in de proefkamer — 20 oktober 2026

Vervolg: [de eerste omgevings-/botsingsproef](exploration-collision.md) voegt
later op dezelfde dag één expliciete proefgrens en de herstelde rigminiatuur
toe. De hieronder beschreven toestand zonder interne collision is die van
de eerdere dockstap, geen actuele ontkenning van die vervolgproef.

Status: lokaal geïmplementeerd op `codex/audit-checkpoint-2026-10-19`, boven
`32d9418843d996afc2e5203afa4552a6cd2d459a`. Niet gecommit, gepusht of gedeployd.
Expliciete opdracht: bestaand Keeper-dock in de proefkamer, artwork inslepen,
de bestaande beweging en snelheidsinstelling hergebruiken.

## Gebruik

Als eigenaar: Profile → View my reception → Explore → Library. Sleep het
geschikte artwork naar het dock, sluit Library en kies Release. Klik op lege
kamerruimte of houd de rechtermuisknop ingedrukt om te sturen. Het tandwiel
opent de bestaande Keeper-instellingen, inclusief beweging en zwemsnelheid.
Return roept de Keeper terug. Back to Reception sluit de proefkamer.

De eerste bestaande Keeper wordt gebruikt; bij meerdere is er een keuzelijst.
Zonder Keeper wordt één leeg privé-dock met Layered swim aangemaakt. Een
bestaande Keeper behoudt zijn eigen bewegingsmodus. De bestaande artwork-
validatie en foutafhandeling blijven gelden; niet ieder willekeurig beeld is
een voorbereid gelaagd Keeper-artwork.

## Verantwoordelijkheden en grenzen

- `src/keeper/ExplorationKeeper.jsx` verbindt de bestaande editorgrens,
  profiel-draft, Library-workspace en KeeperWorkbench. Geen tweede Keeper-model
  of kamer-draft. Artwork en instellingen zijn dezelfde als op de Workbench.
- De originele Workbench-dockpositie wordt niet verplaatst: de proefkamer
  geeft een tijdelijke dockpositie door. Vlucht en terugkeer schrijven niet
  naar het document. Een nieuw dock gebruikt de bestaande opslaandactie.
- De bestaande editorlease voorkomt twee gelijktijdige eigenaareditors.
  Onleesbare/ontbrekende drafts vragen herstel via de Workbench. Bezoekers
  krijgen de privé-editor of Library niet. De bevoegdheid komt van de
  bestaande eigenaargrens, niet van een URL-parameter.
- `useKeeperMotion.js` accepteert een optionele kamergrens via
  `keeperFlightViewport`; zonder die invoer blijft de Workbench-beweging
  hetzelfde. Snelheid, versnelling, rig, artworkhost en recall blijven bestaand.
- Bij verlaten ontkoppelen actor, beweging, Library en editorlease.

Nog niet gebouwd: muren/interne collision, wereldcoördinaten, camera-follow,
zoom, scene-editor, publieke habitat en meerdere opgeslagen Workbenches.
De Library en editor blijven afhankelijk van de bestaande Workbench-context;
dit is hergebruik van die infrastructuur, geen algemene wereldarchitectuur.
De fixture toont functionele beweging, geen benchmark voor de geïllustreerde
wereld met veel herhaalde bronafbeeldingen.

## Verificatie

- Alle 1.263 algemene tests geslaagd.
- Proefkamer: twee browsertests geslaagd, inclusief echte Library-pointerdrop,
  snelheid opslaan, vliegen, geen opslag tijdens vlucht, recall, heropenen
  zonder duplicatie, bezoekerafscherming en tabbladlease.
- Brede en smalle controle op 1440, 640 en 390 px; instellingen bereikbaar.
- Bestaande Keeper: drie browserchecks; selectie één; dialoog drie, alle groen.
- Reception zes en echte App-eigenaarroutering vijf browserchecks, alle groen.
- Ontwerpinventaris en tien ontwerpcontroles geslaagd. Productiebuild en
  budgetcontrole geslaagd: 821.965 bytes initiële JS; één gebouwde-starttest
  geslaagd, eigenaar-/walletruntime buiten de verse instap.
- Bestaande CI voor basis-HEAD was eerder groen gecontroleerd. Deze lokale
  wijzigingen hebben nog geen externe CI/deployment. Een hercontrole via
  lokale `gh` was niet mogelijk omdat die CLI hier niet geïnstalleerd is.

Bewijs: [vlucht breed](exploration-keeper/flying-1440.png),
[instellingen 640 px](exploration-keeper/settings-640.png),
[instellingen 390 px](exploration-keeper/settings-390.png).
Gebruikt testartwork: bestaande `browser-tests/fixtures/keeper-layered.svg`;
dit is niet de persoonlijke illustratie van de maker.

De nieuwe suite `browser-tests/exploration-keeper.browser.mjs` is opgenomen in
de onderhouden browserrunner. Volledige wereldprestaties blijven onbewezen.

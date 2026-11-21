# Reception profiel en achtergrond — 13 november 2026

Status: lokale implementatie; niet gecommit, gepusht of gepubliceerd.
Checkout: `remediation-2026-10-19-shared-checkpoint/work`.
Branch: `codex/profile-work-index-2026-10-30`, HEAD `08b4a7b`.
De reeds aanwezige, omvangrijke lokale wijzigingen zijn behouden. De Git-diff
tegen HEAD omvat ook werk van eerdere taken en is geen zuivere diff van deze taak.

## Resultaat en verantwoordelijkheid

- Native Reception toont de bestaande Identity-gegevens direct op de achtergrond
  boven de Bento. De officiële UP-projectie en de bestaande authored overlays
  blijven de bron; er is geen nieuwe netwerk- of opslagroute voor identiteit.
- `ProfileSection` en `LinksSection` zijn uit `IdentityCardBody` gehaald en worden
  door beide presentaties gebruikt. De inline kopieën en hun iconimports zijn
  verwijderd. De bestaande Identity-window blijft de editor voor die gegevens.
- `ReceptionAtmosphere` is één gedeeld CSS-onderdeel voor publieke/ownerweergave,
  Preview en het kleine voorbeeld in de instellingen. Geen timer, animatielus,
  canvas of WebGL. De achtergrond vangt geen invoer af. Er is geen FPS- of
  GPU-benchmark uitgevoerd; dit is geen gekwantificeerde performanceclaim.
- Eén gedeelde Page-instellingenset onder Bento en in Preview. Page background
  is verplaatst uit Current grid; framekleuren blijven bij Current grid.
  Kleurgebaren gebruiken de bestaande versiegebonden preview/commit-controles.
- Optioneel, strikt gevalideerd `lighting` bevat kleur en drie waarden van 0–1.
  Ontbrekende waarden gebruiken alleen een renderdefault; er vindt geen
  automatische draftwijziging plaats. Saves, Undo/Redo, backup, publicatieprojectie
  en restore gebruiken het bestaande Reception-document.
- Preview meet nu de volledige pagina voor de breedtebediening. De Bento meet
  zelf de beschikbare binnenbreedte. De zijmarges en profielmaat reageren op de
  paginabreedte, ook wanneer alleen de preview smaller wordt gemaakt.
- Bestaande v2-publicaties behouden hun benodigde renderer en compacte header.
  Dit is een echte resterende consumer; geen verborgen alternatief voor v3.
  Navigatie, verkenning, celinspectie en de Identity-editor blijven eigenaren van
  hun bestaande gedrag. Een lange bio klapt uit binnen een begrensd scrollgebied.

## Verificatie

- 112 gerichte Node-tests geslaagd: Bento-mutaties, editor-document, scope,
  publicatie en Identity-projectie. De nieuwe cases controleren opslagfalen,
  ongeldige lichtwaarden, Undo/Redo, opnieuw openen, layoutgeneratie, afzonderlijke
  canvassen en complete publicatie/backup-roundtrip.
- `npm run test:lukso-standards`: 5/5 geslaagd. Geen RPC, UP-schrijfactie,
  indexerregel of wallet-authorisatie gewijzigd.
- De browserregressies zijn toegevoegd. De runner kon Chromium in deze omgeving
  niet starten (`spawn UNKNOWN` in `owned-chromium.mjs`); daarom geen geslaagde
  automatische browserrun claimen. Na die poging zijn de Bento-selector en de
  lange-biocase aangevuld op basis van de echte browserbediening.
- Rechtstreeks in de browser gecontroleerd met geïsoleerde testdrafts: lichtkleur,
  sterkte, spreiding, positie, Undo/Redo, herladen, publieke weergave van dezelfde
  opgeslagen waarden, Bento Page → Preview en bestaande responsive celbediening.
- Breedte 2550 → 320 → 2550 keert terug zonder horizontale overflow; bij 320 px
  zijn de zijmarges 20 px. Ook 900/1440 px en Dark/Light bekeken. Een lange bio
  bleef op 900 px binnen 220 px hoogte, met zijn volledige tekst bereikbaar.
- De echte gepubliceerde Nomad-Reception lokaal gelezen: officiële bio, tags,
  links en portrait zichtbaar in de nieuwe header. Eén bestaande artworkcel
  bleef unavailable; de profielweergave en de andere artworkcel renderden wel.
  Er is niets naar de publicatie geschreven. Browserformaat en Dark-thema hersteld.
- Gerichte diffcontrole en referentiezoekactie uitgevoerd. Geen nieuwe dependency,
  geen bundellimiet aangepast, geen bestaande test/assertie afgezwakt.

## Open productiegrens

`npm run build` loopt hier vast bij de esbuild-configloader op een ontoegankelijke
bovenliggende Windows-directory. Met `npm run build -- --configLoader native`
compileert de app, maar de echte bundelcontrole faalt op `coreJavaScript.raw`:
2.753.437 bytes tegenover maximaal 2.744.000, dus **9.437 bytes te groot**.
`npm run build:check` bevestigt dezelfde fout. Dit betreft de huidige volledige
checkout; er is geen geïsoleerde pre-task meting om de hele delta aan deze taak
toe te schrijven. Het eerdere text-entry buildlog was groen, maar vervangt geen
meting van deze build. Gedeelde profielsecties en bestaande kleurcontroles zijn
hergebruikt; dat is nog niet genoeg om binnen de limiet te blijven.

Deze wijziging is lokaal te beoordelen, maar geen groen releasecheckpoint.
Voor een release moet daadwerkelijk bundelruimte worden teruggewonnen en moeten
de browserregressies in een omgeving met een startbare Chromium-runner slagen.
De volledige `npm test`-releasecontrole is niet uitgevoerd.

Bewijs: `.verification/reception-atmosphere-unit-final.log`,
`reception-atmosphere-lukso.log`, `reception-atmosphere-browser.log`,
`reception-atmosphere-build-final.log`, `reception-atmosphere-budget.log` en
`reception-atmosphere-local.jpg`, alle onder `.verification/`.

## Follow-up: profiel, uitlijning en Preview-header

De founder vroeg daarna om de bio uit deze header te halen, de lijnen op de
compositie uit te lijnen en de losse Preview-balk in de profielheader te plaatsen.

- De header toont portrait, naam, tags en links zonder bio. De eerder hierboven
  beschreven uitklapbare headerbio en bijbehorende state/CSS zijn verwijderd;
  Identity-data en de bestaande Identity-kaart blijven ongewijzigd.
- De buitenrails volgen de paginamarge, een headerlijn volgt de portrait/text-gap
  en de inhoudsrails volgen de actuele Bento-breedte. Geen procentueel herhaalde
  kolommen, extra observer of animatielus voor deze lijnen.
- Preview geeft de bestaande bediening door aan een slot in de gedeelde header:
  terug, workspacekeuze, Fit/Desktop/Tablet/Phone, breedteslider met getalinvoer,
  responsive instellingen en Page appearance. Breed rechts, smal onder het
  profiel. De oude losse balk en bijbehorende CSS zijn verwijderd. De publieke
  header krijgt deze bediening niet mee.
- Geen metadata-, opslag-, publicatie- of walletgrens aangepast, geen nieuwe
  dependency en geen bundellimiet verhoogd.

Verificatie van deze follow-up:

- Eerste gerichte Node-run: 83 geslaagd, 1 fout in
  `row/cell growth rejects size limits, failed storage and stale authority
  atomically` (`receptionBento.test.js:592`). Dit is gelijktijdig gewijzigd
  celgroeiwerk buiten de bestanden van deze headerwijziging; niet aangepast door
  deze taak. Het testbestand veranderde daarna opnieuw. De herhaalde controle
  op die bijgewerkte checkout slaagt: **84/84**, zie `unit-final.log`.
- De acht browsercases kunnen hier nog steeds geen Chromium starten
  (`spawn UNKNOWN`). Nieuwe assertions controleren ontbrekende headerbio,
  controls binnen de Preview-header, afwezigheid in public en uitgelijnde rails.
- Handmatig in de geisoleerde browserfixture: brede Preview, 320 px en terug naar
  2550 px zonder horizontale overflow; instellingen voor appearance en responsive
  openen; 890 px Preview wrapt zonder overflow; publieke 900 px-weergave toont
  geen Preview-controls. Daar zijn canvas en rails beide 828 px breed en beginnen
  beide op x=36. Tijdelijke viewportoverride hersteld.
- Inspectie van de echte app-tab is geblokkeerd door de browserextensie. De
  follow-up screenshot is daarom expliciet een geisoleerde testpreview, geen
  bewijs van de huidige gebruikersdraft. Geen gebruikerscompositie gewijzigd.
- De normale build blijft vastlopen op de Windows-esbuild-configloader. De
  native configloader compileert; de actuele bundelcontrole faalt op 2.753.771
  tegenover 2.744.000 bytes core JS (9.771 bytes te groot). `build:check`
  bevestigt dit. Dit meet de volledige, gelijktijdig gewijzigde checkout en is
  geen geisoleerde delta van deze headeraanpassing.

Bronvergelijking met de snapshots aan het begin van deze follow-up en controle
op verwijderde bio-/barreferenties uitgevoerd. Geen commit, push of deployment.
Logs en bron-snapshots: `.verification/reception-alignment-2026-11-13/`.
De screenshot van de geisoleerde testpreview staat daar als `result.jpg`.

# Inscape — consolidatie en versteviging

Datum: 29 oktober 2026. Opdracht: de lead neemt de technische regie en maakt een uitvoerbaar plan voor zichzelf en drie subagents. Na onderzoek van de broncode, actuele CI-evidence en bestaande controles heeft de founder ingestemd met dit plan. De lokale uitvoering is op 29 oktober gestart; de actuele pakketstatus staat in `progress.json`.

Werk uitsluitend in `remediation-2026-10-19-shared-checkpoint/work`. Het [actieve contract](../../../INSCAPE_ACTIVE_CONTRACT.md), [creative intent](../../../INSCAPE_CREATIVE_INTENT.md) en checkout-AGENTS blijven leidend. Dit is technische werkplanning, geen nieuwe productrichting. De status van deze ronde staat in [progress.json](progress.json); oudere auditplannen blijven gedateerde evidence.

## Beoogd resultaat

1. De volledige verificatie kan afronden en geeft één controleerbare uitslag voor dezelfde bronversie, inclusief alle verplichte browsersuites.
2. Workbench-selectieoperaties hebben expliciete voorbereiding, tijdelijke preview, geldigheid en afronding. React-eventhandlers hoeven de interne configuratie van modules minder te kennen.
3. De werkelijke producenten en gebruikers van deze grenzen worden door types en gedragstests gecontroleerd.
4. Bestaande vormgeving, creatieve mogelijkheden en het onderscheid tussen authored content, lokale vensterpresentatie en tijdelijk bezoekersgedrag blijven behouden.

Een kleiner bestand, meer hooks, minder lintmeldingen of meer tests is op zichzelf geen resultaat. Iedere wijziging moet aantoonbaar een verantwoordelijkheid verduidelijken, dubbel werk vervangen of een bewezen fout herstellen.

## Actueel vertrekpunt

- Branch: `codex/static-reception-bento-2026-10-26`; HEAD: `5c5a00e8cff831f97987042be24d071c9aab2052`.
- [starting-state.json](starting-state.json) registreert 1.481 expliciet gekozen bron-/configuratiebestanden, twintig reeds gewijzigde tracked bestanden en vier nieuwe bron-/fixturebestanden. De gekozen scope staat in het bestand. Dit is een planningsvingerafdruk, geen volledige release-identiteit of herstelkopie.
- De wijzigingen aan Library/collecties zijn inmiddels lokaal afgerond in een andere taak. Het [verslag](../library-loading/README.md) rapporteert 207 gerichte units, 26 browsergevallen en een geslaagde build. Die wijzigingen en de bestaande camera/crop-/buildaanpassingen zijn onderdeel van het vertrekpunt, niet nieuw werk van deze ronde.
- In de voorafgaande beoordeling slaagden lint en de afgebakende typecontrole. Lint bevatte 88 geregistreerde hook-observaties. De typecontrole controleert drie productie-bodies, met 17 negatieve aanroepen en drie productiemutaties. Dit is geen volledige applicatiecontrole.
- [CI-run 40775463649](https://github.com/RadarVisuals/INSCAPE/actions/runs/40775463649) voor PR #5 stopte na dertig minuten tijdens de browsersuites. Catalogus, lint, types en 1.493 units slaagden. Van 105 geselecteerde browsersuites waren 85 afgerond; zes daarvan bevatten samen elf falende gevallen. Twintig suites hadden nog geen eindresultaat. Standards, design-inventaris, productiebuild/budget en productie-opstart na deze fase waren nog niet bereikt.
- Het CI-artifact `12855519197` hoort bij de PR-mergecommit `f665913dd7282a25261014117c7b79b6bb7a8cd7`; de PR-head is `5c5a00e…`. Beide identiteiten moeten behouden blijven. De geslaagde Netlify-preview bewijst de volledige testgate of de latere lokale wijzigingen niet.

### Wat we al behouden

`workbenchGestures.js` bezit pointercapture, annulering, cleanup en één completion. `moveWorkbenchGroup.js` en `resizeWorkbenchSelection.js` voeren groepsbewerkingen al via één `commitCompletedOperation` uit. De draftstore beschermt schrijvers per actieve canvas, ook bij A→B→A.

Gewone vensterbewegingen lopen via module-owned presentation en de bestaande layoutcache. Het actieve contract sluit lokale vensterpresentatie uit van artwork-undo. Deze ronde maakt dus expliciet welke operatie authored data wijzigt en welke alleen presentatie; we voegen geen algemene undo- of opslaglaag over alles heen toe.

## Team, bestanden en beslissingen

| Rol | Verantwoordelijkheid | Schrijfrecht tijdens uitvoering |
| --- | --- | --- |
| Lead | Scope, vertrekpunt, integratie, beoordeling van regressies, eindbewijs en gebruikersupdates | Dit plan/status; gedeelde catalogus en lint-ledger; engineering map; gecontroleerde integratiepatches |
| Agent A — verificatie | CI-failures verklaren, runner en evidence betrouwbaar laten afronden | `.github/workflows/verify.yml`, `scripts/verifyRelease.mjs`, `scripts/runBrowserTests.mjs`, `scripts/browserSuiteCatalog.mjs`, `scripts/releaseEvidence.mjs`, nieuwe aggregator/helpers en betrokken tests; falende fixtures alleen na toewijzing |
| Agent B — interacties | Concrete move-/resizeoperaties losmaken van UI-regie, bestaande module-/store-eigenaren behouden | `WorkbenchView.jsx`, maximaal twee concrete operation-adapters, betrokken `ShapeWorkbench.jsx`-registratie, optionele move-validatie in de bestaande `workbenchGestures.js` en gerichte interaction-tests |
| Agent C — contracten en review | Typed interface, negatieve bewijzen, ontbrekende lifecycle-integratietests; onafhankelijke beoordeling van B | `src/contracts/workbench.d.ts`, `tsconfig.contracts.json`, `typechecks/*`; typeannotaties en extra tests pas na expliciete overdracht van betrokken bestanden |

Eén schrijver per bestand. Agent B en C bespreken de interface voordat er code wordt verplaatst. C schrijft pas in een adapter nadat B die heeft overgedragen. Alleen de lead wijzigt `scripts/browserSuites.json`, `scripts/lint-debt.json` en gedeelde rapportage. Een agent levert bestandlijst, diff, uitgevoerde checks, beperkingen en open vragen op. Een andere agent of de lead controleert het resultaat.

Zware browser-/buildrondes worden lokaal door de lead ingepland, zonder concurrerende prestatieruns of schrijvers in dezelfde outputmap. Parallelle CI-jobs krijgen eigen checkouts, poorten en artifactnamen. De bestaande gebruikersserver blijft beschikbaar.

## Werkpakketten en volgorde

### P0 — Actuele basis veilig vastleggen — lead

Herlees branch/status en vergelijk met de planningsvingerafdruk. Leg de bestaande diffs en nieuwe bronbestanden herstelbaar vast zonder de werkboom terug te zetten. Neem de nieuwe Library-fixtures en decoder mee. Leg runtime, browser, lockfile, relevante publieke buildconfiguratie en gekozen bronnen vast. Gebruik de bestaande veilige evidence-inventaris; het beschermde handoffbestand wordt nooit gelezen, gehasht, gekopieerd of gestaged.

Bij nieuwe externe wijzigingen: bepaal eigenaar en afhankelijkheid voordat het betrokken bestand wordt aangepast. Begin niet vanuit een kale HEAD die bestaande lokale verbeteringen mist. Geen brede `git add`, reset of automatische synchronisatie naar een andere checkout.

**Klaar wanneer:** het vertrekpunt en de bestaande wijzigingen herkenbaar en herstelbaar zijn; bestandstoewijzing staat vast. De huidige `starting-state.json` is alleen de eerste inventaris.

### P1 — Zes CI-failures op de huidige bron classificeren — A, lead

Begin met de bestaande commandoroute en gerichte herhalingen van deze suites. Dit voorkomt dat oude CI-resultaten tot onnodige productwijzigingen leiden.

| Suite | Oude CI-waarneming | Te bewijzen op huidige bron |
| --- | --- | --- |
| `settings` | Vier gevallen: na sluiten bleef Settings aanwezig, vooral smal/landscape | Sluitfase versus functionele blokkade; sluiting, focus en uiteindelijke interactie blijven vereist |
| `editor-preferences` | Twee landscape-gevallen: foutmelding onderschepte de pointer op de toolbar | Is de actie werkelijk onbereikbaar, of staat de fixture onjuist? Behoud echte pointerbediening |
| `mini-apps` | Eén timeout bij een disabled control | Verklaar inhoud/ready-state en het bedoelde toegangsgedrag vóór een wijziging |
| `owner-profile-routing` | Eén assert op oude Reception-returnstructuur | Controleer bestemming, bruikbaarheid en focus in de huidige structuur |
| `local-workbenches` | Twee gevallen wachten op oude blokkade van collectiepublicatie | Contract accepteert inmiddels publieke collecties; vervang oude verwachting door huidig gedrag met behoud van private/public-grenzen |
| `design-system-workspace` | Eén fout in Color-tabfocus | Reproduceer de daadwerkelijke toetsenbord-/focusvolgorde |

Classificeer per geval: achterhaalde verwachting, fixtureprobleem, productregressie of omgevingsverschil. Alleen het bewezen probleem repareren. Productregressies in bestanden buiten A's scope worden aan de lead toegewezen. Geen force-clicks, willekeurige sleeps, langere algemene deadlines, skips of zwakkere asserts om groen te verkrijgen. Linux/Windows-verschillen vereisen gelijkwaardige runs als bewijs.

**Triage afgerond wanneer:** ieder geval een actuele uitkomst en verklaring heeft. **P1 klaar wanneer:** alle zes suites op de huidige bron slagen, of een bewezen al vervallen test door minstens even betekenisvolle actuele gedragsdekking is vervangen. Een concreet open defect blijft open en houdt P1 op `in_progress`; het is geen groen vertrekpunt voor P3. Een oud CI-fail is niet automatisch een huidig appdefect.

### P2 — Volledige verificatie begrensd en samenhangend laten afronden — A, lead

De 85 afgeronde suites namen samen ongeveer 1.702 seconden in beslag. De seriële uitvoering veroorzaakt aantoonbare tijdsdruk; het bewijs wijst nog niet op één globale hang. Start met vier geïsoleerde browserjobs voor de volledige actuele releasecatalogus. Verdeel deterministisch en gebruik gemeten suiteduren om grote onbalans te voorkomen. Vier is een toetsbare startconfiguratie, geen prestatiebelofte; pas de verdeling aan als de eerste volledige Linux-run dat onderbouwt.

- Splits uitsluitend onafhankelijke controles. Iedere browser-shard draait in een eigen omgeving met behoud van de bestaande suite-isolatie.
- Bewaar een eenduidig lokaal `npm run verify`-pad. De CI-verdeling moet dezelfde verplichte checks selecteren; geen tweede afwijkende definitie van wat releaseklaar is.
- Geef een suite een herkenbaar start-/eindresultaat; een timeout, signaal, crash, ontbrekende output of niet uitgevoerde suite blijft een failure.
- Maak annulering expliciet: stop alleen eigen subprocessen, wacht op cleanup en bewaar het gedeeltelijke rapport. De huidige runner schrijft pas na een suite een resultaat en beëindigt bij een signaal alleen het directe kind; de nieuwe lifecycle moet ook op Windows gecontroleerd worden.
- Laat één verplichte eindcontrole catalogusdekking en bronidentiteit samenvoegen. Iedere geselecteerde suite precies eenmaal, geen ontbrekende/extra/dubbele suite, geen skipped/todo/cancelled test, alle jobs verplicht.
- De eindjob wordt ook na gefaalde/geannuleerde jobs gestart en beoordeelt hun status expliciet. Ontbrekende jobs, artifacts of een overgeslagen eindjob kunnen nooit acceptatie opleveren. Diagnostisch bewaarde builds heten pas release-gevalideerd na geslaagde gezamenlijke acceptatie.
- Leg werkelijk geteste commit, PR-head en eventuele mergecommit afzonderlijk vast. Vergelijk dezelfde bron-, lockfile- en relevante configuratie-identiteit vóór resultaten gecombineerd worden.
- Leg Node- en Chromium-versie en runnerplatform vast. De shards binnen één CI-uitkomst gebruiken dezelfde afgesproken omgeving; aanvullende Windows-controles blijven afzonderlijk herkenbaar.
- Houd unit-, standards-, design-inventaris-, productiebuild/budget- en productie-opstartbewijs compleet. Bouw waar nodig het artifact eenmaal en test exact dat artifact.
- Bewaar diagnostiek ook bij fouten. Bewijs de aggregator met negatieve tests voor ontbrekende shard, verkeerde bronversie, duplicaat en incomplete TAP-output.
- Hergebruik waar mogelijk de bestaande vereiste checknaam voor de gezamenlijke einduitslag. Deelgroepen heten expliciet deelresultaten; `verifyRelease` mag ze niet als een complete releasepass markeren.
- Stel runtime- en cleanupgrenzen in op basis van metingen; een hogere globale timeout alleen lost deze ronde niet op.

**Klaar wanneer:** de volledige selectie afrondt binnen de gekozen CI-jobgrenzen, een fout nooit een groene eindstatus oplevert en dezelfde eindstatus naar bron en build terugleidt. Lokale pipeline-tests bewijzen nog geen succesvolle nieuwe externe CI-run.

### P3 — Concrete Workbench-operatiegrens consolideren — B, C voor interface, lead voor acceptatie

Eerst leggen B en C voor lokale move, persistente groep/blockmove, authored resize en Visitor-transformatie vast welke state mag veranderen. Bestaande tests vormen de basis; voeg alleen ontbrekende gevallen toe. P3-implementatie begint na P0 en volledig afgeronde P1. Tijdens P1 mogen B/C die grens alleen onderzoeken en ontwerpen. Onafhankelijke P2-runnerwijzigingen kunnen daarna parallel lopen met eigen bestandseigenaarschap.

Maak daarna hoogstens twee concrete adapters voor move en selection-resize. Ze krijgen expliciete oorsprong/targets, geometrie, preview, geldigheid en afronding. Pointer en toetsenbord gebruiken dezelfde operation-logica. Laat de bestaande gesture-engine capture/annulering bezitten, de bestaande modulepreparers inhoud interpreteren en de bestaande commitfuncties authored writes uitvoeren. De oude inline implementatie wordt vervangen.

Verwijder één aangetoonde modulelekkage: de host leest nu Shape `expected.kind === 'grid'` en `expected.grid.spacing`. Laat Shape zijn bestaande schaalgrenzen via het resize-target leveren; de host combineert grenzen zonder Shape-inhoud te interpreteren. Bewaar de 8–512 spacinggrenzen en bestaande afronding, gezamenlijke eindpunten en Text-reflow exact.

Leg de geldigheid van vastgelegde targets expliciet vast: registratie/instantie, profiel/canvas en generatie waar relevant. Normaal canvaswisselen is tijdens een actieve gesture al geblokkeerd; bewijs blokkering en vrijgave na completion. Gedwongen sessievervanging of unmount is een apart geval: een late callback mag geen nieuwe instantie met hetzelfde ID raken. Een vermoedelijke fout krijgt eerst een reproducerende test.

**Klaar wanneer:** UI-handlers geen modulespecifiek layout-/transactiebeleid meer hoeven te bevatten voor de uitgehaalde operatie, bestaande eigenaarschap en opslagbetekenis behouden zijn, de oude route verdwenen is en relevante gedragstests slagen. Directe module-windowgestures en `systemWorkflowResize.js` voor Grid-placements vallen buiten deze eerste consolidatie.

### P4 — Werkelijke productiegrenzen typeren en onafhankelijk toetsen — C, B na overdracht, lead

Breid de bestaande JSDoc/strict-check aanpak uit op de concrete adapter, de gebruikte gesture-interface en de resize-commitgrens. Controleer productie-bodies én hun aanroepen. Het huidige `ResizeTarget`-type beschrijft de werkelijke `prepare`/`commit`/limits-/reflow-capabilities nog onvoldoende.

Maak expliciet welke targets alleen tijdelijke presentatie toelaten en welke een bevoegde authored commit hebben. Leg synchroniteit en completion-resultaat vast. Voeg negatieve aanroepen en productiemutaties toe voor ontbrekende bevoegdheid, verkeerd target/scope, ongeldige vorm van geometrie en onbedoelde async `prepare`/`commit`. Numerieke grenzen en verouderde sessies blijven ook runtimechecks vereisen; types bewijzen die niet.

De 88 lint-observaties worden niet automatisch herschreven. Herbeoordeel alleen gewijzigde grenzen; verwijder overbodige uitzonderingen of laat een onderbouwde uitzondering met actuele evidence staan. Geen `any`, brede casts of uitgeschakelde controles om de gate te halen.

**Klaar wanneer:** opzettelijke contractbreuken in de daadwerkelijke productiecode falen, de integratietests werkelijk UI/module/store koppelen en de onafhankelijke review geen onopgeloste relevante regressie vindt. Een volledige TypeScript-conversie is geen onderdeel van deze ronde.

### P5 — Eén gezamenlijke eindcontrole en overdracht — lead, C als onafhankelijke reviewer

Integreer de kleine patches en controleer de verschillen tegenover het vastgelegde vertrekpunt. Werk eerst de geraakte eigenaarschapspassages in de engineering map bij. Reserveer dan een stabiele bron voor de finale run. Rond alle bron- en documentwijzigingen vóór de broninventaris af; logs en eindrapporten gaan naar een evidence-directory buiten die inventaris. Een bronwijziging tijdens een controle maakt het gezamenlijke bewijs ongeldig.

Ook `progress.json` hoort bij de broninventaris. Zet vóór de freeze de finale status op `awaiting_final_evidence` met het vooraf gekozen pad naar het externe eindrapport. Vanaf de freeze is dat rapport buiten `SOURCE_INPUTS` de autoriteit voor de finale uitslag. Het bevat geteste bronhash, resultaten en beperkingen. Werk de in-source status niet stilzwijgend achteraf bij; een latere documentwijziging is een nieuwe bronversie en wordt als zodanig benoemd.

Voer de complete verificatie uit: catalogus, lint, types, alle units, volledige release-browserselectie, standards, design-inventaris, build/budget en productie-opstart. Draai daarnaast de relevante aanvullende browsergevallen hieronder en de zelfstandige design-systembuild. Vermijd dubbele controles wanneer dezelfde finale runner ze al aantoonbaar heeft uitgevoerd. Inspecteer screenshots breed en smal voor de geraakte bediening.

Rapporteer per pakket: werkelijk vereenvoudigd, bestaande grenzen behouden, checks en bronidentiteit, resterende beperkingen. Afzonderlijke groene deelruns worden niet als één volledige releasepass gepresenteerd.

**Klaar wanneer:** alle vereiste lokale controles op de gezamenlijke bron slagen en onafhankelijke review is afgehandeld. Een externe CI-acceptatie vereist apart een voltooide run op de werkelijk gepushte versie. Deze planningsopdracht voert geen push, merge, deployment, publicatie of walletactie uit; lokale en externe status blijven apart zichtbaar.

## Gerichte acceptatiematrix

| Grens | Vereist bewijs | Bestaande basis / aanvullende controle |
| --- | --- | --- |
| Lokale individuele/selectiemove | Layout beweegt en herlaadt; authored content en artwork-undo blijven ongewijzigd | `workbench-view-scale`, `workbench-layout-reload` |
| Groepmove en mixed resize | Eén canonical write/undo-stap, gezamenlijk undo/redo; mislukte save laat draft/history intact | `workbenchGroups.test.js`, `workbench-groups`; mixed resize met echte modulepreparers en falende storage aanvullen |
| Preview/cancel | Escape, verloren capture, pointercancel en unmount schrijven niets en herstellen preview | Bestaande `workbenchGestures.test.js`; echte View-adapterintegratie aanvullen |
| Canvas-/profiel-/registratiewissel | Normale wissel geblokkeerd tijdens gesture; daarna vrij. Gedwongen vervanging accepteert geen late oude writes | Scoped-storetests en `local-workbenches`; late callback naar identiek module-ID aanvullen |
| Invoergelijkheid | Pointer en keyboard gebruiken dezelfde operation-regels; native tekstinvoer behoudt eigen undo | `workbench-view-scale`, `workbench-input-recovery`, `workbench-grab-stability` |
| Geometrie | Gemengde Image/Text/Shape/Display, fractionele zoom, aansluitingen en Text-reflow behouden | `workbench-text-display-resize`, `workbench-image-joins`, bestaande module-resizetests |
| Visitor | Toegestane interactie blijft tijdelijk; geen draftwrite of owner-capability | Bestaande Visitor-gevallen en gerichte nieuwe negatieve operation-test |
| Verificatie | Ontbrekend, dubbel, afgebroken of bronvreemd bewijs kan nooit slagen | Runner-/aggregatortests plus complete finale selectie |

## Grenzen aan de uitvoering

Bij de eindcontrole overschreed de build het bestaande core-JavaScriptbudget.
Na verwijdering van concrete duplicatie meet de bundel 2.686.423 raw en
882.484 gzip-bytes. De founder heeft op 29 oktober expliciet ingestemd met
de voorgestelde verhoging van uitsluitend het gzip-budget van 882.000 naar
883.000 bytes (+0,11%). Dit is een gedocumenteerde uitzondering op de
oorspronkelijke vaste budgetgrens, geen geslaagde meting onder de oude grens.
Alle overige budgetten, assertions en verplichte controles blijven gelden.

De ronde omvat CI-betrouwbaarheid, de concrete Workbench-selectieoperatiegrens en bijbehorende contracts/tests. Library-paginering op scroll, nieuwe caches, brede CSS-opruiming, rendererwissels, Desktop, nieuwe modules, schemas/migraties en een algemene security-audit worden geen bijkomende projecten. Bestaande functies en vormgeving blijven werken; budgetten en assertions worden niet versoepeld om resultaat te suggereren.

Een nieuwe bevinding wordt gekoppeld aan een bewezen afhankelijkheid van een werkpakket. Is ze daar niet nodig, dan wordt ze als afzonderlijk vervolg genoteerd. De lead beslist over technische volgorde en routinekeuzes. Een echte nieuwe productkeuze gaat terug naar de founder; agents vragen geen nieuwe toestemming voor iedere reversibele stap binnen de afgesproken taak.

## Werkritme

P0 → P1. Tijdens P1 mag B/C alleen de gedragsmatrix en interface voorbereiden. Daarna P2 en P3 in parallel waar bestanden en controles onafhankelijk zijn. P4 volgt de overgedragen P3-interface. P5 volgt alle afgeronde pakketten. De lead blijft verantwoordelijk voor integratie en de betekenis van de einduitslag; een agentmelding alleen sluit geen pakket af.

Gebruik korte checkpoints per werkpakket, geen vooraf verzonnen uurgarantie. De lead meldt concrete ontdekkingen, gewijzigde aannames en afgeronde controles. Alleen werkelijk uitgevoerde en gecontroleerde stappen krijgen een afgeronde status.

Tijdens uitvoering volgt de status de werkelijk uitgevoerde stappen. P1 leverde naast fixturecorrecties één aangetoonde reparatie op: interactieve opslagmeldingen gebruiken nu de bestaande gemeten vrije hoogte boven de bedieningsbalken. De informatieve Text-waarschuwing behoudt haar eigen lagere laag. Uitvoerbewijs staat buiten de broninventaris onder `.verification/codebase-consolidation-2026-10-29/`.

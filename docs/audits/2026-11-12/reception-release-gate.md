# Reception: verificatiepoort en bundlegrootte

12 november 2026. Lokale wijzigingen op `codex/profile-work-index-2026-10-30`,
HEAD `08b4a7b871084780bafc89ad08404ca901e61f17`. Geen commit, push, deployment,
publicatie of wijziging aan gebruikerscomposities. Bestaande wijzigingen behouden.

## Uitgevoerde wijzigingen

- `reception-image-inspect` en `reception-svg-breakpoints` als releasesuites
  geregistreerd. De bestaande assertions zijn ongewijzigd.
- CSS-inventaris opnieuw gegenereerd en inhoudelijk vergeleken: dezelfde 98
  bronbestanden, 11 bestaande inspection-definities toegevoegd aan de inventaris
  en bronhashes/regelnummers van drie gewijzigde stylesheets bijgewerkt.
  Geen product-CSS aangepast.
- De oude lagenproeftest verwacht nu het actuele native ankergedrag: proportioneel
  verkleinen, gekozen rand en padding behouden, nooit groter dan authored formaat.
  Zowel brede als smalle/hoge en lage kaders worden gecontroleerd. Productgeometrie
  is ongewijzigd; deze correctie introduceert geen nieuw positioneringsbeleid.
- De generieke Tiptap Link-extension vervangen door `ArticleLink`. De bestaande
  artikelvalidator blijft eigenaar van toegestane URL's (HTTPS/mailto), terwijl
  ProseMirror de marks, selectie, splitsing en geschiedenis blijft beheren.
  De editor blijft handmatige links en plain-textpaste gebruiken.
- `@tiptap/extension-link` en de uitsluitend daardoor gebruikte `linkifyjs`
  uit package/lockfile en installatie verwijderd. Geen andere dependencyversies
  gewijzigd. De oude modules zijn niet meer aanwezig in de gemeten productiechunks.
- Acht gedragstests toegevoegd voor linkopmaak, bereikwijzigingen, verwijderen,
  gedeeltelijke links, typen op/naast links, paragrafensplitsing, toggle,
  Undo/Redo, bestaande attributen en onveilige URL's bij commands/parse/render.

Het artikel-JSON, de tekstsession, save/recovery, reader en centrale store zijn
behouden. Dit is een dependencyverwijdering, geen herstructurering van de tekstengine.
De lokale productiecode groeit met de begrensde markimplementatie; twee externe
runtimepackages verdwijnen. Binnen deze wijziging: 43 productiebronregels
toegevoegd en 3 vervangen/verwijderd (40 regels voor de nieuwe mark, drie
vervangingen in de extensielijst); daarnaast 138 nieuwe testregels, de aangepaste
proeftest, catalogusregistraties, packageverwijderingen en gegenereerde inventaris.

## Gemeten productiebytes

Beide builds gebruiken dezelfde COMMIT_REF, actuele configuratie en bestaande
budgetcategorieën. Geen budget of classificatie gewijzigd. Lazy code telt mee.

| Categorie | Voor raw / gzip | Na raw / gzip | Verschil raw / gzip |
| --- | ---: | ---: | ---: |
| Core JavaScript | 2.761.277 / 911.638 | 2.734.544 / 898.552 | −26.733 / −13.086 |
| Totaal JavaScript | 5.906.473 / 1.780.547 | 5.879.740 / 1.767.455 | −26.733 / −13.092 |

Core-plafond: 2.744.000 raw / 909.000 gzip. Resterende marge: 9.456 raw /
10.448 gzip bytes. Alle bestaande productie-budgetchecks slagen.

De standaard configbundeling van `npm run build` stuit hier op geweigerde
parent-directorytoegang in esbuild. De ondersteunde native configloader werkt:

```powershell
$env:COMMIT_REF='08b4a7b871084780bafc89ad08404ca901e61f17'
npm run build -- --configLoader native --outDir output/reception-release-fix-2026-11-12/final
npm run build:check -- output/reception-release-fix-2026-11-12/final
```

Beide laatste opdrachten slagen. De baseline gebruikte dezelfde productieconfig
via native Node-import, met moduleattributie als extra bewijsplugin.

## Verificatie en grenzen

| Controle | Resultaat |
| --- | --- |
| Tekst, Reception, lagenproef, inventaris, catalogus en shardplanning | 233 PASS, 0 FAIL |
| Nieuwe linktests | 8 PASS, 0 FAIL; onderdeel van bovenstaande set |
| Lint | PASS; 578 bronbestanden, bestaande 46 hookobservaties |
| Typecontracten | PASS; 40 ongeldige calls en 9 productiemutaties afgewezen |
| Productiebuild met native configloader | PASS |
| Onafhankelijke buildcheck | PASS |
| Volledige `npm test`, voor wijzigingen | 1.808 PASS / 21 FAIL van 1.829 |
| Volledige `npm test`, na wijzigingen | 1.821 PASS / 16 FAIL van 1.837 |
| Vier gerichte browsersuites | Niet gestart: procesinspectie geblokkeerd |

Vijf bestaande falende tests zijn hersteld; acht nieuwe tests slagen. Alle zestien
resterende falende tests kwamen ook in de nulmeting voor en liggen in de build-/
verificatie-infrastructuur: twee configbundelingschecks, drie release-evidencechecks
en elf procesbeheerchecks. Geweigerde parent-directorytoegang en
`Get-CimInstance: Access denied` blokkeren de betrokken paden. De veiligheidschecks
voor procesbeheer zijn niet verzwakt of omzeild. De browserrunner stopt vóór
uitvoering van Reception-inspectie, SVG-breakpoints, text-library-insertion en
text-writing. Daarom is UI-/clipboardpariteit van de linkvervanging nog niet
volledig in de browser bewezen. Er is geen volledig groen releasecheckpoint.

GitHub leverde voor HEAD geen gecombineerde statussen en geen PR-workflowruns;
dat bewijst geen remote succes en dekt deze lokale wijzigingen niet.

Bewijs en snapshots van de wijzigingsbasis staan in
`output/reception-release-fix-2026-11-12/`, met `comparison.json`,
`baseline-tests.log`, `final-tests.log`, `focused-final.log`, `lint.log`,
`typecheck.log`, `final-native-build.log`, `build-check.log`,
`remaining-failures.json` en `browser/browser.json`.

Volgende noodzakelijke verificatie: de volledige testpoort en genoemde
browsersuites uitvoeren in een omgeving waar configbundeling en veilige
Windows-procesinspectie beschikbaar zijn. Performanceonderzoek blijft stap 2.

## Aanvulling: uitvoering vanuit gewone lokale PowerShell

De gebruiker voerde de lokale teststarter uit. Bewijs:
`output/reception-local-verification-2026-11-12T16-48-04-247Z/`.
De samenvatting en browserrunner binden beide dezelfde bronhash
`3adfbea4ae675679b8d1d6da8f3dd52fa5f3bdb787d215a9086ec615d3338e3b`;
de starter heeft geen bronwijziging tijdens de uitvoering gemeld.

- De volledige unitselectie slaagt: **1.837 PASS, 0 FAIL, 0 skip**.
  Dit bevestigt dat de resterende zestien fouten in de afgeschermde uitvoering
  geen reproduceerbare unitregressies in de gewone lokale omgeving waren.
- `reception-image-inspect` en `reception-svg-breakpoints` slagen beide.
- `text-library-insertion` faalt in vier scenario's: tweemaal een Read-knop
  buiten het bereikbare canvas na vaste camera-panning, tweemaal een Library-knop
  die door de gesloten zijbalk niet aanwezig is. In die laatste twee scenario's
  slagen de voorafgaande checks voor linkaanmaak, href, geselecteerde woorden en
  opgeslagen linkgegevens op 100% en 75% zoom.
- `text-writing` slaagt op 390px; op 1440px onderschept de menubalk het sleepdoel
  van de illustratie. Plakken, tekstopmaak en tekst-Undo/Redo zijn daarvoor al
  gepasseerd. Dit bewijst nog geen correcte illustratieverplaatsing op desktop.
- Procesidentiteiten en opruiming zijn door de runner gecontroleerd; geen
  overgebleven eigen processen of cleanupfouten gerapporteerd.

Gerichte testaanpassing: vervang de vaste test-panning door de bestaande
`View > Focus selection`-route, met expliciete controle dat het opgeslagen
document identiek blijft. Open Library via de bestaande zijbalkhelper.
Voor de desktop-illustratiedrag wordt de Text eveneens via het bestaande
cameracommando in beeld gebracht. Geen productcode gewijzigd, geen geforceerde
clicks/drags, geen assertions verwijderd of versoepeld.

Syntax en diff zijn gecontroleerd. De aangepaste browserbediening moet nog
vanuit gewone lokale PowerShell worden uitgevoerd. De eerdere groene
unituitvoering en Reception-browsersuites zijn geen bewijs dat die nieuwe
testbediening al slaagt. Geen volledig groen releasecheckpoint; de
performancemeting is nog niet uitgevoerd.

### Tweede lokale uitvoering

Bewijs: `output/reception-local-verification-2026-11-12T17-02-16-728Z/`.
De unit- en browsersamenvatting delen bronhash
`af72f51ee82355db526a93e4d4e8c8b28c8d8c5bbf3f10011e6978b1551bc2c7`.
Opnieuw 1.837 unitchecks groen. Beide Reception-browsersuites zijn groen;
`text-writing` slaagt nu op zowel 1440 als 390px, inclusief artworkdrag en Undo.
Alleen de vier scenario's in `text-library-insertion` blijven rood.

Nadere code-inspectie verklaart de volgende testbedieningsproblemen:
`text.css` verbergt de Text-actiebalk bewust buiten hover/focus/tools-open.
De camerafocus geeft focus terug aan de workspace; de test klikte daarna op
de inactieve Read-knop zonder de Text eerst met de muis te betreden.
De test hovert nu de echte Text-surface vóór de klik. Daarnaast hoort
`Resize Library` uitsluitend bij de oude niet-embedded Library-host;
`WorkbenchLibraryWindow` rendert die niet bij de huidige dockhost. De tests
schrijven geen Library-breedte meer voor en behouden de echte hit-test op de
artikel-dropbestemming. Geen product-CSS of productbediening aangepast.

De lokale starter ondersteunt nu `--text-library-only` voor de ene resterende
suite, met expliciete scope in de samenvatting. Dit is geen volledige
releasegoedkeuring. Syntax/diff zijn gecontroleerd; de laatste wijziging in
de testbediening is nog niet in een browser uitgevoerd.

### Derde lokale uitvoering: drie van vier Library-scenario's groen

Bewijs: `output/reception-local-verification-2026-11-12T17-15-34-397Z/`,
scope `text-library-only`, bronhash
`aa40c5538565a2c4a86f0b8499ba5d18ac54ce9167636c3bfef5a1068389b243`.
De gebonden uitvoering geeft 3 PASS / 1 FAIL: Read-mode afwijzing op 700px
en invoegen op 100% en 75% slagen nu, met behoud van de bestaande tekst-,
link-, invoegpositie- en Undo/Redo-assertions. Opruiming is geverifieerd.

Het resterende 1440px-scenario toont na hover een andere, concrete obstructie:
de vaste Editor-menubalk onderschept Read. Dit is een UX-bevinding in de
combinatie Focus selection en de externe Text-actiebalk, geen bewezen fout
in het afwijzen van Library-drops. De hovercorrectie alleen was onvoldoende.
Deze overlap moet apart worden beoordeeld; hier is geen productfix geclaimd.

De testsetup meet nu de Read- en menubalkrechthoeken. Alleen bij overlap
verschuift hij de camera via een gewone Space-drag op een bewezen vrije
achtergrond, met precies de benodigde schermruimte. Het opgeslagen document
moet identiek blijven. Voor de gewone muisklik wordt expliciet gecontroleerd
dat Read het werkelijke hit-testdoel is. Geen force, CSS-aanpassing, skip of
versoepeling van de functionele dropchecks. Syntax/diff slagen; browserverificatie
van deze laatste setupaanpassing staat nog open.

### Vierde lokale uitvoering: resterende Library-suite groen

Bewijs: `output/reception-local-verification-2026-11-12T17-25-31-121Z/`.
Scope `text-library-only`; bronhash
`97161266087afa0fc6d9de17b70f343584a205350a82c62279e9a5ab8136e6fb`
is gelijk in starter en browserrunner. **4 PASS, 0 FAIL, 0 skip**.
De runner bevestigt gecontroleerde opruiming zonder overgebleven processen.

Read-mode afwijzing slaagt op 1440 en 700px. Invoegen slaagt op 100% en 75%
zoom met behoud van alle tekst, links en oorspronkelijke selectie-inhoud;
de werkelijke dropbestemming, opgeslagen artikelgegevens en Undo/Redo blijven
gecontroleerd. De muisklik bereikt Read na de expliciete camera-panning.

De bronmanifesten van de tweede en vierde lokale uitvoering zijn vergeleken:
alleen `browser-tests/text-library-insertion.browser.mjs` en dit auditdocument
verschillen; geen bestanden verdwenen. De productiecode, dependencies,
unitchecks en overige drie browsersuites zijn identiek aan de tweede uitvoering.
Daarom is de gerichte verificatie van deze remediatie afgerond: de volledige
unitselectie en alle vier geselecteerde browsersuites hebben geldige groene
uitvoeringsevidence, verdeeld over de genoemde runs. Dit is geen uitvoering
van de volledige release-browsercatalogus en geen deploymentgoedkeuring.

De productie-bundlebesparing en eerdere groene buildchecks blijven gelden;
de latere wijzigingen zijn uitsluitend testbediening en auditbewijs. De
overlap van de Text-actiebalk met de menubalk na Focus selection blijft een
afzonderlijke UX-bevinding. Performanceonderzoek is de volgende stap en is
nog niet uitgevoerd. Alles blijft lokaal, zonder commit, push of publicatie.

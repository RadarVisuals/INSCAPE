# Reception — gemeten invoervertraging, 13 november 2026

## Resultaat en besluit

In deze gecontroleerde desktopproef is de mediane typlatentie vóór en na de laatste geometrie-optimalisatie 24 ms. Met zestien lange artikelen daalt de gepoolde p95 op beide breedtes van 40 naar 32 ms; die richting komt in twee van drie gepaarde rondes terug, met één gelijke ronde. Bij zestien korte artikelen op 900 px stijgt de p95 juist van 32 naar 40 ms. Op 1440 px blijft korte tekst gelijk. Er is daarom geen consistent voordeel over alle omstandigheden, en deze proef onderbouwt geen algemene claim dat typen 31% sneller is.

De eerder gemeten 31,46% minder frame-opzoekingen blijft een afzonderlijk resultaat over rekenwerk. Deze vergelijking betreft uitsluitend de laatste twee controles in editorCellPreviewTransforms en reconcileReceptionCells; alle eerdere optimalisaties zitten in beide versies.

Over de 2.592 acties is de hoogste gerapporteerde eventduur 48 ms. Geen gemeten interactie heeft een gerapporteerde duur boven 50 of 100 ms, en er zijn geen browsertaken van meer dan 50 ms binnen de drie meetperioden geregistreerd. De afzonderlijke kalibratie valt daarbuiten. Deze getallen zijn afgeronde browsermetingen, geen garantie dat iedere fysieke toets op ieder toestel even snel wordt afgebeeld.

Besluit: geen extra productcode gewijzigd. De huidige meting toont geen grote vertraging waarvoor een bredere tekst- of storeherschrijving nu nodig is. Het verschil van één rapportagestap in beide richtingen blijft een beperkt laboratoriumresultaat; een causale snelheidswinst of -regressie is hiermee niet vastgesteld. Een concreet nieuw haperingsgeval of zwakkere hardware zou aanleiding zijn voor een gerichte vervolgmeting.

## Vergelijking

Alle waarden in milliseconden; p50 is de mediaan, p95 de grens waar 95% van de gemeten acties onder of op ligt. Elke rij bevat drie herhalingen: 240 typeacties, 48 selecteercommando's of 36 opmaakcommando's per versie. <16 betekent onder de rapportagedrempel van deze browsermeting, geen gemeten nulduur.

| Inhoud per artikel | Breedte | Actie | p50 vóór | p50 na | p95 vóór | p95 na | Hoogste vóór | Hoogste na |
|---|---:|---|---:|---:|---:|---:|---:|---:|
| 3 alinea’s | 1440 | Typen | 24 | 24 | 32 | 32 | 40 | 40 |
| 3 alinea’s | 1440 | Woordselectie via toetsenbord | <16 | <16 | 16 | 16 | 16 | 16 |
| 3 alinea’s | 1440 | Vet wisselen via Ctrl+B | 24 | 24 | 32 | 32 | 40 | 32 |
| 3 alinea’s | 900 | Typen | 24 | 24 | 32 | 40 | 40 | 40 |
| 3 alinea’s | 900 | Woordselectie via toetsenbord | <16 | <16 | 16 | 16 | 24 | 16 |
| 3 alinea’s | 900 | Vet wisselen via Ctrl+B | 24 | 24 | 24 | 32 | 32 | 32 |
| 24 alinea’s | 1440 | Typen | 24 | 24 | 40 | 32 | 48 | 40 |
| 24 alinea’s | 1440 | Woordselectie via toetsenbord | <16 | <16 | 16 | 16 | 16 | 16 |
| 24 alinea’s | 1440 | Vet wisselen via Ctrl+B | 24 | 24 | 32 | 32 | 32 | 48 |
| 24 alinea’s | 900 | Typen | 24 | 24 | 40 | 32 | 48 | 40 |
| 24 alinea’s | 900 | Woordselectie via toetsenbord | <16 | <16 | 16 | 16 | 16 | 16 |
| 24 alinea’s | 900 | Vet wisselen via Ctrl+B | 24 | 24 | 40 | 32 | 40 | 40 |

## Spreiding over rondes

Afzonderlijke p95's tonen de variatie die achter de gepoolde tabel zit. Iedere kolom toont ronde 1 / 2 / 3. De versievolgorde is vóór-na, na-vóór, vóór-na; er worden geen gunstige rondes uitgekozen en de pilot telt niet mee.

| Alinea’s | Breedte | Actie | p95 vóór per ronde | p95 na per ronde |
|---:|---:|---|---|---|
| 3 | 1440 | Typen | 32 / 32 / 32 | 32 / 32 / 32 |
| 3 | 1440 | Woordselectie via toetsenbord | 16 / 16 / 16 | 16 / 16 / 16 |
| 3 | 1440 | Vet wisselen via Ctrl+B | 40 / 32 / 24 | 32 / 32 / 24 |
| 3 | 900 | Typen | 24 / 32 / 32 | 24 / 40 / 40 |
| 3 | 900 | Woordselectie via toetsenbord | 24 / 16 / 16 | 16 / 16 / 16 |
| 3 | 900 | Vet wisselen via Ctrl+B | 32 / 24 / 24 | 32 / 32 / 32 |
| 24 | 1440 | Typen | 40 / 32 / 40 | 32 / 32 / 32 |
| 24 | 1440 | Woordselectie via toetsenbord | 16 / 16 / <16 | 16 / <16 / 16 |
| 24 | 1440 | Vet wisselen via Ctrl+B | 24 / 32 / 32 | 32 / 32 / 48 |
| 24 | 900 | Typen | 32 / 40 / 40 | 32 / 32 / 32 |
| 24 | 900 | Woordselectie via toetsenbord | 16 / 16 / 16 | 16 / 16 / 16 |
| 24 | 900 | Vet wisselen via Ctrl+B | 40 / 24 / 40 | 32 / 40 / 32 |

## Meetmethode

Ongeïnstrumenteerde minified productiefixture; uitsluitend de geïsoleerde workloadgenerator wisselt tussen 3 en 24 alinea's per artikel. Beide versies hebben zestien cellen, zestien afbeeldingen en zestien artikelen. Voor = de twee snapshots vóór de geometrie-optimalisatie; na = huidige bronbestanden. Geen render-count hooks. Gelijke releasegegevens en compileropties.

Browser Event Timing wordt geobserveerd vanaf documentstart met durationThreshold 16. De duration is door de browser bepaalde invoer-tot-render-update, afgerond in stappen van 8 ms; het is geen hardwaremeting van toets tot schermpixel. Werkbron: [W3C Event Timing, werkversie](https://w3c.github.io/event-timing/) (geraadpleegd 13 november 2026).

Per gemeten toets wordt de vertrouwde keydown en bijbehorende keyup bijgehouden, gekoppeld op browser-tijdstempel aan Event Timing en gegroepeerd op interactionId. De langste gerapporteerde eventduur binnen die interactie telt. Niet-gerapporteerde toetsinteracties worden als onder de rapportagedrempel verwerkt; percentielen daaronder heten <16 ms, nooit 0 ms. Alleen ondersteunde Chromium-metingen, geen synthetische dispatchEvent. Modifier-only toetsen tellen niet als aparte actie.

Na geladen fonts/afbeeldingen en zeven opwarmtekens: 80 tekens met minimaal 80 ms tussen tekens, 16 selecteer-volgend-woord-commando's (Ctrl+Shift+ArrowRight), 12 Bold-wissels op de selectie. Metingen gebruiken browserklokken; protocolrondreizen en wachttijden zijn niet de gerapporteerde eventlatentie. Keyboardselectie blijft een afzonderlijke proef; muissleepselectie is hiermee niet gemeten.

Drie herhalingen per versie, inhoudslengte en computerbreedte (1440 en 900 px); versievolgorde wisselt per ronde. Geen CPU-throttling, geen parallelle tests of builds tijdens de metingen. Geen productie- of mobiele veld-INP-claim. Eerste opening/koude teksteditor, IME/plakken en zwakkere hardware zijn uitgesloten. De pilot valideert de meetopstelling en telt niet mee in de definitieve vergelijking.

Gedragscontroles per proef: alle 16 afbeeldingen klaar, 80 tekens opgeslagen, selectie verandert geen opgeslagen document, iedere Bold-wissel verandert opgeslagen markering, geometrie en vijftien andere artikelen blijven gelijk, geen paginafouten. Elk browsercontext bezit zijn eigen testopslag; gebruikersdocumenten worden niet geopend.

Na iedere proef wordt op een los kalibratie-element een afzonderlijke vertraagde toets gemeten. Dit controleert dat de browser Event Timing met interactionId werkelijk levert. De kalibratie valt volledig buiten de drie meetperioden en hun percentielen/long tasks.


## Uitgevoerde controles

Alle 24 proeven zijn voltooid. In iedere proef zijn de ingevoerde tekens opgeslagen, heeft selecteren het opgeslagen document ongemoeid gelaten en veranderen alle twaalf Bold-wissels de opgeslagen markering. De geometrie en vijftien overige artikelen blijven gelijk. Geen paginafouten. Alle 16 afbeeldingen waren geladen voordat de meting begon. Screenshots van de lange inhoud op 1440 en 900 px zijn bekeken; dit is de bestaande editor met haar vaste zijpanelen en bijbehorende schaal, zonder UI-aanpassing.

De twee diagnostische builds zijn geslaagd. Omdat er geen productiecode, productieconfiguratie of bestaande test is veranderd, zijn de volledige unit- en releasebrowsersuites en de gewone productiebuild/budgetcheck niet opnieuw gedraaid voor dit meetwerk. De vorige verificatie staat afzonderlijk in [het geometrieverslag](reception-typing-geometry.md); die wordt niet voorgesteld als een nieuwe volledige releasecontrole.

De pilot had eerst een fout in de meethelper (een module-namespace werd als schrijfbaar object behandeld). Die is gecorrigeerd vóór de geslaagde pilot en definitieve reeks. De mislukte pilot is bewaard; hij bevat geen benchmarkresultaten. De geslaagde pilot en definitieve reeks hebben beide geverifieerde procesopruiming, zonder resterende geobserveerde processen. Er is niets aan Windows-instellingen of maprechten veranderd.

## Herkomst en reproduceerbaarheid

Bewijsmap: output/reception-input-latency-2026-11-13/.

- summary.json: gepoolde uitkomsten, aantallen, browserkenmerken, source-provenance en procesopruiming.
- results.json: alle 24 proeven met ruwe Event Timing-events, toetskoppeling, meetperioden, long tasks en gedragscontroles.
- process.json en pilot-process.json: afloop en geverifieerde procesopruiming; pilot-results.json blijft apart.
- build.mjs, serve.mjs, measure.mjs, runner.mjs, summarize.mjs en method.md: concrete meetopstelling.
- before/ en after/: ongeïnstrumenteerde minified testbuilds, broninventarissen en screenshots.

Beide broninventarissen beschrijven dezelfde actuele checkout (5319dc20adf326f1180ea712cfb62c1a277bd094cfbfbca37cf16eb547afc710); de vóór-build vervangt alleen de twee genoemde bestanden door de snapshots van vóór de vorige wijziging. Hun afzonderlijke hashes staan in summary.json. De fixture-aanpassing voor 3/24 alinea's is in beide builds gelijk en wordt alleen tijdens de diagnostische build toegepast. De echte bronbestanden worden nooit tijdelijk teruggezet.

De broninventaris was na de meting identiek aan die bij het bouwen; geen bronwijzigingen tijdens de proef. Dit verslag wordt pas daarna toegevoegd. Bestaande lokale wijzigingen zijn behouden. Alleen meethelpers, meetresultaten en dit verslag zijn toegevoegd; geen productcode, tests of contracten gewijzigd. Geen commit, push, upload, walletactie of deploy uitgevoerd.

# Audit Reception en directe afhankelijkheden — 27 oktober 2026

**Oordeel: de gekozen basis is bruikbaar en grotendeels goed gescheiden. Eerst enkele concrete reader-, herstel- en CSS-grenzen repareren voordat Reception verder groeit. Een redesign of generiek editorframework is niet nodig.**

Deze audit onderzoekt de bestaande lokale implementatie, inclusief alle niet-gecommitte wijzigingen. Ze verandert geen productiecode, productvormgeving of echte profielinhoud. Bevindingen zijn hieronder onderscheiden als bevestigde fouten, structurele risico’s en onbewezen zaken.

## 1. Onderzochte toestand en bewijskracht

- Checkout: `C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work`.
- Branch: `codex/static-reception-bento-2026-10-26`; HEAD: `4a0251647234c0757847078ec34f0865425f6857`.
- Bij aanvang: 25 gewijzigde tracked bestanden en vier nieuwe Reception-bronbestanden. Alle 29 gecontroleerde bestaande wijzigingen zijn na de audit bytegelijk aan het begin, inclusief `code-quality-progress.json`. Zie [hashcontrole][preservation].
- De actieve contractafspraken van 27 oktober gelden: eigen Reception-editor, gedeelde contenttools, één canonieke draft, eigenaar leest lokaal, bezoekers lezen gepubliceerd, Done publiceert nooit. Desktop blijft uitgesteld.
- Gelezen: checkout-instructies, relevante actieve contractsecties, creative intent, Hanssen-packet en recent cell-editor-verslag. De drie primaire Hanssen-screenshots zijn bekeken; About → Work → Darkness is live geïnspecteerd. De bestaande smalle gaps, contouren, grote contentvlakken en compacte navigatie zijn het uitgangspunt voor behoud.
- [PR #5](https://github.com/RadarVisuals/INSCAPE/pull/5) staat op `3cfd6cf5da12218938d7706268ebd10bed890966`, dus niet op deze lokale HEAD. De opgehaalde GitHub-checks op die PR-head zijn geannuleerd; Netlify meldt wel een geslaagde preview op die andere revision. Dat bewijst niets over de huidige lokale wijzigingen. Voor de lokale HEAD leverden de commitlookup geen PR-getriggerde workflowruns en geen gecombineerde statuses op; dit is geen uitputtende claim over alle mogelijke CI-bronnen. [Remote evidence][remote], [check-samenvatting][remotechecks].
- Geen commit, push, deployment, upload, walletprompt, handtekening of publicatie uitgevoerd.

### Nieuwe verificatie

| Controle | Resultaat |
| --- | --- |
| Lint | Geslaagd: 500 bronbestanden; 91 bestaande geregistreerde hook-observaties blijven staan. |
| Typecheck | Geslaagd; 17 ongeldige calls en 3 mutaties correct afgewezen. |
| Gerichte navigatie / Reception / productiebuildtests | 36/36 geslaagd. |
| Aangrenzende store / lease / Text recovery / publicatie / Library-tests | 59/59 geslaagd. |
| Bestaande Reception-editor-browserregressies | 16/16 geslaagd. |
| Bestaande owner-routing-browserregressies | 5/5 geslaagd. |
| Bestaande Reception / Explore / publieke navigatie | 6/6 geslaagd. |
| Productiebundel-startuptest | 1/1 geslaagd, 1440 en 390 px. |
| Nieuwe auditprobes | Zes scenario’s uitgevoerd; documenteren geobserveerde fouten en één geslaagde lease-/authority-controle. Geen vervanging van regressietests. |
| Productiebuild en budgetcontrole | Beide geslaagd. |

De eerste sandboxrun mislukte uitsluitend bij esbuild-directorytoegang; dezelfde build/gerelateerde tests slaagden buiten die beperking. Logs van beide pogingen zijn behouden. Het volledige `npm test`- en releasebrowserpakket is niet uitgevoerd. Dit is een gerichte audit, geen releaseverklaring.

Reproduceerbare scripts, logs en JSON staan in deze map. De browserrunner gebruikt eigen browsercontexten/testorigins. De extra probes gebruiken uitsluitend synthetisch profiel `0x333…333`; externe requests worden afgebroken. De CUA-controle gebruikte de bestaande Reception-fixture met een eigen `reception-test:boundaries-audit-20261027:` opslagprefix. Er is geen echte gebruikersdraft aangepast.

## 2. Verantwoordelijkheden en gegevensstroom

| Grens | Feitelijke eigenaar en verbinding | Beoordeling |
| --- | --- | --- |
| Route en bevoegdheid | [App][app] → [useApplicationNavigation][navigation] → bestemming; owner-return wordt alleen bij afgeronde, geverifieerde ownership meegegeven. Profiel-URL’s verlenen geen rechten. | Goed gescheiden van contentcommands. About loopt nog te diep door de publieke read-boundary: F1. |
| Lokale reader | [ProfileOverview][overview] kiest voor geverifieerde eigenaar [OwnerReception][owner]; bezoekers houden de publicatie-input. | Goede richting, maar eigen store-instanties hebben geen reader-invalidatie: F2/F3. |
| Exclusief schrijven | [ProfileEditingBoundary][boundary] verwerft de profiel-lock; [profileEditorLease][lease] bindt stores aan het oorspronkelijke token. Done unmount deze boundary bij About-entry. | Tweede editor wordt geblokkeerd; oude stores krijgen geen nieuwe lease cadeau. Getest. |
| Reception-capabilities | [ReceptionStoreEditor][scopehost] verwerft [acquireReceptionScope][scope]. Alleen Reception en gedeelde identiteit mogen verschillen; Workbenchvelden worden vergeleken en afgeschermd. | Geen extra Workbench-modus of tweede Reception-opslag. Scope-release trekt late mutatierechten in. |
| Commands en opslag | UI → [receptionSession][commands] / [receptionLayout][layout] → scoped `commitCompletedOperation` → [canonical store][persist]. | Validatie, generation/expected-object-controle, schrijfcontrole en undo zitten onder de UI. Een mislukte write accepteert geen nieuwe draft/history. |
| Collectie | [workbenchCollection][collection] bewaart Reception in `shared`, naast profielidentiteit en Keeper. | Reception is geen canvas en wordt niet per canvas gekopieerd. |
| Library | [useProfileLibrary][library] wordt ook door [useOwnerWorkbenchLibrary][workbenchlibrary] gebruikt. De Reception-picker hergebruikt browserworkspace, presenter, rail en categoriecommands. | Werkelijk gedeelde bron/data/presentatie. `ProfileLibraryPicker` zelf is een Reception-adapter; zijn hostnamen/classes zijn nog specifiek. |
| Text | [ReceptionTextEditor][textadapter] gebruikt dezelfde ArticleEditor, TextToolsContent, TextColourTools en [Text edit session][textsession]. `containerOwned` en `containerControls=false` laten Reception de buitenkant bezitten. | Goede inhoudelijke scheiding. Geen gekopieerde rich-text engine. CSS ondergraaft die scheiding plaatselijk: F5. |
| Color | [CommittedColourControls][color] en TextColourTools blijven de gedeelde implementaties. Reception bezit target en tijdelijke preview; commit gebruikt zijn scope. | Correcte concrete reuse, zonder globale color-selectiestore. |
| Image | [resolveImageLibrarySide][imagesource] behoudt asset/source-identiteit; [ReceptionImage][imagewrapper] gebruikt dezelfde ImageArtwork/projection/mediaterugwinning. | Data en renderer gedeeld; bento-cropinteractie is terecht lokaal. Publieke toegankelijkheidsnaam ontbreekt: F7. |
| Identiteit | [useReceptionContent][content] combineert draftpresentatie met de gedeelde identity-viewmodel; officiële UP-link blijft apart van authored branding. Profieleditor hergebruikt IdentityCardSettings. | Geen eigen identiteitsschema. Reader haalt wel bredere Library-afhankelijkheden binnen dan alleen presentatie: R1. |
| Publiceren | [PublicationRack][publishui] → [buildCanvasPublication][publishbuilder] → bestaande gecontroleerde publicatieflow. Gedeeld profiel/Reception/Keeper heeft een aparte checkbox. | Done heeft geen publish-call. Ongekozen canvases behouden hun vorige publieke revision. |
| Publieke projectie | [projectReception][projection] verwijdert private en ongeplaatste records, leegt verwijzingen naar uitgesloten content en filtert logo. [V9-builder][v9builder] gebruikt die projectie. | Privacy wordt in de data begrensd, niet door knoppen te verbergen. Huidige gerichte tests slagen. |
| Rendering | [ReceptionCanvas][canvas] is dezelfde presentatie voor editor, preview, owner-reader en bezoeker; [ReceptionFrameTools][frametools] bevat editorhandles. | Authored layout en tijdelijke selectie/drag-preview zijn grotendeels gescheiden. Geen tweede bento-renderer. |

Er is dus **geen reden om opnieuw één overkoepelend editorsysteem te bouwen**. Reception bezit de partitionering en selectie; Workbench bezit vrije plaatsing, camera en layers. Het probleem zit vooral in enkele adapters tussen bestaande verantwoordelijkheden.

## 3. Bevestigde bevindingen

Prioriteiten: **P1** vóór verdere functionele uitbreiding; **P2** gerichte reparatie vóór een betrouwbaar breder checkpoint. Er is in deze audit geen kritieke privacy- of destructieve opslagfout aangetoond.

### F1 — P1 — About kan een geldige lokale Reception blokkeren wanneer de publicatie ontbreekt of niet leesbaar is

**Locatie:** [PublishedProfileBoundary:51][publicgate], [App:225][app225], [OwnerReception:15][owner15].

De owner-reader wordt pas gemount nadat de publieke boundary een `RESOLVED` of `STALE` document heeft. Bij `UNAVAILABLE`, `ERROR` of `INVALID` toont About uitsluitend de publieke statuspagina. De lokale store wordt dan niet gelezen, ook met geverifieerde owner-bevoegdheid en een geldige opgeslagen Reception.

**Reproductie:** seed een lokale Reception met merknaam LOCAL A; geef de echte PublishedProfileBoundary owner-return-capability; verander alleen de publieke resolutie naar elk van deze drie statussen. In alle gevallen blijft de canonieke draft LOCAL A, maar er is geen Reception-canvas. [Probe-resultaten][probes], [screenshot][blockedshot].

**Gebruikersimpact:** een eigenaar zonder eerste publicatie kan zijn opgeslagen Reception niet via About bekijken; hetzelfde kan bij een koude netwerk-/gatewayfout. Workbench → Edit Reception blijft een omweg, geen oplossing voor de afgesproken About-route.

**Kleinste verbetering:** kies de geverifieerde owner-reader op profieladres vóór de publieke documentvereiste. Geef de publicatie optioneel mee als fallback/reconciliatiebron. Behoud dezelfde authority-gate en laat publieke fouten de bezoekersroute blijven begrenzen. Test absent/error/invalid mét en zonder lokale draft.

### F2 — P2 — De owner-reader blijft een oude snapshot tonen nadat een andere toegestane editor opslaat

**Locatie:** [OwnerReception:13][owner13], [SavedReception:36][saved36], [store subscribe/getSnapshot:245][store245].

`saved.store` wordt één keer aangemaakt; `useSyncExternalStore` luistert alleen naar notificaties van die instantie. De store heeft geen storage-/foreground-verversing. Zodra Done de lease heeft vrijgegeven, kan een andere tab geldig bewerken, terwijl de eerste reader blijft doen alsof zijn oude snapshot actueel is.

**Reproductie:** open twee owner-readers. Bewerk in tab B de merknaam via de echte editor naar LOCAL B en klik Done. Opslag én tab B tonen LOCAL B; tab A blijft LOCAL A tonen, ook na terugbrengen naar de voorgrond. Reload van A toont wel LOCAL B. [Probe-resultaten][probes], [screenshot][staleshot].

**Impact:** verwarrende schijn van verloren of niet opgeslagen wijzigingen; dit schendt de bedoeling van één canonieke lokale bron, zonder dat werkelijk bytes verloren gaan.

**Kleinste verbetering:** geef de reader een expliciete read/refresh-lifecycle voor het actuele profiel, inclusief storage-event en opnieuw zichtbaar worden. Gebruik de bestaande validatie en maak stale/error zichtbaar. Roep niet blind `reload()` op een actieve editor aan: dat herroept scopes en wist history. Deel de invalidatie met eventuele andere read-only consumers.

### F3 — P2 — Succesvolle backup-recovery sluit terug naar de oude publicatie en behoudt de foutstatus

**Locatie:** [OwnerReception:54][owner54], vergeleken met [normale Done:25][owner25] en [WorkbenchBackupControls:restore][backup].

Het initiële recoverypad gebruikt `onRestored={onClose}`. Dat sluit de editor zonder de herstelde rootstore via `onDone(root)` aan de reader te geven. De oorspronkelijke `saved.error` blijft bestaan.

**Reproductie:** maak de synthetische lokale record corrupt; open Edit Reception; lees een geldige private fixturebackup en bevestig Replace. De canonieke store bevat RESTORED LOCAL. De reader toont PUBLIC ONLY; de oude alert “Your local Reception could not be read” blijft in de DOM, maar is op de screenshot niet zichtbaar. Reload toont de herstelde inhoud correct. [Probe-resultaten][probes], [screenshot][restoreshot].

**Impact:** een geslaagd herstel lijkt mislukt. De gebruiker kan onnodig opnieuw herstel proberen of denken dat werk weg is.

**Kleinste verbetering:** laat succesvol herstel dezelfde reader-overdracht uitvoeren als Done, met de daadwerkelijk geaccepteerde store en eventueel een cleanup-waarschuwing. Reset de oude read-error. Test ook opnieuw openen na herstel. De bestaande backupvalidatie hoeft niet vervangen te worden.

### F4 — P2 — Toolpaneel verliest toetsenbordfocus bij sluiten

**Locatie:** [ReceptionControls:15][focus15].

Het paneel probeert focus terug te zetten in de cleanup van een gewoon effect. Na DOM-verwijdering is `document.activeElement` al BODY; de voorwaarde `node.contains(document.activeElement)` is dan onwaar.

**Reproductie:** focus Page settings → Enter → focus Close Page settings → Enter. Het paneel verdwijnt, maar activeElement wordt BODY, niet de oorspronkelijke knop. Automatische probe én CUA bij Close Text tools bevestigen dit. [Probe-resultaten][probes].

**Impact:** toetsenbordgebruikers verliezen hun positie en moeten opnieuw door de pagina navigeren.

**Kleinste verbetering:** capture de herkomst bij openen en herstel gericht vanuit de close-overgang, met bescherming tegen een nieuwere focuskeuze. Het bestaande [useDeferredFocusReturn][focusshared] is een concrete hergebruikkandidaat. Test sluiten via knop, Escape, paneelwissel en verdwijnen door route-/scopewijziging.

### F5 — P2 — Toolchrome lekt door naar authored Text

**Locatie:** [ReceptionEditor:155][editor155], [workbenchToolChrome:50][chrome50], [Text-title CSS:79][titlecss].

De hele editorwindow, inclusief bento-inhoud, draagt `data-window-chrome="flat"`. De gedeelde descendantselector voor native inputs/textarea’s geeft daardoor ook de authored artikeltitel toolstyling. `containerOwned` voorkomt dit niet.

**Meting:** dezelfde titel krijgt in editing een 1px rand en `5px 7px` padding; de reader heeft 0 rand en 0 padding. Titelhoogte: 48,39 versus 36,39 px. De buitenste editor-/previewbreedtes verschillen bewust; de rand/padding en 12px extra titelruimte zijn het aantoonbare lek. [Metingen][styleprobe], [editorbeeld][editshot], [readerbeeld][readshot].

**Impact:** het schrijfvlak en de uiteindelijke inhoud wijken onbedoeld af; verdere tool-CSS kan straks ook andere authored inputs raken.

**Kleinste verbetering:** scope controlchrome tot daadwerkelijke toolvlakken en de header, buiten authored content. Behoud de eigen Text-presentatieregels. Geen extra titel-specifieke `!important`-override toevoegen.

### F6 — P2 — Mobiele controls krijgen niet de bedoelde gedeelde afmetingen

**Locatie:** [Reception CSS:112][mobile112], [workbenchToolChrome:38][chrome38], [workbenchToolPanel:7][panel7].

De Reception-mediaregel vraagt 40px hoogte, maar de generieke chrome-regel met vergelijkbare specificiteit wint in de geobserveerde laadvolgorde met een 32px fallback. De 44px/smalle-fieldregels van Workbench gelden slechts voor andere hostclasses. De closeknop is zelfstandig op 28px vastgezet.

**Meting bij 390×844:** header-iconknoppen 34×32px, Done 69,92×32px, paneelsluiting 28×28px, Brand name 12px tekst. De bestaande mobile-regressie controleert voor sluiten slechts minimaal 28px en detecteert dit daarom niet. [Metingen][styleprobe], [screenshot][mobileshot].

**Impact:** kleinere touchbediening dan de gedeelde afspraak en afhankelijkheid van CSS-importvolgorde. Dit is een concrete uitzondering, geen reden om de gekozen visuele dichtheid te veranderen.

**Kleinste verbetering:** één gedeelde sizing-token/hostvariant voor deze controls, met expliciete smalle/coarse targets; begrens generieke selectorsterkte. Test computed hit-area’s en typografie op 320/390 én bij coarse pointer, ook na andere lazy tools geopend te hebben. Behoud artworkgeometrie.

### F7 — P2 — Reception-artwork heeft geen betekenisvolle toegankelijkheidsnaam

**Locatie:** [ReceptionImage:29][imagewrapper], [region label:80][region80], [ImageArtwork:75][image75].

De wrapper geeft geen rol/naam; de rasterrenderer gebruikt een aria-hidden SVG. In de geïnspecteerde gevulde preview bevat de toegankelijkheidsboom alleen “Region 4 · image”, zonder de naam/beschrijving van het werk. De naam en bronreferentie bestaan wel in het record. De publieke Reception biedt ook geen artwork-infoactie zoals de editor.

**Impact:** een screenreadergebruiker kan dit centrale werk niet identificeren. Dit is geen verlies van provenance in opslag: de publicatie bewaart die referenties correct.

**Kleinste verbetering:** geef het artwork een passende toegankelijke naam uit zijn bestaande record/source, met consistente behandeling van decoratieve versus inhoudelijke beelden. Een publieke infoactie kan de bestaande dossierweergave hergebruiken indien gewenst; voor het herstellen van de naam is geen nieuw metadataframework nodig. Verifieer de accessibility-tree met een rasterwerk en prepared SVG.

## 4. Structurele risico’s, zonder bewezen gebruikersfout

### R1 — P2 — Reader/editor-bundels en budgetten begrenzen niet de routes die de gebruiker werkelijk opent

De naam “lazy owner” is maar gedeeltelijk informatief. [OwnerReception:6][owner6] importeert ReceptionStoreEditor statisch. Een eigenaar die alleen About leest, laadt daardoor ook de Reception-editor, Library-presenter, Color en metadata-afhankelijkheden. De rijke Text-editor zelf blijft apart lazy; een bezoeker krijgt niet automatisch de owner-editor.

Nieuwe manifestmeting, **statische closure inclusief gedeelde startup**, dus geen opgetelde unieke routekosten of gemeten netwerklatentie:

| Route/chunk | JS raw | Extra boven startup raw | CSS raw |
| --- | ---: | ---: | ---: |
| Publieke ProfileOverview | 1.019.807 | 189.232 | 126.714 |
| OwnerReception, ook reader | 1.264.541 | 433.966 | 180.312 |
| ReceptionStoreEditor | 1.215.470 | 384.895 | 176.848 |
| ReceptionTextEditor | 1.705.129 | 874.554 | 181.849 |
| Workbench runtime | 1.663.161 | 832.586 | 186.305 |

De publieke Overview importeert bovendien `ownerSystemWorkflow.css` om gedeelde tokens/styles te krijgen. Bestandsnaam alleen is geen architectuurfout; de brede closure en F5/F6 maken gerichte scheiding wel zinvol.

De bestaande `ownerJavaScript`-maat meet vooral de statische shell: 119.790 raw bytes, terwijl zijn dynamisch geopende runtime veel meer meebrengt. [Budgetberekening][budgetcalc] en [owner-graph guard][graphguard] bewaken startup en drie bekende owner-markers, niet iedere relevante route of nieuwe Reception-editorgrens.

**Kleinste verbetering:** maak de editorimport lazy op daadwerkelijke edit-entry; splits alleen de concreet benodigde readeridentiteit/mediaresolutie en gedeelde chrome/token-CSS uit brede hosts. Voeg routeclosures voor publieke About, owner About en editor toe aan de bestaande buildreporting. Eerst meten, geen arbitraire nieuwe limieten of generieke pluginarchitectuur.

### R2 — P3 — De huidige budgetverruiming is traceerbaar, maar vrijwel zonder ontwikkelmarge

Nieuwe build bevestigt exact:

| Maat | Gemeten raw / gzip | Limiet raw / gzip |
| --- | ---: | ---: |
| Startup JS | 830.575 / 240.682 | 1.303.524 / 379.811 |
| Totale non-wallet JS, inclusief startup en optionele routes | 2.652.486 / 865.503 | 2.653.000 / 866.000 |
| Walletgroep | 4.547.248 / 1.209.314 | 4.600.000 / 1.225.000 |
| Startup CSS | 32.526 / 6.615 | 51.807 / 10.301 |

De laatste raw-verruimingen zijn klein en toegelicht; de shared extraction voorkomt duplicatie. Er is geen bewijs dat deze paar kilobytes een performanceprobleem veroorzaken. Wel resteert slechts **514 raw / 497 gzip bytes** in de totale non-walletgroep. Telkens precies verhogen tot de nieuwe build past, geeft weinig onafhankelijk signaal over betaalbare routekosten. Bovendien is deze groep geen “alleen optioneel”-maat: startup zit erin.

**Kleinste verbetering:** behoud de huidige bundelgrenzen, rapporteer routekosten en stel bij een volgende feature een vooraf begrensde groeiruimte vast. Verlaag eerst de onnodig eager reader/editor-koppeling; beschouw dat niet automatisch als lagere totale codegrootte. Geen herhaalde budgetverhoging zonder nieuwe meting en inhoudelijke verklaring.

### Wat nu geen aparte abstractie nodig heeft

- ReceptionEditor is circa 255 regels orchestration en heeft concrete layout-, gesture-, content- en framehelpers. Het aantal panels op zichzelf rechtvaardigt geen generieke editor-engine.
- Een aparte cropgesture is logisch voor een bento-vak; bronresolutie, transforms, cropberekening en renderer zijn reeds gedeeld.
- ReceptionButton en ReceptionPanel hergebruiken materiaal/CSS, maar niet de volledige Workbench-windowlifecycle. De bewezen ontbrekende focusafhandeling moet gericht gedeeld worden; niet alle vrije window-docking naar Reception brengen.
- In `reception.css`: 125 rules, geen `!important`, geen herhaalde identieke selector binnen dezelfde conditie. Geen bewijs van een omvangrijke lokale override-stapel. De concrete problemen zijn **ancestor-scope, cascadevolgorde en hostspecifieke sizing**.
- In de aangrenzende brede `ownerSystemWorkflow.css` staan zeven `!important`-declaraties en één gesplitst selectorblok. Dat is ondersteunende schuld, geen automatisch bewijs van een Reception-bug. [CSS- en bundelanalyse][analysis].

## 5. Lifecycle, privacy en visuele dekking

**Werkend aangetoond:** Edit → Done → opnieuw openen; About ↔ Canvases; owner-authority loss; smalle routes; tweede tab geblokkeerd tijdens editing en toegelaten na Done; split/resize/move/merge; crop commit/cancel/reload; Library-cancel en late-resultaten; mislukte writes met behoud van accepted draft; Text retry met behoud van andere wijzigingen; private/ongeplaatste inhoud uitgesloten; gedeelde publicatiekeuze onafhankelijk van ongekozen canvases.

De Library-request neemt profielscope, region en generation mee en wordt bij cancel/unmount ingetrokken. [prepareReceptionImage][asyncimage]. Pointergebaren ruimen capture, windowlisteners, visibility/blurhandlers en preview op. [useReceptionGesture][gesture]. ImageArtwork heeft keyed retries, bounded decoder-timeout en cleanup; de Reception-wrapper hergebruikt dat pad.

De publieke tests vergelijken opslag vóór/na browsen en ontbreken van editcontrols. Gecontroleerde projectie sluit private en ongeplaatste records uit; de scope verhindert dat Reception canvasvelden schrijft. Dit ondersteunt een goede privacygrens, maar is geen volledige securityaudit van alle artworkformaten, walletprovider of server.

**Visueel bekeken:** gevulde layout met Text, profielvelden, links en echte meegeleverde transparante artwork; Carbon/Mist; desktop en smalle schermen; toolpaneel; titel-/chromeverschil. De bestaande suite produceerde beelden op 320, 390, 640, 800, 1440 en 2560 px en controleerde transparante contouren en extreme radius/gapwaarden. [Brede presentatie][wide], [smalle presentatie][narrow], [Text-tools][toolsimage]. Desktop-preview en publieke geometrie worden door dezelfde browsercase vergeleken. De geaccepteerde vorm hoeft voor de gevonden reparaties niet te veranderen.

CUA bevestigde de gedeelde Text controls en preview zonder tools. Een CUA-screenshotcall kreeg een timeout; de interactie was wel uitgevoerd en de verse accessibility-state bevestigde het resultaat. De hierboven gelinkte beelden komen uit de daadwerkelijk uitgevoerde geïsoleerde browserruns, niet uit die mislukte screenshotcall.

**Niet bewezen:** echte hosted wallet/IPFS-publicatie; daadwerkelijke mobile hardware en iOS-zoom; complete forced-colors-/screenreaderacceptatie; performance van een maximaal gevulde Reception met 32 vakken en zware animaties; alle routes van het volledige releasepakket; online gedrag van deze ongepushte bron. De startupcheck meet alleen de verse entry, geen volledige profiel- of editorinteractiviteit.

## 6. Kleinste herstelvolgorde

1. **Lokale About-reader onafhankelijk maken van publicatiebeschikbaarheid (F1).** Eén authority-gate behouden; lokale/publieke fallback expliciet testen.
2. **Reader-lifecycle en hersteloverdracht samen repareren (F2/F3).** Canonieke refresh met zichtbaar stale/error, normale Done en recovery op dezelfde overgang.
3. **Toolchrome begrenzen en focus terugbrengen (F4–F6).** Authored content buiten controlscope; één sizingrecept; concrete focushelper hergebruiken. Gevulde layout en actuele vorm vergelijken vóór/na.
4. **Artwork toegankelijk benoemen (F7).** Bestaande metadata gebruiken; accessibility-tree controleren.
5. **De eager editorimport en routebudgetten aanpakken (R1/R2).** Eerst reader/editor-kosten zichtbaar maken; daarna pas nieuwe Reception-mogelijkheden toevoegen.

Na deze gerichte stappen is er een geloofwaardig uitbreidingspad binnen de huidige architectuur. De data-, module- en publicatiegrenzen zijn voldoende bruikbaar om op voort te bouwen; de nieuwe owner-reader en de toepassing van gedeelde CSS zijn de onderdelen die nu nog niet even betrouwbaar zijn.

## 7. Reproduceren en evidence

Uitvoeren vanuit de genoemde checkout:

```powershell
node --test src/profileDiscovery/applicationNavigation.test.js src/profileDocument/domain/receptionPresentation.test.js scripts/productionBuild.test.js
node scripts/runBrowserTests.mjs reception-editor owner-profile-routing reception-card
node docs/audits/2026-10-27/reception-boundaries-audit/probes.mjs
node docs/audits/2026-10-27/reception-boundaries-audit/analyze.mjs
npm run test:browser:production
```

Gebruik voor nieuwe browserruns een eigen `INSCAPE_BROWSER_REPORT` en `INSCAPE_BROWSER_OUTPUT`; de runner overschrijft geen bestaande selectie. De auditprobes documenteren het defect zoals gevonden: een “geslaagde” probe betekent **reproductie**, niet dat het productgedrag correct is. De auditfixture en scripts zijn nieuw bewijs onder docs, geen nieuwe productie-entry of permanente testacceptatie.

[Checks en logs][folder] · [95 unit-/boundarytests: gerichte log][focused] / [aangrenzende log][adjacent] · [browserresultaten][browserresults] / [aanvullende browserresultaten][adjacentresults] · [startupresultaten][startup] · [probes][probes] · [stylingmetingen][styleprobe] · [bundels/CSS][analysis].

[preservation]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/preservation-check.json>
[remote]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/remote-checks.json>
[remotechecks]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/remote-check-diagnostics.json>
[app]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/App.jsx:195>
[navigation]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/profileDiscovery/useApplicationNavigation.js:56>
[overview]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/profileDocument/components/ProfileOverview.jsx:17>
[owner]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/OwnerReception.jsx:11>
[boundary]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/systemWorkflow/ProfileEditingBoundary.jsx:11>
[lease]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/systemWorkflow/profileEditorLease.js:7>
[scopehost]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/ReceptionStoreEditor.jsx:4>
[scope]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/systemWorkflow/systemWorkflowDraftStore.js:403>
[commands]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/receptionSession.js:7>
[layout]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/receptionLayout.js:1>
[persist]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/systemWorkflow/systemWorkflowDraftStore.js:582>
[collection]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/systemWorkflow/domain/workbenchCollection.js:38>
[library]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/library/useProfileLibrary.js:20>
[workbenchlibrary]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/public/ownerSystemWorkflow/useOwnerWorkbenchLibrary.js:7>
[textadapter]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/ReceptionTextEditor.jsx:10>
[textsession]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/text/textEditSession.js:5>
[color]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/colour/CommittedColourControls.jsx:6>
[imagesource]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/imageModule/imageLibrarySide.js:5>
[imagewrapper]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/ReceptionCanvas.jsx:29>
[content]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/useReceptionContent.js:7>
[publishui]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/public/ownerSystemWorkflow/OwnerSystemWorkflowPublicationRack.jsx:55>
[publishbuilder]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/profileDocument/domain/canvasPublication.js:27>
[projection]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/profileDocument/domain/receptionPresentation.js:60>
[v9builder]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/profileDocument/domain/profileDocumentV9Builder.js:194>
[canvas]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/ReceptionCanvas.jsx:48>
[frametools]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/ReceptionFrameTools.jsx:5>
[publicgate]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/profileDocument/components/PublishedProfileBoundary.jsx:51>
[app225]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/App.jsx:225>
[owner15]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/OwnerReception.jsx:15>
[owner13]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/OwnerReception.jsx:13>
[saved36]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/OwnerReception.jsx:36>
[store245]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/systemWorkflow/systemWorkflowDraftStore.js:245>
[owner54]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/OwnerReception.jsx:54>
[owner25]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/OwnerReception.jsx:25>
[backup]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/systemWorkflow/WorkbenchBackupControls.jsx:49>
[focus15]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/ReceptionControls.jsx:15>
[focusshared]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/public/useDeferredFocusReturn.js:5>
[editor155]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/ReceptionEditor.jsx:155>
[chrome50]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/public/ownerSystemWorkflow/workbenchToolChrome.css:50>
[titlecss]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/text/text.css:79>
[mobile112]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/reception.css:112>
[chrome38]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/public/ownerSystemWorkflow/workbenchToolChrome.css:38>
[panel7]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/public/ownerSystemWorkflow/workbenchToolPanel.css:7>
[region80]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/ReceptionCanvas.jsx:80>
[image75]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/imageModule/ImageArtwork.jsx:75>
[owner6]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/OwnerReception.jsx:6>
[budgetcalc]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/scripts/productionBuild.js:460>
[graphguard]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/scripts/ownerRuntimeIsolation.js:1>
[asyncimage]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/receptionSession.js:45>
[gesture]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/src/reception/useReceptionGesture.js:5>
[probes]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/probe-results.json>
[blockedshot]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/probes/local-draft-blocked-by-public-state.png>
[staleshot]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/probes/stale-owner-reader.png>
[restoreshot]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/probes/recovery-still-shows-error.png>
[styleprobe]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/authored-text-and-chrome.json>
[editshot]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/probes/text-editor-chrome.png>
[readshot]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/probes/text-reader-chrome.png>
[mobileshot]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/probes/mobile-control-sizes.png>
[analysis]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/bundle-and-css.json>
[wide]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/browser-verified/reception-editor/public-1440-carbon.png>
[narrow]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/browser-verified/reception-editor/public-390-mist.png>
[toolsimage]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/browser-verified/reception-editor/mobile-cell-tools.png>
[folder]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/>
[focused]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/focused-verified.log>
[adjacent]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/adjacent-boundaries.log>
[browserresults]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/browser-verified/results.json>
[adjacentresults]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/adjacent-browser/results.json>
[startup]: <C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/remediation-2026-10-19-shared-checkpoint/work/docs/audits/2026-10-27/reception-boundaries-audit/production-startup/results.json>


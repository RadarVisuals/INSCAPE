# Neutrale opkuis na de designsysteemmigratie

Uitgevoerd op 23 oktober 2026 in `remediation-2026-10-19-shared-checkpoint/work`,
branch `codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`.
Dit verslag beschrijft de aanvullende opkuis na `technical-cleanup.md`.
De vergelijking gebruikt de lokale toestand bij aanvang van deze ronde, inclusief
alle eerdere onopgeslagen migratiewijzigingen. Er is niets gecommit, gepusht of gedeployed.

## Opdracht en resultaat

Alleen technische opkuis, met behoud van het bestaande uiterlijk en gedrag.
De custom Identity/profile card is beschermd: alle 11 bestanden onder
`src/public/identity/` zijn byte voor byte ongewijzigd.

- Ongebruikte selectors voor verdwenen inspectors, Discover-workspace, oude
  Layers-bediening, oude tekstbediening en referentiehulpelementen verwijderd.
- De Library-regels uit de grote workflowstylesheet naar `libraryWorkspace.css`
  verplaatst. De werkende selectorvoorrang en laadvolgorde zijn behouden.
  De niet meer bereikbare variant zonder Library-chrome en zijn 13 regels zijn verwijderd.
- Gemeenschappelijke vensterstructuur gescheiden van uitsluitend tactile
  materiaalregels; flat vensters hoeven die materiaalwaarden niet eerst te erven.
- Aangrenzende dubbele regels en overschreven declaraties samengevoegd.
- Ongebruikte props en doorgeefketens bij Display, shortcuts, groepsnavigatie
  en Text verwijderd, evenals ongebruikte referentie-imports en lokale variabelen.
- De gegenereerde designsysteeminventaris bijgewerkt.

Netto verdwenen **115 CSS-regels en 17.654 bytes** uit 11 stylesheets.
De task-delta omvat 44 bestaande bestanden, inclusief tests en de gegenereerde inventaris.
Details en Identity-hashes staan in [change-summary.json](neutral-cleanup-evidence/change-summary.json).

## Controle

| Controle | Resultaat |
| --- | --- |
| Complete unit-suite | 1.313 geslaagd, 0 mislukt |
| Gezamenlijke gerichte browserregressie | 115 geslaagd, 0 mislukt |
| Aanvullende Identity lifecycle-test | 1 geslaagd, 0 mislukt |
| Inventaris en broncontrole na laatste opmaak | 5 geslaagd; inventaris actueel |
| Productiebuild en buildcontrole | Geslaagd binnen bestaande budgetten |
| Vergelijking app en referentie | 208 toestanden; 0 verschillen in gemeten styling en geometrie |

De browserregressie omvat Library-organisatie, opslag en filters; sidebar en
bestemmingen; metadata; Text; gedeelde Color/Transform; Image, Shape en FX;
docken, stapelen, verplaatsen en toetsenbordbediening; Identity en focusherstel.
Er zijn geen wallettransacties, uploads of publicaties uitgevoerd.

De visuele vergelijking gebruikt Carbon en Mist op 1440×900, 390×844, 844×390
en 320×320. Ook actieve tabs, focus op velden en resizebediening zijn vergeleken.
Volledige screenshots bevatten soms verschil door ladende/bewegende compositie-inhoud
of rasterafronding; daarom wordt geen volledige pixelidentiteit van alle screenshots
geclaimd. De 16 Identity-screenshots hadden 12 exacte matches; de overige vier
verschilden slechts op 2 of 79 pixels met maximaal één kleurstap.
De Identity-bronbestanden en gemeten vensterwaarden zijn exact gelijk.

## Bijgewerkte tests

Oude aannames over de ontbrekende Info-tab, docknamen, bewaarde actieve tabs,
de inventarislengte en de vroegere avatar-clip zijn aangepast aan de bestaande app.
Dubbel voorkomende labels in de referentie worden nu binnen het bedoelde voorbeeld gezocht.
Theme-menu's worden na het scrollen geopend, zodat een vertraagd scrollevent de
test niet onbedoeld sluit.

Identity-tests sluiten overlappende artworktools via hun echte bediening of
gebruiken ondersteunde toetsenbordacties. Geen geforceerde klikken, verborgen
vensters via test-CSS of wijzigingen aan de app om tests te laten slagen.
Eén verouderde test die een identieke inventaris eiste tussen de vroegere
gecombineerde Properties-referentie en de huidige opgesplitste app is verwijderd.
De afzonderlijke referentievoorbeelden en de actuele gedeelde tools houden hun
gedragscontroles.

## Bewust behouden

Actieve bevel-, tactile- en flat-varianten hebben nog echte gebruikers. Onder meer
Identity, authored modulevensters en de expliciet behouden Properties-referentie
blijven bestaan. Dynamisch gemaakte resize-, toolbar-, grid- en Activity-klassen,
editorclasses en technische typografiehulpen zijn geen dode selectors.
De onafhankelijke controllers voor camera, vensters en authored inhoud zijn niet gewijzigd.

Het bestaande versmallen van het Library-zoekveld bij focus en overlap tussen
onafhankelijke vensters op smalle schermen blijven aanwezig. Dit zijn afzonderlijke
gedrags-/ontwerpkwesties en vallen buiten de uitdrukkelijke opdracht om niets
zichtbaars of functioneels te veranderen. Deze opkuis claimt geen nieuwe volledige
architectuurdoorlichting of verwijdering van iedere mogelijke duplicatie in de hele repository.

## Bewijs

- [Unit-tests](neutral-cleanup-evidence/unit-final.log)
- [Browserregressie](neutral-cleanup-evidence/browser-final.log)
- [Identity lifecycle](neutral-cleanup-evidence/identity-lifecycle.log)
- [Productiebuild](neutral-cleanup-evidence/build.log) en [buildcontrole](neutral-cleanup-evidence/build-check.json)
- [88 venstervergelijkingen](neutral-cleanup-evidence/window-parity.json)
- [120 toestandvergelijkingen](neutral-cleanup-evidence/state-parity.json)
- [Library voor](neutral-cleanup-evidence/library-before.png) / [na](neutral-cleanup-evidence/library-after.png)
- [Identity voor](neutral-cleanup-evidence/identity-before.png) / [na](neutral-cleanup-evidence/identity-after.png)
- [Color voor](neutral-cleanup-evidence/color-before.png) / [na](neutral-cleanup-evidence/color-after.png)
- [Referentie voor](neutral-cleanup-evidence/reference-before.png) / [na](neutral-cleanup-evidence/reference-after.png)

De vier volledige stijlmetingen zijn als gecomprimeerde JSON in dezelfde bewijsmap
bewaard. Tussentijdse screenshots en scripts staan in de genegeerde map
`.browser-test-runtime/neutral-cleanup/`; de oorspronkelijke lokale snapshot is behouden.
Deze resultaten betreffen deze lokale werkboom; remote CI en deployment bevatten
deze wijzigingen niet automatisch.

## Aanvullende broncontrole en opkuis

De daaropvolgende broncontrole vond nog ongebruikte onderdelen buiten de eerdere
selectie. De founder heeft ook deze opkuis goedgekeurd, met behoud van uiterlijk
en werking. Deze aanvullende ronde gebruikt een nieuwe snapshot van de lokale
werkboom; de eerdere vergelijking hierboven blijft een afzonderlijk historisch resultaat.

- De onbereikbare oude artworkviewer, bijbehorende plaatsingsbediening en uitsluitend
  daarvoor gebruikte metadata- en layoutcode zijn verwijderd. De geometrie en
  animatiehulpen die de huidige Display nog gebruikt, blijven behouden.
- Oude Library-vensterregels, achtergebleven viewerregels in gedeelde stylesheets,
  ongebruikte doorgeefcode en exportbestanden zijn verwijderd. Overschreven
  declaraties zijn opgeruimd zonder de werkende selectorvoorrang te veranderen.
- Tests voor verwijderde onderdelen zijn vervallen. Actuele Library-tests houden
  rekening met de bestaande sidebar, tooltabs, actieve kleur en huidige indeling.
  Routetests gebruiken de bestaande knopnamen Connect, Connect profile en Disconnect.
  De oorspronkelijke Library-fouten zijn ook op de snapshot van vóór deze ronde vastgesteld.
- De zelfstandige designsysteemexport bleek te struikelen over top-level await
  in zijn testpagina. Die initialisatie staat nu in één async functie met dezelfde
  volgorde; de browserdoelgroep en productie-app zijn niet aangepast.

Deze ronde wijzigt **56 bestaande bron-, test- en inventarisbestanden**, waarvan
**21 verwijderd**, en verwijdert netto **173.416 bytes en 262 CSS-regels**.
Alle **11 custom Identity-bronbestanden blijven byte voor byte gelijk**.
De actuele importcontrole vindt buiten app en referentie uitsluitend de bewust
alleen door tests gebruikte filled-Workbench-fixture. Dynamische classes en
actief gebruikte flat-, tactile- en bevel-materialen blijven behouden.

Controle: **1.256 unit-tests, 53 browserchecks en 10 designsysteemtests geslaagd**.
De productiebuild, buildbudgetcontrole, inventariscontrole en zelfstandige
designsysteembuild slagen. **88 schermtoestanden** in Carbon en Mist op
1920×1080, 390×844, 844×390 en 320×320 geven **nul verschillen in gemeten styling
en geometrie**; 71 volledige screenshots zijn pixelidentiek. Bewegende of
asynchroon ladende compositie-inhoud verklaart waarom niet alle volledige beelden
pixelidentiek zijn. Dit is geen bewijs dat iedere mogelijke ongebruikte declaratie
in de hele repository afwezig is. Er is niets gecommit, gepusht of gedeployed.

Het [aanvullende bewijs](residual-cleanup-evidence/summary.json) bevat de exacte
[bestandsdelta en Identity-hashes](residual-cleanup-evidence/changes.json),
[visuele vergelijking](residual-cleanup-evidence/visual-parity.json), bronanalyse,
testlogs, buildlogs en enkele voor-/na-beelden.

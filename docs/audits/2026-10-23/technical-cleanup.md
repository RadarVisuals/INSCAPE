# Technische opruiming — behoud van styling en werkwijze

23 oktober 2026. Alleen lokaal, ongecommit. Uitgangspunt is de opgeslagen,
al gewijzigde werkmap bij aanvang van deze opruiming, niet Git HEAD.

De uiteindelijke wijziging verwijdert ongebruikte onderdelen en overbodige
doorgegeven gegevens. Alle behouden CSS-bestanden en alle bestanden van de
custom Identity-kaart zijn byte voor byte gelijk aan de startsituatie.
Er zijn geen zichtbare stijlwijzigingen, nieuwe gebruikershandelingen of
gedragsreparaties toegevoegd. De eerder onderzochte CSS-consolidatie is volledig
teruggezet; ook de bestaande Library-focusfout is behouden.

## Werkelijk verwijderd

- De ongebruikte `OwnerSystemWorkflowDiscoverWorkspace`, zijn uitsluitend daar
  gebruikte sidebarfuncties en de ongebruikte Create-dialog. Discover gebruikt
  al `PublicEntryPortal`; die route is niet veranderd.
- De nergens geïmporteerde `DisplayMetadataCard` en zijn eigen ongebruikte
  stylesheet. De actieve Info-presentatie en de gebruikte inspectiehooks blijven.
- De uitsluitend voor het oude Discover-pad bestemde ontwikkelstate,
  groepscommando's en `reviewDiscovery`-props, inclusief overbodige fixtureprops.
  De fixturegegevens zelf blijven beschikbaar voor de huidige portaltests.
- Ongelezen props van `OwnerSystemWorkflowPanelLayer`, enkele ongebruikte imports
  en de alleen door de verwijderde kaart gebruikte `compactView`-variant van
  `MetadataCreator`. Het gebruikte standaardresultaat blijft gelijk.

Zes bestaande brontekst-/modeltests zijn aangepast aan de reeds aanwezige
implementatie of de verwijderde component. Daarbij is geen productiegedrag
veranderd. De design-systeminventaris is opnieuw gegenereerd en gecontroleerd.
De exacte wijzigingen tegenover de startsnapshot staan in
[changes-from-start.json](technical-cleanup-evidence/changes-from-start.json).

## Bewust behouden

De actieve cascade in `ownerSystemWorkflow.css`, `workflowTactile.css`,
`workflowFlat.css`, `workbenchToolChrome.css`, `workbenchWindowChrome.css` en
de overige stylesheets is niet herschikt, samengevoegd of aangepast. De bestaande
bevelvariant heeft nog actieve gebruikers, waaronder Identity en authored modules.
`OwnerSystemWorkflowSelectionInspector` is nog gebruikt door Display en de
referentie. Dynamische klassefamilies, resizehandvatten, navigatiestatus en
bewuste weglatingen via destructuring zijn geen automatisch verwijderbare code.

Dit is dus geen claim dat alle oude CSS is verdwenen. Verdere cascadeopruiming
is niet uitgevoerd binnen de strikte grens van deze ronde.

## Vergelijking vóór en na

- 48 schermtoestanden: tools, Library, Settings, Profile en de **echte custom
  Identity-kaart**, zowel ingeklapt als uitgeklapt. Carbon en Mist; 1440×900,
  390×844, 844×390 en 320×320.
- Geen verschil in de gemeten DOM-inhoud, afmetingen en berekende stijlen van
  de gecontroleerde onderdelen. Alle 16 Identity-afbeeldingen zijn pixelgelijk.
- Zeven eerste volledige schermvergelijkingen bevatten verschillen door nog
  ladende canvasmodules. Acht gerichte herhalingen wachten expliciet op die
  modules en op de geopende Library. Ook daar zijn afmetingen en stijlen gelijk.
  De resterende verschillen zitten in de Navigator-miniatuur: 11 pixels bij
  Carbon breed en 77 pixels met één kleurwaarde verschil bij Carbon laag.
  Daarom wordt geen absolute pixelgelijkheid van iedere canvasminiatuur geclaimd.
- De startsituatie is voor herhalingen via een afzonderlijke lokale server uit
  de eigen startsnapshot gelezen. De actuele bronbestanden zijn daarvoor niet
  opnieuw gewijzigd. Op het kleinste formaat gebruikt de opname de bestaande
  toetsenbordactie voor sluiten/uitklappen; dit bewijst geen vrije muisklikruimte.

Zie [bestands-hashes](technical-cleanup-evidence/style-and-identity-hashes.json),
[eerste vergelijking](technical-cleanup-evidence/parity-summary.json) en
[herhaling](technical-cleanup-evidence/parity-settled-summary.json).

## Gedraaide controles

| Controle | Uitkomst |
| --- | --- |
| Volledige `npm test` | 1.313 geslaagd, geen overgeslagen tests |
| Design-systemtests | 10 geslaagd; onderdeel van de volledige suite |
| Inventaris genereren en controleren | Geslaagd: 83 bestanden, 595 definities, 301 namen |
| Workbench-browsercontroles | 126 geslaagd, 11 mislukt |
| Design-systembrowsercontroles | 29 geslaagd, 4 mislukt |
| Aanvullende bestemmingsintegratie | 2 publicatiebevestigingen geslaagd, 1 oude lifecyclecheck mislukt |
| Productiebuild en `build:check` | Beide geslaagd; geen budget verhoogd |

De 16 mislukte browserchecks zijn afzonderlijk tegen de startsituatie uitgevoerd
en falen daar eveneens. De browsercontrole is **niet volledig groen**. Zie de
[vergelijking van mislukkingen](technical-cleanup-evidence/browser-baseline-comparison.json).

| Onderdeel | Actuele dekking en beperking |
| --- | --- |
| Layers, Transform, Color, docking | Geslaagd: selectie, ordening, undo, slepen, losmaken, hergroeperen en herstel |
| Image, Shape, FX | Gedeeltelijk geslaagd; vier oude tests verwachten de tabrij zonder Info of navigeren daardoor naar de verkeerde tab |
| Info | Zeven controles geslaagd, waaronder brongegevens, Display, losmaken en beide thema's |
| Text | Brede scenario's geslaagd; twee smalle scenario's vinden de Carbon-optie niet |
| Navigator, Keeper, Sidebar | Gerichte bewegings-, viewport-, navigatie- en persistentiecontroles geslaagd |
| Library en editorvoorkeuren | Geteste opslag, venster- en voorkeurstromen geslaagd; bestaande focus-layoutfout niet gerepareerd |
| Settings, Activity, Discover | Gerichte actuele suites geslaagd, inclusief smalle/lage weergave en herstel |
| Publish, Docs, Profile, Grids | Bestemmingsvensters en Grid-acties geslaagd; bevestigde publicatie door refresh geslaagd op breed en smal scherm |
| Custom profielkaart | 16 pixelgelijke vergelijkingen; animatiecontinuïteit en gepubliceerde Identity geslaagd. Vijf oudere integratietests worden nog door overlappende tools/controls geblokkeerd |
| Groups en Index, Owner/Visitor | Gerichte bewerking, tijdelijke bezoekersnavigatie, opslag en herstel geslaagd |
| Design-systemreferentie | 29 geslaagd; vier oude controles hebben dubbele control-locators, een verouderd aantal of een niet gevonden oude control |

De aanvullende oude lifecyclecheck verwacht nog een expliciete `clip-path` op
de compacte Profile-avatar; zowel vóór als na is die `none`. Hiervoor is geen
CSS toegevoegd. Evenmin zijn vensters verplaatst of bediening aangepast om
oude tests groen te maken.

De eerste volledige unittestrun had vijf fouten: vier verouderde verwachtingen
en een overschrijding van het bestaande gzip-budget. De uiteindelijke volledige
run slaagt. De productiebuild heeft 822.520 bytes initiële JavaScript
(239.284 gzip) en 2.518.172 bytes core-JavaScript (808.624 gzip).
De normale build stuitte eerst op een sandbox-leesbeperking; dezelfde lokale
build buiten die beperking slaagde. Bestaande chunk-/dependencywaarschuwingen
zijn niet onderdrukt. Publicatietests gebruiken gecontroleerde fixtures.

## Status en grenzen

Checkout: `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. De vele reeds aanwezige lokale
wijzigingen zijn behouden. De geraadpleegde succesvolle
[CI-run voor die commit](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131)
bewijst niets over de ongecommitteerde werkmap. Geen nieuwe externe CI- of
deploymentsuccessen worden geclaimd.

Geen commit, push, upload, walletactie of deployment. De volledige releasecheck
en productie-browserstartup zijn niet uitgevoerd. Dit verslag is bewijs van
de beperkte lokale opruiming, geen releasegoedkeuring of claim dat alle
bestaande browserproblemen zijn opgelost.

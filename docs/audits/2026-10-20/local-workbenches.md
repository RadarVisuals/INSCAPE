# Eerste lokale stap met benoemde Workbenches

20 oktober 2026. Expliciete makeropdracht: voer de lokale stap met twee
benoemde Workbenches uit; test onafhankelijk opslaan, wisselen en herladen;
behoud bestaande wijzigingen en de Keeper-proef. Geen commit, push of deploy.

## Resultaat en bediening

Rechtsboven in de eigenaar-Workbench staan de actieve naam, **New** en
**Rename**. De bestaande compositie blijft behouden bij het eerste benoemen
of aanmaken. Een nieuwe Workbench heeft een leeg canvas, met de gedeelde
Library en Keeper beschikbaar. Wisselen bewaart de vertrekkende layout;
herladen opent de laatst opgeslagen actieve Workbench.

De browserproef gebruikt **Lunar Desert** en **Studies**, elk met eigen Text
en verschillende canvasafmetingen. Dit zijn geïsoleerde testgegevens op een
afzonderlijke lokale origin; de persoonlijke browseropslag is niet vervangen
of aangevuld met testcomposities.

De grens is maximaal acht lokale Workbenches, 512 KiB gevalideerde draft
per compositie inclusief gedeelde gegevens, en maximaal 4 MiB voor de
collectie. Browserquota kunnen eerder bereikt zijn; een mislukte opslag
houdt de huidige compositie open.

## Verantwoordelijkheden en vereenvoudiging

- Eén gevalideerd profielrecord bezit de compositielijst, actieve ID en
  gedeelde identiteit, Reception-instellingen en Keeper-configuratie.
- Iedere compositie bezit naam, stabiele ID, modules, canvasafmetingen en
  authored layout. De bestaande module-API krijgt een afgeleide actieve
  draft; er is geen tweede mutabele opgeslagen kopie van die draft.
- De eerdere impliciete profielgrens voor geschiedenis en layoutcache is
  vervangen door profiel plus Workbench. Undo/Redo blijft tijdens deze
  editorsessie bij de bijbehorende compositie.
- Een editorhandle behoort aan één activatie. Na wisselen kan hij niet
  schrijven, herstellen of Undo uitvoeren, ook niet na A → B → A.
- Lokale layoutcache blijft een afgeleide weergave, gevalideerd tegen de
  canonieke layout. Bij wisselen gaat de actuele authored layout atomair
  mee met de nieuwe actieve ID. Tijdelijke camera/selectie wordt heropend;
  zij wordt geen compositie-inhoud.
- De bestaande één-editor-per-profiellease blijft de schrijfautoriteit.
  De Library krijgt geen kopie per Workbench. De proefkamer gebruikt dezelfde
  gedeelde Keeper-records via de bestaande store.

De module-API verwacht nog steeds de bestaande platte draftvorm. Dat is een
expliciete afgeleide grens, geen claim dat alle modules afzonderlijk zijn
herontworpen. Publieke projectie, selectie voor publicatie, compositielinks,
het overzicht, Layers en docking zijn vervolgwerk.

## Foutgevallen en herstel

Opslagfouten of een extern gewijzigd record accepteren geen nieuwe actieve
compositie. Ontbrekende of corrupte inhoud in een andere compositie wordt
niet als een leeg canvas opgeslagen. Herstel van een late actie wordt ook
geweigerd wanneer de extern opgeslagen actieve Workbench is veranderd.

Mislukte Text-invoer blijft herstelbaar per Workbench. Onvoltooide crops en
canvasgebaren blokkeren wisselen. Herstelmeldingen blijven zichtbaar; een
late actie uit een verlaten context kan de volgende compositie niet wijzigen.

**Download all Workbenches** exporteert beide composities en gedeelde
instellingen. Herstel benoemt de volledige vervanging. Een oude afzonderlijke
Workbench-backup kan een collectie niet ongemerkt vervangen. Additief
importeren is in deze stap niet gebouwd.

Collectiepublicatie wordt met uitleg tegengehouden. Het bestaande publieke
document met één compositie mag de lokale collectie tijdens reconciliatie
niet overschrijven. Er zijn geen uploads, walletprompts of transacties uitgevoerd.

## Verificatie

1284/1284 algemene tests geslaagd:
[volledige log](local-workbenches/unit.log). De inventariscontrole is na de
laatste CSS- en registerwijziging nog afzonderlijk geslaagd (4/4).
Productiebuild en budgetcontrole geslaagd, 822007 initiële JS-bytes:
[buildlog](local-workbenches/build.log).

30 gerichte browsertests geslaagd, verdeeld over acht suites:

| Controle | Geslaagd | Bewijs |
| --- | ---: | --- |
| Twee benoemde Workbenches, eigen inhoud/formaat, wisselen/herladen, Undo, falende opslag, Text-herstel, backupdownload, editorlease | 2 | [log](local-workbenches/local-workbenches.log) |
| Keeper-proef: bestaande beweging/camera/collision/F, autoriteit, gedeelde instelling in A/B, smal scherm | 3 | [log](local-workbenches/exploration-keeper.log) |
| Opslag/backup/herstel en twee echte tabbladen | 6 | [log](local-workbenches/workbench-storage.log) |
| Layout herladen | 2 | [log](local-workbenches/workbench-layout-reload.log) |
| Herstel na editor sluiten en layout-opslagfout | 1 | [log](local-workbenches/workbench-recovery.log) |
| Text-herstel en positie | 8 | [log](local-workbenches/text-recovery-position.log) |
| Bestaande Keeper | 3 | [log](local-workbenches/keeper.log) |
| Eigenaarroutering | 5 | [log](local-workbenches/owner-profile-routing.log) |

Storetests bewijzen aanvullend onafhankelijke Image-crops/afmetingen bij
dezelfde Library-bron, late acties na A → B → A, corrupte niet-actieve
composities, extern gewijzigd actief doel, scoped layout en volledig
backupherstel zonder gedeeltelijke vervanging.

Visueel geïnspecteerd op 1440 en 390 pixels, plus bereikbaarheid gemeten op
700 pixels. De eerste test vond overlap met de Keeper-knop linksboven.
De wisselaar staat daarom rechtsboven met vrije ruimte voor de bestaande
dock. [Breed](local-workbenches/workbenches-1440.png),
[smal](local-workbenches/workbenches-390.png),
[gedeelde Keeper op smal scherm](local-workbenches/shared-keeper-390.png).

De bestaande hersteltest opende een Text-venster over de Display-shortcut;
de fixture opent nu eerst de onderliggende shortcut en activeert Display
expliciet vóór Layers. De inhoudelijke herstelcontroles zijn behouden.
Een tussentijdse tabbladcontrole werd door live bronherladen onderbroken;
de ongewijzigde tabbladcontrole is daarna op de stabiele bronversie geslaagd.
De bronlogs van eerdere mislukte pogingen blijven in `.browser-test-runtime/`.

Dit is gerichte browserdekking, geen claim dat de volledige browsersuite
of alle toekomstige publicatie-/importscenario's zijn uitgevoerd.

## Bewaarde werkstand

Checkout `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, basis-HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`.

Alle reeds aanwezige wijzigingen blijven in dezelfde werkboom, waaronder
Reception, de Keeper-proef, wereldcamera, F-zoom, metalen botsingsranden,
ontwerpdocumentatie en oorspronkelijke referenties. Bestaande Keeper-runtime
en artwork zijn voor deze stap niet gewijzigd; de browserproef is uitgebreid.
De ontwerpinventaris is opnieuw gegenereerd met behoud van de eerdere
Reception-/Keeper-wijzigingen.

De eerder geverifieerde externe Verify-run 34 betreft alleen de basis-HEAD.
Er is geen externe CI- of deploymentclaim voor deze lokale, ongecommitte
werkboom.

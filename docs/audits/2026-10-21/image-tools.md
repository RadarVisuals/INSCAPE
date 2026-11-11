# Image-venster in het gedeelde docksysteem

Lokale wijziging op 21 oktober 2026 na de expliciete keuze “Image eerst”.
Checkout: `remediation-2026-10-19-shared-checkpoint/work`, branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`. Ongecommitteerd en niet gedeployed.
Andere bestaande wijzigingen zijn behouden. De bestaande verify-workflow is
geïnspecteerd; er is geen externe CI-run voor deze ongecommitteerde staat.

## Resultaat

Image is een vierde tab naast Layers, Transform en Color. Hetzelfde venster
kan los staan, aansluiten op andere tabs, verplaatsen, sluiten en met de
onzichtbare randen resizen. Actions → Image settings brengt de gesloten tab
terug; deze actie is onderscheiden van de bestaande Image-creatieactie.
Een selectiewijziging verandert de actieve tab niet. Een andere module of
meerdere modules toont een selectiebericht; een gesloten Image biedt openen.

De bestaande bediening staat in dezelfde volgorde: Library drop (Add side of
Replace side), zijde verwijderen en Include Image in publication. Het vorige
Image-Properties-venster is vervangen. Rotate, beide Mirror-acties, Crop,
Fit inside/Fill canvas, inspectie en dupliceren staan nog in de bestaande
toolbar. Transform houdt de afmetingen; Color biedt geen Image-kleur.
Er zijn geen nieuwe Image-instellingen toegevoegd. Shape en Text zijn in deze
stap niet naar een nieuwe tooltab gemigreerd. Dockindeling blijft sessiestaat.

## Eigenaarschap en grenzen

`ImageWorkbench.jsx` levert de bestaande controles via `useWorkbenchToolSource`,
dezelfde bestaande selectiebron die Color al gebruikt. De Image-module behoudt
de geselecteerde zijde, dropmodus, lopende asynchrone drop en invalidatie,
opslaan, opslagfouten, Undo en publicatiekeuze. Het dock ontvangt alleen de
bediening. Geen tweede module- of inhoudsstore is toegevoegd.

`WorkbenchSharedTools` toont die Image-bron voor de huidige selectie.
`ContextToolContent` levert voor Image alleen nog de bestaande actie- en
fit/cropbalken. Een actiefout, waaronder een opslagfout bij Fit of Crop, blijft
naast de toolbar zichtbaar, ook wanneer de Image-tab verborgen is. Een fout
van de Image-instellingen verschijnt alleen naast die instellingen. De gemigreerde paneelinhoud is
verwijderd uit het oude Properties-pad. De andere gebruikers van dat pad
behouden hun huidige venster.

De algemene dockindeling, gestures, focusherstel en venstergeometrie zijn
hergebruikt. Deze wijziging bouwt geen nieuw vensterframework en is geen
algemene architectuur- of performanceclaim. Tests die bewust de eerdere
drie-tabindeling onderzoeken verbergen eerst Image; de nieuwe Image-tests
beginnen met de werkelijke standaardindeling van vier tabs.

## Gedrags- en beeldcontrole

De nieuwe browsergevallen gebruiken geïsoleerde fixturedata achter de gewone
editor/reconciliatiegrens op de bestaande lokale server, poort 24970. Geen
gebruikerscompositie, upload, wallet of echte publicatie is aangeraakt.

Gecontroleerd: standaard vier tabs, één Image-controlinstantie, Image-Properties
verdwenen, dropmodus tijdelijk en per Image behouden bij selectie/docking,
publicatiekeuze alleen voor het bedoelde Image-record, zijde verwijderen,
Undo, mislukte opslag met herstel, toolbarplaatsing, Crop/Cancel, sluiten en
terughalen, losmaken en samenvoegen, resizen, gesloten Image openen en
retargeten naar Shape zonder oude Image-bediening achter te laten.

Mist bij 1440 × 1000 en Carbon bij 760 × 620 zijn bekeken. De onafhankelijke
Image is ook tot de bestaande minimummaat verkleind. Labels, vier tabs,
sluitknop, select en checkbox passen; de beelden hieronder tonen de werkelijke
productiecomponenten met fixturedata.

![Image in het gedeelde dock](image-tools/image-mist-docked.png)
![Image als zelfstandig venster](image-tools/image-mist-independent.png)
![Compact Image-dock in Carbon](image-tools/image-carbon-narrow.png)

## Definitieve controles

- `npm test`: **1.309/1.309 geslaagd**, inclusief de echte productiebuild naar
  een afwijkende outputmap. [Log](image-tools/unit-final.log).
- Gerichte browserreeks: **12/12 geslaagd** voor Image-tools, Image-fit,
  dockinteracties, gedeelde Transform/Color, Color-focus en Text/Article-tools.
  [Log](image-tools/acceptance-final.log).
- Design-system-inventaris opnieuw gegenereerd; **10/10 checks geslaagd**.
  [Log](image-tools/design-system.log).
- `npm run build -- --configLoader native` en `npm run build:check` geslaagd.
  De native configloader is de bestaande lokale Windows-aanpak.
  [Build](image-tools/build.log), [budgetcontrole](image-tools/build-check.log)
  en [bundlerapport](image-tools/bundle-report.json).
- De drie bovenstaande screenshots zijn opnieuw bekeken na de definitieve
  browserreeks: geen afgesneden tablabels of bediening, geen horizontale
  overflow in het compacte Image-paneel.

De eerste bredere browserreeks ontdekte dat Fit-opslagfouten door het verwijderen
van de oude Properties-inhoud niet meer zichtbaar waren. Dat is hersteld door
de bestaande Image-fout aan de oorspronkelijke bediening te koppelen:
actiefouten in de toolbar, instellingsfouten in Image. De mislukte Fit-opslag
wordt nu ook met verborgen Image-tab gecontroleerd; een instellingsfout krijgt
geen tweede melding in de toolbar.

De eerste volledige testreeks overschreed de bestaande core-gzipgrens bij de
afwijkende outputbuild met 178 bytes (793.178 tegenover 793.000). Alleen deze
grens is voor de nieuwe Image-toolrouting verhoogd tot 794.000 bytes; alle
andere plafonds blijven gelijk aan de staat vóór deze stap. De definitieve
native build meet 2.475.400 raw / 792.526 gzip core-JavaScript en
822.889 raw / 239.436 gzip initiële JavaScript. Er is weinig core-budgetruimte;
dit is geen performanceverbetering of hernieuwde algemene performanceclaim.

Dit is een lokale, ongecommitteerde wijziging. Geen externe CI, volledige
browserreleasecontrole, deployment, upload of walletactie is uitgevoerd.
De gerichte fixtures dekken de genoemde productiecomponenten en overgangen;
zij vervangen geen volledige end-to-end publicatiecontrole. Bij een al geopende
sessie is één herlaadactie nodig om de nieuwe standaardindeling met vier tabs
te initialiseren. Er is geen tijdelijke hot-reloadmigratie toegevoegd.

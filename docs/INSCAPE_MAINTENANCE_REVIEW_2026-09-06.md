# Onderhoudsronde — 6 september 2026

Technisch werkverslag, geen nieuwe productrichting. Scope: de recent gewijzigde
Library-drag, Stage-plaatsing, shortcut-iconen en Grid-overgangen. De actieve
contract- en creative-intent-documenten blijven leidend.

## Vervolg na akkoord: Library naar compositie

- Tijdens slepen onderscheidt de bestaande plaatsingspreview nu expliciet
  `Release to add layer` en `Release to replace icon`. Ook een shortcut krijgt
  een preview van de gekozen afbeelding, inclusief wanneer de compositie vergrendeld is.
- Geslaagde plaatsing selecteert de nieuwe laag via de gedeelde controller,
  zodat Stage en Layers dezelfde nieuwe selectie tonen. Pointer-drop,
  dubbelklik en native drop gebruiken deze controlleractie. Mislukte plaatsing
  verandert de selectie niet.
- Het onderstaande recovery-voorstel is inmiddels uitgevoerd na gebruikersakkoord:
  de bestaande begrensde buildpruning sluit de gekopieerde recovery-map uit.
  `public/recovery` blijft onaangetast en lokaal beschikbaar; `dist/recovery`
  ontbreekt. Er is geen deployment uitgevoerd. Eventuele externe gebruikers
  van oude productie-URLs zijn niet geverifieerd.
- `npm run build` en `npm run build:check` slagen nu met ongewijzigde budgetten.
  De gerichte build- en plaatsingstests, Library-, shortcut- en annuleringschecks
  slagen. Selectie na pointer-drop en dubbelklik is in de browser gecontroleerd,
  evenals screenshots op 1440, 1024 en 700 px. De volledige suite is niet gedraaid.

De onderstaande buildblokkade beschrijft de meting vóór dit vervolg.

## Aangepast

- Escape annuleert een actieve Library-drag en houdt de Library open. Sluiten,
  wisselen van Grid/profiel en wijziging van de compositievergrendeling maken
  oude plaatsingsaanvragen ongeldig. Een late afbeeldingsdecode kan daardoor
  niet alsnog plaatsen. Dit geldt ook voor de native drop-route.
- Pointer-drag, native drop en dubbelklik bouwen hun plaatsingsaanvraag met
  dezelfde kleine helper. De gekozen afbeelding, eventuele opgeloste fallback,
  afmetingen en oorspronkelijke tokenidentiteit blijven bij elkaar.
- Een paneel boven de Stage is geen geldig drop-oppervlak voor de Stage.
  De oude controle keek alleen naar de rechthoek van de onderliggende Stage.
- Een shortcut blijft binnen de Workbench als de Library of vensterbreedte
  de beschikbare ruimte verandert. Een gekozen icoon blijft lokaal; de
  compositievergrendeling verhindert het vervangen van dat icoon niet.
- Bij continu afspelen wordt ook de scène ná de volgende Grid alvast gemount.
  Zonder rust tussen scènes moet die eerder laden dan bij een handmatige swipe.
  De cache blijft beperkt tot de huidige scène en benodigde buren; er wordt
  geen volledige documentgalerij gemount.

Geen schemawijzigingen, uploads, walletacties, deployments of verwijdering van
gebruikersbestanden. Bestaande veranderingen buiten deze scope zijn behouden.

## Verificatie

De 24 gerichte unittests zijn geslaagd. De gevulde-scènetest registreerde
717 frames op 2044 px breed en 921 frames op 390 px breed: geen blootliggende
achtergrondpixels in die 1.638 frames. De Library-, shortcut- en
annuleringschecks zijn eveneens geslaagd. Screenshots op brede en smalle
viewports zijn visueel gecontroleerd. `git diff --check` meldt geen fouten.

De browserchecks gebruiken echte pointer-bewegingen en controleren onder meer:

- gekozen Library-afbeelding naar Stage, behoud na herladen en in Preview;
- gekozen afbeelding naar shortcut terwijl de compositie vergrendeld is,
  behoud na herladen en ongewijzigde canonieke draft;
- Escape tijdens slepen, sluiten tijdens vertraagde decode en vergrendelen
  terwijl een native drop nog op afbeeldingsafmetingen wacht;
- volledig gevulde 4096 × 2304 PNG-scènes, transparante WebP-lagen in brede,
  vierkante en hoge plaatsingsrechthoeken, snelle richtingswissels en automatische
  Grid 4 → HOME-overgang; frame-opnames controleren daadwerkelijk blootliggende
  achtergrondpixels, niet alleen aanwezigheid van DOM-elementen;
- eerder toegevoegde seam-, playback- en tijdelijke laagzichtbaarheidchecks.

Screenshots staan lokaal in `.browser-test-runtime/`. De tijdelijke testkleur
onder het artwork en de fixture-aanpassingen worden uitsluitend in de
testbrowser toegepast. De gebruikersdraft wordt niet voor tests geopend.

## Buildblokkade: bevinding en voorstel

De productiecode compileert. De bestaande assetbudgetcontrole blokkeert de
build op de volgende bestanden, onafhankelijk van bovenstaande UI-wijzigingen:

| Meting | Bytes | Limiet |
| --- | ---: | ---: |
| Gepubliceerde statische assets in de huidige build | 252.829.315 | 15.200.000 |
| `public/recovery` / gekopieerde `dist/recovery` | 238.412.600 | — |
| Grootste bestand: `recovery/images/5.webp` | 4.169.702 | 2.700.000 |
| Statische assets zonder de recovery-map, berekend | 14.416.715 | 15.200.000 |
| Grootste bestand buiten recovery: `assets/stage/mountains/mountain_03.webp` | 2.574.306 | 2.700.000 |

De recovery-map bevat 204 bestanden. De recovery-interface wordt alleen in
development geladen, maar Vite kopieert bestanden uit `public` ook naar de
productie-output. Het uitschakelen van de development-route sluit die bestanden
dus niet uit. De bestaande buildpruning verwijdert al andere ongebruikte
authoring-assets uit de gegenereerde output; daardoor is alleen de grootte van
de bronmap meten niet voldoende om de budgetcontrole te verklaren.

**Voorstel voor een afzonderlijke wijziging:** sluit `recovery` aan op de
bestaande, begrensde uitsluiting van development-assets uit productie-output.
Behoud alle originele herstelbestanden en hun lokale development-URLs. Test
dat ze lokaal beschikbaar blijven en niet in de productie-output terechtkomen.
Controleer vóór die wijziging of er een externe afhankelijkheid van de
productie-URL `/recovery/` bestaat. Dit voorstel is niet uitgevoerd; budgetten
zijn niet verhoogd en originele assets zijn niet aangepast.

## Grenzen van deze ronde

Geen live wallet-, LUKSO-, publicatie- of deploymentvalidatie. De browserchecks
lopen in Edge met lokale fixtures, niet in de bestaande browsersessie van de
eigenaar. Mobiele browsers en touch-apparaten zijn niet fysiek getest. De
volledige repositorytestsuite is geen releasecheck in deze ronde; gerichte
unit- en browserchecks dekken de gewijzigde grenzen.

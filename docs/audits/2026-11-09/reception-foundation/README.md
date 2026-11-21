# Reception — voorbereidende editorverbeteringen

Datum: 9 november 2026. Lokale implementatie na de gerichte Reception-review en
de toestemming van de oprichter om de aanbevolen verbeteringen uit te voeren.
Branch: `codex/profile-work-index-2026-10-30`; basis-HEAD:
`08b4a7b871084780bafc89ad08404ca901e61f17`.

De bestaande ongecommitteerde wijzigingen zijn behouden. Deze ronde heeft geen
commit, push, publicatie of deployment uitgevoerd. De aparte E:-checkout en de
beschermde handoff zijn niet gebruikt.

## Gewijzigd gedrag

- **Move to cell** in Layers verplaatst bestaande native lagen
  naar een gekozen cel. De selectie wordt als geheel gecentreerd; IDs, inhoud,
  afmetingen, onderlinge offsets en eigen publicatievlaggen blijven behouden.
  De bestaande celachtergrond-volgorderegel houdt achtergronden achter hun inhoud.
- **Move out of cell** verwijdert de celrelatie en behoudt de wereldpositie.
  De bestaande reconciler past zo nodig de minimummaat voor zelfstandige modules
  toe, bijvoorbeeld 180 px breedte voor een zelfstandig tekstvak.
- Verplaatsing gebruikt de bestaande Reception-scope, generatiecontrole,
  opslagbevestiging en geschiedenis. De selectie wisselt pas van bewerkingscel
  nadat de opslag is geaccepteerd. Een klik naar de huidige cel is een no-op.
- Een intersecterend groepsanker wordt losgemaakt zonder de achterblijvende
  lagen opnieuw te centreren. Vergrendelde lagen en vergrendelde deelnemers aan
  zo'n anker blokkeren de operatie. Fit-to-text reist mee; oude relatieve
  telefoonplaatsingen worden verwijderd voor de verplaatste lagen, zodat de
  bestaande reader ze uit de nieuwe cel afleidt.
- **Contents** gebruikt de opgeslagen artwork-volgorde, bovenste laag eerst,
  overeenkomstig Layers. Er is geen tweede opgeslagen volgorde toegevoegd.
- Maatvelden bewaren hun tijdelijke invoer afzonderlijk. Ongewijzigde afgeronde
  weergave schrijft geen wijziging terug. Blur/Enter herstelt na normalisatie of
  opslagfout de werkelijk geaccepteerde waarde; Escape annuleert de invoer.

## Verantwoordelijkheden en opruiming

De eigendomswijziging zit in `receptionCellMembership.js` en wordt uitsluitend
via de bestaande `editBento`-transactie uitgevoerd. Het centreren hergebruikt
`positionReceptionMembers`; het opschonen van verwijzingen hergebruikt
`pruneCellMembers`; achtergrondvolgorde hergebruikt `backgroundsBehindContents`.
De bediening gebruikt het bestaande gedeelde SelectMenu in Layers. Een eerste
variant met dezelfde actie in het objectmenu is teruggenomen: één menuroute
volstaat en houdt de productiebuild binnen het bestaande bundelbudget.

De oude toevoegvolgorde in Contents en de ongecontroleerde waarde/blur-logica
van CellNumber zijn vervangen. Bestaande laagreordering blijft onafhankelijk:
een drag naar een andere cel is nog steeds geen impliciete eigendomswijziging.
Geen nieuwe afhankelijkheid, CSS-regel, documentversie, opgeslagen geometriekopie
of animatieruntime toegevoegd. Bronverwijzingen zijn na de wijziging gecontroleerd.

[before/](../../../../../../reception-foundation-2026-11-09/before/)
bewaart uitsluitend de relevante eerdere werkbestanden, niet alleen HEAD, zodat
deze ronde van het reeds aanwezige werk te onderscheiden is.
[changes-final.json](../../../../../../reception-foundation-2026-11-09/changes-final.json)
bevat de incrementele regelaantallen en bronhashes.
De baseline voor `receptionEditorDocument.js` is achteraf gereconstrueerd door
uitsluitend het in deze ronde toegevoegde `export` terug te nemen.

## Uitgevoerde en open verificatie

Uitgevoerd op de laatste productiecode; bewijs staat buiten de applicatie-
broninventaris in
[reception-foundation-2026-11-09](../../../../../../reception-foundation-2026-11-09/):

- `npm run lint`: groen, 570 bronbestanden; 46 bestaande geregistreerde
  hookobservaties, geen toegevoegde uitzondering.
- `npm run typecheck`: groen; de bestaande contractchecks blijven behouden.
- Gerichte Reception-scope/document/Bento/geometrie- en gedeelde laagtests:
  **92/92 geslaagd**, niets overgeslagen. De eerste run vond een onnodige
  generatieverhoging bij een ongewijzigde Reception; de scope retourneert nu
  zonder commit als de uiteindelijke canonieke Reception ongewijzigd is.
- Complete browsersuite `reception-native-editor`: **35/35 geslaagd**, niets
  overgeslagen, procesopruiming bevestigd. De drie nieuwe gevallen controleren
  echte menubediening op 1440 px Dark en 900 px Light, Contents/Layers-volgorde,
  focusherstel, Undo/Redo, reload, opslagfouten en precieze maatinvoer.
  Beide screenshots van de nieuwe bediening zijn visueel bekeken.
- Twee bestaande verwachtingen in die suite zijn bijgewerkt: een extra rij
  behoudt het vaste Bento-formaat van 1200 × 400; na mislukte opslag toont het
  maatveld de opgeslagen waarde 48 in plaats van het geweigerde voorstel 64.
  De controles op geometrie, foutmelding, geschiedenis en reload blijven staan.
- Complete browsersuite `reception-layer-order`: **3/3 geslaagd** na de latere
  testopruiming. De vergelijking wacht nu op het zichtbare tekstoppervlak van
  ieder afzonderlijk tekstvak voordat zij stijl en transformatie leest; de
  oorspronkelijke fout was een te vroege meting. Alle assertions op lagen,
  clipping, tekstweergave, privé-inhoud en opgeslagen geometrie blijven behouden.
  [Hertest en bronidentiteit](../../../../../../test-cleanup-2026-11-09/first/browser.json).
  Procesopruiming is bevestigd.
- `npm run build` en `npm run build:check`: groen met ongewijzigde plafonds.
  Core JavaScript: 2.743.652 bytes raw / 905.276 gzip; raw plafond 2.744.000,
  dus **348 bytes marge**. De eerste variant overschreed raw met 436 bytes;
  de dubbele menuroute is verwijderd voordat opnieuw is gebouwd.
- `node --check` voor de nieuwe eigendomsoperatie en beide gewijzigde testbestanden:
  groen. Dit controleert syntaxis en voert geen tests uit.
- `git diff --check` voor de getroffen paden: groen.
- Incrementele bronvergelijking en controle van gedeelde consumers: uitgevoerd.

De drie nieuwe domeingevallen dekken verplaatsing, Undo/Redo, reload, isolatie
van gewone canvassen, vergrendeling, verouderde generaties, opslagfouten en
vrijmaken van tekst. Eerste mislukte runs zijn bewaard. Een eerste browserstart
weigerde bewijs binnen de broninventaris; de volgende had een verkeerd lokaal
Chrome-pad. Na correctie van het pad is de echte browsercontrole uitgevoerd.

De definitieve native-editor-run staat in
[browser-final/browser.json](../../../../../../reception-foundation-2026-11-09/browser-final/browser.json).
De eerdere run met het toen falende layer-order-resultaat en de bekeken screenshots staat
in [browser-chrome/](../../../../../../reception-foundation-2026-11-09/browser-chrome/).
De overige controles staan in `unit-final.log`, `lint-final.log`, `typecheck.log`,
`build-final.log` en `budget.log` in dezelfde bewijsmap.

Eerdere GitHub-controles voor basis-HEAD gaven geen commit-statussen of
PR-workflowruns terug; ze keuren deze lokale wijzigingen evenmin goed.
Er is geen volledige applicatietestrun of releasecontrole uitgevoerd.

## Volgende fase

Dit is de eerste voorbereidende ronde. Animatietoestanden, samengestelde ouder-
en kindtransforms en de compacte/open profielkaartproef
zijn nog niet geïmplementeerd. De bestaande native IDs en celrelaties vormen het
aansluitpunt; de huidige tijdelijke sleeptransforms zijn geen tijdlijnmodel.
De oprichter heeft "Text doesn't fit" op 8 november expliciet afgewezen en laten
verwijderen. De eerdere suggestie om overflowwaarschuwingen
toe te voegen vervalt; die waarschuwing wordt niet teruggebracht.

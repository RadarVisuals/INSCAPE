# Herstel van lokale Workbench-voorkeuren

Zelf uitgevoerd door één agent, zonder nieuwe auditronde. Lokaal, niet gecommit,
gepusht of gedeployed. De bestaande gebruikersserver bleef beschikbaar.

## Opgelost

`workbenchPreferences.js` slikte schrijffouten in. Runtime schreef bovendien na
het openen automatisch terug, ook wanneer het lezen van de opgeslagen kopie was
mislukt. Nu blijven mislukte leesbewerkingen zichtbaar en blijft die kopie intact
tot de gebruiker expliciet de huidige voorkeuren opslaat.

Workbench-voorkeuren hebben een eigenaar op profielniveau. De laatst gekozen
waarden blijven actief bij een schrijffout en tijdens compositiewissels. Een
herstelknop schrijft die actuele waarden opnieuw. Externe wijzigingen en verloren
schrijfrechten worden gecontroleerd; callbacks van een afgesloten profiel kunnen
niet meer schrijven. De waarschuwing blijft staan zolang het opslaan mislukt.

De bestaande beveiliging van editorvoorkeuren is ondergebracht in
`localPreferencesStore.js` en wordt door beide concrete voorkeurenrecords gebruikt.
Keys, formaten, inhoud en normalisatie blijven bij hun bestaande eigenaren.
Workbench-instellingen schrijven direct; editorvensters behouden hun bestaande
korte batchinterval en flush vóór leasevrijgave. De oude Runtime-opslageffectcode
is verwijderd. Compositie-inhoud en publicatie vallen buiten deze wijziging.

Layout- en voorkeurenfouten staan in één bestaande meldingscontainer, met een
eigen herstelknop per fout. Zo bedekken de knoppen elkaar niet bij gelijktijdige
problemen. Geen CSS of normale productbediening gewijzigd.

## Verificatie

- 28 gerichte unitchecks geslaagd: bestaande voorkeuren, snapping, editoropslag,
  quota-/leesfouten, onleesbare records, externe wijzigingen, verloren bevoegdheid,
  profielisolatie en afwijzen van callbacks na afsluiten.
- Vier browserscenario's geslaagd: onafhankelijke herstelknoppen op 1440 en
  390 pixels, expliciete vervanging van een beschadigd record en behoud tijdens
  compositiewisselen. Opslag na retry en herladen gecontroleerd. De eerste drie
  scenario's controleren ook dat de opgeslagen compositie-inhoud gelijk blijft.
- Screenshots van de twee gelijktijdige foutmeldingen op breed en smal formaat
  bekeken; beide herstelacties zijn bereikbaar en staan onder elkaar.
- Lint geslaagd: 467 bronbestanden, 92 bestaande gemotiveerde observaties.
  Typecontractcontrole geslaagd: 17 ongeldige aanroepen en 3 mutaties afgewezen.
- Build en build:check geslaagd binnen ongewijzigde limieten. Core-JavaScript:
  2.515.967 raw / 809.140 gzip bytes (limieten 2.519.500 / 809.500).

De eerste twee browserpogingen bevatten fouten in de nieuwe testopzet: wachten
op alle paginabronnen, verkeerde formulierlabels, een nog niet gemounte sidebar,
en het tegelijk vrijgeven van twee gesimuleerde opslagfouten. Dat laatste liet
een bestaande automatische editorflush vóór de retryklik slagen. De definitieve
test wacht op de UI en heft fouten afzonderlijk op. Geen productiecode is voor
die testcorrecties aangepast. De eerdere logs blijven als tussenstand bewaard.

Bewijs: [workbench-preferences-2026-10-24](../../../../../technical-regie-2026-10-23/continuation/workbench-preferences-2026-10-24/),
met `browser-verified/results.json` als definitieve browseruitkomst.

Geen volledige release-/appmatrix uitgevoerd. Bij blijvend onbeschikbare opslag
blijven wijzigingen alleen in de open sessie beschikbaar; de melding zegt daarom
het venster open te houden. Dit voegt geen cloudopslag of automatische conflictoplossing toe.

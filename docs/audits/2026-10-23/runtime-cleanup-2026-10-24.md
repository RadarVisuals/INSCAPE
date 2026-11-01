# Centrale runtime: uitvoering op 24 oktober

**Historische tussenstand.** De buildblokkade hieronder is inmiddels opgelost en
twee aanvullende verantwoordelijkheden zijn afgescheiden. Zie de
[opvolgende uitvoering](runtime-boundaries-2026-10-24.md) voor de actuele uitkomst.

Uitgevoerd door één agent op verzoek van de founder. Geen nieuwe auditdelegatie,
geen volledige herhaling van de app-testmatrix. Lokaal, niet gecommit of gepusht.

## Verandering

De werkende `OwnerSystemWorkflowRuntime.jsx` is opgesplitst in zes concrete grenzen:

| Bestand | Verantwoordelijkheid |
| --- | --- |
| `OwnerWorkbenchSession.jsx` | Profiel, backupherstel en compositiewissel bepalen de levensduur van de editor; voorkeuren worden vóór leasevrijgave geflusht. |
| `useWorkbenchModuleRegistry.js` | Tijdelijke rapporten en invoerdoelen van gemounte modules; zeven identieke registratieroutines delen één helper. Display behoudt zijn afwijkende null/undefined-contract. |
| `useOwnerWorkbenchLibrary.js` | Library-inventaris, verwijzingen en afgeleide afbeeldingsafmetingen. Ontwikkeldata en bijbehorende memo-afhankelijkheden blijven buiten productie. |
| `prepareWorkbenchPreview.js` | Documentvoorbereiding vanuit de vastgelegde compositie. Bestaande request-eigenaar bewaakt annuleren, wijzigingen en focus. |
| `workbenchCommands.js` | Eén dispatcher voor toolbar en contextmenu, met gedeelde foutafhandeling voor moduleoperaties. Bestaande modules bewaren validatie, opslag en Undo. |
| `OwnerWorkbenchModules.jsx` | Bestaande modulehosts en lazy loading, met dezelfde DOM-volgorde en Suspense-grenzen. |

De oude implementaties zijn uit Runtime verwijderd. Geen tweede selectie-, opslag-
of module-inhoudsmodel toegevoegd. CSS en productfuncties zijn niet gewijzigd.
Runtime ging van 1.460 naar 904 regels; de winst zit in de begrensde verantwoordelijkheden,
niet in een verplicht regelaantal. Runtime beheert nog de koppeling tussen providers,
chroom, presentatieprojectie en acties die meerdere oppervlakken raken.

De eerder voorbereide ontwikkel-Library-grens is toegepast: testcategoriecommando's
worden niet meer in de productiecode opgenomen. De buildcontrole weigert hun concrete
markers in uitgegeven JavaScript. De productie-limieten zijn ongewijzigd.

## Gerichte controle

- 26 bestaande gerichte unitchecks geslaagd; één nieuwe artifactgrens-check geslaagd.
- Typecontractcontrole geslaagd, inclusief afwijzing van ongeldige aanroepen/mutaties.
- Lint geslaagd: 464 bronbestanden, 92 bestaande gemotiveerde observaties.
  De Runtime-uitzondering is opgelost. Alleen de al beoordeelde selectie-v4-observatie
  in WorkbenchView is aan zijn actuele bron en regelnummer gekoppeld.
- Eerste browsercontrole: 27/27 geslaagd, geen skips: composities opslaan/wisselen/
  Undo/herladen, preview/cancel/stale-resultaat, Library, toolbar en behouden Displays.
- Na de aanvullende vereenvoudiging zijn alleen registratie, Library en commando's
  opnieuw gecontroleerd: **19/19 geslaagd**, geen skips. Dit zijn gerichte hercontroles
  van bestaande scenario's, geen 19 extra unieke scenario's.
- Brede Carbon- en smalle Mist-screenshots van toolbar/Add visueel bekeken.
  Geen claim van een pixelvergelijking of volledige visuele appdekking.

## Open grens

De productiebuild compileert de gewijzigde bron, maar **build en build:check falen**
op de bestaande totale core-JavaScript-gzipgrens: **809.764 > 809.500 bytes (+264)**.
De raw-grens slaagt (2.518.923 van 2.519.500 bytes). Er is geen limiet verhoogd,
functionaliteit verwijderd of mislukte check als geslaagd gerapporteerd.
Deze lokale verbetering is daarom geen groene release en geen voltooiing van alle
dertig stappen. De overige eerder open werkpunten zijn met deze opdracht niet afgedaan.

Bronkopie, logs, screenshots en definitieve bronidentiteiten:
[runtime-2026-10-24](../../../../../technical-regie-2026-10-23/continuation/runtime-2026-10-24/).

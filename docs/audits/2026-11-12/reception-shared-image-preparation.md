# Reception: gedeelde voorbereiding van rasterbeelden

Status: lokaal uitgevoerd; niet gecommit, gepusht, gedeployd of gepubliceerd.

## Eigenaarschap en vervanging

De gedeelde worker bestond al, maar elk gemount Image maakte na de workerrespons
zelf een object-URL en decodeerde die nogmaals voor zijn eigen weergave.
Editor en Preview konden daardoor dezelfde bron opnieuw downloaden/resizen en
ieder een eigen tijdelijke URL houden.

imagePaintQueue bezit nu zowel pending werk als de gedecodeerde tijdelijke URL.
Een bron/resolutiecombinatie heeft een gedeelde voorbereiding met expliciete
gebruikers. De client blijft eigenaar van zijn aanvraag en kan annuleren of
sluiten zonder andere gebruikers van hetzelfde beeld te onderbreken.

- Gelijke pending aanvragen worden samengevoegd; resultaten worden eenmaal
  gedecodeerd en via dezelfde URL aan actuele gebruikers geleverd.
- Een kleinere weergave mag een reeds beschikbare, voldoende grote afgeleide
  gebruiken. Vergroten krijgt nooit een te kleine bron als eindresultaat.
- De hook herstelt eerst de oorspronkelijke bron en laat vervolgens zijn lease
  los. Daardoor kan een gedeelde URL niet worden ingetrokken terwijl een andere
  gemounte gebruiker haar nog nodig heeft.
- De laatste gebruiker trekt de URL in en verwijdert de entry. Er is geen
  idle/persistent cache; de hoeveelheid actieve entries is begrensd door de
  gemounte aanvragen. Na de laatste client stopt ook de worker.
- Afgesloten of vervangen aanvragen krijgen geen late callbacks. Oude workers
  kunnen niet in een nieuwe workerlevensduur publiceren. Pending annulering,
  decodefouten en workerfouten laten de oorspronkelijke mediaweergave intact.
- Mislukte/ongeschikte voorbereidingen blijven niet als negatieve cache bestaan;
  een latere echte retry kan opnieuw aanvragen.

De oude per-Image object-URLaanmaak, tweede decode, pendingUrl en URL-revocation
zijn uit usePreparedImageArtwork verwijderd. De bestaande generatiecontrole,
resolutieobservatie en originele bron blijven aanwezig. De workerinhoud is
bytegelijk aan de snapshot bij de start van deze stap: bestaande lokale
wijzigingen en de guards op formaat, animatie, kleurprofiel, EXIF, bytes en pixels
zijn behouden. SVG en andere uitgesloten formaten gebruiken hun bestaande pad.

Er zijn geen dependencies, voorkeuren, schema's, opslag- of IPFS-wijzigingen.
Native load/retry-status per Image blijft afzonderlijk; deze stap deelt de
optionele paintvoorbereiding, niet iedere browserdecode of netwerkrequest.

## Productiegecompileerde browservergelijking

Evidence: output/reception-shared-image-preparation-2026-11-12/ui-comparison.json.
De bestaande mixed-16-fixture bevat 16 afbeeldingen met twee herhaalde WebPs,
16 teksten met elk 24 paragrafen en vaste tekstframes. Het is geen proef met
16 unieke mediabestanden en geen veld-, CDN- of telefoonbenchmark.

Voor-build: output/reception-performance-2026-11-12T19-28-04-005Z/dist.
Na-build: output/reception-performance-2026-11-12T19-37-05-022Z/dist.
De manifesten verschillen alleen in de twee runtimebestanden, de nieuwe test,
de eerder bijgewerkte gegenereerde CSS-inventaris en de vorige auditnotitie.

Beide builds werden in afzonderlijke disposable loopback-origins via dezelfde
HTTP-testserver/probe geopend. De fixture gebruikt in beide dezelfde publieke
HTTPS-WebPs, zoals bij de eerdere navigatorproef; productievalidatie is niet
versoepeld en geen browsertrust is aangepast. Er zijn geen gebruikersdrafts
gelezen of bewerkt. De probe telt live object-URLs, gecodeerde Blob-bytes,
worker-preparejobs en workers; dit zijn geen exacte decoded/GPU-geheugenmetingen.

| Afgeronde fase | Oude object-URLs / Blob-bytes | Nieuwe object-URLs / Blob-bytes |
| --- | ---: | ---: |
| Editor | 16 / 483.192 | 2 / 60.399 |
| Preview open | 32 / 966.384 | 2 / 60.399 |
| Terug in Editor | 16 / 483.192 | 2 / 60.399 |
| Nieuwe Editor na 200% zoom | niet herhaald | 2 / 195.882 |
| Nieuwe compositie gesloten | niet afgelezen | 0 / 0 |

Bij Preview ging de oude teller van 17 naar 33 workerjobs; de nieuwe bleef op
4. Die 4 bevatten ook geannuleerde opstartvoorbereiding; het zijn geen vier
blijvende bronnen. Alle 32 gemounte beeldweergaven gebruikten na voorbereiding
de twee gedeelde URLs. Op 200% zoom waren alle 16 Editor-beelden ready en werden
grotere afgeleiden aangemaakt. De celinspectie gebruikte aantoonbaar de originele
HTTPS-WebP. Na sluiting: nul worker, nul object-URLs en nul Image-elementen.
Het opgeslagen testdocument bleef gelijk en de aangepaste proef had geen
console-errors. De twee testtabs en eigen servers zijn gesloten.

## Checks en grenzen

- 9 nieuwe gerichte queuetests: deduplicatie Editor/Preview, voldoende resolutie,
  sourcewissels, gedeeltelijke annulering, late decode/workerresponses, fallback,
  retry, workercreatiefout en volledige opruiming.
- Volledige npm-testselectie: **1854/1854 geslaagd**, nul fouten of skips.
- Lint geslaagd: 579 bronbestanden; dezelfde 46 bestaande hookobservaties.
- Productiebuild en afzonderlijke build-check geslaagd; bundelplafonds behouden
  en initial JS 726.263 bytes.
- Performancefixture gecompileerd en alle drie documenten gevalideerd.
- Diff-whitespacecontrole geslaagd.

Geen nieuwe latency-, GPU-geheugen- of algemene netwerkbesparingsclaim. De winst
is aantoonbaar minder paintvoorbereiding en minder levende gecodeerde Blob-
bronnen in deze fixture. Aanvraaggroottes kunnen tussen composities verschillen;
een Preview die meer detail nodig heeft, mag terecht extra voorbereiding vragen.

Ten opzichte van de bij aanvang opgeslagen bestanden: productiecode 97 regels
toegevoegd en 48 verwijderd; de groei zit in gedeelde leases, deduplicatie en
fout-/lifecycleafhandeling. Tests en deze notitie staan daar los van. De
voorgaande navigator- en draftkopie-optimalisaties zijn behouden.

# Reception: een beschermde kopie na draftvalidatie

De volledige validatie en het directe opslagpad blijven behouden. Een geldige
kandidaat werd achtereenvolgens volledig gekopieerd door twee opruimfuncties.
De eerste kopie beschermt de invoer en geschiedenis; de tweede was overbodig.

Draftvalidatie laat de opruiming van verwijderde interfacevelden nu werken op
de al losgekoppelde kopie van de artwork-opruiming. De aparte collectiegrens
blijft de bestaande copying wrapper gebruiken, omdat die nog wel een eigen
beschermde kopie nodig heeft. Beide paden delen dezelfde opruimimplementatie.
Er is geen tweede opslagautoriteit, cache, debounce of alternatieve validatie.

De wijziging raakt twee productiebestanden en twee aanroepen: de muterende
opruimfunctie is expliciet beperkt tot eigen, losgekoppelde gegevens. Twee
regressietests controleren volledige detachment, bevroren invoer, beide families
van verwijderde velden, precies een kopie en afwijzing van ongeldige gegevens
voordat normalisatie kan plaatsvinden.

## Afgebakende meting

Evidence: output/reception-draft-copy-optimization-2026-11-12/before.json en
after.json; script measure-validation.mjs in dezelfde map. Node 24.20.0,
dezelfde mixed-16 Reception-fixture als eerder, nu als pure draft-validatieproef.
158.041 JSON-bytes, 16 afbeeldingen en 16 teksten van elk 24 paragrafen,
40 warmupvalidaties gevolgd door vijf batches van 100 validaties.

| Meting | Voor | Na |
| --- | ---: | ---: |
| Validaties | 500 | 500 |
| structuredClone-aanroepen | 1000 | 500 |
| Mediane tijd per 100 validaties | 535,8ms | 296,5ms |

Dit is circa 45% minder tijd in deze lokale validatieproef. Het is geen claim
van 45% snellere toetsaanslagen of van een algemene prestatiewinst op elk device.
De volledige invoer bleef in beide runs bytegelijk. Metingen gebeurden voor
het starten van builds en tests; alle gewijzigde bronhashes zijn vastgelegd.

## Controle

- 193/193 gerichte tests geslaagd: validatie, collecties, store-isolatie,
  geschiedenis, save boundaries, tekstsession, tekstedit-session en Reception-scope.
- Lint geslaagd: 579 bronbestanden, dezelfde 46 bestaande hookobservaties.
- Productiebuild geslaagd met native configloader, inclusief bundelplafonds.
- Afzonderlijke build-check geslaagd: 726.263 initial JS bytes.
- Diff-whitespacecontrole geslaagd.

De eerste brede reeks gaf 1844/1845 geslaagde tests. De enige fout was de
verouderde gegenereerde CSS-inventaris na eerdere frame-/grainwijzigingen.
De inventaris is opnieuw gegenereerd en vergeleken: 98 naar 100 CSS-bestanden;
710 definities en 395 namen blijven gelijk. Geen definitiewaarden, scopes of
referenties veranderden, alleen bronregistratie, hashes en regelnummers.
De volledige reeks slaagt daarna: **1845/1845 tests**, nul fouten of skips.
Log: output/reception-draft-copy-optimization-2026-11-12/all-unit-tests-final.log.

Een nieuwe productiegecompileerde browserproef is geprobeerd, maar startte
geen browserproces (spawn UNKNOWN):
output/reception-performance-2026-11-12T19-28-04-005Z/report.json.
Er zijn daardoor geen nieuwe browser-timingresultaten of typelatencyclaims.
De compile van de performancefixture slaagde; er zijn geen permissies of
beveiligingsinstellingen gewijzigd. De pure validatiemeting hierboven is
afzonderlijk succesvol uitgevoerd.
Brede store-reconciliatie, rendering en mediavoorbereiding blijven afzonderlijke
optimalisatiekandidaten. Deze ingreep verandert de IPFS-publicatiestructuur niet.

Alle wijzigingen zijn lokaal, niet gecommit, gepusht of gepubliceerd. De
bestaande gebruikerswijzigingen en de navigator-optimalisatie zijn behouden.
De oorspronkelijke drie bestanden zijn voor deze stap apart vastgelegd onder
output/reception-draft-copy-optimization-2026-11-12/*.before.

Productiecode: 8 regels toegevoegd en 3 verwijderd. Tests: 37 regels toegevoegd.
De gegenereerde inventaris en deze auditnotitie zijn afzonderlijke niet-runtimewijzigingen.

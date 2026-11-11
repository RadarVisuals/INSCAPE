# Eerste gezamenlijke integratiecontrole

23 oktober 2026. De uitgevoerde lokale tranche bestaat uit de browsersuitecatalogus,
evidence-routing, acht ongebruikte exports en de begrensde Image-recoveryreparatie.
Dit is geen afronding van het dertigstappenplan en geen groene releaseverklaring.
De uitvoeringsstatus staat uitsluitend in
[code-quality-progress.json](../../2026-10-23/code-quality-progress.json).

## Werkelijke uitkomst

| Controle | Resultaat |
| --- | --- |
| Catalogus | Alle 229 bestanden verantwoord; 91 geselecteerd voor release |
| Volledige unit-suite | 1.260 geslaagd, 0 failures/skips/cancellations |
| Standards | 5 geslaagd |
| Gegenereerde stijlinventaris | Geslaagd |
| Productiebuild en bestaand bundelbudget | Geslaagd |
| Productie-opstart na build | 1 geslaagd |
| Afzonderlijke designsysteembuild | Geslaagd |
| Gerichte browserintegratie | Alle 34 suites uitgevoerd: 179 TAP-resultaten, 175 geslaagd, 4 mislukt, 0 skips/cancellations |
| Bron tijdens de hele uitvoering | Ongewijzigd; begin- en eindhash gelijk |

De 34 suites zijn alle 25 nieuwe release-items plus negen bestaande suites voor
composities, opslag, Library-drag/drop, Activity en artwork/herstel. Alle negen
behouden suites slagen: samen 54 tests. Van de 25 nieuwe items slagen 22 suites;
drie suites blijven rood. Dit is niet de volledige nieuwe selectie van 91 suites.
De volledige CI-duur inclusief installatie is nog niet gemeten.

De browserfase duurde 547,231 seconden; de hele gerichte verificatie ongeveer
tien minuten. De opzet behoudt iedere failure en stopt niet na de eerste rode
browsersuite. De verifier retourneerde terecht exitcode 1.

## Drie concrete open scenario's

| Suite | Waarneming en volgende handeling | Plan |
| --- | --- | --- |
| `startup` | De ownercasus met vertraagde runtime vindt op regel 165 geen `.startveil` meer. Tien subtests slagen; de ene falende subtest en zijn parent leveren twee rode TAP-resultaten. Maak leasevertraging in de bestaande fixture deterministisch terwijl de runtimegate gesloten blijft. Leg readiness en zichtbare bestemming per fase vast; bevestig of de tijdelijke accesscontrole te vroeg gereed meldt. Dit is een onmiddellijke begrensde vervolgtaak, zonder op een grote runtime-refactor te wachten. Oorzaak en oorsprong zijn nog niet runtime-bewezen. | 02, 03, 19, 26 |
| `workbench-destinations` | De eerste casus bereikt een uitgeschakelde Focus-knop op regel 82. De helper combineert `focus()` en synthetische Shift+Enter in één evaluatie. Herhaal met afzonderlijke gebruikershandelingen en registreer selectie na elke stap; behoud camera-, Back-, frame- en opslagassertions. De andere twee cases slagen. | 02, 11, 26 |
| `workbench-shape-tools` | De brede casus slaagt. De smalle casus vindt na Home/End/pijltoetsen op regel 121 geen `Close Shape`. De test controleert tabpositie, maar legt daar niet de actieve tab en werkelijk gefocuste knop vast. Herhaal met die toestand en een screenshot na elke toets; stel vast of focus/activatie of de verwachting verkeerd is. Geen selectorvervanging zonder die verklaring. | 02, 12, 16, 26 |

De drie suites zijn voor het eerst in deze tranche uitgevoerd. Ze waren niet
onderdeel van de oorspronkelijke 66-suite-nulmeting. Ze worden daarom niet zonder
bewijs bestempeld als al bestaande fouten of als regressies van deze wijziging.
Hun tests blijven verplicht geselecteerd. De oorspronkelijke 57 baselinefailures
zijn niet door deze beperktere run opnieuw beoordeeld of als opgelost aangemerkt.

## Integratieproblemen die wel zijn opgelost

De eerste poging (`integration-01`) faalde na de unit-suite op twee controles:
de gegenereerde CSS-inventaris was verouderd en de core-JavaScript gzipomvang was
809.507 bytes bij een grens van 809.500. Deze mislukte run blijft bewaard.

De inventaris is opnieuw gegenereerd en inhoudelijk vergeleken: uitsluitend de
hash/regelposities/verwijzingen van `src/imageModule/imageModule.css` veranderden;
79 bestanden, 570 definities en 290 namen blijven gelijk. Vier inventaristests slagen.
De nieuwe Image-laadpoging bewaart niet langer de bron-URL dubbel in lokale state
en normaliseert dezelfde URL niet opnieuw bij het tekenen. De componentkey blijft
de bron en poging afbakenen. De gemeten core-gzipomvang is nu 809.470 bytes.
Het budget is ongewijzigd en heeft slechts 30 bytes marge; dit is geen substantiële
prestatieverbetering of algemene ruimte voor nieuwe features.

De onafhankelijke v5-review vindt geen regressie in die vereenvoudiging. De
Image-recoverytests slagen opnieuw binnen de gezamenlijke run, inclusief bronwissels,
late resultaten, crop/Inspect, flips, owner/Visitor en 24 schermrandgevallen.
De parent heeft vier opgeslagen beelden op brede/smalle schermen en boven/onderranden
visueel bekeken. Dit bewijst de genoemde gevallen, niet iedere mogelijke paneelopstelling.

## Reproduceerbaarheid en bewijs

Checkout: `remediation-2026-10-19-shared-checkpoint/work`; branch
`codex/audit-checkpoint-2026-10-19`, HEAD
`32d9418843d996afc2e5203afa4552a6cd2d459a`, met lokale wijzigingen.
Runtime: Node v24.20.0, Windows x64, Chrome via de bestaande browseromgeving.
Bronhash van `integration-02`:
`4e873582e0da1a6c28af050b952271d1f7da9cb93f3dca85e81429d1f7d3b302`.
Lockfilehash:
`209d29b36abfad4f8f31f1ecebb8ecbdc9591d291eba54abb80176416258fa1d`.
Geen expliciete VITE-configuratie. Start 16:41:53.774 UTC, einde 16:51:53.390 UTC.

Uitvoering vanuit de appcheckout:

```text
node <support-root>/verify-integration.mjs <support-root>/verification/integration-02
```

`<support-root>` is `C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/technical-regie-2026-10-23`.
Het script importeert de bestaande verifier en draait alle niet-browsergates,
de designsysteembuild en de expliciete 34-suite-selectie. Het schrijft een eindhash.

- [Exacte gates, commando-implementatie en bronidentiteit](../../../../../../technical-regie-2026-10-23/verification/integration-02/verification.json)
- [Alle browseruitkomsten en naastliggende logs/beelden](../../../../../../technical-regie-2026-10-23/verification/integration-02/browser/results.json)
- [Exacte selectie en bronstabiliteit](../../../../../../technical-regie-2026-10-23/verification/integration-02/scope.json)
- [Bestandsdelta tegenover de vastgelegde vuile nulmeting](../../../../../../technical-regie-2026-10-23/verification/integration-02/delta-from-baseline.json)
- [Bewaarde eerste mislukte poging](../../../../../../technical-regie-2026-10-23/verification/integration-01/verification.json)
- [Onafhankelijke Image-review](../../../../../../technical-regie-2026-10-23/reviews/test-coverage/recovery-review.md)
- [Onafhankelijke catalogusreview](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/integration-review.md)
- [Gerichte startupdiagnose en gecontroleerde reproductiestap](../../../../../../technical-regie-2026-10-23/reviews/test-coverage/startup-integration-triage.md)
- [Late baseline-triage en afzonderlijke bestemmingsbevinding](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/late-baseline-triage.md)
- [Hercontrole van de zeven verwijderbestanden en verdwenen symbolen](../../../../../../technical-regie-2026-10-23/verification/integration-02/removal-preservation.json)
- [Bundelvereenvoudiging, exacte delta en gerichte hercontrole](../../../../../../technical-regie-2026-10-23/reviews/baseline-failures/bundle-followup/README.md)

Na de bronfreeze zijn deze rapportage en de voortgangstekst bijgewerkt. De laatste
diffcontrole vond bovendien één lege eindregel die na exportverwijdering was
achtergebleven in `profileDocumentV9Reconciliation.js`. Alleen die twee CRLF-bytes
zijn verwijderd; de uitvoerbare bytes zijn gelijk. [Exacte formaatdelta en controle](../../../../../../technical-regie-2026-10-23/verification/integration-02/formatting/result.json).
De gerichte `git diff --check` slaagt daarna. De testhash identificeert de bevroren
bron vóór deze documentatie- en whitespaceaanvulling; er is geen gedragwijziging
na de gezamenlijke controle gedaan.
Er is niets gecommit, gepusht, geüpload of gedeployed. De grote runtime-/selectiegrenzen,
CSS-opruiming en overige architectuurstappen zijn hiermee niet afgerond.

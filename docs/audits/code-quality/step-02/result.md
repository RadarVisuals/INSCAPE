# Nulmeting van de actuele lokale bron

23 oktober 2026. De bestaande volledige verificatie is uitgevoerd vóór de
technische bronwijzigingen. Het resultaat is **niet geschikt als groene release**.
Dit verslag houdt de originele fouten intact.

| Controle | Werkelijk resultaat |
| --- | --- |
| `npm test` binnen `npm run verify` | 1.256 geslaagd; geen failures, skips of cancellations |
| Bestaande browserselectie | Alle 66 suites uitgevoerd: 275 checks, 218 geslaagd, 57 mislukt, geen skips/cancellations |
| Suites als geheel | 36 geslaagd, 30 mislukt |
| Standards | 5 geslaagd |
| Design-system inventory | Geslaagd; dit is geen browserinteractietest |
| Productiebuild en bundelcontrole | Geslaagd |
| Productie-opstart | 1 geslaagd |

De browserfase duurde 1.248,438 seconden (20 minuten 48 seconden). De oorspronkelijke
verifier stopte daarna volgens zijn bestaande contract. De vijf resterende stappen
zijn afzonderlijk uitgevoerd tegen dezelfde bron, met dezelfde verifier; ze zijn
niet achteraf als onderdeel van de mislukte run gepresenteerd.

## Reproduceerbare bron en opdrachten

- Checkout: `remediation-2026-10-19-shared-checkpoint/work`.
- Branch: `codex/audit-checkpoint-2026-10-19`.
- HEAD: `32d9418843d996afc2e5203afa4552a6cd2d459a`; de werkboom bevat lokale wijzigingen.
- Node: `v24.20.0`, Windows x64.
- Browser: `C:/Program Files (x86)/Google/Chrome/Application/chrome.exe`.
- Bronhash: `fb70c9801472bf1e97c89f456e47dac0ef44ee7fa676a3c12b99a7dac50e4517`.
- Lockfilehash: `209d29b36abfad4f8f31f1ecebb8ecbdc9591d291eba54abb80176416258fa1d`.
- Expliciete publieke VITE-configuratie: leeg; config en hash staan in de evidence.

In de appcheckout is `npm run verify` uitgevoerd met `INSCAPE_VERIFY_REPORT`
gericht op de onderstaande `baseline-01`-map. De aanvullende run gebruikte
`technical-regie-2026-10-23/verify-remaining.mjs`, die dezelfde `verifyRelease`
importeert en uitsluitend unit/browser uit de stappenlijst weglaat. Er zijn geen
package-installaties, uploads, walletacties of deployments uitgevoerd.

De twee beginmanifesten en de aanvullende eindcontrole hebben dezelfde bronhash.
Een afzonderlijke inventaris na de volledige browserrun bevestigt dezelfde 2.621
verificatie-inputs. De eerder gemelde Nomad-afwijking in de onafhankelijke review
bleek UTF-8-decoding in die scanner; vergelijking van originele bytes vond nul
wijzigingen. De herstelkopie uit stap 01 bevat meer bestanden omdat die daarnaast
toegestane lokale Git-inputs bewaart; beide scopes zijn expliciet vastgelegd.

## Bewijs en afgebakende vervolgstappen

- [Volledige oorspronkelijke verifieruitkomst](../../../../../../technical-regie-2026-10-23/verification/baseline-01/verification.json)
- [Alle 66 suite-uitkomsten](../../../../../../technical-regie-2026-10-23/verification/baseline-01/browser/results.json), met individuele TAP-logs in dezelfde map.
- [Alle 30 falende suites met concrete volgende handeling](baseline-failures.json)
- [Bronmanifest na de browserrun](../../../../../../technical-regie-2026-10-23/verification/baseline-01/source-after.json)
- [Aanvullende standards/build/opstart-run](../../../../../../technical-regie-2026-10-23/verification/baseline-remaining-01/verification.json)
- [Onafhankelijke diagnose van de eerste 41 suites](../../../../../../technical-regie-2026-10-23/reviews/baseline-failures/README.md)
- [Inventaris van alle 229 browserbestanden](../../../../../../technical-regie-2026-10-23/reviews/test-coverage/step-03-coverage-review.md)

De diagnose onderscheidt een echte ontbrekende Image-recoveryactie van oude
Properties-selectors, overlappende testopstellingen, veranderde selectiebediening
en achterhaalde voorkeur-/kleurverwachtingen. Een failure is niet automatisch een
productdefect en evenmin automatisch een ongeldige test. De onafhankelijke diagnose
betreft de eerste 41 suites; latere failures zijn niet stilzwijgend meeverklaard.

De Image-recovery krijgt een afzonderlijke begrensde reparatie. Fixture- en
verwachtingsreparaties vallen onder stap 26, met behoud van de oorspronkelijke
garanties en gerichte heruitvoering; mogelijke focus/selectie/camera-afwijkingen
worden eerst gereproduceerd en zo nodig toegewezen aan stappen 11, 13, 14 of 16.
Nieuwe tools/navigatie-dekking en evidence-routing vallen onder stap 03.
Een [aanvullende brontriage van de elf latere suites](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/late-baseline-triage.md)
verklaart inmiddels hun faalpunten en concrete volgende handelingen, met expliciete
onzekerheid bij onder meer Text-herstel, selectie en Focus. Zij behandelt 33 van
de 57 failures en vervangt geen individuele browserreproductie. De oorspronkelijke
failure-inventaris hierboven blijft de vastgelegde historische meetstand.

Individuele heruitvoering blijft open waar zij niet daadwerkelijk is uitgevoerd.
De [latere integratiecontrole](../integration/result.md) toetst de concrete wijzigingen
en aanvullende suites; zij herschrijft deze nulmeting niet.
De 30-minutengrens van CI is hiermee niet bewezen:
de lokale 20:48 is uitsluitend de oorspronkelijke browserfase, zonder CI-installatie
en zonder de 25 nog toe te voegen suites.

# Expliciete browsersuitecatalogus

23 oktober 2026. De machineleesbare catalogus is geïntegreerd in de bestaande
runner en verificatie. Uitvoering en resterende beperkingen worden hieronder
afzonderlijk bijgehouden; classificatie betekent niet dat een test geslaagd is.

Alle 229 aanwezige browserbestanden hebben een bestemming: 91 releasecontroles,
134 gerichte controles, drie prestatiemetingen en één historische kandidaat.
De 66 oorspronkelijke defaults blijven in dezelfde volgorde geselecteerd.
Er zijn 25 actuele controles toegevoegd voor onder meer Layers, docking, gedeelde
tools, Image/Shape/FX, Navigator, sidebar, bestemmingen, herstel en vijf
designsysteemstromen. Geen suite is verwijderd of gedemoveerd om een failure te verbergen.

`scripts/browserSuiteCatalog.mjs` valideert de catalogus tegen de daadwerkelijke
bestanden en weigert onbekende, ontbrekende, dubbele of ongeclassificeerde suites
en lege motiveringen. Namen met een interne punt, zoals `mini-apps.production`,
blijven selecteerbaar; paden/traversal niet. Expliciete suitekeuze blijft mogelijk
uit alle categorieën. `production-startup` blijft afzonderlijk verplicht na de
productiebuild; zijn targeted-categorie haalt die controle niet uit verify.

De normale `npm run verify` start nu met de cataloguscontrole en gebruikt vervolgens
dezelfde runner. De bestaande CI-opdracht neemt dit dus automatisch mee. Elke
browserrun bewaart zijn exacte selectie. De runner bindt ook de volledige
`INSCAPE_SYSTEM_WORKFLOW_URL` en de door Reception gebruikte screenshotvariabele.

In 17 van de 25 toegevoegde suites zijn uitsluitend outputpaden en de benodigde
directoryaanmaak gewijzigd. Screenshots en Navigator-metingen volgen nu
`INSCAPE_BROWSER_OUTPUT`; oude fallbackpaden blijven beschikbaar voor losse runs.
De overige acht suites voldeden al of schrijven geen beelden. 983 assertion-aanroepen
en de testdefinities zijn bij deze harnesswijziging ongewijzigd gebleven.

## Uitgevoerde controle

- De catalogus valideert alle 229 echte bestanden en selecteert exact 91 releasesuites.
- Vier catalogusregressietests en elf bestaande release-evidencetests slagen.
- Een gecontroleerde echte directory met één geclassificeerde suite wordt geaccepteerd.
  Na toevoeging van `unclassified.browser.mjs` weigert dezelfde loader de directory
  met de precieze ontbrekende naam. De appbron is voor deze proef niet aangepast.
- De loader en naamcontrole zijn onafhankelijk herbeoordeeld, inclusief de interne
  punt in een bestaande suite. De runner-/catalogusintegratie krijgt een afzonderlijke review.
- Alle 25 nieuwe releasesuites slagen voor syntaxiscontrole. Statische controle van
  79 artifactpaden bevestigt behoud van bestandsnamen en Windows-paden met spaties.

## Bewijs

- [Classificatie en voorwaarden per suite](../../../../scripts/browserSuites.json)
- [Onafhankelijke dekkingsreview](../../../../../../technical-regie-2026-10-23/reviews/test-coverage/step-03-coverage-review.md)
- [66 behouden defaults en 25 aanvullingen](../../../../../../technical-regie-2026-10-23/verification/catalog-integration/selection-change.json)
- [Negatieve discoveryproef](../../../../../../technical-regie-2026-10-23/verification/catalog-integration/negative-proof.json)
- [Review van de loader](../../../../../../technical-regie-2026-10-23/reviews/obsolete-code/catalog-review.md)
- [Evidence-routingdelta en statische checks](../../../../../../technical-regie-2026-10-23/reviews/test-coverage/implementation/README.txt)

## Gezamenlijke uitvoering

Alle 25 toegevoegde releasesuites zijn uitgevoerd in `integration-02`:
125 TAP-resultaten, 121 pass en 4 fail, verdeeld over drie rode suites.
Daarbij zijn negen bestaande suites voor opslag, Library en herstel uitgevoerd;
hun 54 tests slagen. [De gezamenlijke uitkomst](../integration/result.md) noemt
bronhash, selectie, logs en concrete vervolgstappen voor startup, bestemmingen
en smalle Shape-toetsenbordbediening. De onafhankelijke integratiereview heeft
geen open bevinding in de catalogus/runner. De oorspronkelijke tests zijn niet
verwijderd of gedemoveerd om deze uitkomst groen te maken.

## Nog vereist voor afronding

De complete selectie van 91 suites moet nog gezamenlijk draaien; alleen de 25
aanvullingen plus negen behouden suites zijn op de geïntegreerde bron herhaald.
De bestaande nulmeting bevat 57 browserfailures; die zijn niet door de catalogus
opgelost. De volledige CI-duur inclusief installatie en build moet nog passen binnen
de 30-minutengrens. Er is geen CI-run of deployment van deze lokale wijzigingen.
Een vroege broninventaris of groene unit-test vervangt die ontbrekende bewijzen niet.

Sommige niet-standaard gerichte suites vereisen nog eigen voorbereiding, een verse
productiebuild, specifieke preview/hardware of aanpassing van oude vaste poorten.
Hun voorwaarden blijven in de catalogus/review expliciet. Zij worden niet stil als
uitvoerbaar of geslaagd beschouwd omdat hun naam geclassificeerd is.

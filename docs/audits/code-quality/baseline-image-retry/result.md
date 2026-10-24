# Afgebakende reparatie: Image-herstel na een laadfout

23 oktober 2026. De nulmeting ontdekte een echte recoveryfout naast verouderde
testselectors. Een mislukte eerste rasterafbeelding verwees naar Close/reopen,
terwijl de owner Close-knop bewust was verwijderd. Layers hide/show unmount de
renderer niet en vormde daarom geen betrouwbare herstart.

De reparatie biedt Retry bij de bestaande Image-foutstatus voor owner en Visitor.
De laadpoging blijft eigendom van de media-renderer. Alleen diens tijdelijke poging
wordt vernieuwd; type-detectie, decode en disposable WebP-werk krijgen hun bestaande
cleanup. De SVG-route gebruikt haar bestaande retry en requestafbakening. Er is geen
nieuwe writer naar compositie, crop, afmetingen, history of publicatie toegevoegd.

De status staat fysiek buiten de canvas-button. Kleine/dunne Images gebruiken
viewportafhankelijke statuspositie vanuit de bestaande ImageWindow-geometrie.
Inspect toont loading/failure bij zijn bestaande Return-bediening; crop houdt zijn
herstelstatus. Pointer-, keyboard- en focusgedrag van Retry wordt apart afgevangen
zodat herstel geen nieuwe selectie- of camerabewerking wordt. Gewone artworkbediening
en de bestaande Next-side-recovery blijven hun eigen pad gebruiken.

De twee bestaande recovery-suites zijn naar de actuele Image-tab en echte Retry
bijgewerkt. Zij behouden owner/Visitor, pointer/touch, inhoudsbehoud en herstel na
bronvervanging. Gerichte aanvullingen bestrijken oude laadresultaten, flips na
herstel, kleine geometrie en status tijdens crop/Inspect. Oude, afzonderlijke
Image-suites met verdwenen Properties-selectors worden hiermee niet groen verklaard.

## Verificatie en review

De eerste uitvoering en de aanvullende onafhankelijke review zijn afzonderlijk
bewaard. De review vond bereikbaarheid aan de schermrand en verdwenen status in
crop/Inspect; die werden vóór de gezamenlijke integratiecontrole opgepakt. Een
randtest vond daarnaast ongewenste selectie via native focus, die lokaal is afgevangen.
Dit document is geen vervanging voor de definitieve testuitkomst of reviewhercontrole.

- [Oorspronkelijke diagnose](../../../../../../technical-regie-2026-10-23/reviews/baseline-failures/README.md)
- [Implementatie, exacte delta en gerichte testresultaten](../../../../../../technical-regie-2026-10-23/reviews/baseline-failures/implementation/README.md)
- [Onafhankelijke review, met versiegebonden bevindingen](../../../../../../technical-regie-2026-10-23/reviews/test-coverage/recovery-review.md)

De [gezamenlijke integratie-uitkomst](../integration/result.md) bevestigt beide
recovery-suites, SVG-lifecycle, alle 1.260 unit-tests, beide builds en de productie-
opstart. De producentcontrole omvat bovendien animated-raster en 24 schermrandgevallen;
de parent bekeek vier brede/smalle en boven-/onderrandbeelden. De onafhankelijke v5-review
heeft geen open bevinding binnen de onderzochte hersteldelta. Dubbele src-state is
weggehaald; het bestaande bundelbudget bleef ongewijzigd. Drie andere browsersuites
zijn rood en staan afzonderlijk in het integratieverslag; dit is geen releasegoedkeuring.

De uitvoeringsstatus staat in `code-quality-progress.json`. Alles is lokaal;
geen commit, push, walletactie, upload of deployment.

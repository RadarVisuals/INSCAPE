# Reception: vermijd navigatormetingen bij tekstupdates

Status: lokaal uitgevoerd; geen commit, push, deployment of publicatie.

## Gewijzigde verantwoordelijkheid

WorkbenchNavigator schilderde na elke React-render opnieuw de mapprojectie.
Ook een teksttransactie die uitsluitend een miniatuur wijzigt, las daardoor via
navigationViewport opnieuw computed CSS en viewportmaten. Het voorafgaande
CPU-profiel wees dit pad aan als concrete kostenpost.

De onvoorwaardelijke paint is vervangen door een effect op camera- en
extentcoordinaten. De tijdelijke extentvergelijking bevat alleen canvasgrenzen,
outside-visibility en, indien zichtbaar, de moduleframes buiten het canvas.
Het is geen opgeslagen toestand of tweede eigenaar van documentgeometrie.
Miniaturen blijven hun bestaande live bron en React-updates gebruiken.

De bestaande camera-paintsubscription, host-/map-ResizeObserver en
host-styleobserver blijven de eigenaar van actuele camerareizen en insets.
De ResizeObserver volgt nu ook de actuele navigatie-/creationrails, inclusief
mount/unmount en wrapping. De registratiecontrole na render leest geen layout.
De eerdere dubbele initial paint is verwijderd; het gerichte effect schildert
de eerste projectie. Observers en subscription worden bij sluiting opgeruimd.

Geen wijzigingen aan tekstinhoud, stores, validatie, savefrequentie, Undo,
camera-interacties of authored coordinates. Brede windowrenders en document-
validatie blijven afzonderlijke gemeten optimalisatiekandidaten; deze stap
claimt die architecturale koppeling niet op te lossen.

## Gecontroleerde vergelijking via beschikbare browser

De directe performancecoordinator compileerde wel, maar kon in deze omgeving
geen afzonderlijke Chrome starten (`spawn UNKNOWN`). Die run blijft failed:
`output/reception-performance-2026-11-12T18-43-37-899Z/report.json`.
Er zijn geen instellingen, permissies, browsercertificaten of sandboxguards
aangepast. De beschikbare browser werd gebruikt voor een afgebakende UI-proef.

Vergelijking van twee productiegeminificeerde fixtures:

- Voor: `output/reception-performance-2026-11-12T18-43-37-899Z/dist`;
  bronhash `f2669043f2f8efb199dedfe749cf17011ee85c9f85429c8b3dbc139553134f7e`.
- Na: `output/reception-performance-2026-11-12T18-45-52-131Z/dist`;
  bronhash `b64a8f5579c8c0859e818a1a49e2cc3308c34de319fd4846de3927da7ba37114`.
- De bronmanifesten verschillen uitsluitend in WorkbenchNavigator.jsx.
- Beide fixtures gebruikten dezelfde mixed-16-compositie, met 16 beelden en
  16 teksten van elk 24 paragrafen, vaste tekstframes en dezelfde invoer van
  31 echte keyboard-inputevents: `navigator typing performance 01`.
- De tijdelijke UI-server/probe staat in
  `output/reception-typing-optimization-2026-11-12/serve-check.mjs`.
  Beide geminificeerde fixture-entrybestanden kregen dezelfde testaanpassing
  voor de twee oorspronkelijke publieke HTTPS-WebPs. HTTP-mediareferenties
  worden door de productievalidatie geweigerd; die validatie is niet versoepeld.
  Applicatiecomponenten bleven de geminificeerde builduitvoer gebruiken.
- Een identieke, uitsluitend voor deze proef ingesloten teller telde reads van
  de vier viewport-CSS-properties via getPropertyValue. Reset vond plaats na
  openen van tekstbewerking en verplaatsen naar het begin van de tekst.

| Controle | Voor | Na |
| --- | ---: | ---: |
| Tekstinvoerevents | 31 | 31 |
| Reads van de vier viewport-CSS-properties tijdens invoer | 360 | 0 |

Dit bewijst het verdwijnen van dit herhaalde meetwerk. Het is geen claim dat
de hele editor een bepaald percentage sneller is: CPU-tijd, inputlatency en
framepercentielen zijn met deze interactieve proef niet opnieuw bepaald.

In de aangepaste fixture zijn via de echte UI gecontroleerd:

- De ingevoerde tekst bereikt direct de opgeslagen draft en de navigatorminiatuur.
- Undo verwijdert de laatste wijziging; Redo herstelt de opgeslagen tekst.
- Zoom tot 25% en 200%, toetsenbordpan via Navigator en Fit canvas werken.
- De navigatorprojectie verandert bij viewportresizes (1440x1000 en 900x800).
- Het zijpaneel opent; de host/insetwijzigingen blijven door observatie gevolgd.
- Preview opent en keert terug met behoud van de opgeslagen tekst en miniatuur.
- Alle zestien beeldminiaturen blijven aanwezig; geen console-errors in de
  aangepaste proef.

Dit gebeurde op aparte loopback-origins, met disposable testdrafts. De gebruiker-
compositie is niet geopend of bewerkt. Testtabs zijn gesloten, de tijdelijke
viewportoverride is hersteld en de twee eigen servers worden afgesloten.

## Regressie en technische checks

- Bestaande Navigator-browsersuite uitgebreid met een echte Reception-tekst-
  regressie: nul viewport-CSS-reads tijdens typen, live miniatuur, opslaan,
  ongewijzigde geometrie/camera, Undo/Redo, resizen, zoom en toetsenbordpan.
  Syntaxcontrole geslaagd. Automatische uitvoering van deze browsersuite blijft
  hier geblokkeerd door de browserprocesstart; de interactieve proef hierboven
  is afzonderlijk gerapporteerd en wordt niet als groene volledige suite verkocht.
- 16/16 gerichte tests voor navigatorgeometrie, navigatie en view-scaling geslaagd.
- Source lint geslaagd: 579 bestanden; dezelfde 46 bestaande hookobservaties.
- Browsercatalogus geldig: 255 suites; geen nieuwe suite of gewijzigde indeling.
- Productiebuild met native configloader geslaagd, inclusief productieplafonds.
- Afzonderlijke build:check geslaagd: 726.263 initial JS bytes.
- Diff-whitespacecontrole geslaagd voor de twee aangepaste bestanden.

De lokale snapshot bij de start van deze stap is bewaard onder
`output/reception-typing-optimization-2026-11-12/*.before`; reeds aanwezige
wijzigingen in beide bestanden zijn behouden. De productieaanpassing is alleen
de beschreven navigator-lifecyclewijziging; tests en deze notitie staan apart.

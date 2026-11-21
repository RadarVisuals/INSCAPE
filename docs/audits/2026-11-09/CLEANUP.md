# Lokale onderhoudsronde — 9 november 2026

Deze ronde actualiseert het auditbewijs en herstelt enkele verouderde
testopstellingen. Geen releasegoedkeuring of nieuwe productrichting.

- De oude procesopruimingsfout en bundeloverschrijding waren reeds hersteld.
- De stijlinventaris is ververst; volledige units 1771/1771, lint, types,
  opmaak, standaarden en productiebuild/budget groen.
- Core JS: 2.741.274 raw / 904.326 gzip bytes; de bestaande grenzen blijven
  2.744.000 / 909.000 bytes. Raw marge 2.726 bytes.
- 34 browsersuites opnieuw op één bron: 17 groen / 17 rood. Gerichte
  testcorrecties maken daarna beide camera-cases groen en verbeteren Layers
  van 4/10 naar 6/10. Een aanvullende Text/Display-suite blijft 4/10.
- Laatst bekende resultaten uit opeenvolgende bronmomenten: 35 suites,
  18 groen / 17 rood. Dit is geen gecombineerde releasepass. De resterende
  mislukkingen zijn verificatiepunten, geen bewezen lijst van 17 appbugs.
- Alle afgeronde browserruns hebben verified procesopruiming. De geïnstalleerde
  Chrome is gebruikt nadat de meegeleverde testbrowser niet kon starten.
- AGENTS.md verplicht nu expliciet om bij een vervanging de getroffen tests
  in dezelfde wijziging bij te werken, met behoud van relevante gedragsdekking.

De runtime, afhankelijkheden en productie-CSS zijn niet veranderd. Bestaand
lokaal werk is behouden. Geen commit, push, publicatie of deployment.

[Volledig resultaat, bronhashes, logs en concrete vervolgpunten](../../../../../cleanup-2026-11-09/README.md).
[Machineleesbare actuele lijst](../../../../../cleanup-2026-11-09/summary.json).

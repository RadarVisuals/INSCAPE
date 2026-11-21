# Reception-performancemeting

Status: meetopstelling voorbereid; browserresultaten nog niet uitgevoerd.
Dit is stap 2 na de gerichte releasepoort-/bundleremediatie.

## Afbakening

Geen productiecode, dependencies, gebruikerscompositie, publicatie of deployment
gewijzigd. De bestaande Reception-reader, native Editor en tekst-/beeldcomponenten
worden geïmporteerd in een apart met productieminificatie gebouwd testentrypoint.
Dit volgt het bestaande `filled-workbench-performance.mjs`-model. De proef is
geen cold-loadbenchmark van de volledige publieke profielroute of een CDN.
De optionele wallet-entryoptimalisaties zijn geen meetdoel van deze fixturebuild.

De broninventaris en Git-identiteit worden vóór de run opgeslagen en de bronhash
wordt na afloop opnieuw gecontroleerd. Extra artwork buiten de checkout wordt
afzonderlijk met bestandsgrootte en SHA-256 vastgelegd. Het wordt ongewijzigd
ingelezen en uit geheugen geserveerd. Resultaten komen uitsluitend onder
`output/reception-performance-<tijdstip>/`.

## Inhoud

| Workload | Gevulde inhoud | Betekenis / grens |
| --- | --- | --- |
| raster-14 | 14 cellen met bestaande Abyssal Eye- en Reaper-WebP | Twee bronnen herhaald; geen claim over veertien unieke downloads |
| svg-6 | 6 cellen met de bestaande `nomad-webp-svg/NOMAD-animated.svg` | Zes exemplaren van dezelfde originele animatie onder zes URLs; geen zes verschillende kunstwerken |
| mixed-16 | 16 beelden, 16 teksten, samen 384 rich-textparagrafen | Vetgedrukte passages en links; alle inhoud blijft binnen de echte domein-/opslagvalidatie |

Nomad: 908.082 bytes, bron-SHA-256
`5151866ee081a24c36e82f8a34547569fb3e6c0fb13651e2a32e2d088366b083`.
De SVG bevat de oorspronkelijke ingebedde WebP-lagen en GPU-animatie. De proef
wijzigt geen script of beeldlaag. Hij controleert via read-only frame-inspectie
dat alle zes renderers klaar zijn en hun eigen animatieklok vooruitgaat.

De drie documenten zijn gevalideerd en kunnen via de echte draftstore worden
opgeslagen. De productie-fixturecompile slaagt. Voorbereidingsbewijs:
`output/reception-performance-2026-11-12T17-46-30-735Z/`.
Dit is compile-/datavalidatie, geen browsermeting.

## Uitvoering

```powershell
node browser-tests/reception-performance.mjs
```

Deze opdracht start vanuit de applicatiecheckout; een absoluut scriptpad mag
ook, omdat de starter zelf zijn checkout vaststelt. Node moet overeenkomen met
`.node-version`. Bestaande Git/OpenSSL wordt gebruikt voor een kortlevend
self-signed loopbackcertificaat. Er wordt geen certificaat geïnstalleerd en
geen systeem- of browsertrustinstelling gewijzigd. Alleen de nieuwe, geïsoleerde
Playwright-context accepteert deze lokale testidentiteit. De HTTPS-server bindt
uitsluitend aan 127.0.0.1 en serveert de testbuild, publieke assets en drie
expliciete mediabronnen; certificaatbestanden zijn niet bereikbaar via de server.
Browserstart en opruiming gebruiken de bestaande bewaakte Chromium-lifecycle.

Default vijf cold/warm-paren per workload, elk paar in een nieuwe browsercontext.
Daarna volgen per workload 2s idle, 10s echte browser-viewportresize, tien
smal/breed-cycli en tien inspectiecycli. Een afzonderlijke herhaling van SVG-
inspectie levert een gecomprimeerde Chromium-trace inclusief child renderers;
die trace beïnvloedt de daarvoor verzamelde baseline niet.

In de echte native Editor van de geïsoleerde gemengde compositie: 200 tekens
typen met 10ms gevraagde tussenruimte, een echte dividerdrag van 10s en terug
via één Undo, daarna de werkelijke responsive preview openen/sluiten. Het typen
gebruikt een vast tekstkader; auto-fittypen valt buiten deze timing. Preview
moet het bewerkte document identiek behouden. De drop-/clip-/saveinvarianten
worden niet uitgezet voor de meting.

## Meetwaarden en interpretatie

- HTTPS-requestaantallen, gecodeerde responsebytes en cachehits; relevante HTTP-
  en netwerkfouten blijven zichtbaar. De huidige ready-tijd omvat expliciete
  fonts/media-readiness en een vaste 500ms settlingpauze, geen network-idlegarantie,
  en mag niet als first paint worden voorgesteld. De eerste run gebruikte nog
  network idle; zie de afzonderlijke resultaten en hun meetgrenzen.
- Paint-observaties en grootste waargenomen contentpaint van het testentrypoint.
- Frame-intervallen (P50/P95/P99/max), intervallen boven 32ms, top-frame Long Tasks,
  blocking time boven 50ms en beschikbare Event Timing-samples.
- Main-target CDP-layout-/style-/script-/taskduur en layoutaantallen. Dit dekt
  niet alle opaque SVG-renderers of GPU-werk; de afzonderlijke trace vult dat aan.
- Heap-/DOM-snapshots met expliciete GC op de diagnostische meetpunten, aantallen
  frames, host-object-URLs en expliciete Worker-start/terminatecalls. Deze waarden
  zijn geen exacte GPU-allocaties of zelfstandig bewijs van een geheugenlek.
- Reader-document blijft identiek, inspectie behoudt outer-frame-identiteit en
  na unmount zijn de iframe-elementen weg. De originele SVG-applicaties moeten
  na resize en inspectie nog steeds zonder eigen fout vooruitgaan.
- Aantallen media vóór/tijdens/na de native Editor-preview, om de eerder gevonden
  dubbele mounts concreet te beoordelen zonder dubbel netwerk/geheugen te verzinnen.

Een geslaagde run betekent dat meetacties en functionele waarborgen afgerond zijn.
Er is nog geen performancebudget bepaald; 'passed' betekent niet automatisch
dat het product snel genoeg is of gereleased mag worden. De normale productie-
Reactbuild levert geen betrouwbare React-commitprofiler; zulke aantallen worden
niet verzonnen. Automation-walltime omvat Playwright-overhead en is geen veld-INP.

Volgende stap: de complete `report.json`, eventuele foutbeelden en SVG-trace
uitlezen, beperkingen per resultaat benoemen en alleen daarna concrete
optimalisaties voorstellen. De meetopstelling zelf is syntactisch gecontroleerd;
fixturecompile, domein-/storevalidatie, percentielaggregatie en bestaande lint
zijn gecontroleerd. De echte browserrun vereist gewone lokale PowerShell door
de reeds vastgestelde procesinspectiebeperking van de afgeschermde uitvoering.

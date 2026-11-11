# Eén Dark/Light-instelling voor de volledige interface

Datum: 30 oktober 2026. Lokaal prototype op `codex/profile-work-index-2026-10-30`.
Deze wijziging vervangt de losse thema-eigenaars; mobiel is buiten deze iteratie.
Terugdraaipunt vóór deze wijziging: `17e8dab` (het desktop-indexprototype blijft dan bestaan).

## Resultaat en verantwoordelijkheid

`interfaceTheme.js` bezit één apparaatvoorkeur, opgeslagen onder
`inscape:interface-theme`. `inscapeTokens.css` bezit de kleuren. De gedeelde
DARK/LIGHT-bediening in Settings verandert uitsluitend die voorkeur. Workbench,
Reception, publieke profielen, canvasoverzicht, inloggen, Discover, vensters,
menuportalen en de ontwerp-referentie erven dezelfde kleuren. De officiële
UP Modal krijgt dezelfde modus via zijn bestaande `setTheme`-API; autoriteit,
verbinding en publicatiegedrag zijn niet gewijzigd.

Dark: omgeving `#171717`, vensters/balken `#080808`, tekst `#EBECE7`.
Light: omgeving `#DEDBD3`, vensters/balken `#EBECE7`, tekst `#171717`.
Actieve toolbar-bediening keert tekst en achtergrond om. Het canvasraster
ververst zijn gerasterde kleuren bij een moduswijziging; camerabewegingen blijven
zonder extra stijlmetingen werken.

## Verwijderd en bewust behouden

Verwijderd: zes interfacepaletten, Workbench-achtergrondkeuze, vensterthemakeuze,
Reception-thema voor huidige weergave en bezoekers, aparte headerknop,
overzichtspecifieke charcoal-override, `setMenuSurface`, themaprops door
componenten heen, themadata-attributen, lokale shader-themaprop en ongebruikte
Display-surfacekleur-forwarding. Nieuwe drafts, backups en publicaties schrijven
geen oude interfacevoorkeuren meer. De ontwerp-referentie gebruikt dezelfde
instelling; de tokens-inventaris is opnieuw gegenereerd.

Bestaande composities zijn niet wegwerpbaar. Een kleine leesopschoning verwijdert
oude interfacevelden uit ingelezen drafts. De gepubliceerde documentvalidator
accepteert die oude velden nog zonder de hash-gecontroleerde bytes te herschrijven;
geen renderer gebruikt ze. Dit is geen verborgen themakeuze. Authored Display
surface IDs, afbeeldingskleuren, artikelkleuren, Shapes, Reception-celkleuren en
Identity cloud-inhoud blijven bewaard. Bevel/flat vormgeving en semantische
statuskleuren blijven waar ze een bestaande functie hebben; hun interfacepalet
is gedeeld.

## Verificatie

- Alle 1.380 tests onder `src`: geslaagd, inclusief drafts, collecties, publicatie,
  opslagfouten/herstel en de drie nieuwe voorkeurtests.
- Browser: globale keuze in Settings, portaalmenu, Reception, overview, echt
  inlogscherm en Discover in beide standen. Een themakeuze verandert de opgeslagen
  compositie niet. Gevuld Discover met lokale artworkbestanden gecontroleerd,
  inclusief zoeken/paginering via de bestaande Discover-suite op 1440px.
- Bestaande desktop-tests: Settings in beide standen en na herladen, Reception
  Settings op 1920px, toolbar in beide standen, twee Display-lifetime-scenario's,
  ontwerp-referentie op 1440px. Geslaagd. Geen nieuwe mobiele werkzaamheden.
- Lint, typecheck, core-formatcontrole, design-tokencontrole en de vijf
  LUKSO-standardschecks: geslaagd. De bestaande 87 hook-observaties blijven zichtbaar;
  twaalf bestaande observaties in zes bestanden zijn expliciet opnieuw bekeken na
  uitsluitend het verwijderen van themaprops/imports. Geen nieuwe vrijstelling.
- Productiebuild met `npm run build -- --configLoader native` en `build:check`:
  geslaagd. Native config-loader voorkomt de bestaande esbuild-toegangsbeperking.
- Negen gerichte referentie/token/kleuren/lagen-tests: geslaagd.
- De eerder uitgevoerde volledige `npm test` was niet groen. De thema- en
  inventarisverwachtingen zijn daarna hersteld en gericht opnieuw gecontroleerd.
  Windows release-/procesbewaking kon processen niet inspecteren
  (`Get-CimInstance: Access denied`); de standaard config-bundleproef kon een
  bovenliggende directory niet lezen. Die releasecontrole is hier onbewezen,
  niet weggefilterd of als geslaagd voorgesteld.

Screenshots en logs staan lokaal onder `.browser-test-runtime/interface-theme/`
en `.verification/interface-*.log`; ze zijn geen productie-assets. Voor screenshots
gebruiken de fixtures bestaande artworkbestanden uit `public/` en geïsoleerde
opslag. Er is geen walletactie, upload, push of deployment uitgevoerd. De huidige
branch heeft voor deze wijziging nog geen nieuwe CI-/deploymentuitslag.

## Omvang

Productiecode: **+354 / −355 regels**.
Tests en fixtures: **+265 / −181 regels**.
Ontwerp-referentie: **+33 / −56 regels**.
Documentatie, lintregistratie en gegenereerde tokeninventaris apart van deze
productiecijfers. De nieuwe code bestaat uit één voorkeur-store, gedeelde
bediening en beperkte leesopschoning om bestaande composities te behouden.
De oude themapaden en forwarding zijn verwijderd, waardoor productiecode netto
kleiner wordt.


## Correctie: daadwerkelijk getekende Workbench-achtergrond

De oprichter wees na de eerste oplevering terecht op de Workbench-achtergrond.
De controle hierboven mat de CSS-achtergrond van de host, maar miste de Canvas2D-laag
buiten de compositie. `WorkbenchArea` schilderde die nog met `#242626`, een vaste
`#888b88`-rand en een groen-grijze schaduw bij “Show outside canvas”.

Die drie vaste kleuren zijn verwijderd. De tekenlaag leest nu de gedeelde
omgeving en randkleur bij montage en bij een Dark/Light-wijziging. Camera-frames
hergebruiken de gemeten kleuren; er komen geen stijlmetingen per pan-frame bij.
De compositie en buitenliggende objecten houden dezelfde inhoud en geometrie.

De aangevulde browsercontrole verkleint het canvas, schakelt de buitenweergave in,
wisselt Dark → Light → Dark en leest de echte Canvas2D-pixels: `23/23/23` versus
`222/219/211`, plus de overeenkomstige 65%-schaduw. Na pannen blijven de kleuren
correct en de opgeslagen compositie ongewijzigd. Beide interface-browsertests,
lint en de productiebuild met budgetcontrole slagen. Screenshots voor deze
correctie: `.browser-test-runtime/interface-theme/workbench-background-*.png`.
Deze correctie is lokaal; geen push of deployment.

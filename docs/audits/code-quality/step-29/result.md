# Stap 29 — gezamenlijke actuele verificatie

In uitvoering op de vastgelegde bron van continuation/final-01/. De bestaande officiële releasegate wordt ongewijzigd uitgevoerd. Als de bekende buildbudgetfout haar onderbreekt, worden nog onafhankelijke resterende controles apart uitgevoerd en als diagnostisch bewijs benoemd. Dat maakt de officiële gate niet groen.

Selectie: 92 release-browsersuites plus 29 aanvullende suites uit de gewijzigde bronnen, regressiematrix en expliciete grenzen. De twaalf prestatiemetingen van stap27 zijn afzonderlijk uitgevoerd; hun vergelijking volgt. Geen commit, push of deployment.


## Afgeronde final-01, 23 oktober 2026

Bron voor en na identiek: `7fcc3f3cb5f470c2839e63ed0e33a55a309f93c0bee84aefe9c45db004346562`. Duur 2067.665 seconden, inclusief extra diagnostiek. De officiële releasegate faalt op één van 1420 unittests: de actuele productieconfiguratie meet 809609 gzipbytes tegenover 809500 toegestaan. 1419 unittests slagen.

Afzonderlijke diagnostiek na deze gatefout: 92 release-browsersuites leveren 435 pass en 15 fail uit 450 cases, zonder skips; 29 aanvullende suites leveren 109 pass, 11 fail en 3 expliciet obsolete skips uit 123 cases. Standards (5/5), design-systeminventaris, zelfstandige design-systembuild en diagnostische startup van het vers gebouwde maar budget-afgekeurde artifact slagen. De artifactbinding bleef identiek. Geen volledige releasepass.

De failures worden opgesplitst in aantoonbare productregressies en fixture-/contractdrift. Oorspronkelijke rode logs blijven onder continuation/final-01 bewaard. Geen asserties verzwakken om groen te worden. Actuele betekenisvolle Display-dekking behouden; oude creatie en vervangen zoom/inspectiegedrag niet herstellen. Een volgende gezamenlijke run moet de uiteindelijke reparaties bewijzen.

Dit is lokale, ongecommitteerde bron. Het huidige GitHub-workflowbestand gebruikt Ubuntu, de vastgelegde Node-versie, npm ci, locked Playwright Chromium en een limiet van 30 minuten. Uitvoering binnen die limiet op deze gewijzigde bron is nog niet bewezen. De lokale diagnostische totale duur is geen CI-meting.

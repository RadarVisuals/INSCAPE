# Profielvoorkeuren en schermvensters

De bestaande voorkeurenstore en venstercontrollers zijn behouden. Vijf kleine wijzigingen maken de callback- en effectgrenzen expliciet, zonder nieuwe store, opslagvorm of CSS: actuele framewriter, concrete navigatiesetters, stabiele sessiondependency en benoemde compact/editing/preview-overgangen. Dertien van achttien toegewezen lintmeldingen zijn opgelost. Vijf blijven met hun concrete mount-/geometrie-invariant zichtbaar geregistreerd.

Onafhankelijke review vond geen nieuwe regressie. De gerichte modeltests slagen **21/21**. Op de bevroren gezamenlijke bron slagen editor preferences **11/11**, tool-docking **4/4**, Identity **7/7**, Keeper **3/3** en toolbar **13/13**. De aanvullende oudere Text-tools-resize-suite heeft **1/4** geslaagd; twee gevallen verwachten de vroegere tabloze UI, een derde ontmoet overlappende Info-bediening. Die afzonderlijke testcorrectie loopt; de volledige stap blijft daarom in uitvoering.

Bewijs: `technical-regie-2026-10-23/continuation/step-15-preferences/README.md`, `continuation/reviews/step-15-preferences-review.md` en `continuation/midplan-01/`. Bronmanifest vóór/na is identiek. De bestaande custom Identity-rendering en CSS zijn behouden. Haar oudere optionele shortcutvoorkeur is afzonderlijke lokale presentatie, geen tweede authored geometrie; die opslag is niet stil gemigreerd.

## Aanvullende Text-controle afgerond

De drie rode oudere Text-tools-resizegevallen zijn verklaard en de testopstelling is bijgewerkt via echte venster- en camerabediening. De definitieve test slaagt 4/4 op actuele bron, 4/4 met de relevante geladen bronnen van vóór stap 15, en 4/4 via de gewone runner. Alle oorspronkelijke resize-, annulering-, opslagfout-, Undo/Redo-, inhouds- en viewportcontroles blijven behouden. Geen productie- of CSS-wijziging voor deze testreparatie. Zie continuation/text-tools-resize/README.md en final-01; alle 126 opgenomen hashes zijn vóór/na gelijk. Dit is begrensd gedragsbewijs, geen nieuwe volledige releasecontrole.


## Afgebakende Text-controlsrand

De eerder gevonden50%-clipping is hersteld in dezelfde bestaande vensterhost. De keuze boven/onder houdt nu rekening met de geprojecteerde canvasrand, uitsluitend voor controls die werkelijk binnen die cliphost staan. CSS, materialen, authored frames en opslag veranderen niet. De oude component faalt onder dezelfde huidige host identiek bij50% en slaagt bij100%; vier brede/smalle native gevallen zijn na de correctie groen. De volledige Text-transferproef staat weer op de oorspronkelijke standaardpositie:6/6, inclusief de4 nieuwe controlgevallen;17 oorspronkelijke assertions blijven exact behouden. Bestaande Text-venster/resizeproeven slagen4/4. [Exacte delta, vergelijking en bewijsgrenzen](../../../../../../technical-regie-2026-10-23/continuation/text-controls-boundary/README.md). De onafhankelijke reviewer bevestigt de bron; twee ongewijzigde hookinvarianten zijn opnieuw aan de exacte hash gebonden. De stabiele6-case-run ging vooraf aan de laatste artikelvalidatorwijziging; finale gezamenlijke bronbinding volgt.

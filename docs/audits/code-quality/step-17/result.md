# Stap 17 — Library-grenzen

Implementatie en onafhankelijke bronreview afgerond; gezamenlijke releasecontrole blijft open.

Netwerkinventaris en lokale organisatie blijven bij useLibraryStore. Actieve selectie, filters en voorkeuren blijven bij useBrowserWorkspace. Drie ongebruikte selectie-/filtervelden, hun setters en afgeleide interne updates zijn uit de inventarisstore verwijderd. De echte browserselectie blijft behouden. Geen nieuwe store, cache of presenter toegevoegd.

Een onvoltooide volledige inventarisiterator kon onterecht ready worden. De bestaande fallback/foutafhandeling wordt nu gebruikt; gerichte metadatareparatie behoudt haar afzonderlijke volledigheidsberekening. Zeven van acht hookobservaties zijn opgelost. De behouden previewVersion is inhoudelijk bewezen nodig voor decodeprojectie bij een gelijke bronarray.

Bewijs: 152/152 gerichte units, 26/26 browserchecks (23 lifecycle, één opslag, twee echte Image-drops). De onafhankelijke reviewer voerde 29/29 units uit, bevestigde alle acht actuele productie-/testhashes en vond geen nieuwe delta-bevinding. De review claimt geen volledige Library→Text-browserworkflow in twee Workbenches: Text-onafhankelijkheid is met echte save-/scopefuncties en reload getest.

Uitvoering: [bewijs en delta](../../../../../../technical-regie-2026-10-23/continuation/step-17/README.md). Review: [onafhankelijk verslag](../../../../../../technical-regie-2026-10-23/continuation/reviews/step-17-review.md). Alles lokaal; geen commit, push of deployment.

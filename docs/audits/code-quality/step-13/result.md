# Gebaren met één levensduur

`createWorkbenchGestures` beheert pointeridentiteit, capture, tijdelijke listeners en commit/cancel van één move-, resize- of marqueegebaar. View houdt de concrete geometrieadapters en routering; de draftstore blijft de eigenaar van opgeslagen bewerkingen en Undo. De oude tweede listenerimplementatie is verwijderd.

De [overdracht](../../../../../../technical-regie-2026-10-23/continuation/step-13-gestures/README.md) bevat18 gerichte gesturegevallen, de selectie-/geometriechecks en browserbewijs voor captureverlies, Escape, Layers, focus, Workbenchwissels en herstel. De nieuwe marqueeproef faalde vóór de correctie en slaagt na herstel van het volledige selectiesnapshot. Permanente eventhandlers lezen actuele beperkte acties; ze bewaren geen tweede selectie of inhoud.

De [onafhankelijke hookreview](../../../../../../technical-regie-2026-10-23/continuation/reviews/final-core/remaining-hook-review.md) vond nog CORE-13-02: crop-listeners konden na Undo van een buurplaatsing oude controllergegevens gebruiken. Die concrete reparatie en haar native regressiecontrole lopen onder `continuation/step-13-crop-review-fix`. Stap13 blijft daarom open. Overige individuele hookinvarianten zijn centraal verwerkt. Volledige gezamenlijke verificatie volgt; alles lokaal en ongecommit.


CORE-13-02 is daarna gericht hersteld: eventhandlers lezen actuele controller/media/acties, terwijl de bestaande cropsessie en opslaggrens eigenaar blijven. Drie native Undo/Redo-buurgevallen falen vóór en slagen na de fix; de volledige crop-lifecyclesuite slaagt13/13. De onafhankelijke reviewer bevestigt de exacte bron en sluit de bevinding. [Rood/groen bewijs en3 opgeloste lintobservaties](../../../../../../technical-regie-2026-10-23/continuation/step-13-crop-review-fix/README.md). De hoofdtaak heeft de3 records na hash- en actuele ESLintcontrole verwijderd. Dit zijn productiehook-grenstests, geen volledige Runtime-releaseclaim.

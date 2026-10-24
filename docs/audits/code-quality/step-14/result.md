# Camera los van opgeslagen geometrie

WorkbenchCamera en de bestaande navigatie/motion-eigenaren blijven behouden. Camera-Back herstelt de volledige selectie via dezelfde selectie-eigenaar. Tijdelijke Text-verbindingslijnen volgen ook presentatie-transforms. Display bewaart zijn authored breedte bij een smaller scherm; native en groepsresize gebruiken dezelfde bestaande documentlimieten.

De onafhankelijke review ontdekte CORE-14-01: vergroten kon een breed Display naar de schermbreedte doen krimpen. Vier nieuwe390px-gevallen reproduceren dit vóór de fix. Daarna slagen47 gerichte units en10 geometriebrowsergevallen. De schema-afmetingen zijn niet verruimd. [Camera-/resizebewijs en beperkingen](../../../../../../technical-regie-2026-10-23/continuation/step-14-camera/README.md) verwijzen ook naar focus/back, Owner/Visitor, canvasranden en Text-links. De onafhankelijke bronherreview bevestigt dat native pointer, toetsenbord en groep nu dezelfde limieten krijgen; hij voerde zelf geen browserrun uit.

Dit is gericht bewijs, geen volledige bronfreeze of bewijs dat ieder smal scherm vrij van overlay-overlap is. Individuele camera-hookinvarianten staan in de centrale lintledger. De gezamenlijke releasecontrole en gevulde performanceproef blijven open. Lokaal, ongecommit en ongepusht.

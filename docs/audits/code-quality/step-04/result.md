# Eigenaarschap en vaste regressiematrix

Negen bestaande gegevensverantwoordelijkheden en zestien risicovolle overgangen zijn getraceerd naar concrete implementaties en 39 bestaande testbestanden. De kaart is een beschrijving van code, geen nieuwe productautoriteit. De actuele uitvoeringsstatus blijft in [de voortgangslijst](../../2026-10-23/code-quality-progress.json).

De onderbouwde kaart, importrelaties, exacte testdeclaraties en machineleesbare matrix staan in `technical-regie-2026-10-23/continuation/step-04/` in het bovenliggende project. Het manifest bevat de 86 gelezen inputs; de voorbereiding draaide geen tests en wordt niet als nieuwe groene gedragsevidence gepresenteerd.

Vier concrete conflicten hebben één bestemming: automatische scope-exposure → stap 08; dubbele beslissingen tussen runtime-activatie en Workbench-selectie → 11; verschillende toolregistraties → 12; afwijkende foutpolicy van de oudere voorkeurenopslag → 15. Camera, Library en publicatie hebben al afgebakende owners; vervolgstappen moeten hun garanties toetsen voordat iets wordt verplaatst.

De matrix omvat profiel A/B, Workbench A/B, eigenaar/Visitor, selectie, opslagfouten, Undo, reload, inspectie, docking, Library-hergebruik, preview/publicatie en inputannulering. Werkelijke dekkingsgaten blijven zichtbaar: alle scope-capabilities, gezamenlijke selectie/tooltarget-overgangen, remount van toolregistratie met hetzelfde ID en late previewacceptatie. Ze worden bij hun verantwoordelijke stappen ingevuld. Bestaande testdeclaraties of cataloguscategorieën zijn geen bewijs dat die tests slagen.

Stap 08 heeft inmiddels de scopegrens en 123 unit-/8 browsercontroles toegevoegd; de onafhankelijke review vond geen blokkerende productbevinding. Dit sluit alleen dat deel van de matrix. De overige criteria blijven in hun bestaande stappen staan; het plan wordt niet opnieuw gestart.

# Stap16 — focus en invoer

De afgebakende focusterugkeerpaden zijn hersteld: Library selecteer/sorteer- en filtermenu, destination-panelcontroller, Library assetmenu en inline editor, en sluiten/heropenen van Discover. Een gedeelde kleine helper annuleert verouderde callbacks en bewaart een nieuwere focuskeuze. De inline Library-editor vindt zijn opnieuw gerenderde trigger terug. Een assetmenu met alleen uitgeschakelde opdrachten krijgt zelf toetsenbordfocus zodat Escape werkt. Vier eerdere hookobservaties zijn opgelost.

Gerichte bewijzen: preferences17/17 en Library-storage1/1; Discover5/5 en profile-routing5/5. De aangrenzende destinationsuite slaagde later17/17. De onafhankelijke styling/focusreview herhaalde preferences op de toen actuele bron17/17. Eerdere rode resultaten en hun precieze oorzaak blijven bewaard; dit is geen globale toegankelijkheidsclaim.

[Uitvoering en beperkingen](../../../../../../technical-regie-2026-10-23/continuation/step-16-focus/README.md) · [Onafhankelijke review](../../../../../../technical-regie-2026-10-23/continuation/reviews/styling-focus-review.md).

Alle wijzigingen zijn lokaal. De gezamenlijke definitieve broncontrole en releasechecks blijven open; status staat uitsluitend in de centrale voortgangslijst.

Dezelfde concrete race is aanvullend bewezen en hersteld bij Preview. De uitgebreide lifecycle-suite slaagt2/2, inclusief oudere requests, late focus en heropenen. Zie de Preview return extension in het uitvoeringsrapport.


## Exacte R12-toestanden en formaten

De vijf gerichte suites slagen gezamenlijk: 59/59, nul skips, 1170 bron-/testbestanden en vier productautoriteiten onveranderd tijdens de run. Publicatie, receipt-herstel, voorkeurenherstel en echte Preview-/Discoverterugkeer zijn op 390×844, 844×390 en 320×320 in Carbon/Mist aangevuld met native hit-tests en muisacties. Opgeslagen composities blijven gelijk. Alle bestaande assertionbetekenissen blijven behouden; de recoveryhoogtegrens is uitsluitend aan de gebruikte testhoogte gekoppeld. Bewijs: continuation/step-16-r12-final/README.md en verification/results.json.

R12-OBS01 blijft een concrete grens: bij een aanhoudende voorkeurenopslagfout kan de foutmelding de onderste Library-knop op 844×390 bedekken. Er is geen dismiss-knop. De bestaande retry is bereikbaar en verwijdert bij geslaagde opslag de melding; herstel, opgeslagen voorkeur en reload zijn getest. Deze tijdelijke overlap is niet opgelost en wordt niet als ontbrekende herstelroute geclassificeerd.

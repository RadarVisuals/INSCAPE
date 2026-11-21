# Reception: browserfouten hersteld — 12–13 november 2026

**Eindstatus: alle 118 releasesuites en alle 1.857 unit-/integratietests slagen.** De volledige eerdere ronde leverde 77 geslaagde en 41 falende suites op. De meldingen hadden gedeelde oorzaken; niet iedere falende suite vertegenwoordigde een afzonderlijke productfout.

## Productwijzigingen

| Eigenaar | Oorzaak | Herstel |
| --- | --- | --- |
| EditorCellsProvider | Zonder editorstore waren zowel optionele store als generatie undefined. Die vergelijkingen slaagden voor een lege appearancePreview, waarna null.patch de Visitor liet crashen. | Eerst controleren dat er een preview bestaat. |
| appendReceptionBentoRow | Een oneven rijhoogte leverde een niet-gehele standaardhoogte voor mobiel op. De documentvalidatie wees de volledige toevoeging af. | De nieuwe mobiele standaardhoogte afronden binnen de bestaande grenzen. |
| ReceptionDocumentCanvas | Een fractionele HTML-positie van de SVG-achtergrond kon de zichtbare dekking van een positieve gutter afronden. | Alleen de vulling krijgt een geheel fysieke layout-oorsprong plus fractionele vertaling. De celgroep, leden en nul-gutterpolicy blijven onder hun bestaande eigenaar. |
| EditorToolbarPopover | Het dialoogelement kon zelf geen focus krijgen; een gerichte Escape belandde daardoor in een invoerveld dat Escape gebruikt om invoer te annuleren. | tabIndex=-1 biedt een focustarget. De native popover en annulering van veldinvoer blijven leidend. |

## Bijgewerkte testverwachtingen

- Gemeten previewbreedte, leesinset en gedeelde padding volgen de actuele reader. De artikelinhoud blijft ongewijzigd.
- Strokes worden vergeleken met werkelijke geprojecteerde celranden, inclusief pixelafronding en schaling.
- Insettekst heeft geen dubbele ronde clip nodig; de test controleert de vrije hoekruimte.
- Z-volgorde wordt via de huidige celgroepen en geschilderde laagvolgorde gecontroleerd. Privétekst blijft uitgesloten.
- De SVG-reader gebruikt zijn HTML-viewport; native afmetingen, schaal en gecentreerde crop blijven gecontroleerd.
- CSS-kleuren worden als geschilderde sRGB-kanalen vergeleken; alpha blijft onderdeel van de vergelijking.
- De opslagfouttest neemt zijn baseline na de legitieme Inspector-selectieopslag.
- Invoeging richt zich binnen de celrand, buiten het afzonderlijke target aan de buitenrand. De preview moet met release overeenkomen. Noodzakelijke framewijzigingen zijn toegestaan; asset, crop, transform, artikelinhoud, Undo/Redo en opslag blijven gecontroleerd.
- Geometriegevoelige fixtures gebruiken vaste lege grids. De gutterfixture houdt cellen boven de leesdrempel om pixeldekking los van responsive herschikking te meten. De responsive tests blijven behouden.

Geen suites overgeslagen of verwijderd, geen budgetten of pixeldekkingstoleranties verruimd. De releasecatalogus blijft 118 suites.

## Bewijs vóór de brede browserronde

- 1.857 unit- en integratietests geslaagd; nul mislukt, overgeslagen of geannuleerd.
- De twee nieuwe regressies voor boven/onder toevoegen aan een oneven rij faalden vóór de afrondingsfix en slagen erna, inclusief Undo, Redo en opslagherstel.
- Lint, contractcontrole, formatting van de bestaande kernbestanden en productiebuild geslaagd.
- Productiebudgetten geslaagd: 726263 initiële JavaScript-bytes.
- Alle gerichte herstelscenario's geslaagd, waaronder de pixeltest voor de gutter en invoeging op 1440 en 800 pixels.
- De eerste herhaling van de oude 41 suites werd door een sessie-/omgevingsreset onderbroken. Afgeronde resultaten blijven diagnostisch bewijs; die ronde wordt niet als volledige verificatie aangemerkt.

## Eindverificatie

| Controle | Resultaat |
| --- | --- |
| Unit- en integratietests | 1.857 geslaagd; 0 mislukt, geannuleerd of overgeslagen |
| Release-browsersuites | 118 unieke suites volledig gedekt |
| Browserregressies | 614 geslaagd; 0 mislukt, geannuleerd, overgeslagen of todo |
| Procesopruiming | Alle 118 suites: verified; geen resterende processen of cleanupfouten in de eindrapporten |
| Lint | Geslaagd; 46 bestaande hookobservaties blijven afzonderlijk geregistreerd |
| Contracten | Strikte controle geslaagd; 40 ongeldige calls en 9 productiemutaties afgewezen |
| Core-opmaak | Geslaagd |
| Productiebuild en budgetten | Geslaagd; 726.263 initiële JavaScript-bytes |

De volledige catalogus is afgewerkt met twee onafhankelijk gestarte workers van elk 58 suites en een afsluitende herhaling van twee controles uit de onderbroken poging. De drie complete eindrapporten zijn alle geslaagd en controleren dezelfde bronhash: `c0d636955af5013690320847013f52bd97a47bb0cecd94ef75364b8a4a89fb2a`. Browser: Chrome 157.0.8103.78 op Windows, Playwright 1.61.1.

De samengevoegde resultaten staan in `output/reception-browser-remediation-2026-11-12/final-browser-summary.json`. De drie complete bronrapporten:

- `.browser-test-runtime/reception-browser-remediation-resume-0-1794526969150/browser.json`
- `.browser-test-runtime/reception-browser-remediation-resume-1-1794527083521/browser.json`
- `.browser-test-runtime/reception-browser-remediation-recheck-1794529121340/browser.json`

De catalogusdekking, unieke suitenamen, nul skips, geverifieerde cleanup en ongewijzigde bron zijn na afloop opnieuw gezamenlijk gecontroleerd. Visuele controle omvatte de Editor en daadwerkelijke invoegingspreview op 1440 en 800 pixels; een extra controle wachtte na herladen ook op werkelijk gerenderde cellen en Image.

## Afbakening van het bewijs

Onderbroken eerdere uitvoeringen, koude-start-time-outs en tijdelijke cleanup-time-outs tijdens vier gelijktijdige browsers blijven als diagnostisch materiaal bewaard. Zij zijn niet als eindbewijs geteld en zijn niet achteraf tot geslaagd of verified gewijzigd. De complete vervolgruns gebruiken de bestaande test- en cleanupgrenzen.

De productwijzigingen zijn lokaal. Er is geen compositie van de gebruiker aangepast en er zijn geen publicatie-, upload-, wallet-, commit-, push- of deployacties uitgevoerd. Geen Windows-, security- of toestemmingsinstelling is gewijzigd. De documentatie is na de verificatie bijgewerkt; de geteste product- en testbronnen blijven ongewijzigd.

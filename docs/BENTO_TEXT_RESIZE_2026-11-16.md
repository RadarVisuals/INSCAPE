# Bento Text: positie en afknippen — 16 november 2026

Lokaal aangepast; niet gecommit, gepusht of gedeployed. Bestaande gebruikerscomposities zijn niet gebruikt of aangepast voor de reproductie.

## Gevonden

In een reproductie met twee cellen en rechts een individueel gecentreerd tekstvak verplaatste 10 px horizontale celresize de tekst ook 3,801 px naar beneden. De framebreedte ging van 560 naar 551,813 px; tegelijk ging de hoogte onbedoeld van 520 naar 512,398 px. De uniforme schaalfactor van de uitlijning koppelde beide assen. Bij een hoogtewijziging kon dezelfde factor de tekst smaller maken en zijwaarts hercentreren.

Daarnaast knipte native Bento Text in de editor exact op de CSS-grens, dwars door een regel. Preview had daarvoor wel volledige-regelmeting. De verkorte framehoogte uit de eerste fout maakte dat voortijdige afknippen extra zichtbaar.

## Vervanging en eigenaarschap

- Individueel uitgelijnde Text gebruikt nu onafhankelijke assen: breedtewijzigingen laten hoogte en verticale positie intact; hoogtewijzigingen laten breedte en horizontale positie intact. De bijbehorende uitlijning blijft werken. Een zuivere verplaatsing draagt het volledige tekstvak mee.
- De bestaande excerptmeting is uit ReceptionTextPreview gehaald en ondergebracht in één gedeelde useTextExcerpt-hook. Native Text en publieke Reception gebruiken dezelfde meting, genormaliseerd naar lokale pixels zodat camerazoom geen extra verkleining van het afknipvlak veroorzaakt. Ook een gedeeltelijke eerste regel bij een binnenkomende celrand wordt weggelaten.
- De oude Preview-specifieke fadevariabelen en CSS-maskerregel zijn verwijderd. Geen tweede artikelrenderer, opslagroute of dependency toegevoegd.
- De bestaande Reception-scope, geometrie, geschiedenis en native artikelgegevens blijven de bron. Geometriewijzigingen herschrijven de artikeltypografie niet.

De eigen tekstvakhoogte blijft bewust bestaan: een kleiner tekstvak wordt niet automatisch tot aan de celbodem verlengd. Gemengde kunstwerkgroepen behouden proportionele schaal. Gefocust typen, geroteerde/gespiegelde tekst en meervoudige native kolommen behouden hun bestaande specifieke weergave; deze correctie is geen volledige audit van alle tekstmodi.

## Verificatie

- 100 gerichte unittests geslaagd: celgeometrie, Bento en Reception-scope. Inclusief verticaal verplaatsen zonder horizontale drift en behoud van responsieve projectie.
- Vier nieuwe browsergevallen geslaagd: 1440 en 900 px, vrije en gecentreerde tekst. Echte pointerdrag, live positie van letters, stabiele opgeslagen assen, volledige regels tot aan de beschikbare grens, Undo/Redo en herladen.
- Vijftien bestaande publieke Reception/reading-browsergevallen geslaagd, waaronder gestapelde tekst, echte celclipping, kort/lang artikel en ongewijzigde inhoud.
- Brede en smalle screenshots bekeken. De testfixture is geregistreerd voor toekomstige releasecontroles.
- Lint, contract-typecheck, build, productieplafonds, tokeninventaris, browsercatalogus en diff-whitespacecontrole van de gewijzigde bestanden geslaagd. Geen volledige unit-suite uitgevoerd.
- De ontwikkelserver op poort 5173 blijft beschikbaar. Een aparte testserver zorgde dat gewijzigde fixtures vers werden geladen; de bestaande ontwikkelserver kijkt alleen naar applicatiebronnen.

## Omvang van deze ronde

Ten opzichte van de lokale inhoud bij aanvang, los van eerdere wijzigingen en dit verslag:

| Onderdeel | Toegevoegd | Verwijderd |
| --- | ---: | ---: |
| Productiecode | 112 | 72 |
| Tests en fixture | 124 | 2 |
| Browsercatalogus | 5 | 0 |
| Actief contract | 12 | 2 |
| Gegenereerde tokeninventaris | 3 | 23 |

De netto groei van 40 productieregels verbindt de gedeelde meetfunctie met native Text en corrigeert schaal/zichtbare grenzen; de eerdere losse Preview-meting is daadwerkelijk verwijderd.

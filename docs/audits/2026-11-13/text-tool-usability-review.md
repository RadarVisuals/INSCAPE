# Text tool: onafhankelijke beoordeling van begrijpelijkheid

Datum: 13 november 2026. Status: onderzoek en voorstellen; geen productcode gewijzigd.

Aanvulling 13 november: de eerste uitvoeringsstap is inmiddels gedaan: ruimere vaste tekststart, standaard fit uit, de naam Fit box to text en een rustiger selectiekader. Zie [tekststart en selectie](reception-text-entry.md). De onafhankelijke beoordeling hieronder blijft als oorspronkelijk advies behouden.

## Oordeel

De Text tool kan veel en heeft al bruikbare veiligheidsgrenzen. Het grootste probleem voor een nieuwe gebruiker is dat een simpele bedoeling — “zet deze tekst hier en maak hem groter” — langs meerdere verschillende soorten selectie, grootte en uitlijning loopt. De controles zijn technisch verklaarbaar, maar die uitleg is nog onvoldoende zichtbaar op de plek waar de gebruiker kiest.

Mijn eerste stap zou daarom geen nieuwe teksteditor, aparte labelsoort of brede herindeling zijn. Maak eerst het huidige doelwit en het effect van de bestaande bediening herkenbaar. Daarna kan een kleine praktijktest bepalen welke controles werkelijk te ver weg zitten.

## Onderzoek en grenzen

Ik heb de actuele componenten, hun artikel- en celpaden en bestaande gedragstests gelezen in de applicatiecheckout. De branch was `codex/profile-work-index-2026-10-30`, met 1771 lokale statusregels tijdens inspectie. De ouderagent voert gelijktijdig andere toegestane auditcorrecties uit; dit is geen beoordeling van een schone commit of voltooide release.

Visueel bekeken:

- De recente Reception-screenshot `.browser-test-runtime/reception-preview-history-1794555369264/reception-native-editor/native-image-text-editor.png`: gevulde cel met native Image en Text, op celniveau geselecteerd. Dit bewijst de celpresentatie; er stond geen geopende Text-inspector op.
- `.browser-test-runtime/text-inspector-1440.png`, gewijzigd op 7 november: compacte Light-inspector met zichtbaar Selected text, Font/Style/Size/Tracking, Paragraph en disclosures. Dit is historisch visueel ondersteunend bewijs; actuele labels en gedrag zijn opnieuw in de code gecontroleerd.

Geen nieuwe browserrun, gebruikerstest, timingmeting of externe productvergelijking uitgevoerd. De onderstaande begripsproblemen zijn onderbouwde usabilityhypothesen, geen gemeten uitvalpercentages. Bestaande tests zijn als gedragsspecificatie gelezen, niet opnieuw uitgevoerd.

## Prioriteiten

| Prioriteit | Waar de gebruiker kan twijfelen | Wat de huidige code doet | Klein voorstel |
|---|---|---|---|
| 1 | “Ik selecteerde tekst, waarom verandert niet alles?” | Objectselectie en tekstselectie zijn verschillende scopes. Bij een lege tekstselectie zetten letteropmaakcommando’s kenmerken aan de cursor; ze formatteren niet automatisch het gehele artikel. | Toon de scope ook in de snelle Reception-balk: **Typing cursor**, **Selected text** of **Title**. Gebruik een tooltip met concrete uitleg. Overweeg daarna een expliciete actie **Select all text** als praktijktests daar behoefte aan tonen. |
| 1 | “Centreert dit mijn letters, mijn tekstvak of mijn hele blok?” | Alinea-uitlijning, verticale uitlijning binnen het tekstvak en negenpuntspositionering van het kader binnen de cel zijn aparte handelingen. | Benoem ze consequent als **Paragraph alignment**, **Text inside box** en **Box position in cell**. Houd de bestaande functies en eigenaars gescheiden. |
| 1 | “Fit to text: maakt dat de letters passend?” | Fit to text meet de inhoud en past het kader aan, begrensd door de cel. De lettergrootte wordt niet automatisch verkleind. Een handmatige kaderresize kan de automatische fit weer uitschakelen. | Noem dit **Fit box to text** en leg er kort bij: “The box follows the text size, up to the cell edges.” Toon de actuele aan/uitstand; de bestaande checkbox volstaat. |
| 2 | “Waarom blijft de tekst aan die kant vastzitten?” | Een gekozen positie is een blijvend celanker. Nogmaals op hetzelfde punt klikken verwijdert dat anker. Dat staat hoofdzakelijk in een tooltip. | Maak **Free placement** expliciet zichtbaar bij de negen punten, met de bestaande null-ankeractie. Bewaar togglen als snel alternatief. |
| 2 | “Waarom werkt Default size niet op deze letters?” | Individuele letteropmaak heeft voorrang op artikeldefaults; huidige uitleg zegt dat ook. Het is dus geen defect dat zo’n wijziging een zichtbaar fragment ongemoeid laat. | Behoud de default-disclosure en de bestaande resets. Gebruik zichtbare labels **Selected text** versus **Article defaults** en laat een reset benoemen welke default terugkomt. |
| 2 | “Ik zie het einde niet. Ben ik tekst kwijt?” | Het normale tekstvak kan clippen of scrollen; Reception Preview heeft daarnaast een bezoekersuittreksel en Read more. Focus writing opent de volledige auteurtekst. | Geef Overflow een contextzin: in Editor gaat dit over het tekstvak; Preview kan een uittreksel tonen. Behoud **Focus writing** dichtbij de basisbediening. |
| 3 | “Wat is Tracking / Line height / Article / Title?” | De tool combineert typografie voor korte labels en langere artikelen. Naast de body bestaat een onafhankelijk optioneel titelveld. | Gebruik **Letter spacing**, **Line spacing**, **Compact spacing** en **Paragraph spacing** waar dezelfde betekenis behouden blijft. Leg bij Title uit dat korte labels alleen hoofdtekst nodig hebben; die uitleg bestaat al en moet blijven. |
| 3 | “Ik typ een ongeldige waarde en die springt terug?” | TextTypographyInput past geldige waarden direct toe, bewaart incomplete invoer tijdens typen en herstelt de actuele waarde bij afronden. Het toont daarbij geen bereikmelding zoals de recent verbeterde CellNumber. | Trek de feedbackstijl gelijk: concrete geldige grenzen en een herkenbare annulering, met behoud van de eigen live-preview/Undo-semantiek. Deel niet blind dezelfde invoercomponent; hun commitgedrag verschilt. |

## Waarom de eerste drie punten zwaarder wegen

### Selectie en veranderen

De uitgebreide inspector heeft al een nuttige scoperegel: **At the cursor** of **Selected text**. De snelle balk voor een Reception-tekstvak toont direct font, grootte, vet, cursief, kleur en spacing, maar niet diezelfde zichtbare scoperegel. Daardoor kan juist de snelste route de minste uitleg geven.

De gewenste verbetering is eerst eerlijk tonen wat de bestaande actie doet. Automatisch “geen selectie betekent alles veranderen” invoeren zou normale schrijfbediening veranderen en het verschil tussen cursoropmaak en documentdefaults vervagen. Dat verdient eerst een concrete vergelijking en keuze; het volgt niet vanzelf uit dit onderzoek.

Bronnen: `src/text/ArticleEditor.jsx:192`, `:197`, `:218`, `:233`; `src/text/articleTypography.js`, `selectedTypography` en `setArticleTypography`.

### Drie relaties met eigen geometrie

| Relatie | Voorbeeld | Bestaande eigenaar |
|---|---|---|
| Letters/alinea binnen hun regel | Links, midden, rechts | Tiptap-alineaopmaak in ArticleEditor |
| Inhoud binnen een groter tekstvak | Boven, midden, onder | Artikelappearance verticalAlign in TextTools |
| Het volledige kader binnen een Reception-cel | Linksboven, midden, rechtsonder; celpadding | memberAnchors in EditorCellPositionControls |

Dat zijn nuttige functies, maar “Alignment” op meerdere plaatsen communiceert te weinig. Celpadding staat bovendien naast inner spacing van het artikel: ook daar zijn de afstanden echt verschillend. Een andere naam en een korte toelichting zijn kleiner en veiliger dan alles tot één magisch uitlijnmechanisme samenvoegen.

Een vergrendelde inhoud kan plaatsing blokkeren; een anker is echter geen vergrendeling. Een slot, een gekozen uitlijnpunt en automatische kaderfit mogen daarom niet als één “lock” worden uitgelegd.

Bronnen: `src/text/TextTools.jsx:56`, `:64`, `:87`; `src/reception/EditorCellPositionControls.jsx:20` t/m `:55`; `src/reception/receptionBento.js`, `anchorMembers`.

### Automatische kadergrootte

Nieuwe Reception-tekst start compact en transparant, met op het celvlak gekozen zwart of wit. Nieuwe tekst krijgt automatisch kaderfit en wordt aanvankelijk gecentreerd. Inhoud of lettertype wijzigen kan dat kader opnieuw laten meten. Dit is een goede basis voor namen en labels: eerst tekst maken, vervolgens zichtbaar positioneren.

De term Fit to text moet dit voordeel uitleggen. Het is geen “shrink text until it fits”, geen publicatiehandeling en geen garantie dat onbeperkte tekst zichtbaar blijft binnen een kleine cel.

Bronnen: `src/reception/receptionTextDefaults.js`; `src/reception/receptionTextFit.js`; `src/reception/receptionEditorScope.js:98` t/m `:113`.

## Wat ik zou behouden

- Eén native artikel en één editor, gedeeld door cel, Text tools en Focus writing. Geen nieuwe kopie van de inhoud of tweede savepad.
- De compacte Reception-balk voor gewone handelingen, met de onafhankelijke Text tool voor uitgebreidere opmaak.
- Het onderscheid tussen cursor/selectieopmaak en artikeldefaults. De bestaande Mixed fonts/Mixed styles en resets zijn waardevol.
- Transparante compacte nieuwe Reception-tekst en zelfstandige kleurkeuzes. Een themawissel mag bestaande inkt niet herschrijven.
- De bestaande plaatsingskeuzes en Fit-checkbox. Het probleem is eerst begrijpelijkheid; verwijderen zou ook nuttige artistieke controle wegnemen.
- Bevestigde lokale opslagstatus en herstel. TextWorkbench toont **Saved in this browser** of expliciete Retry/Replace-herstelacties; dit mag niet als gepubliceerd/IPFS worden gepresenteerd.
- Read more/Inspect voor bezoekers en Focus writing voor de auteur. Hun taak verschilt; dezelfde naam op beide zou opnieuw verwarren.

## Een kleine, reviewbare vervolgstap

1. Verbeter labels en scopetekst in de bestaande eigenaars: snelle Text-balk, celpositionering en Text box layout. Geen schemawijziging en geen extra instellingen.
2. Laat **Free placement** een expliciete bestaande actie worden en hernoem Fit to text naar Fit box to text.
3. Bekijk een echte korte naam met sublabel en een lang tekstblok op 1440 en 900 pixels, Dark en Light. Beide zijn desktopvensters; dit introduceert geen mobiele auteurmodus.
4. Laat iemand zonder uitleg vijf doelen uitvoeren: een naam invoeren, één woord vergroten, de hele naam centreren, vrij plaatsen, en lange tekst volledig openen. Noteer waar de verkeerde scope gekozen wordt.
5. Behoud en test tekstselectie, Ctrl+Z, opgeslagen kader-/ankerwaarden, fout bij opslaan, reload en Preview/public projectie. Een labelwijziging alleen bewijst nog niet dat de bediening begrijpelijker is.

Mijn volgorde: **eerst doelwit + uitlijning + kaderfit duidelijker**, daarna pas besluiten of de Text tool echt minder zichtbare functies nodig heeft. De huidige dichtheid is geen voldoende reden voor een brede herbouw.

## Bronmoment

SHA-256 tijdens inspectie:

| Bestand | Hash |
|---|---|
| ArticleEditor.jsx | 9623be8576c82655ead69e109f55a76bc30738fbbbe5c9c95c8ea6516de2ab28 |
| TextTools.jsx | d0d766434286c29c963b754d21ac15f93e90ec8e99677a79e6dd6099c220c7e1 |
| TextWorkbench.jsx | 9b19009c146456b50596395381401d3193ac15e0a42a412d54911b774ed166e3 |
| EditorCellPositionControls.jsx | 1e46381eb4c1ba9cc5f2295af487b68995fbb9876c021eb27085684c046ba821 |

Toepasselijke projectinstructies, actuele contractsecties voor Reception/tekst en creative intent zijn gelezen. De nieuwste expliciete besluiten gaan voor oudere, soms nog opgenomen beschrijvingen van Text-tabs en afmetingen. Dit rapport wijzigt die contracten niet. Alleen dit rapport is toegevoegd; geen commit, push, upload of publicatie.

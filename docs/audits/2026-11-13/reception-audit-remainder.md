# Reception: resterende auditpunten uitgevoerd

Datum: 13 november 2026. Werk staat lokaal, met behoud van de bestaande wijzigingen. Geen commit, push, publicatie, upload of walletactie.

## Uitkomst

De afgesproken vervolgpunten U2, T2 en C1–C3 zijn onderzocht en afgebakend aangepakt. De twee eerdere lifecyclehypothesen zijn nu daadwerkelijk gereproduceerd. De onafhankelijke [Text-review](text-tool-usability-review.md) bevat voorstellen; die voorstellen zijn niet stilzwijgend als nieuwe productrichting geïmplementeerd.

| Punt | Geconstateerd | Uitgevoerd |
|---|---|---|
| U2 — Fit/Fill | Toolbar en inspector gebruikten verschillende zichtbare namen. | Beide gebruiken Fit en Fill. Bestaande contextuele ARIA-namen en tooltips blijven uitleggen of het om een cel of beeldkader gaat. Crop, alignment en opslagregels blijven hetzelfde. |
| T2 — verticale tekst | De gevulde stacked-proef maakte één kolom van 136.500 px hoog. Er was al Read more, maar geen begrensde kolomstroom. | Verticale tekst stroomt binnen de beschikbare celhoogte door naar kolommen. De excerptmeting gebruikt voor die schrijfwijze de horizontale as en gemeten kolomeinden, met een fade naar rechts. Korte tekst krijgt geen leesactie. Inspectie toont het volledige artikel horizontaal als tijdelijke leesprojectie; de opgeslagen schrijfwijze blijft intact. |
| C1 — conversiefouten | De adapter verloor fouten vóór de canonical store; fouten konden daardoor als opslagprobleem verschijnen. | De boolean commitovereenkomst blijft bestaan, met een lokale foutreden voor locked, reception_command of invalid. Bestaande onderliggende redenen zoals stale en write_failed blijven doorgegeven. Text toont voor de twee specifieke conversieredenen een passende boodschap en behoudt de onopgeslagen inhoud. Een geaccepteerde nieuwe snapshot laat de oude lokale fout vervallen, onafhankelijk van listener-volgorde. |
| C2 — onderbroken inspectie | Documentvervanging tijdens openen liet transform, clip-path en andere animatiestijlen op bestaande lagen staan. | Cleanup gebruikt nu hetzelfde bestaande herstelpad als normaal sluiten. Tests dekken onderbreken tijdens openen én sluiten, opnieuw openen, resize en Escape. |
| C3 — hoogtewijziging | Bij gelijkblijvende breedte gaf 900 → 901 px op DPR 1 een celrand op een halve fysieke pixel; DPR 1,25 liet hetzelfde oorsprongsprobleem zien. | Eén oorsprongsmeting wordt hergebruikt na projectie, vensterresize, scroll en wijzigingen in de afmetingen van de host/parent. De test controleert fysieke randen en aansluitende nul-guttercellen op DPR 1, 1,25 en 2. |

## Eigenaars en verwijderde herhaling

ImageWorkbench houdt de beeldpassing. ReceptionTextPreview houdt uitsluitend de tijdelijke excerptmeting. ReceptionDocumentCanvas houdt de leesprojectie en fysieke paintoorsprong. ReceptionCellLift ruimt zijn eigen tijdelijke DOM-stijlen op. De Reception-adapter blijft een capability over de bestaande canonical store; de lokale foutreden is geen tweede opgeslagen document.

Het aparte, onvolledige cleanup-pad van de lift is vervangen door restore. De dubbele oorsprongsmeting is samengebracht. De tekstmeting bewaart geen tijdelijke array met alle geschikte eindpunten meer. Herhaalde native modulelijsten, native recordprojectie en de lockfoutconstructie zijn hergebruikt.

Om de bestaande bundelgrens te respecteren, is de al aanwezige recordvalidatie hergebruikt in nog enkele bestaande consumers. Identieke verplichte/optionele-keychecks uit Article, Workbench Index en V9-validatie gebruiken één helper; hun toegestane velden blijven bij hun bestaande eigenaar. De publieke Article-exact-export blijft bestaan. Keeper dialogue/swim, Reception-links, draft-history en editorvoorkeuren gebruiken bestaande record-/exact-keychecks. Er is geen nieuwe dependency, migratie of budgetcategorie toegevoegd. De anders gedefinieerde Lattice-check blijft behouden.

Productiedelta tegenover de startsnapshots: **77 regels toegevoegd, 62 verwijderd, in 16 bestanden**. Tests, de bijgewerkte CSS-inventaris en documentatie zijn daarin niet meegeteld. De inventaris heeft nog steeds 101 stylesheets; 713 definities en 396 namen. De extra CSS beschrijft de begrensde verticale excerpt en de richting van zijn fade.

## Definitieve verificatie

| Controle | Uitkomst |
|---|---|
| Volledige unit-/integratieset | 1.862 geslaagd; geen failures, skips of annuleringen |
| LUKSO-standards | 5 geslaagd; ook onderdeel van de unitset, dus niet nogmaals bij die 1.862 optellen |
| Context action bars | 11 browsercases geslaagd; Fit → Fill → Undo controleert een echte wijziging en behoud van Display |
| SVG-breakpoints | 1 browsercase geslaagd |
| Beeldinspectie en nieuwe lees-/herstelproeven | 8 browsercases geslaagd |
| Celinteractie | 5 browsercases geslaagd |
| Laatste native opslaghertest | 3 browsercases geslaagd: twee Preview/history-breedtes en documentwissel |
| Lint, typecontracten en core-formatting | Geslaagd |
| Build, bestaande bundelgrenzen en aparte 40-teken metadata-build | Geslaagd |
| Opruiming | Definitieve runners en visuele proef verified; geen resterende geobserveerde processen |

Dit zijn **28 definitieve browsercases**. Deze controles gebruiken bronhash `c71dbd3e88899cc50d88ac5fcb8abe8dbc9b1788cdd3698ca8a30efdc6d4f56e`. Rapporten en de statusreconciliatie zijn daarna toegevoegd; de geteste productiecode is niet nadien gewijzigd.

Een eerdere brede native run had 51/51 geslaagde cases. De bronbewaking verklaarde die totale run ongeldig doordat tijdens de run de laatste foutstatuscorrectie werd opgeslagen. Hij wordt daarom niet als definitieve volledige native-suiteclaim meegeteld. De geraakte Preview/history- en documentwisselpaden zijn daarna opnieuw op de definitieve bron getest. De volledige 118-suiterelease is in deze ronde niet opnieuw uitgevoerd.

Vroege nieuwe tests zijn gecorrigeerd waar zij geen geldig gedrag maten: een lockproef zonder DOM-meetfunctie is losgemaakt van automatische tekstfit; herstelde stijlen worden op exacte propertywaarden vergeleken in plaats van CSS-declaratievolgorde; verticale Range-boxes kunnen door fontmetriek overlappen, dus de grens moet aansluiten bij een volledig gemeten kolomeinde; de Fill-Undo-proef begint expliciet met Fit zodat Undo een echte Image-wijziging herstelt. Er zijn geen skips, ruimere budgetten of geforceerde interacties toegevoegd.

## Bundel en grenzen

Development-metadata: core JavaScript **2.743.864 raw / 901.961 gzip bytes**. De bestaande rawlimiet is 2.744.000: **136 bytes marge**. Met 40-teken releasemetadata is core **2.743.893 raw / 902.123 gzip bytes**, met **107 bytes marge**. Initieel JavaScript blijft 726.263 bytes in de development-build; releasemetadata geeft 726.292 bytes.

De ruimte blijft dus erg klein. Dit is geen nieuwe laadtijd- of inputlatencymeting en geen claim dat alle toekomstige toevoegingen binnen het budget passen. De metadata-build bevat lokale wijzigingen en bewijst niet dat HEAD die wijzigingen bevat.

De bestaande breedteslider, presets, pixelinvoer, responsive instellingen in Preview en gedeelde Undo/Redo blijven behouden. Geaccepteerde tekstinsets en gewone horizontale excerptregels blijven behouden. Rotatie en mirroring houden hun bestaande volledige celinspectie; er zijn geen nieuwe tekstrollen geïntroduceerd. Voor willekeurige DOM-verplaatsingen zonder resize/scroll is geen volledige browsermatrix uitgevoerd. Algemene pauzering van verborgen SVG-animaties blijft onbewezen optimalisatiewerk en is niet toegevoegd.

Visueel bekeken: verticale excerpt op 1280 px, volledige lezer op 1280 en 900 px, en een aanvullende proef op beide breedtes met geladen lokale artwork. De leesproeven gebruiken herhaalde echte tekst; de aparte beeldinspectie blijft bronratio, crop, transforms en mounted-mediaovergangen controleren.

## Bewijs

- `.verification/reception-audit-remainder-1794558062804/verification.json`
- `.browser-test-runtime/reception-audit-remainder-reading-final-1794558063084/browser.json`
- `output/reception-audit-remainder-2026-11-13/native-history-summary.json`
- `output/reception-audit-remainder-2026-11-13/head-metadata-summary.json`
- `output/reception-audit-remainder-2026-11-13/summary.json`
- Startsnapshots, voor-/naproeven, stijllek- en oorsprongsmetingen en screenshots in dezelfde outputmap.

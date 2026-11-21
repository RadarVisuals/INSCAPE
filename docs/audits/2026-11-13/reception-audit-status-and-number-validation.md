# Reception-audit — actuele stand en nummerinvoer, 13 november 2026

Aanvulling 13 november: U1 is inmiddels uitgevoerd met behoud van de responsive instellingen én breedtebediening in Preview. Zie [Preview-status en geschiedenis](reception-preview-history.md) voor de definitieve nieuwe verificatie.

Aanvulling 13 november: ook U2, T2 en de afgebakende C1–C3-vervolgpunten zijn uitgevoerd. Zie [resterende auditpunten](reception-audit-remainder.md) voor de definitieve verificatie en grenzen; [de onafhankelijke Text-review](text-tool-usability-review.md) bevat afzonderlijke voorstellen.

## Uitkomst van deze ronde

De geprioriteerde bevindingen uit de [oorspronkelijke audit](https://chatgpt.com/library?file_id=libfile_6947a2d9b7d88191b3f8e35f1c7470f5&account_id=personal) zijn naast de huidige code, het actieve contract en de recente meet-/verificatierapporten gelegd. Die oude audit blijft ongewijzigd; dit verslag beschrijft de vervolgsituatie.

De bouw- en testblokkades uit die audit zijn opgelost. De discussie over centre-swap is achterhaald door de expliciete native acceptatie van 11 november; de dedicated Split-opdracht is op later verzoek volledig verwijderd. Niet elke suggestie uit de audit is daarmee een nog open productfout. De huidige leesinset en excerpts zijn expliciet geaccepteerd gedrag.

Eén concrete correctie is in deze ronde uitgevoerd: ongeldige nummerinvoer geeft nu gekoppelde uitleg bij het veld. De opgeslagen waarde en geschiedenis blijven intact totdat een geldige wijziging wordt bevestigd. De rest van de ronde is statusreconciliatie, geen nieuwe volledige app-audit.

## Geprioriteerde bevindingen opnieuw beoordeeld

| ID | Actuele status | Bewijs / betekenis |
|---|---|---|
| B1 — JavaScript-budget | Opgelost | Linkdetectie-dependencies verwijderd in de eerdere releasepoortstap; huidige build en bestaande budgetten worden hieronder opnieuw gecontroleerd. Geen plafonds of categorieën verruimd. |
| Q1 — ontbrekende suites | Opgelost | Beide suites staan in de releasecatalogus. De normale browserrunner kan reception-image-inspect en reception-svg-breakpoints selecteren. De laatste draait in deze ronde opnieuw. |
| Q2 — inventaris / prototypeverwachting | Opgelost | De ankerproeftest volgt de bestaande proportionele native constraints; de volledige unitset is nadien groen. De inventaris is voor deze nieuwe lokale veldstylesheet gecontroleerd bijgewerkt. |
| A1 — Split / centre-swap | Afgehandeld | Split is verwijderd op expliciet verzoek. Centre-drops die slots uitwisselen zijn toegestaan in “Native integration authorised after the trial (2026-11-11)”. Ze vormen dus geen open afwijking op grond van de oudere drag-richting. Merge blijft bestaan. |
| U3 — stille ongeldige invoer | In deze ronde hersteld | CellNumber toont het bereik en zo nodig de eis voor een geheel getal. Zie gedrag en regressies hieronder. |
| U1 — Preview kan opslaan | Afgehandeld in vervolgstap | Responsive instellingen blijven in Preview op expliciete keuze van de founder. Uitleg, de bestaande lokale save-status en gedeelde Undo/Redo zijn toegevoegd. Slider, presets en pixelveld blijven tijdelijk. Zie reception-preview-history.md. |
| U2 — Fit/Fill-woordenschat | Afgehandeld in vervolgstap | Toolbar en inspector gebruiken beide Fit/Fill; context blijft in ARIA en tooltips. Cropgedrag behouden. Zie reception-audit-remainder.md. |
| T2 — horizontale tekstoverflow | Gereproduceerd en hersteld in vervolgstap | Stacked writing is begrensd op celhoogte, stroomt door naar kolommen en krijgt horizontale excerptmeting met leesactie. Inspectie is een horizontale leesprojectie; opgeslagen schrijfwijze blijft intact. |
| C1 — conversiefout verliest oorzaak | Afgebakend afgehandeld in vervolgstap | Bekende adapterweigeringen behouden locked/reception_command/invalid; Text geeft specifieke uitleg waar beschikbaar. Onderliggende opslagredenen blijven bestaan. Oude foutstatus vervalt bij een geaccepteerde snapshot, ongeacht listener-volgorde. Dit is geen vervanging van alle modulefoutmeldingen. |
| T1 — reader-inset / tekstkader | Geaccepteerde leesprojectie, geen bewezen nieuwe fout | Het actuele contract verlangt ademruimte, ruimte voor Read more en begrensde excerpts. De huidige 16/24px-inset is daarmee te behouden. Uitleg en een expliciete gedragsmatrix voor bijzondere opmaak blijven nuttig. Een nieuw leesbaar/artistiek tekstrolsysteem is niet als productrichting geaccepteerd en wordt hier niet ingevoerd. |
| P1 — dubbele mounted media | Deels aangepakt; verdere pauzering niet bewezen nodig | De gedeelde paintqueue levert identieke bron/resolutie-resultaten via leases. De eerdere gevulde proef liet bij Preview 32 tijdelijke URLs dalen naar 2 en na sluiten naar 0. Editor blijft gemount voor zijn sessie/history. Dit bewijst geen universele besparing op netwerk/GPU en dekt geen algemene pauze van onzichtbare SVG-animaties. |
| C2 — onderbroken lift / reststyles | Gereproduceerd en hersteld in vervolgstap | Documentwissel tijdens openen liet animatiestijlen staan. Cleanup gebruikt nu restore; regressies controleren openen, sluiten en opnieuw inspecteren. |
| C3 — canvasoorsprong bij hoogte-only wijziging | Gereproduceerd en hersteld in vervolgstap | Alleen vensterhoogte veranderen kon fysieke pixelranden verschuiven. Gedeelde oorsprongsmeting reageert op resize/scroll/hostafmetingen; hoogteproeven op DPR 1, 1,25 en 2 slagen. |

## Uitgevoerde correctie U3

CellNumber bezit alleen de tijdelijke veldinvoer en de validatiemelding. De bestaande HTML-numberconstraints blijven bepalen of een nieuwe waarde geldig is. De canonical Reception-store, capabilitygrens, generatiecontrole, opslag en Undo zijn niet vervangen.

Bij blur of Enter blijft ongeldige invoer zichtbaar om te corrigeren. Een melding vermeldt het toegestane bereik; voor integer-only velden wordt “a whole number” gebruikt. aria-invalid en aria-describedby verbinden het veld met de zichtbare alert. Geen ongeldige waarde wordt doorgegeven aan onChange. Escape herstelt de laatst opgeslagen weergave en verwijdert de melding, zonder bewerking.

Een onaangeraakte afgeronde weergave wordt nog altijd niet teruggeschreven over de preciezere opgeslagen waarde. Geldige invoer gebruikt het bestaande commitpad. Bij opslagweigering of domeinnormalisatie herstelt dat pad de opgeslagen weergave, zoals voorheen; bestaande savefoutmeldingen blijven bij de store/inspector. De lokale melding wordt ongeldig wanneer de bijbehorende waarde of constraints veranderen.

De oude stille-resetroute voor ongeldige waarden is verwijderd. Er is één gedeelde implementatie voor celgrootte/radius, padding, responsive posities/hoogte en previewbreedte. Geen tweede veldcomponent, store, schema, voorkeur, dependency of compatibiliteitspad toegevoegd. De nieuwe stylesheet bevat alleen de foutvariant en bestaande ink-tokengebruik; geldige controls houden hun huidige opmaak. De CSS-inventaris groeit van 100 naar 101 bestanden, met dezelfde 710 definities en 395 namen. Ten opzichte van de startsnapshots: productiecode 26 regels toegevoegd en 7 verwijderd (inclusief 2 regels lokale CSS); browsertests 65 regels toegevoegd; de gegenereerde inventaris en dit verslag staan daar los van.

## Regressies en visuele controle

Twee nieuwe gedragstests gebruiken de echte native editor en Preview, op 1440 px Dark en 900 px Light. Ze controleren bovengrens, ondergrens en leeg veld; melding en toegankelijke koppeling; geen draft- of historywijziging; Escape; corrigeren naar een geldige radius; Undo, Redo en herladen; integer-validatie van previewbreedte; en dat een geldige previewbreedte tijdelijk blijft.

De tests falen tegen het oorspronkelijke CellNumber op de ontbrekende aria-invalid/uitleg, op beide breedtes. Dat is gereproduceerd met een Vite-overlay zonder de productiebron terug te zetten. Na de correctie slagen ze. Een vroege na-proef las de previewbreedte vóór ResizeObserver de effectieve maat had teruggeleverd; de test wacht nu op die daadwerkelijk getoonde breedte en behoudt de exacte waardecontrole.

Screenshots zijn bekeken voor de ongeldige radius en previewbreedte op beide breedtes, met Dark en Light. De melding staat bij het veld, de header/inspector blijft binnen zijn beschikbare breedte en de controls blijven bereikbaar. Afbeeldingen staan als testbewijs in de outputmap, niet als bewerkte gebruikerscompositie.

## Verificatie

| Controle | Uitkomst |
|---|---|
| Volledige unit-/integratieset | 1.857 geslaagd, 0 mislukt/overgeslagen/geannuleerd |
| Native Reception editor | 49 browsercases geslaagd, inclusief de twee nieuwe |
| Celinteractie | 5 browsercases geslaagd |
| SVG-breakpoints / previewbreedtes | 1 browsercase geslaagd |
| Lint, contracten en core-formatting | Geslaagd |
| Productiebuild en bestaande bundelgrenzen | Geslaagd; 726.263 initiële JavaScript-bytes |
| Oorspronkelijke CellNumber via overlay | Beide nieuwe tests falen op de ontbrekende feedback, zoals verwacht |
| Procesopruiming | Alle drie browsersuites en verificatiestappen verified; geen resterende geobserveerde processen |

Samen 55 gerichte browsercases, zonder failures, skips, annuleringen of todo. Unit- en browserverificatie controleren dezelfde bronhash: 5d9ad0df61f16651bc6847fcdef1bcad506b096683857b69d236d7d5d9ed02e5. Bewijs: .verification/reception-audit-followup-1794548431578/verification.json en .browser-test-runtime/reception-audit-followup-1794548431799/browser.json; samengevat in output/reception-audit-followup-2026-11-13/summary.json. De inventarischeck zit in de geslaagde unitset; de gegenereerde diff bevat uitsluitend de nieuwe veldstylesheet en het bestandenaantal. Dit verslag is pas na de controle toegevoegd.

## Vervolgstatus

De genoemde vervolgvolgorde U2 → T2 → C1–C3 is uitgevoerd in reception-audit-remainder.md. De onafhankelijke Text-review bevat nieuwe voorstellen voor begrijpelijkheid; die zijn nog geen uitgevoerde herindeling.

Nieuwe tekstrollen, een nieuwe gridbibliotheek, algemene recordcaches of een brede componentopsplitsing zijn geen verplichte voorwaarden voor deze vervolgstappen. De laatste invoermeting geeft geen aanleiding voor nog een algemene performance-ingreep.

## Bronmateriaal

- Actuele AGENTS.md, INSCAPE_ACTIVE_CONTRACT.md en INSCAPE_CREATIVE_INTENT.md.
- docs/audits/2026-11-12/reception-release-gate.md en reception-shared-image-preparation.md.
- docs/audits/2026-11-12/reception-cell-geometry-and-split-removal.md.
- docs/audits/2026-11-13/reception-browser-remediation.md, reception-typing-geometry.md en reception-input-latency.md.
- Actuele eigenaars: CellNumber, ReceptionEditorPreview, ReceptionTextPreview, ReceptionDocumentCanvas, ReceptionCellLift, receptionEditorScope, ImageWorkbench en de releasecatalogus.

De oudere volledige browserverificatie (118 suites / 614 cases) blijft bewijs van dat eerdere checkpoint. Ze wordt niet opnieuw als volledige controle van de huidige wijzigingen opgevoerd. Deze ronde draait de getroffen browserpaden en de volledige unitset opnieuw.

Alle wijzigingen zijn lokaal. Geen gebruikerscompositie gewijzigd, geen commit, push, upload, walletactie, publicatie of deploy uitgevoerd. Bestaande lokale wijzigingen zijn behouden; de beschermde continuation-handoff is niet gelezen of gewijzigd.

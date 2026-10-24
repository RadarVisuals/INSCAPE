import { readFile, writeFile } from 'node:fs/promises';
const root = 'docs/audits/2026-10-21/nomad-export-comparison';
const data = JSON.parse(await readFile(root + '/summary.json', 'utf8'));
const quality = JSON.parse(await readFile(root + '/quality.json', 'utf8'));
const pixels = JSON.parse(await readFile(root + '/pixel-comparisons.json', 'utf8'));
const preservation = JSON.parse(await readFile(root + '/preservation.json', 'utf8'));
const f = value => value.toFixed(1).replace('.', ',');
const row = (variant, active = 4) => data.summary.find(s => s.variant === variant && s.active === active);
const names = { full: 'Referentie op 60 fps', half: 'Halve beeldlagen', quarter: 'Kwart beeldlagen', vector: 'Vectorpaden', loop: 'WebP-lus' };
const cpuRows = Object.keys(names).map(v => `| ${names[v]} | ${f(row(v,1).overviewCPU)}% | ${f(row(v).overviewCPU)}% | ${row(v).overviewRange.map(f).join('–')}% |`).join('\n');
const fileRows = Object.keys(names).map(v => `| ${names[v]} | ${(row(v).bytes / 1e6).toFixed(2).replace('.', ',')} MB | ${['vector', 'loop'].includes(v) ? 'Geen eigen WebGL-texturen' : f(row(v).textureRGBAWithMipsMiB) + ' MiB'} |`).join('\n');
const body = `De halve beeldlagen zijn de beste balans in deze lokale Nomad-proef: de bestaande reactieve beweging blijft behouden en de berekende WebGL-textuurop slag daalt met ongeveer 75%, van 132,5 naar 33,2 MiB per exemplaar. Het CPU-verschil is veel kleiner. De vectorproef en de vooraf gerenderde WebP-lus vragen in deze uitvoering meer CPU-werk dan de oorspronkelijke beeldlagen. Een ander bestandsformaat is hier dus geen automatische snelheidswinst.

Er zijn vijf afzonderlijke SVG-bestanden gemaakt en getest. De [vergelijkpagina](../../../output/nomad-export-study-2026-10-21/compare.html) laadt één gekozen versie tegelijk. [NOMAD-half.svg](../../../output/nomad-export-study-2026-10-21/NOMAD-half.svg) is mijn voorkeursproef voor normaal gebruik; het oorspronkelijke volledige artwork blijft de detailbron. Dit zijn lokale artworkkopieën, geen vervanging in de applicatie of een gepubliceerde standaard.

**Omzettingen en behouden gedrag.** De referentie is de bestaande Nomad met 39 stilstaande transparante WebP-lagen, een WebGL2-doekrenderer en live vliegbeweging, nu begrensd op 60 tekenbeurten per seconde. Halve en kwartlagen behouden alle 39 lagen, wereldposities, laagvolgorde, zwarte onderlagen, vaste kern, rig en shader. Alleen de pixelmaten veranderen naar respectievelijk 50% en 25% per as. Het verkleinen gebeurt met vooraf met alpha vermenigvuldigde kleuren om donkere transparantieranden te vermijden. De verkleinde beelden zijn daarna verliesloos als WebP opgeslagen; de resampling zelf verliest uiteraard detail.

De vectorvariant gebruikt de oorspronkelijke voorkanten als curves. Negentien zwarte onderlagen zijn benaderd vanuit de alpha van de bestaande voorbereide lagen, met een drempel van 128/255 en contourvereenvoudiging van maximaal 0,6 bronpixel. De bronregels voor vulling zijn behouden. De 39 groepen leveren samen 65 paden. Dezelfde doekformule beweegt de curvepunten in JavaScript; dat benadert de oorspronkelijke vervorming door een driehoeksnet en is geen exact gelijke geometrie. Wind en live vliegen werken; de diagnostische laagkleuring is uitgeschakeld.

De WebP-lus is 512 × 568 pixels, 240 beelden, 30 beelden/s en acht seconden lang. De kleding is opgenomen met wind 35% en kledingsnelheid nul; de live vliegbeweging en slepen blijven op maximaal 60/s werken. De kleding reageert niet meer op veranderende wind of vliegsnelheid. Voor een gesloten lus zijn de twee doekfrequenties licht aangepast van 2,2 en 3,7 naar 2,356 en 3,927 rad/s. Pauzeren/verbergen schakelt over naar een stilstaande poster; hervatten start de lus opnieuw. Dit is een afzonderlijk decoratief alternatief, geen gelijkwaardige vervanging van reactief doek.

De lus gebruikt WebP-kwaliteit 90 met exact behouden alpha; de gemeten PSNR op vooraf met alpha vermenigvuldigde kleuren is 50,9 dB. Het beginbeeld en de opnieuw berekende houding op acht seconden verschillen maximaal ${pixels.loopSeamAt0And8Seconds.maxChannelDelta}/255 per kanaal. Een eerste WebP-proef op 60 beelden/s was 7.373.164 bytes: alleen de base64-tekst zou al circa 9,83 MB vragen, nog zonder SVG-wrapper en poster. Dat overschrijdt de bestaande hostlimiet van 8 MiB aan brontekst. De geteste 30-fps-versie past binnen die limiet.

| Variant | Zelfstandig SVG | Berekende eigen texturen per Nomad |
| --- | ---: | ---: |
${fileRows}

De textuurgetallen tellen RGBA8 en de werkelijk gebruikte mipmapmaten op. Ze zijn geen directe meting van VRAM of totaal browsergeheugen. Vier aanwezige Nomads houden hun eigen texturen, ook als er maar één beweegt. Geen eigen WebGL-texturen betekent bij vector en lus niet dat er geen browser-, raster- of decodegeheugen nodig is. De lus is als bestand circa 5,7 keer zo groot als de referentie.

**Metingen in dezelfde gevulde Workbench.** Er zijn dertig volledige runs: vijf varianten met één of vier bewegende Nomads, telkens driemaal. De tweede ronde gebruikt de omgekeerde volgorde. Alle vier de Nomads blijven aanwezig; bij één actieve staan de andere drie stil. De Workbench bevat dezelfde zestien afbeeldingen, twaalf teksten met 144 alinea's, 24 vormen, twee stilstaande HTML-panelen en de ongewijzigde Keeper. Van acht opgeslagen Workbenches is er één actief.

Iedere run doorloopt 100% en 30% zoom, zoomen/slepen, typen, opslaan, wisselen, terugkeren en herladen. Onderstaande waarden zijn medianen bij 30% zoom, wanneer alle vier exemplaren zichtbaar zijn. CPU telt Chrome-rendererprocessen plus het Chrome-GPU-proces: 100% is één volledig bezette CPU-kern. Het is geen percentage hardware-GPU-bezetting of van de hele computer.

| Variant | CPU met 1 bewegend | CPU met 4 bewegend | Bereik met 4 over 3 runs |
| --- | ---: | ---: | ---: |
${cpuRows}

Bij vier bewegende Nomads is het CPU-verschil van halve lagen tegenover de referentie ongeveer ${f((1-row('half').overviewCPU/row('full').overviewCPU)*100)}%. De referentie en verkleinde varianten voeren nog steeds 39 tekenopdrachten per beeld uit. Kleinere beelden halen dus vooral de textuurdruk omlaag; ze nemen die herhaalde opdrachten niet weg. De vectorvariant gebruikt circa ${f(row('vector').overviewCPU/row('full').overviewCPU)} keer en de lus circa ${f(row('loop').overviewCPU/row('full').overviewCPU)} keer de CPU van de referentie. Die uitslag geldt voor deze concrete omzettingen; een veel eenvoudiger vectoranimatie kan anders uitvallen.

De lopende vliegklokken bleven tussen ${Math.min(...data.summary.map(s=>s.clockRatio[0])).toFixed(3)} en ${Math.max(...data.summary.map(s=>s.clockRatio[1])).toFixed(3)} seconde per echte seconde. De live tekenfrequenties bleven rond 60/s; bij de lus is dat de live plaatsing, terwijl de kleding afzonderlijk 30/s afspeelt. De meetbestanden bewaren ook intervallen tussen tekenbeurten, procesgeheugen en resultaten op 100% zoom. De korte stilstaande meetvensters duren 2,2 seconden. Het Chrome-proces en driver houden caches vast; de procesgeheugencijfers zijn daarom geen zuivere per-artworkmeting.

De machine is een ${data.machine.cpus}, 16 logische CPU's, circa 32 GiB RAM, Chrome ${data.machine.browser}, met ANGLE/D3D11 op een RTX 2080. De meting gebruikt een eigen tijdelijk browserprofiel en echte GPU-versnelling. De smalle beeldcontrole emuleert schermdichtheid 2; dit is geen benchmark op een echte telefoon of in Safari/Firefox.

**Detail en levensduur.** De ${quality.evidence.length} beeld- en gedragscombinaties omvatten iedere variant op 120 pixels breed/DPR1, 800/DPR1 en 320/DPR2. Bij groot weergeven verliest de kwartvariant zichtbaar detail in de zeis; de halve variant blijft dichter bij de referentie. De vector blijft scherp maar tekent randen en doek anders. De lus oogt zichtbaar zachter bij vergroten. Een stilstaande opname bewijst niet dat een andere vervorming artistiek identiek is; de vergelijkpagina laat die verschillen tijdens afspelen zien.

![Referentie met volledige beeldlagen](nomad-export-comparison/full-wide.png)

![Halve beeldlagen in dezelfde houding](nomad-export-comparison/half-wide.png)

Pauze/hervatten, verbergen/hervatten, aanvankelijke en later ingeschakelde verminderde beweging, onafhankelijke kopieën en verwijderen van hun documenten zijn gecontroleerd. WebGL-contextverlies toont bij de drie rastervarianten de stilstaande terugval. Alle vijf werken als stilstaande afbeelding wanneer scripts niet draaien. De WebP is apart met stilgezette live plaatsing gecontroleerd: de kleding verandert werkelijk van pixels en stopt bij de posterwisseling. Wind verandert de getekende pose bij referentie, half, kwart en vector; de lus blijft op haar vaste wind.

De geëxporteerde bestanden zonder meethooks zijn ook zelf geopend op brede en smalle schermen. De vergelijkpagina houdt één iframe geladen en pauzeert/hervat de gekozen variant. Tijdens de Workbenchruns blijven opslaan, HTML-posities, inhoud in andere Workbenches en herladen correct. Na overschakelen naar de lege Workbench zijn in alle dertig runs alle uitvoerbare artworkdocumenten verwijderd.

**Wat hiermee wel en nog niet verandert.** De conversie blijft binnen het artwork; de Workbench blijft eigenaar van plaatsing, schermdichtheid en actieve levensduur. Er is geen nieuwe applicatiecache of parallel opslagmodel toegevoegd. Het hostpad voor dichtheidsmetingen en het opnieuw maken van artworkdocumenten tijdens navigatie is niet aangepast. De navigatiehaperingen uit de eerdere proef zijn daarmee niet opgelost; kleinere texturen of het ontbreken van textureuploads veranderen een deel van de kosten, maar niet het hele hostpad. Verdere CPU-optimalisatie vraagt waarschijnlijk minder afzonderlijke tekenopdrachten; dat is een nieuwe hypothese om afzonderlijk te meten.

Mijn keuze is daarom **halve beeldlagen met de bestaande reactieve renderer en de 60-fps-limiet**, met de volledige bron behouden voor grote detailweergave. De kwartvariant is bruikbaar wanneer de figuur klein blijft. De vector- en lusversies blijven vergelijkmateriaal; de gemeten kosten en hun afwijkende beeldgedrag rechtvaardigen hier geen overstap.

**Bewijs en behoud.** De checkout staat op \`codex/audit-checkpoint-2026-10-19\`, HEAD \`32d9418843d996afc2e5203afa4552a6cd2d459a\`. De gelezen succesvolle [Verify Inscape-run](https://github.com/RadarVisuals/INSCAPE/actions/runs/39416407131) geldt voor die commit; de lokale proef is geverifieerd met de huidige vuile checkout. De benchmark bouwt de actuele fixture; er is geen nieuwe volledige releasecheck gedaan omdat geen productiecode is gewijzigd.

De [ruwe runs](nomad-export-comparison/benchmark.json), [samenvatting](nomad-export-comparison/summary.json), [beeldcontroles](nomad-export-comparison/quality.json), [pixelverschillen](nomad-export-comparison/pixel-comparisons.json), [conversiegegevens](nomad-export-comparison/conversion.json), [lusgegevens](nomad-export-comparison/loop.json) en [behoudcontrole](nomad-export-comparison/preservation.json) zijn opgeslagen. Van ${preservation.length} vooraf vastgelegde bestaande bestanden/afwezigheden bleven er ${preservation.filter(p=>p.unchanged).length} identiek; uitsluitend de twee bestaande benchmarkbestanden zijn uitgebreid. Het oorspronkelijke SVG, de vectorbron, voorbereide bronlagen, Keeper-proef en alle bestaande productwijzigingen bleven behouden. Er is niets gecommit, gepusht, geüpload of gedeployd.
`;
await writeFile(root + '.md', body.replace('textuurop slag', 'textuuropslag') + `
**Opnieuw uitvoeren.** Vanuit de applicatiecheckout: voer \`python browser-tests/prepare-nomad-exports.py\` uit, daarna \`node browser-tests/capture-nomad-loop.mjs\`. Encodeer met \`python browser-tests/encode-animation-study.py .browser-test-runtime/nomad-export-study/loop\`, waarbij \`INSCAPE_ANIMATION_FRAMES\` naar \`.browser-test-runtime/nomad-export-study/loop/frames30\` wijst. Bouw de vijf bestanden met \`node browser-tests/build-nomad-exports.mjs\`. De benchmark gebruikt \`INSCAPE_PERF_SUITE=nomad-exports\`, \`INSCAPE_PERF_RUNS=3\` en \`INSCAPE_PERF_OUTPUT=.browser-test-runtime/nomad-export-study/benchmark\` bij \`node browser-tests/filled-workbench-performance.mjs\`. Voer grafische kwaliteitscontroles pas uit nadat de CPU-meting klaar is: \`nomad-export-quality.mjs\` en \`nomad-export-preview.mjs\` onder \`browser-tests\`. De lokale vergelijkpagina is te openen via \`node browser-tests/serve-nomad-exports.mjs\`. Er zijn geen nieuwe pakketafhankelijkheden geïnstalleerd.
`);
console.log(root + '.md');

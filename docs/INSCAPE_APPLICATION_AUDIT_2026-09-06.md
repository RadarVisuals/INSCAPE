# Applicatieaudit — 6 september 2026

Read-only audit van applicatiecode; alleen dit verslag en lokale auditoutput
zijn toegevoegd. Dit is geen nieuwe productautoriteit of implementatieopdracht.

## Vervolg na gebruikersakkoord: Library-opslag uitgevoerd

Auditpunt 1 is aansluitend aangepakt. Library-mutaties gaan via
`libraryWorkspacePersistence.js`: eerst gecontroleerd opslaan, dan zichtbare
state wijzigen. De oude save-timer is verwijderd. Opslagfouten worden apart
van netwerkfouten getoond en invoer blijft bij een mislukte category-save staan.
Corrupte huidige en legacy-records worden niet automatisch vervangen. Geldige
legacy-migratie blijft ondersteund. Reeds zichtbare externe wijzigingen of
verwijderingen blokkeren een verouderde save; localStorage biedt hiermee nog
geen atomische vergrendeling tussen exact gelijktijdig schrijvende tabs.

Verificatie: volledige suite 747/747, daarna aanvullende legacy-test geslaagd;
Library-opslag- en afbeeldingsbrowsertests geslaagd. Foutweergave bekeken op
1440 en 700 px. De bestaande ingeklapte navigatie beperkt op smalle schermen
de zichtbare lengte van het invoerveld; deze ronde herontwerpt die navigatie niet.
`build`, `build:check` en `git diff --check` slagen. Geen deployment of
wijzigingen aan de persoonlijke browsersessie. De overige auditpunten hieronder
zijn nog voorstellen, geen uitgevoerde wijzigingen.

## Oordeel

Vervolg metadata/cache uitgevoerd na gebruikersakkoord:

- Externe collectie-JSON wordt streaming gelezen met een limiet van 2 MiB en
  een deadline die headers én body dekt. Timeout en abort ronden ook af wanneer
  een transport niet reageert; body-readers en listeners worden opgeruimd.
- Identity-cachejobs hebben een expliciete afronding, 15-seconden-deadline,
  gedeelde pending requests en annulering. Clear rondt actieve en wachtende jobs
  af. Late antwoorden kunnen daarna geen nieuwe resultaten vervangen.
- Identity-records worden begrensd tot 256, behalve noodzakelijke actieve
  subscribers; de pending queue is eveneens begrensd. Onderliggende SDK-calls
  die AbortSignal negeren kunnen fysiek doorlopen, maar hun resultaat wordt genegeerd.
- Collection-contexten verlopen na vijf minuten; mislukte contextreads zijn
  bij de volgende aanvraag opnieuw probeerbaar. Maximaal 128 contextrecords.
  Annulering voorkomt het starten van verdere tokens in de wachtrij.
- Token/collectie-scope en lookupvolgorde zijn behouden, gecontroleerd tegen de
  [officiële metadata-readhandleiding](https://docs.lukso.tech/learn/digital-assets/nft/read-nft-metadata/).
  Dit voegt geen nieuwe hashverificatieclaim of wallet-authority toe.

Verificatie: volledige suite 759/759; daarna aanvullende cache-snapshottest
geslaagd (9 gerichte cachetests). LUKSO-standaardcontrole, Library-afbeeldingsflow
en annuleringsbrowsertest geslaagd. De freshness van publieke documenten en
de aparte contract-fact-cache zijn niet gewijzigd in deze tranche.

INSCAPE heeft bruikbare architectuurgrenzen: Workbench-state is onderscheiden
van compositie, publieke projectie en walletpublicatie. De beste vervolgstap is
de ondersteunende opslag- en netwerklaag even betrouwbaar maken als de recent
verstevigde canonieke editor. Een algemene rewrite zou werkende grenzen onnodig
opnieuw openen. Korte bronbestanden zijn evenmin een doel: de identity-cache is
zeer compact, maar bevat juist moeilijk zichtbare lifecycle-fouten.

## Bereik en bewijs

Bekeken: App/Startveil/owner-entry; Workbench-runtime en Display Module;
Library-store en opslag; metadata-resolver; identity- en public-documentcaches;
Signals-state; publicatiestate en publisher; publieke documentreader; Netlify
uploadfunctie, beveiligingsheaders, buildrapport en browsertestinfrastructuur.
Architectuur, belangrijke callsites en testbestanden zijn steekproefsgewijs
gelezen. Niet ieder bestand of iedere functie is regel voor regel beoordeeld.

De laatste ongewijzigde codebaseline heeft 742 geslaagde tests, vijf geslaagde
gerichte browsertests en een geslaagde build/budgetcontrole uit de direct
voorafgaande hardeningronde. Deze audit herhaalt die suite niet en gebruikt geen
testaantal als bewijs dat alle workflows afgedekt zijn.

Nieuwe verificatie in deze audit:

- Identity-cacheproblemen gereproduceerd met lokale fake repositories.
- Metadata-bodytimeout gereproduceerd via de geëxporteerde resolver met een
  fake RPC-client en fake fetch; geen externe aanvraag of transactie.
- Actuele `npm audit --json` uitgevoerd; geen installatie of dependencywijziging.
- Lokale app geopend in een aparte Edge-sessie, 1440 en 390 px breed. Het
  opgegeven profiel toonde `PROFILE UNAVAILABLE`, zonder page-errors. Daardoor
  is hier de publieke herstelweergave beoordeeld, niet de persoonlijke owner-draft.

## Bevindingen, in voorgestelde volgorde

### 1. Library-opslag kan succes tonen zonder duurzaam opgeslagen resultaat — P1

**Code:** `src/library/state/useLibraryStore.js:33`, `:42`, `:63`;
`src/library/storage/libraryWorkspaceStorage.js:69` en `saveLibraryWorkspace`.

Category-acties wijzigen eerst de zichtbare workspace en plannen 180 ms later
een save. De boolean van die save wordt niet verwerkt. Bij volle of geblokkeerde
opslag blijft de wijziging zichtbaar, terwijl ze na herladen ontbreekt.
De directe toegang tot `window.localStorage` tijdens module-import is bovendien
niet beschermd tegen een werpende getter. Signals gebruikt hetzelfde patroon.

De code bevat flushfuncties, maar er zijn geen productie-callsites naar gevonden;
de gevonden aanroepen zitten in tests. Snel sluiten of herladen kan dus de laatste
debounced wijziging verliezen. Ook ontbreekt hier de externe-recordcontrole die
de canonieke draft-store nu wel heeft. Een beschadigde Library-record valt terug
naar legacy/lege data; een latere save kan de huidige record vervangen.

**Voorstel:** een kleine expliciete Library-opslaggrens met opgeslagen/pending/
mislukt-status, een beschermde storage-acquisitie en behoud van beschadigde bytes.
Bescherm tegen reeds opgeslagen wijzigingen uit andere tabs. Maak belangrijke
category-commits duurzaam of flush lifecycle-overgangen met zichtbaar foutpad.
Test quota, blokkade, corruptie, profielwissel, reload en twee tabbladen.
Geen migratie of automatische reset van bestaande gebruikersdata.

### 2. Metadata-timeout dekt de body niet — P1, gereproduceerd

**Code:** `src/creations/data/lsp8CollectionMetadataResolver.js:60–73`.

`return response.json()` staat in een try/finally. De finally ruimt timeout en
abortlistener op vóór die promise afgerond is. Snelle headers met een trage body
ontsnappen daardoor aan de deadline. De body heeft hier ook geen expliciete
bytelimiet. De publieke documentreader bevat wél een begrensde streaming-reader.

**Reproductie:** deadline 5 ms, body na ongeveer 40 ms; totale uitvoering 57 ms,
`signalAborted: false`, één metadataresultaat geaccepteerd.

**Voorstel:** behoud de deadline gedurende volledig uitlezen én parsen; begrens
bytes en geef abort/timeout/ongeldige inhoud afzonderlijk terug. Gebruik de
bewezen aanpak van de documentreader als referentie, zonder metadata- en
publicatieregels tot één generieke resolver samen te persen.

### 3. Cache-lifecycle en freshness zijn inconsistent — P1/P2

**Code:** `src/profileIdentity/state/profileIdentityCache.js:9–11`;
`src/profileDocument/state/usePublishedProfile.js:23`;
`src/creations/data/lsp8CollectionMetadataResolver.js:93–105`.

Gereproduceerd in ProfileIdentityCache:

- `clear()` verwijdert wachtende jobs zonder hun promises af te ronden.
- Een reeds actieve job vult de gewiste cache later opnieuw.
- Een synchrone repositoryfout laat een actieve slot en pending-entry achter.

De huidige live identity-repository is async en productie-callsites van `clear()`
zijn niet gevonden. Dit zijn dus bewezen contractfouten in de cache, geen bewijs
dat gebruikers elk geval momenteel tegenkomen. De queue heeft wel belang voor
werkelijke activiteit/identiteitsresolutie; de repository mist een uniforme
totale deadline voor alle onderliggende reads.

Verder worden RESOLVED publieke documenten bij terugkeer niet automatisch opnieuw
gevalideerd. Collection-contexten bewaren ook foutief verkregen null-resultaten
zonder TTL. Meerdere caches bewaren onbeperkt records. Effecten: oude publicaties
of metadata blijven zichtbaar, tijdelijke fouten duren een sessie, geheugen groeit.

**Voorstel:** expliciete generation/invalidation, afgeronde annulering, retrybeleid,
capaciteitslimieten en freshness per gegevenssoort. Eerst identity en collectie-
metadata; pas daarna gemeenschappelijke kleine primitives extraheren. Behoud het
verschil tussen identiteit, contractfeiten, holdings en gepubliceerde documenten.

### 4. Dependency-blootstelling moet vóór bredere distributie onderzocht worden — P1

`npm audit` meldt 93 getroffen dependency-items: 10 low, 61 moderate, 19 high,
3 critical. Dit zijn geen 93 bewezen exploiteerbare INSCAPE-bugs.

Direct gemelde packages zijn `vite` (high) en `@lukso/up-modal` (moderate).
Critical transitive items zijn `form-data`, `request`, `tar`. De scan stelt voor
een deel een downgrade naar up-modal 0.10.0 voor; die past niet bij de
projectconstraints en is geen verantwoord herstelplan.

**Voorstel:** per advisory vastleggen: browser/build/server, bereikbaar codepad,
dependency-keten en geteste ondersteunde update. Toolchain apart van walletstack
behandelen. Geen force-fixes, overrides of blinde downgrades. Werkelijke
exploitability is in deze audit niet vastgesteld.

### 5. In-flight publicatieherstel over reload heen ontbreekt — P1 vóór bredere release

**Code:** `src/profileDocument/storage/profileDocumentPublisher.js:72`, `:181`;
`src/profileDocument/state/useProfileDocumentPublication.js`.

De publisher voorkomt dubbele submissions binnen dezelfde instance en bewaart
de hash bij fouten. De `submitted`-registratie is echter alleen een Map in memory.
Een reload/unmount tijdens bevestigen verliest die lokale hervatstatus. De
Alpha-supportdocumentatie ondervangt dit operationeel met expliciete begeleiding
en het verbod nogmaals te submitten wanneer een hash bekend is.

**Voorstel:** een minimaal, profielgebonden lokaal ontvangstbewijs voor reeds
ingediende transacties en een read-only hervatpad. Nooit automatisch opnieuw
tekenen of verzenden. Bewaar geen walletprovider, geheimen of private draft.
Test reload na hash, receipt-fout, replacement en afwijkende read-back. Hiervoor
is apart LUKSO/publicatiegrenswerk nodig; geen uitvoering tijdens deze audit.

### 6. Browserregressies zijn onvoldoende als vaste controle gebundeld — P1/P2

**Code:** `package.json`, `browser-tests/*.browser.mjs`, `netlify.toml`.

Er zijn veel nuttige browserchecks, maar `test:browser` kiest één bestand. De
nieuwe workflowchecks worden expliciet los gestart. Veel scripts kiezen zelf
Edge op een Windows-pad en poort 5173, terwijl een gedeelde adapter al bestaat.
Er is geen `.github`-directory gevonden; de Netlify-build voert alleen build uit.
Externe CI-configuratie kan bestaan, maar is niet bekeken.

**Voorstel:** één ondersteund browsercommando met gedeeld browser-/serverbeheer,
een snelle kernset en een uitgebreide suite voor releasecontrole. Neem routing,
storage failure, drag, crop, wrapping, Preview en publicatieherstel expliciet op.
Behoud echte gevulde raster-scenes voor flits/seam-tests. Geen extra tests die
alleen bronopmaak herkennen. Bestaande 742 tests blijven waardevol, maar zijn
geen vervanging voor deze user-flow-controle.

### 7. Uploadgrens heeft een helder Alpha-model, met resterend schaalrisico — P2

**Code:** `netlify/functions/pin-profile-document.mjs:25`, `:39`, `:97`.

Sterk: gesloten schema, canonieke bytes, server-side credential, per-IP-limiet,
losse CID-verificatie en aparte walletpublicatie. Het endpoint heeft geen
server-side bewijs van gebruiker/controller; Origin is een browsercontrole,
geen authenticatie tegenover niet-browserclients. Dit is dus geen aangetoonde
wallet-authority-bypass, wel een mogelijke uploadquota-/kostenblootstelling.
Ook wordt de volledige requestbody gebufferd vóór de gemeten bytelimiet wordt
toegepast wanneer Content-Length ontbreekt of onjuist is.

**Voorstel:** vóór publieke schaal vastleggen wie uploads mag laten betalen,
quota per toegestane context en streaming bodybegrenzing. Controleer de werkelijk
gedeployde rate-limitconfiguratie en het accountplan. Niet live belast of getest.
De huidige rateLimit-configuratievorm is ondersteund volgens de
[officiële Netlify-referentie](https://docs.netlify.com/build/functions/api/).

### 8. Blind herladen bij chunkfout kan terugkerende laadproblemen versterken — P2

**Code:** `src/main.jsx:8–12`.

`vite:preloadError` herlaadt direct. `{ once: true }` geldt per paginalading;
een blijvend ontbrekende chunk kan na iedere nieuwe load opnieuw tot reload
leiden. Pending editorstate kan hierbij verdwijnen. Dit is een codepad-risico,
geen tijdens de audit waargenomen loop.

**Voorstel:** begrens één automatische poging per release/chunk en bied daarna
de bestaande herstelweergave. Test deploymentwissel, offline en ontbrekende chunk.

### 9. Runtime/venster/CSS-verantwoordelijkheden verdienen gerichte splitsing — P2

Metingen: `PresentationBoardDefinitive.jsx` 466 regels,
`OwnerSystemWorkflowRuntime.jsx` 412, `OwnerSystemWorkflowLibraryPresenter.jsx`
396, `ownerSystemWorkflow.css` 1632. Lengte alleen is geen probleem.

Concreet bevat PresentationBoard venstergeometrie, shortcut-opslag, icoonbewerking,
menu's en inspectiehosts. De runtime verbindt data, panelen, playback, selectie
en presentatie. Dit vergroot het aantal neveneffecten bij een lokale wijziging.

**Voorstel:** shortcutgedrag en venstergeometrie afzonderlijk isoleren, runtime
als samensteller houden en CSS per owning surface ordenen. Eén gedrag per
reviewbare stap, met dezelfde selectors, fonts, tokens en wide/narrow checks.
Geen algemene hernoeming van PresentationBoard en geen verwijdering van lattice
alleen omdat de naam oud klinkt: production gebruikt daarvan nog rendering/tools.

## Sterke delen behouden

- Gescheiden canonieke private draft, publieke projectie en Workbench-state.
- Publicatiereader valideert schema, profiel, canonieke bytes en hash; deadlines
  en streaming bytebegrenzing zijn daar al uitgewerkt.
- Publisher bindt snapshot/CID/draft/walletgeneraties en verifieert read-back.
- Owner-entry is profielgebonden; provider-lifecycle heeft racegerichte tests.
- CSP verbiedt o.a. arbitrary scripts, objecten en frames; credentials blijven
  buiten browsercode. Geen eval/innerHTML-injectiepad gevonden in de gerichte zoekslag.
- Buildbudgetten en runtime-isolatie slagen. Gemeten initiële JS: 779782 bytes
  raw / 226731 gzip; standalone walletgroep: 3945427 raw / 1042852 gzip, lazy.
  Statische assets: 14416715 bytes. Geen bewijs van een performanceprobleem alleen
  op basis van deze getallen; profileer eerst trage apparaten en grote collecties.

## Aanbevolen uitvoering

1. Library-opslag: gebruikerswerk betrouwbaar bewaren en fouten zichtbaar maken.
2. Metadata-/cache-lifecycle: deadlines, annulering, retry en freshness.
3. Vaste browserregressiesuite; dependency-blootstelling en ondersteunde updates.
4. Publicatieherstel en uploadquota vóór uitbreiding buiten begeleide Alpha.
5. Gerichte runtime/CSS-splitsing op basis van de bovenstaande beschermde grenzen.

Niet onderzocht: alle code regel voor regel, echte wallet/signature/transaction,
live Netlify headers/limieten/secrets/logs, Pinata-account, adversariële loadtest,
Safari/Firefox/fysieke touchhardware, volledige toegankelijkheidsaudit,
representatieve langetermijn-heap/performanceprofielen en elke advisories-callsite.
Geen conclusie dat de app volledig veilig of releaseklaar is.

Officiële contextcheck: de gebruikte mainnet chain-id 42 komt overeen met de
[LUKSO-netwerkparameters](https://docs.lukso.tech/networks/mainnet/parameters/).
Dit is geen volledige herverificatie van alle LSP-implementaties.

## Vervolg: publicatieherstel

Uitgevoerd na gebruikersakkoord: profiel- en mainnet-gebonden lokaal
publicatielogboek, reservering voor de walletaanvraag, bewaren van de ontvangen
hash en read-only herstel bij heropenen van Publish. Het herstel vergelijkt de
receipt en de huidige gepubliceerde canonieke inhoud. Onbekend blijft onbekend;
opnieuw controleren verstuurt geen transactie. Web Locks beschermen gelijktijdige
aanvragen tussen tabbladen waar beschikbaar. De bestaande wallet-authority,
CID-verificatie en publieke/private documentgrenzen blijven intact.

Getest: 767/767 volledige tests; daarna gerichte publicatietests voor ingepakte
walletweigering en succesvolle opruiming van het logboek. Browserchecks toetsen
herladen, opnieuw controleren, profielwissel tijdens een openstaande read,
transactiefout, expliciete erkenning en uitsluiting van een tweede lockhouder.
Screenshots op 1440 en 390 pixels gecontroleerd op tekst, knoppen, hashafbreking
en paneelgrenzen. LUKSO-standaardcontrole geslaagd. Geen echte upload, walletactie
of transactie uitgevoerd.

Beperkingen: een onderbreking voordat de hash is ontvangen, of een vervanging
tijdens afwezigheid, vraagt nog controle van walletactiviteit/begeleide support.
Er wordt geen transactiehash gegokt. Wissen van browseropslag verwijdert het
herstellogboek. De uploadquota en overige auditpunten zijn in deze ronde niet
gewijzigd. Operationele details staan in `NETLIFY_PUBLIC_IPFS_PUBLICATION.md`.

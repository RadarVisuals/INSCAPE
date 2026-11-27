# Stap 01 Herstelbaar vertrekpunt

23 oktober 2026. De huidige lokale werkboom op `codex/audit-checkpoint-2026-10-19`, HEAD `32d9418843d996afc2e5203afa4552a6cd2d459a`, is vastgelegd zonder reset, stash, commit of bronverwijdering.

Het checkpoint staat buiten de applicatiecheckout:
`C:/Users/Hidden Swarm/Documents/ChatGPT/inscape/technical-regie-2026-10-23/checkpoints/baseline-2026-10-23T15-18-59-289Z/`.

- `manifest.json`: expliciete lijst van 2.720 bestanden, hun grootte en SHA256, Git-/runtimegegevens en exclusions.
- `snapshot/`: kopie van de toegestane huidige bron, assets, tests en documenten.
- `restore-check/`: afzonderlijke herstelkopie, per bestand tegen het manifest gecontroleerd.
- `summary.json`: 190.477.579 bytes, nul herstelverschillen en nul bronwijzigingen tijdens vastlegging.

De bestaande `sourceInventory` is hergebruikt, aangevuld met toegestane actuele Git-bestanden. Het ondersteunende script staat buiten de app in `technical-regie-2026-10-23/checkpoint.mjs` onder de projectroot. Het controleert padbegrenzing, weigert onverwachte links en controleert beschikbare schijfruimte. Beide kopieën blijven bewaard.

De beschermde continuation handoff is vóór bestandstoegang uitgesloten. Git-internals, dependency-installaties, gegenereerde output, browsercaches en private configuratie zijn geen onderdeel van dit checkpoint. Er zijn geen bestaande browserprofielen of gebruikersopslag gelezen of aangepast.

Broninventaris tijdens het checkpoint:
`a71f2eb5307cc1a1a089ed04f1047b6d7c6a28148ad7ba7674a4ca9b4c1f3c65`.
Node: `v24.20.0`. De toevoeging van dit resultaat en de voortgangsupdate komt na het checkpoint; de volgende verificatie legt haar eigen actuele bronmanifest vast.

Resultaat: herstelbaarheid van de opgenomen lokale bestanden is geverifieerd. Dit is geen uitspraak over de functionele teststatus. Styling, modules, composities en productcode zijn door deze stap niet gewijzigd.

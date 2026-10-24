# Transactionele opslag en herstel

De bestaande store accepteert een nieuwe toestand pas na validatie en succesvolle opslag. Gewone edits, contextwisseling en herstel houden hun verschillende semantiek. De optimalisatie voor reeds gevalideerde inactieve Workbenches blijft behouden; er is geen tweede opslagengine of cache toegevoegd.

Nieuwe gedragproeven controleren acht acties tegen leesfout, schrijffout/quota, externe wijzigingen en ontbrekende schrijfmethode, naast het acceptatiemoment en een herhaalde recovery. Ze vergelijken onder meer beide composities, snapshotidentiteit, generatie, activatie, Undo/Redo en subscribers. Eén echte tekortkoming is gerepareerd: create/switch/rename/restore meldden leesfalen en een ontbrekende writer ten onrechte als externe wijziging. Dezelfde bestaande foutcodes als bij gewone commit maken die oorzaken nu correct onderscheidbaar. Dit was een contractfout; de rode tests toonden geen gegevensverlies.

De nieuwe matrix heeft 41 leafgevallen, 43 TAP-tests. Samen met scope-, lease-, history-, backup- en gatecontroles slagen **181/181** op de geïntegreerde bron. De strikte typegate slaagt eveneens. Bron en tests zijn onderdeel van checkpoint `dfda98753e34b9d96540a0b4f433bd096e9df619469210228ad5915b552d452f`; de bronhash bleef tijdens het gezamenlijke controlemoment gelijk.

Bewijs: `technical-regie-2026-10-23/continuation/step-09-save-boundary/README.md`, de oorspronkelijke rode matrix, afzonderlijke kandidaatpatch en `integrated-unit-01.tap`. De opslag blijft één synchroon browserrecord onder de editorlease; er wordt geen compare-and-swap tussen willekeurige externe writers beloofd. Gezamenlijke productiebuild is nog geblokkeerd door het ongewijzigde bundelbudget.

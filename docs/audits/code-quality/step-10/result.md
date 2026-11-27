# Layoutgrenzen: gerichte implementatie en controle

De onmiddellijke editorrelease schrijft de laatste gecommitte layout via de bestaande leasegrens. De onafhankelijke review en 2 Display-/8 aangrenzende browsergevallen plus 11 units blijven vastgelegd in [releasebewijs](../../../../../../technical-regie-2026-10-23/continuation/step-10-layout-release/README.md).

De verdere layoutcontrole vond één extra fout: Display gebruikte na een viewportverandering binnen dezelfde layoutmodus nog de oude marge. De meetcallback berekent nu de actuele marge. De rode 696px-uitkomst bij 720px wordt 680px; een gekozen vensterbreedte blijft behouden zolang ze past. Geen CSS-wijziging. [Volledige capture-/layoutcontrole](../../../../../../technical-regie-2026-10-23/continuation/step-10-layout-boundary/README.md): 32 units en 20 afzonderlijke browsergevallen groen.

De capturegrens houdt live, cache, authored fallback en defaults in expliciete volgorde; actuele modulelijsten bepalen membership. Failed save behoudt accepted snapshot, geschiedenis en bytes. Succesvolle retry maakt de oude cache ongeldig. De hoofdtaak las de gerichte productiediff, captureproeven en ownergrenzen; de aanvullende gezamenlijke run van capture/schema/Library-opslag slaagde met 24/24 tests.

De 30 hookobservaties zijn afzonderlijk beschreven, met 29 behouden dependencyvormen en één gerepareerde oorzaak. Centrale bronbinding van het lintregister volgt na de nog lopende selectie-/toolwijzigingen. Tijdelijke groups/linked-framebewegingen blijven gekoppeld aan stap14. De nieuw gereproduceerde mini-app-viewport/capturefout is afzonderlijk toegewezen aan mini-app-window-boundary; deze stap verklaart die niet opgelost. Gezamenlijke eindbuild, budget en regressierun blijven vereist. Alles lokaal.

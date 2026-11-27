# Begrensde Workbench-typecontracten

De drie productie-implementaties `systemWorkflowDraftStore`, `WorkbenchViewContext` en `workbenchPresentationCapture` hebben strikte JSDoc-controle. De expliciete scope met 25 leden, module-/frame-ID's, selectie/activatie, geometrie, toolregistratie en nullable/foutresultaten staan in één begrensd contract. `npm run typecheck` voert de positieve compilatie, 16 bewust verkeerde aanroepen en drie productiemutaties uit. De normale verifier en broninventaris bevatten deze gate en haar configuratie.

De annotatiedelta heeft dezelfde uitvoerbare syntax als haar eigen beginsnapshot. De daarna afzonderlijk toegepaste stap-09-foutcodecorrectie verandert bewust gedrag; voor die gecombineerde bron slaagt de typegate opnieuw, zonder een onjuiste claim van historische AST-gelijkheid. Onafhankelijke review vond geen nieuwe fout in de afgebakende wijziging.

Dit is geen volledige TypeScript-migratie. Concrete productie-implementaties worden gecontroleerd en de bestaande externe callers zijn gelezen; Runtime/View en de meeste modulecallers zijn niet integraal `checkJs`-gecontroleerd. De live-providerinvariant is daarom deels bronmatig bewezen. Oude geïmporteerde JS-domeinhelpers kunnen nog afgeleide `any` leveren. Runtimevalidatie van externe/opgeslagen gegevens blijft nodig.

Bewijs: `technical-regie-2026-10-23/continuation/step-07/README.md`, `integrated-proof.json` en `continuation/reviews/step-07-review.md`. Compiler: TypeScript 5.9.3 met React 18 declarations; deze versie past bij bestaande peerconstraints. Geen forced override of wijziging van bestaande productie-dependencyversies.

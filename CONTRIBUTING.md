# Contribuire

## Codice

1. Installa i requisiti del README e avvia `npm run dev`.
2. Trova la responsabilità nella tabella del README. Mantieni le regole di selezione PDF in `readerSession`, quelle DOM/PDF in `pdfNavigation`, le regole del percorso in `guidedReading` e i suoi collegamenti/salvataggi in `useGuidedReading`. Il lavoro dell'utente usa lo store condiviso.
3. Correggi un comportamento con un test del percorso che lo manifesta. I test veloci proteggono dati e algoritmi; quelli in `tests/integration/` usano React e DOM; quelli in `tests/browser/` usano il PDF reale e il percorso di produzione.
4. Esegui `npm run format`, `npm run verify` e `npm run test:browser`. Per gli script di importazione esegui anche `npm run test:import`.

TypeScript è strict. Usa import di tipo espliciti e import relativi senza estensione in `src/`; gli script Node hanno estensioni esplicite. I test Node che usano il caricamento diretto TS mantengono `.ts` dove richiesto dal runtime. Prettier definisce lo stile; ESLint controlla errori, hook e accessibilità. Un'eccezione deve indicare la ragione locale, non disabilitare una categoria per tutto il progetto.

Tieni i riordini estesi separati dalle modifiche di comportamento quando prepari commit. Non introdurre un nuovo modulo che inoltra soltanto setter: deve possedere una regola o un ciclo di vita riconoscibile.

## Contenuti

Modifica `papers/`, mai le copie in `public/papers/` o `dist/`. I formati e la procedura manuale sono in [development.md](docs/development.md). Mantieni gli ID pubblicati: il ripasso e i collegamenti li referenziano. Le coordinate derivano dal PDF, non dalla posizione stimata a schermo.

Dopo una modifica editoriale:

```sh
npm run concepts-index
npm run validate:papers
npm test
```

Le spiegazioni e definizioni devono coprire tutte le varianti dichiarate; il fallback nella UI serve a vecchie selezioni salvate per varianti successivamente rimosse, non a pubblicare contenuti incompleti.

## UI

I testi visibili descrivono contenuti, relazioni del paper o azioni disponibili. Evita slogan e commenti sul ruolo didattico del testo. Il campo `purpose` delle tappe è un razionale editoriale per chi mantiene la guida e non viene mostrato al lettore; il contesto visibile deve spiegare gli oggetti discussi nel paper.

Verifica un paper breve e uno lungo, una spiegazione con diagramma e un concetto con molte voci. Prova schermo stretto, tablet e desktop, entrambi i temi, tastiera e testo ingrandito. Nessuno strumento deve scomparire senza un ingresso alternativo. Una selezione deve rendere visibile il suo bersaglio; un ridisegno non deve cancellare il lavoro dell'utente.

Per il percorso guidato verifica ingresso, dubbio e avanzamento, ritorno dal PDF, sintesi dopo ricarica e ripresa dalla libreria. Un link diretto deve aprire anche un passaggio dentro una tappa lunga. Preserva i riferimenti non più presenti nei dati salvati e rendi esplicito il cambiamento; non rinumerare gli step. Perimetro editoriale e comprensione non si deducono da una percentuale di tappe attraversate.

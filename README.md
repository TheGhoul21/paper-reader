# Paper Reader

Una lettura guidata dei paper scientifici, dal quadro generale ai dettagli. Ogni paper si apre con un orientamento, prosegue per tappe con spiegazioni e glossario e si chiude con sintesi personale, prove e dubbi da rivedere. Il lettore PDF permette di confrontare la fonte e annotarla. Percorso, sintesi, ripasso, annotazioni e preferenze restano nel browser e si possono esportare in un backup.

## Avvio

Requisiti: Node **22.14 o successivo**, npm e Python 3 per la validazione dei paper. `uv` serve per gli script di importazione e i loro test.

```sh
npm ci
npm run dev
```

Apri l'indirizzo stampato da Vite. I dati in `papers/` sono serviti direttamente durante lo sviluppo.

## Verifiche

```sh
npm run verify
npm run test:import
npx playwright install chromium
npm run test:browser
```

`verify` esegue lint, controllo di formattazione, test veloci, test DOM, validazione dei contenuti e build. I test browser usano la build con il percorso `/paper-reader/`, come GitHub Pages, e verificano anche l'avvio in sviluppo sulla porta 5199. La prima installazione di Chromium richiede rete. `test:import` usa `uv` e non scarica paper.

Per formattare il codice usa `npm run format`. Per provare soltanto la build usa `npm run build`, poi `npm run preview`.

Se aggiorni le dipendenze mentre Vite è aperto, ferma il server e riavvialo con `npm run dev -- --force`, poi ricarica la pagina. Un processo rimasto aperto può combinare il vecchio plugin React in memoria con il nuovo runtime su disco e causare errori di Fast Refresh.

## Lettura guidata

La homepage mostra ricerca, fino a tre letture da riprendere, concetti del glossario e quattro paper aggiunti di recente. Il [catalogo](https://theghoul21.github.io/paper-reader/catalog) è separato: ricerca per titolo, autore, concetto, DOI o arXiv, filtri e risultati compatti. I vecchi link alla homepage con filtri continuano a funzionare. La [scelta del catalogo statico](docs/catalog-experience-2026-10-05.md) descrive dati, limiti e verifiche.

L'utente ha scelto il percorso A, ora implementato come ingresso principale. `/paper/<slug>` apre l'orientamento; `?stage=read&step=<id>` raggiunge una tappa e `?stage=summary` il riepilogo. `?view=pdf` apre la fonte; i vecchi link `?p=<id>` mantengono il comportamento PDF. Dal percorso si torna alla stessa tappa dopo il confronto con l'originale.

Per usare il server locale sulla porta 5199: `npm run dev -- --port 5199 --strictPort`. Apri [DAScut](http://localhost:5199/paper/dascut). La [descrizione dell'esperienza](docs/guided-reading-experience-2026-10-04.md) documenta scelta, funzioni e limiti editoriali. L'ampiezza delle spiegazioni è indicata all'ingresso e nella sintesi: il numero di tappe percorse non certifica la comprensione dell'intero PDF.

## Dove intervenire

| Area                                    | Ingresso                                                                                      |
| --------------------------------------- | --------------------------------------------------------------------------------------------- |
| Libreria, lettore, ripasso              | `src/pages/`                                                                                  |
| Homepage, catalogo e ricerca            | `src/pages/Home.tsx`, `Library.tsx`, `src/lib/catalog.ts`, `useCatalog.ts`                    |
| Orientamento, tappe e sintesi           | `src/pages/GuidedReading.tsx`, `src/components/guided/`                                       |
| Sessione e salvataggio del percorso     | `src/lib/useGuidedReading.ts`, regole pure in `guidedReading.ts`                              |
| Composizione del lettore                | `src/components/PdfViewer.tsx`                                                                |
| Selezione, scheda e filtro              | `src/lib/readerSession.ts`                                                                    |
| Documento, viewport, ricerca, glossario | `src/lib/usePdfDocument.ts`, `usePdfViewport.ts`, `usePdfSearch.ts`, `useConceptHighlight.ts` |
| Navigazione DOM del PDF                 | `src/lib/pdfNavigation.ts`                                                                    |
| Salvataggi, migrazioni, backup          | `src/lib/userData.ts`, `storage.ts`, `backup.ts`                                              |
| Posizione e preferenze di lettura       | `src/lib/readingProgress.ts`                                                                  |
| Stili                                   | `src/index.css` e `src/styles/` per schermata                                                 |
| Contenuti                               | `papers/<slug>/`                                                                              |
| Figure originali e animazione delle PTN | `src/components/figures/`, modello in `src/lib/parityTwine.ts`                                |

`npm run catalog-index` rigenera l'indice del catalogo dopo modifiche ai metadati, glossari o percorsi. La build lo rigenera automaticamente. L'indice è derivato dai dati curati; non va modificato a mano.

Leggi [CONTRIBUTING.md](CONTRIBUTING.md) per modificare codice o dati, [il modello del dominio](CONTEXT.md) per il vocabolario e [la guida di sviluppo](docs/development.md) per formati, invarianti e importazione manuale.

La figura 2 di _Optimizing Atom Transport, Gate-Count and Depth with Parity Twine_ è disponibile nelle tappe che la citano: i circuiti lineare, quadrato e a scala si possono percorrere una CNOT alla volta o riprodurre. L'immagine originale resta ingrandibile e collegata alla pagina PDF. I ritagli sono dichiarati in `structure.json` e si rigenerano con `uv run scripts/render-figures.py <slug>`; non vengono estratti automaticamente da confini stimati.

Nello stesso paper sono interattive anche la figura 7(a), con le sei configurazioni dei blocchi QFT, e la figura 8, con i protocolli di trasporto CZ e CZSWAP. I modelli puri sono in `src/lib/oqftBlocks.ts` e `atomTransport.ts`. Comandi, pausa e riproduzione sono condivisi tramite `FigurePlayback.tsx` e `useFigurePlayback.ts`. La [documentazione delle figure](docs/figures-2026-10-05.md) distingue il riordino logico dagli spostamenti fisici e riporta i parametri del modello.

La pipeline verifica il progetto sulle pull request. Il push su `main` pubblica la build verificata su GitHub Pages. L'esecuzione locale dei comandi non pubblica il sito.

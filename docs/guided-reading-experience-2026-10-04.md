# Lettura guidata: percorso A

Data: 4 ottobre 2026. Obiettivo scelto dall'utente: **capire il paper con una lettura guidata, dal quadro generale ai dettagli**. Scelta finale dell'utente: **A — Percorso a tappe**.

La domanda dei prototipi era quale struttura accompagnasse meglio dal quadro generale ai dettagli. A è stato scelto come percorso principale. La soluzione è stata riscritta per il prodotto, con sessione persistente e componenti divise per responsabilità; le varianti B e C, la barra di confronto, i file e il comando provvisorio sono stati rimossi.

## Usare il percorso

```sh
npm run dev -- --port 5199 --strictPort
```

Se il server è già attivo basta aprire [la libreria](http://localhost:5199/) oppure [DAScut](http://localhost:5199/paper/dascut). Il percorso A è l'ingresso ordinario anche nella build di produzione. La pubblicazione su GitHub Pages avviene tramite il push su `main` e attende le verifiche della pipeline.

## All'arrivo: scegliere e orientarsi

La libreria presenta problema e idea degli autori, titoli leggibili, livelli disponibili e un invito a esplorare. La ricerca comprende titolo, autore e riepilogo del problema. Il lavoro più recente ha un ingresso distinto **Riprendi il percorso**. La consultazione PDF mantiene il proprio collegamento e la precedente pagina salvata.

Un paper si apre con il suo titolo, identità della fonte, ampiezza effettiva delle spiegazioni e un'azione principale. Il lettore può iniziare dal quadro generale, riprendere il lavoro o scegliere una sezione. Il problema completo e la motivazione si espandono; il livello delle spiegazioni ha un esempio reale. Il background mostrato deriva dai metadati esistenti: non sono stati dedotti prerequisiti dalla lista dei termini del glossario.

I testi dell'interfaccia descrivono contenuti e azioni. Per richiesta dell'utente sono stati rimossi slogan, promesse generiche e frasi introduttive ripetitive. Il titolo del paper occupa il posto della precedente frase d'apertura; le etichette sono funzionali, come «Spiegazioni», «Sintesi», «Tesi e prove» e «Tappe da rivedere».

## Durante: una tappa, un'idea

La colonna centrale contiene posizione, titolo, contesto scientifico, spiegazioni, eventuale diagramma e domanda di verifica. Il percorso a sinistra permette di raggiungere le sezioni; il contesto a destra contiene l'obiettivo della sezione. Sul telefono il percorso è espandibile e il contesto segue il testo. Il razionale editoriale `purpose` resta nei dati per i manutentori; dal 5 ottobre non viene mostrato nelle tappe, nelle note PDF o nella guida PDF.

Le definizioni si aprono nel punto d'uso e permettono di ritrovare il passaggio che introduce il concetto, esplorare termini correlati e aggiungerlo al ripasso. Originale e approfondimenti si aprono su richiesta. Gli approfondimenti caricano il renderer soltanto quando vengono aperti. Una tappa molto lunga mostra inizialmente quattro passaggi e rende espliciti gli altri passaggi espandibili; i collegamenti diretti aprono anche questi ultimi.

**Mi è chiaro · continua** registra l'esplorazione e rimuove un eventuale dubbio su quella tappa. **Da rivedere · continua** registra il dubbio e permette di avanzare. L'operazione è atomica. Non viene assegnato un voto; una tappa esplorata resta distinta dalla comprensione verificata. Una domanda presente nei contenuti si può confrontare e aggiungere al ripasso; quando manca, la UI propone una riflessione libera.

La fonte si apre nel lettore PDF e permette di tornare alla stessa tappa o al riepilogo, con variante e posizione conservate. I vecchi collegamenti ai passaggi restano compatibili. La dimensione del testo è regolabile nelle preferenze di lettura e condivisa con il PDF. Il cambio di tappa porta il focus al titolo; il glossario restituisce il focus al termine e si chiude con Escape.

## Alla fine: ricomporre e tornare ai dubbi

Il riepilogo ricompone problema, proposta e risultato dai contenuti editoriali. La motivazione del lavoro ha un'etichetta distinta: il campo `tldr.why` non viene presentato come elenco di limiti scientifici.

La sintesi personale invita a completare «Il problema è… L'idea è… Le prove mostrano… Resta da capire…». Si salva mentre si scrive. I dubbi riportano direttamente alle tappe e i loro passaggi si possono aggiungere esplicitamente al ripasso. Le tesi hanno riferimenti ai passaggi originali per ricontrollare prove e condizioni; le domande riguardano tappe effettivamente esplorate. Gli altri paper proposti condividono un concetto reale, indicato come ragione del collegamento.

Il riepilogo è disponibile anche prima della fine e indica le tappe non ancora esplorate. Non certifica la comprensione dell'intero paper. Sintesi, dubbi e ultima posizione rimangono disponibili dopo una ricarica e dalla ripresa in libreria.

## Salvataggio, recupero e collegamenti

Il campo opzionale `journeys` usa lo store recuperabile già presente e il backup compatibile versione 1. I vecchi backup non cancellano il nuovo lavoro. I conflitti usano la data di modifica del percorso. Le annotazioni e il ripasso mantengono il formato e gli ID pubblicati.

Se una scrittura fallisce, lo store conserva il lavoro in memoria e offre esportazione e retry. Se i dati precedenti sono illeggibili, non vengono sovrascritti: il nuovo percorso mantiene una bozza in memoria, anche durante il confronto con il PDF, e offre un backup parziale. Una ricarica del browser perde comunque il lavoro rimasto solo in memoria: il messaggio di recupero resta visibile. Quando lo storage torna leggibile, la bozza può confluire nello store preservando il record più recente.

Le modifiche editoriali possono rendere indisponibile uno step. I riferimenti originali restano nello storage e nel backup; navigazione e conteggi usano quelli validi e mostrano un avviso. Non si rinumerano gli ID per adattarli alla nuova UI. I paper senza guida restano consultabili e annotabili nel PDF con un messaggio esplicito.

| Collegamento                         | Risultato                                    |
| ------------------------------------ | -------------------------------------------- |
| `/paper/<slug>`                      | Orientamento                                 |
| `?stage=read&step=<id>&v=<variante>` | Tappa guidata                                |
| `?stage=summary`                     | Sintesi                                      |
| `?view=pdf`                          | Lettore PDF con la precedente posizione      |
| `?p=<id>`                            | Vecchio collegamento a un passaggio nel PDF  |
| `?view=guide&p=<id>`                 | Passaggio nella guida, espanso e focalizzato |

## Confini del codice

| Responsabilità                                      | Ingresso                                                                             |
| --------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Caricamento, variante e modalità guidata/PDF        | `src/pages/Reader.tsx`, `src/lib/papers.ts`                                          |
| Composizione delle tre fasi e glossario aperto      | `src/pages/GuidedReading.tsx`                                                        |
| Orientamento, tappa, sintesi                        | `src/components/guided/ReadingOverview.tsx`, `ReadingStep.tsx`, `ReadingSummary.tsx` |
| Testo, confronto, approfondimenti e checkpoint      | `src/components/guided/ReadingContent.tsx`                                           |
| Intestazione, percorso e ampiezza delle spiegazioni | `src/components/guided/ReadingNavigation.tsx`                                        |
| Glossario e collegamenti fra paper                  | `src/components/guided/ReadingGlossary.tsx`                                          |
| Regole pure e riferimenti stabili                   | `src/lib/guidedReading.ts`                                                           |
| URL, persistenza recuperabile, focus e scroll       | `src/lib/useGuidedReading.ts`                                                        |
| Validazione e backup                                | `src/lib/userData.ts`, `src/lib/backup.ts`                                           |
| Fonte, ricerca e annotazioni                        | `PdfViewer` e i moduli PDF esistenti                                                 |
| Stili delle schermate                               | `src/styles/guided.css`, `library.css`, `reader.css`                                 |

La sessione guidata possiede le regole del percorso; la sessione PDF continua a possedere selezione, scheda e filtri della fonte. Il nuovo codice non contiene un selettore di prototipi o un secondo sistema di persistenza. La bozza di recupero in memoria è un'eccezione circoscritta ai dati illeggibili, gestita dal modulo di sessione.

## Perimetro editoriale: cosa resta da curare

Il redesign usa i contenuti editoriali esistenti. **Per DAScut il PDF ha 18 pagine; i 31 passaggi, le 8 tappe e le 9 domande disponibili riguardano pagine 1–6.** Non sono state aggiunte spiegazioni scientifiche delle pagine successive. Il percorso dichiara la propria ampiezza all'ingresso e nella sintesi.

La validazione assegna ogni passaggio importato a una tappa, ma non dimostra che il PDF sia coperto interamente. Anche il numero di pagine con ancore indica presenza delle spiegazioni, non completezza di ogni pagina. Prima di promettere una guida completa serve confrontare il PDF per sezioni, distinguere contenuti scientifici, appendici e riferimenti, e completare o dichiarare il perimetro editoriale. Le pagine escluse negli altri paper possono essere bibliografia; il solo conteggio non le classifica come errori.

La prova con `prresearch-6xlb-l92j` ha inoltre mostrato una tappa finale che comprende numerose voci bibliografiche. Il prodotto rende le tappe lunghe espandibili. Resta utile una revisione editoriale della granularità: raggruppare per idea e scopo e distinguere la consultazione delle fonti dalle tappe necessarie al ragionamento.

Obiettivi didattici dedicati, prerequisiti e limiti scientifici strutturati richiedono contenuti curati e verificati. La UI attuale mostra quelli già disponibili senza generare certificazioni di comprensione, durate o condizioni assenti nella fonte.

## Verifica

Le verifiche proteggono avanzamento e dubbi atomici, conservazione della sintesi, scroll obsoleto, riferimenti stabili, conteggio delle ancore, compatibilità e validazione dei backup. Le prove browser attraversano orientamento, tappe, riepilogo, ripresa, confronto con il PDF, tastiera, font ingrandito, passaggi dentro tappe lunghe e recupero con storage illeggibile. I controlli precedenti su PDF, annotazioni, ricerca e ripasso restano attivi.

Controlli completati dopo la revisione dei testi dell'interfaccia:

- `npm run verify`: lint, formattazione, 49 test Node, 7 test DOM, validazione di 11 paper, TypeScript e build riusciti.
- `npm run test:browser`: 51 prove superate su desktop, tablet, tablet stretto, telefono e tema scuro, più avvio in sviluppo. Il recupero usa un backup realmente scaricato e importato in una sessione browser nuova.
- Schermate di ingresso, libreria, tappa, sintesi e paper lungo acquisite; ispezionati anche titolo lungo su telefono e tablet e sintesi in tema scuro.

Le prove browser usano Chromium con dispositivi emulati. Safari, Firefox, screen reader e dispositivi fisici non sono stati provati. La pipeline di importazione non è stata modificata per implementare A; i relativi controlli precedenti sono registrati nel documento degli interventi UI/codebase.

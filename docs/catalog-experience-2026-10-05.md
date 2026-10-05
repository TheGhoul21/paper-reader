# Homepage e catalogo

La homepage e il catalogo hanno due compiti distinti. `/` permette di riprendere una lettura o scegliere un punto di ingresso; `/catalog` serve a cercare e confrontare i paper. La struttura non aumenta il numero di sezioni o card della homepage quando il catalogo cresce.

## Homepage

- Ricerca principale per titolo, autore, concetto, DOI o identificativo arXiv, con invio al catalogo.
- Fino a tre letture recenti, usando i salvataggi locali esistenti. Se il paper ha un percorso iniziato si riprende quel percorso; in assenza del percorso si riprende il PDF. Entrambe le posizioni concorrono all'ordine delle letture recenti.
- Ripasso disponibile quando ci sono card in scadenza.
- Otto concetti realmente definiti nei glossari, ordinati per numero di paper, con collegamento al filtro corrispondente. I termini vengono dai dati editoriali: non sono categorie disciplinari inventate.
- Quattro paper aggiunti di recente e collegamento all'elenco completo.

## Catalogo

La ricerca usa titolo, autori, concetti e alias, identificativi di fonte e riepiloghi. Normalizza accenti e punteggiatura; consente di incollare DOI/arXiv con il loro URL. Richiede ogni termine della query e ordina per pertinenza, privilegiando identificativi e titoli rispetto al riepilogo. Non fa ricerca semantica né promette risposte a domande in linguaggio naturale.

I risultati conservano titoli interi e mostrano autori, una frase sul problema, livelli/lingue delle spiegazioni, numero di tappe e pagine con passaggi spiegati. Il PDF originale resta raggiungibile direttamente. Il conteggio delle pagine non dimostra che ogni sezione o pagina sia spiegata interamente.

I filtri disponibili usano metadati reali: concetto, livello e, dove il catalogo offre più opzioni, lingua e presenza del percorso. Lingua e livello devono corrispondere alla stessa variante di spiegazione. Non è presente un filtro anno: i dati correnti non registrano l'anno di pubblicazione e la data di importazione non lo sostituisce.

Il telefono mostra i filtri in un pannello apribile; i filtri attivi rimangono fuori dal pannello e si possono rimuovere singolarmente. La pagina contiene al massimo 20 paper; la paginazione mostra prima/ultima pagina, la pagina corrente e le due adiacenti. Il numero di pulsanti rimane limitato anche con migliaia di paper.

Ricerca, filtri, ordinamento e pagina sono nell'URL. I vecchi link alla homepage con questi parametri vengono reindirizzati al catalogo. I link guida e PDF salvano in navigation state il punto d'ingresso e i parametri, così il ritorno conserva la ricerca. I salvataggi personali e i formati di backup restano quelli esistenti.

## Dati e responsabilità

`scripts/catalog-data.mjs` deriva l'indice dai metadati, glossari, passaggi e strutture curati. `scripts/build-catalog-index.mjs` scrive `papers/catalog-index.json`; la build lo rigenera prima di copiare i dati. In sviluppo, eseguire `npm run catalog-index` dopo una modifica ai dati rilevanti. Il file generato non va editato a mano.

Il manifest corrente contiene 11 paper e 236 concetti in circa 46 KB non compressi. Homepage e catalogo scaricano soltanto questo indice; definizioni, passaggi e PDF vengono caricati nel lettore. Le stringhe di ricerca vengono normalizzate una volta per manifest. La ricerca statica è adeguata alla dimensione misurata attuale; migliaia di paper andranno misurati sul dispositivo di destinazione prima di scegliere un server di ricerca.

Una misura locale in Node su copie dei metadati reali ha prodotto questi valori. Non misura download, layout o prestazioni del telefono: a 10.000 paper il peso del manifest e la preparazione iniziale richiederebbero una nuova scelta del formato, suddivisione dell'indice o un servizio di ricerca.

| Voci simulate | Manifest non compresso | Preparazione ricerca | Media di quattro query |
| ------------- | ---------------------- | -------------------- | ---------------------- |
| 1.000         | 1,60 MB                | 88 ms                | 1,5 ms                 |
| 10.000        | 15,76 MB               | 859 ms               | 10,9 ms                |

| File                       | Responsabilità                                                     |
| -------------------------- | ------------------------------------------------------------------ |
| `src/pages/Home.tsx`       | Composizione della homepage e compatibilità dei vecchi URL         |
| `src/pages/Library.tsx`    | Stato dei filtri nell'URL, risultati e paginazione                 |
| `src/components/catalog/`  | Controlli di ricerca, card compatte e ripresa delle letture        |
| `src/lib/catalog.ts`       | Validazione, ricerca, ranking, conteggi dei concetti e paginazione |
| `src/lib/useCatalog.ts`    | Caricamento, retry e cache dell'indice                             |
| `scripts/catalog-data.mjs` | Trasformazione deterministica dei dati curati                      |

## Verifica

I test di dominio proteggono generazione, alias, accenti, identificativi, pertinenza, varianti coerenti, riferimenti e paginazione. I test browser usano i dati reali per ricerca e ritorno dal lettore; un catalogo di prova con 1.000 voci verifica il limite dei risultati, i salti di pagina e il layout. Il catalogo simulato esiste soltanto nel test, non viene pubblicato.

Non sono stati aggiunti percorsi curati, suggerimenti personalizzati o dichiarazioni di completezza. Richiedono dati editoriali specifici; la struttura lascia loro spazio senza inventarli.

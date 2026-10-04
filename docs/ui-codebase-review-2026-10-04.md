# Revisione UI/UX e codebase — 4 ottobre 2026

**Stato:** i punti U1–U9 e C1–C6 sono stati implementati. Il [resoconto degli interventi e delle verifiche](ui-codebase-changes-2026-10-04.md) descrive lo stato aggiornato, comprese le prove browser. Il testo seguente conserva l'audit precedente alle modifiche; numeri di riga e limitazioni della verifica si riferiscono a quel momento.

## Valutazione

Il progetto ha una base utile: il PDF originale resta il riferimento, le spiegazioni sono collegate ai passaggi, guida e mappa offrono due modi diversi di capire il paper, il ripasso riusa quei contenuti. Caricamento condiviso, persistenza e ricerca hanno già moduli riconoscibili.

Il maggiore miglioramento viene dal rendere il lettore più prevedibile e più facile da leggere. Oggi la selezione, i filtri, le schede, le annotazioni e gli scroll possono interferire; inoltre la spiegazione selezionata compete con molti contenuti e azioni. Nel codice queste stesse difficoltà si concentrano nel coordinamento di `PdfViewer`.

Rifarei l'organizzazione dell'interazione del lettore, la gerarchia della spiegazione e la distribuzione degli strumenti. Manterrei il modello dei paper, i contenuti editoriali e i moduli condivisi di caricamento, salvataggio e testo PDF. La dimensione del progetto permette interventi progressivi con responsabilità esplicite.

## Perimetro e qualità dell'evidenza

Revisione di componenti, pagine, CSS, librerie, test, script e configurazione. La revisione considera lo stato corrente del workspace, comprese le modifiche precedenti ancora non commesse. In questa sessione è stato aggiunto soltanto questo report.

Le osservazioni sono distinte in tre categorie:

- **Riprodotto:** esecuzione dei componenti o delle funzioni reali in un ambiente controllato, con dipendenze DOM/PDF sostituite dove necessario.
- **Verificato nel codice:** comportamento o regola presente in markup, handler, CSS o configurazione; alcuni dettagli vanno confermati nel browser.
- **Proposta di design:** una scelta motivata per migliorare un percorso, da valutare su schermate reali e con l'uso dell'app.

`npm test`: **42 test superati su 42**. Ulteriori verifiche isolate hanno mostrato selezione filtrata, distruzione della bozza durante il ridisegno, scroll di glossario obsoleto, chiusura del popover su scroll interno, falso successo della copia e navigazione della pagina durante la digitazione. Verificata anche l'accettazione di un indice concetti incompleto.

**Limite:** il controllo del computer è rimasto in attesa dei permessi di Accessibilità e registrazione schermo; il controllo browser ha poi segnalato che nessun browser era disponibile. Non sono state acquisite schermate né completate prove manuali su desktop/mobile o con uno screen reader. I giudizi sulle proporzioni derivano quindi dal CSS e dalla struttura dei contenuti. Non costituiscono una certificazione di accessibilità o una misurazione delle prestazioni.

## Priorità

| Ordine | Intervento | Impatto principale | Evidenza |
| --- | --- | --- | --- |
| 1 | Preservare bozze e modifiche delle annotazioni durante redraw e uscita della pagina | Affidabilità del lavoro dell'utente | Lifecycle riprodotto; focus nativo da verificare |
| 2 | Una selezione deve rendere visibile la spiegazione, da qualunque punto parta | Prevedibilità della navigazione | Riprodotto |
| 3 | Correggere scroll del glossario, attese obsolete e feedback della copia | Lettura e fiducia nei comandi | Riprodotto |
| 4 | Completare input, tastiera, stati di ricerca ed errori | Efficacia e accessibilità | Markup/handler verificati |
| 5 | Riorganizzare toolbar e spiegazione selezionata | Chiarezza e affollamento | Proposta basata sulla struttura corrente |
| 6 | Migliorare spazio di lettura, adattamento e libreria mobile | Leggibilità e scelta del paper | CSS verificato; QA visiva necessaria |
| 7 | Separare coordinamento, navigazione PDF e lavoro sulle annotazioni | Manutenzione | Collegato ai difetti riprodotti |
| 8 | Completare contratti dati, verifiche automatiche e ingresso per manutentori | Prevenzione e comprensibilità | Codice/configurazione verificati |

Gli interventi 1–3 e 7 si sostengono a vicenda: correggere una volta le regole di interazione evita che ogni componente debba ricordare una combinazione di aggiornamenti di stato.

## UI/UX

### U1. La selezione non garantisce l'apertura della spiegazione

**Alta priorità, riprodotto.** Riferimenti: [PdfViewer](../src/components/PdfViewer.tsx), linee 311 e 342; [NotesPane](../src/components/NotesPane.tsx), linee 53, 64 e 139.

Il comando nel PDF promette «Mostra spiegazione», ma il suo handler cambia soltanto selezione e apertura del pannello. Se è attiva Mappa o Guida, resta quella scheda. Se «Il filo» esclude il passaggio, la spiegazione resta filtrata. Il percorso da glossario/guida gestisce già queste condizioni: le due entrate hanno regole diverse.

**Riproduzione:** attivare «Il filo», poi selezionare nel PDF un passaggio fuori dal filo; oppure aprire Mappa e selezionare un paragrafo nel PDF. La selezione cambia, ma il contenuto richiesto non appare.

**Proposta:** ogni azione che chiede una spiegazione deve aprire la scheda Spiegazioni, rivelare il passaggio e scorrere il pannello necessario. Quando occorre togliere un filtro, rendere visibile il cambiamento. Dare al filtro un'etichetta breve, un conteggio e un comando per rimuoverlo vicino ai contenuti filtrati.

**Criterio di riuscita:** click PDF, link guida, link glossario e collegamento interno producono sempre una spiegazione visibile e identificabile; il passaggio selezionato corrisponde a quello evidenziato nel PDF.

### U2. Una bozza può essere distrutta insieme al rendering PDF

**Alta priorità, lifecycle riprodotto.** Riferimenti: [AnnotationLayer](../src/components/AnnotationLayer.tsx), linee 28, 37, 118 e 142; [PageCanvas](../src/components/PageCanvas.tsx), linee 91, 133 e 162.

La bozza di testo vive soltanto nello stato di `AnnotationLayer` e viene salvata su blur. Durante un cambio di scala il layer viene smontato finché il canvas non è pronto; viene smontato anche quando la pagina esce dalla finestra di rendering. Il lavoro in modifica è quindi legato alla durata di una superficie grafica temporanea.

La riproduzione con i componenti reali ha mostrato una textarea prima dello zoom, nessuna dopo il cambio di scala e zero annotazioni salvate. Questo ambiente non simula il blur nativo: un click su un controllo può salvarla prima del redraw. Rimane verificata l'assenza di conservazione della bozza quando lo smontaggio avviene senza quel blur, per esempio durante un adattamento automatico.

**Proposta:** conservare il lavoro in corso indipendentemente dal canvas. Rendere chiaro il confine fra bozza e annotazione salvata, con un salvataggio esplicito oppure un autosalvataggio affidabile e riconoscibile. Anche l'editing di una nota esistente deve sopravvivere al ridisegno.

**Criterio di riuscita:** scrivere, ridimensionare/zoomare, far uscire e rientrare la pagina, continuare a scrivere: il testo rimane. Salva/Annulla hanno un esito chiaro e non creano duplicati.

### U3. Il glossario si chiude mentre si cerca di leggerlo

**Priorità alta per definizioni lunghe, riprodotto.** Riferimenti: [Popover](../src/components/Popover.tsx), linea 37; [CSS](../src/index.css), linea 1276; [conceptHighlight](../src/lib/conceptHighlight.ts), linea 133.

Il popover ha uno scroll interno, ma ascolta tutti gli eventi scroll in capture e chiude senza distinguere la loro origine. Scorrere una definizione lunga o la lista «Anche in» richiede quindi la sua stessa chiusura.

Un secondo difetto riguarda «Evidenzia nel PDF»: lo scroll attende la comparsa di un indice di occorrenza senza associare l'attesa al concetto. Dopo un cambio rapido, la richiesta precedente può scorrere ed evidenziare il nuovo concetto che riusa quell'indice. Questo comportamento è stato riprodotto con la funzione reale e timer/DOM controllati.

**Proposta:** consentire lo scroll interno, definire quando uno scroll esterno deve chiudere o riposizionare la scheda, cancellare la navigazione precedente al cambio/chiusura del concetto. Su schermi stretti valutare una scheda più stabile con titolo e chiusura sempre raggiungibili.

**Criterio di riuscita:** una definizione lunga si legge fino in fondo; cambi rapidi di concetto non provocano salti tardivi; Escape chiude e consente di riprendere la lettura dal punto di apertura.

### U4. La spiegazione attiva ha troppi livelli di contenuto simultanei

**Priorità medio-alta, proposta di design.** Riferimento: [ExplanationNote](../src/components/ExplanationNote.tsx), linee 113, 135, 157 e 203.

Nella scheda attiva, «In concreto», diagramma, «Perché questo passaggio» e link alla guida precedono il testo della spiegazione. Ruoli nella mappa, collegamenti futuri, approfondimento, suggerimento per il quaderno, domande e tre azioni aggiungono altri livelli. L'attivazione modifica molto l'altezza della scheda e la posizione delle successive.

Il contesto didattico è utile; la gerarchia corrente rende però meno immediato trovare la risposta al click sul PDF.

**Proposta concreta per la scheda:**

1. Numero del passaggio e sezione, con stato selezionato ben riconoscibile.
2. Spiegazione come contenuto principale.
3. Contesto breve del passaggio; percorso completo e diagramma espandibili o raccolti nella Guida. Per il livello Base si può lasciare aperto il contesto utile.
4. Approfondimento e collegamenti pertinenti, con titoli uniformi.
5. Azione di ripasso e un solo ingresso per gli aiuti esterni; le altre azioni restano secondarie.

Valutare una vista centrata sul passaggio selezionato con contesto vicino, conservando un modo per sfogliare tutte le spiegazioni. Prima di cambiare la lista, verificare come viene usata per leggere in sequenza.

«Commenti» indica oggi spiegazioni editoriali; «Nota» indica annotazioni personali. Userei **Spiegazioni** e **Le mie note**, così i due oggetti diventano distinguibili senza imparare la struttura interna.

**Criterio di riuscita:** dopo un click, l'utente individua subito la spiegazione e l'azione principale; il contesto rimane accessibile; aprire un aiuto non obbliga a cercare di nuovo il passaggio.

### U5. La toolbar mobile perde capacità e l'input pagina naviga troppo presto

**Priorità medio-alta, comportamento e CSS verificati.** Riferimenti: [Toolbar](../src/components/Toolbar.tsx), linee 113, 132, 197 e 259; [CSS](../src/index.css), linea 1077.

La toolbar desktop raccoglie navigazione, zoom/adattamento, ricerca, quattro strumenti, colori, filo, pannello, variante e download. Sotto 899 px titolo, zoom/adattamento, annotazioni e download scompaiono tramite `display:none`, senza un ingresso alternativo. Questo riguarda anche tablet e finestre strette.

L'input pagina invoca la navigazione a ogni modifica: digitare «20» può prima portare a pagina 2. Svuotarlo produce `Number("") === 0`, che viene passato al salto e ricondotto al limite. Il campo non possiede un nome accessibile; precedente/successiva restano abilitati ai bordi.

**Proposta:** una barra principale per libreria, pagina, ricerca e livello; strumenti di annotazione in un gruppo esplicito e comandi secondari in un menu accessibile anche su mobile. Separare il valore in digitazione dalla pagina confermata, con commit su Invio/blur e validazione leggibile. Disabilitare i comandi senza effetto ai limiti. Selezione dello strumento e filtro devono avere stati dichiarati e riconoscibili.

**Criterio di riuscita:** nessuna funzione scompare senza alternativa; «20» si inserisce senza salti intermedi; svuotare il campo è possibile durante l'editing; apertura della ricerca e ritorno alla lettura sono prevedibili.

### U6. Lo spazio di lettura è poco adattabile

**Priorità media, CSS verificato e proposta da provare visivamente.** Riferimenti: [CSS](../src/index.css), linee 845, 877 e 994; [PdfViewer](../src/components/PdfViewer.tsx), linee 45, 86 e 127.

Il pannello desktop è fisso a 380 px e le spiegazioni sono a `0.8rem` con interlinea 1.45. Per un contenuto di studio lungo, questa combinazione merita una verifica di leggibilità. Su mobile il pannello aperto occupa il 55% dell'altezza; la soglia a 899 px cambia bruscamente il modello di lettura.

Il desktop parte con scala 1.5 e senza adattamento: vicino alla soglia, una pagina può eccedere la larghezza rimasta dopo il pannello. Non ho misurato il clipping nel browser. «Adatta pagina» stima l'altezza con costanti di 100 e 35 px, che possono divergere dalle dimensioni effettive dei controlli e del riepilogo.

**Proposta:** adattamento iniziale alla larghezza disponibile, rispettando poi lo zoom scelto dall'utente; dimensione del testo e larghezza del pannello regolabili; misura del contenitore effettivo per l'adattamento. Su mobile offrire aperture brevi e complete del pannello con uno stato chiaramente visibile. Verificare dimensioni intermedie prima di scegliere nuovi breakpoint.

Tutte le spiegazioni del paper vengono montate nel pannello. Nei paper lunghi è un punto da profilare, ma non è stata misurata una lentezza: introdurre virtualizzazione soltanto dopo aver verificato costo, focus, ricerca nel pannello e navigazione.

**Criterio di riuscita:** apertura a 1024 px utilizzabile senza correzioni manuali immediate; spiegazione leggibile con testo ingrandito; ridimensionamento non perde il punto di lettura né una bozza.

### U7. Alcuni feedback comunicano un risultato diverso da quello ottenuto

**Priorità media, falso successo della copia riprodotto.** Riferimenti: [ExplanationNote](../src/components/ExplanationNote.tsx), linea 94; [PdfViewer](../src/components/PdfViewer.tsx), linea 153; [Reader](../src/pages/Reader.tsx), linea 25; [Library](../src/pages/Library.tsx), linea 112; [Review](../src/pages/Review.tsx), linea 226.

La copia per Claude/ChatGPT ignora l'errore e mostra comunque «Copiato ✓». Il commento prevede una copia manuale, ma la UI non offre il testo da copiare. L'apertura della finestra non ha un recupero visibile se fallisce; il blocco dei popup va provato nel browser.

La ricerca azzera i risultati prima dell'attesa e mostra «0» anche mentre lavora; in caso di errore scrive soltanto nella console. L'utente non distingue ricerca in corso, nessuna corrispondenza e ricerca fallita. Reader e Library mostrano un errore senza retry; Review ha già «Riprova». Alcuni messaggi del caricamento PDF sono in inglese.

**Proposta:** stati distinti e uniformi — attesa, risultato vuoto, errore recuperabile, successo. «Copiato» solo dopo conferma; in caso di errore offrire testo selezionabile e collegamento esplicito alla chat. La ricerca deve mostrare lavoro in corso e poter riprovare. Uniformare lingua e tono dei messaggi.

**Criterio di riuscita:** negando gli appunti non compare un falso successo; una ricerca lenta non sembra vuota; un errore di rete ha un'azione per recuperare senza ricaricare tutta l'app.

### U8. Tastiera, focus e colori hanno lacune concrete

**Priorità media, markup/handler e contrasto verificati.** Riferimenti: [ArgumentMap](../src/components/ArgumentMap.tsx), linea 50; [ExplanationNote](../src/components/ExplanationNote.tsx), linee 105 e 169; [NotesPane](../src/components/NotesPane.tsx), linea 93; [Popover](../src/components/Popover.tsx), linea 46; [Review](../src/pages/Review.tsx), linea 168; [CSS](../src/index.css), linee 70, 235 e 551.

- La selezione di una tesi è affidata a un `li` cliccabile senza un controllo equivalente per tastiera. L'attivazione della spiegazione è affidata a un `div` cliccabile. Usare controlli espliciti, evitando un grande pulsante che contenga altri pulsanti.
- Le schede dichiarano `role=tab` ma mancano gestione del focus con le frecce, relazioni con i pannelli e un solo tab nel percorso Tab. Queste relazioni sono descritte nel [pattern Tabs di WAI-ARIA](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/).
- Il popover dichiara `role=dialog` senza nome e senza gestione del focus. L'ancoraggio del concetto usa coordinate del mouse: un click generato da tastiera può aprire la scheda vicino all'origine dello schermo. Ancorare al controllo reale. Decidere se la scheda sia non modale o modale; il [pattern del dialog modale](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/) richiede comportamenti che vanno applicati quando la modalità è effettivamente modale, compresa la gestione del ritorno del focus.
- Vari toggle mostrano lo stato solo con il colore; filtri di livello e strumenti hanno bisogno di stato accessibile. Input pagina e ricerca richiedono nomi accessibili persistenti. Il pulsante di chiusura del popover è etichettato «Close».
- Nel ripasso l'handler globale di Spazio/Invio esclude soltanto gli input. Quando un altro pulsante ha focus, può impedire la sua azione nativa e rivelare la risposta. Limitare le scorciatoie al contesto della card, rispettando controlli, editing e combinazioni con modificatori. Questa interferenza è dedotta dall'handler e va provata nel browser.
- In tema scuro, bianco su `--accent: #e8916a` ha contrasto calcolato **2.42:1**. Si usa nel badge della navigazione, nei chip attivi e nelle icone attive della toolbar. Per testo piccolo il riferimento è [4.5:1](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html); per informazioni grafiche necessarie a identificare i controlli, [3:1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). Definire un colore sopra l'accento oppure un fondo funzionale distinto per questi stati.

**Criterio di riuscita:** percorso libreria → PDF → spiegazione → glossario → ripasso eseguibile con tastiera, focus sempre individuabile e ritorno sensato dopo la chiusura. Verificare i colori degli stati in entrambi i temi; non dedurre conformità generale dai soli colori controllati qui.

### U9. Libreria, ripresa e recupero possono seguire meglio l'intento

**Priorità media/bassa, mix di comportamento verificato e proposte.** Riferimenti: [Library](../src/pages/Library.tsx), linee 10, 94 e 199; [Reader](../src/pages/Reader.tsx), linea 28; [CSS](../src/index.css), linee 277 e 385; [Review](../src/pages/Review.tsx), linee 164 e 282.

Su mobile la libreria forza due colonne, con copertine in rapporto 3:4, titoli ridotti e vari metadati. La copertina scientifica aiuta a riconoscere un paper, ma compete con titolo e idea nel poco spazio. Una lista con copertina piccola, titolo e breve ragione per leggerlo è una candidata concreta da confrontare con le card. Alleggerire la data di import e i badge secondari; permettere di leggere il titolo completo. Con 11 paper e sei per pagina, valutare se la paginazione aiuti più di una lista breve.

Il filtro «Base/Intermedio/Esperto» filtra la disponibilità dei paper ma il link non porta quel livello al lettore: all'apertura viene scelta la prima variante di `meta`. L'aspettativa probabile è continuare con il livello appena selezionato. Trasmettere o ricordare una preferenza valida, con fallback dichiarato.

La posizione di lettura, il livello scelto e i filtri della libreria non vengono conservati fra uscite e ritorni. Aggiungere «Riprendi» e ritorno al punto precedente dopo un salto lungo ridurrebbe il lavoro di orientamento. Il ripasso fa avanzare subito dopo il voto e la gomma elimina subito le annotazioni: un semplice «Annulla» per l'ultima operazione migliorerebbe il recupero degli errori senza aggiungere conferme a ogni gesto.

**Criterio di riuscita:** titolo e idea restano leggibili su schermo stretto; scegliere Base e aprire un paper mantiene un livello coerente; riprendere uno studio o correggere un voto accidentale richiede un'azione comprensibile.

## Codebase

### C1. Separare il coordinamento del lettore per responsabilità reali

**Priorità alta, intervento strutturale.** Riferimenti: [PdfViewer](../src/components/PdfViewer.tsx), [Toolbar](../src/components/Toolbar.tsx), [NotesPane](../src/components/NotesPane.tsx).

`PdfViewer` ha 610 righe, 22 dichiarazioni di stato e nove effetti. I numeri indicano dove guardare; il problema concreto sono regole distribuite fra più handler, stato delle schede/filtri e lifecycle asincroni. Un manutentore deve ricostruire le loro combinazioni per capire cosa farà una selezione.

Responsabilità che renderei esplicite:

| Module | Responsabilità da tenere insieme | Comportamento che deve nascondere ai componenti |
| --- | --- | --- |
| Sessione/interazione del lettore | Passaggio attivo, apertura/scheda, filtro e selezione della mappa | Una richiesta di spiegazione rivela sempre il suo bersaglio |
| Documento e viewport PDF | Caricamento documento, dimensioni, scala/adattamento e posizione | Lifecycle del renderer e misure effettive |
| Ricerca e navigazione delle occorrenze | Risultati, indice corrente, cancellazione e attesa del rendering | Una richiesta vecchia non modifica una ricerca nuova |
| Lavoro sulle annotazioni | Bozza/editing, salvataggio, annullamento | Il lavoro dell'utente sopravvive alle superfici PDF temporanee |

`PdfViewer` rimane il punto di composizione leggibile. Le Interface dei figli devono esprimere azioni del lettore; la Implementation decide quali stati devono cambiare insieme. Uno state reducer è una possibilità quando rende le transizioni esplicite, ma la decisione va guidata dai flussi, non dal conteggio degli hook. Il principio di evitare stati contraddittori è spiegato in [Choosing the State Structure di React](https://react.dev/learn/choosing-the-state-structure).

La **Locality** migliora se una regola si legge e si corregge in un posto. La **Depth** migliora se pochi comandi comprensibili nascondono il coordinamento necessario. Evitare di spezzare il componente in molti hook che restituiscono ogni setter: sposterebbero il testo mantenendo lo stesso carico mentale. Anche i molti parametri della toolbar vanno raggruppati solo dove esiste una responsabilità coerente.

**Deletion test:** rimuovere gli handler duplicati concentra le regole; rimuovere il coordinatore e distribuire gli stessi setter nei figli le duplicherebbe. **Verifica:** i percorsi di U1–U3 devono attraversare la stessa regola, conservando la distinzione fra scorrere il PDF e scorrere le spiegazioni.

### C2. Rendere locale l'accoppiamento con il DOM PDF

**Priorità media, collegata a U1 e U3.** Riferimenti: [PdfViewer](../src/components/PdfViewer.tsx), linee 215, 311, 329 e 355; [conceptHighlight](../src/lib/conceptHighlight.ts), linea 133; [search](../src/lib/search.ts).

Gli ID `page-*`/`note-*`, i selettori delle occorrenze, doppie `requestAnimationFrame`, attese di 400 ms e polling sono distribuiti fra componenti e librerie. Il manutentore deve conoscere convenzioni DOM e tempistiche di altre parti per modificare una navigazione.

**Proposta:** un confine piccolo e riconoscibile per la navigazione della superficie PDF, con richieste cancellabili e prontezza della destinazione verificabile. Riutilizzare il comportamento di cancellazione già presente nella ricerca per il glossario. Documentare le poche convenzioni DOM rimaste; preferire segnali di pagina/layout pronto alle attese fisse dove il rendering può comunicarli.

**Beneficio:** maggiore Locality del collegamento con pdf.js e meno dipendenza da tempi fortunati. **Deletion test:** un adapter che inoltra soltanto `getElementById` aggiungerebbe un salto inutile; è utile se possiede davvero attesa, identità, cancellazione e scroll. **Verifica:** cambiare query/concetto o chiudere il lettore interrompe ogni navigazione precedente.

### C3. Il confine dati deve garantire ciò che i componenti consumano

**Priorità media, difetto verificato; nessun file corrente malformato individuato.** Riferimenti: [papers](../src/lib/papers.ts), linee 24, 39, 54 e 77; [ConceptPopover](../src/components/ConceptPopover.tsx), linea 64; [Library](../src/pages/Library.tsx), linea 69; [CLAUDE.md](../CLAUDE.md), Data model rules.

`parsePaper` accetta un indice come `{term: [{}]}`; il glossario usa poi `entry.term.toLowerCase()`. Il manifesto della libreria viene letto direttamente come JSON e consumato come array di oggetti tipizzati. La validazione è presente, ma non copre tutti i campi che promette ai consumatori.

Esiste anche una contraddizione: loader obbliga tutte le varianti di spiegazioni/definizioni, mentre componenti e documentazione descrivono il fallback visibile. Con i dati completi attuali non emerge; chi importa o modifica un paper riceve però due contratti diversi.

**Proposta:** mantenere il loader, validare manifesto e campi consumati dell'indice, scegliere una politica unica sulle varianti e applicarla in importazione, runtime e documentazione. Gli errori devono identificare file, record e campo. Pochi validator espliciti possono bastare; un motore generico va giustificato dalla crescita dei formati.

**Beneficio:** una Interface affidabile evita difese sparse e permette al manutentore di sapere quali dati sono sicuri. **Deletion test:** eliminare il loader riprodurrebbe cache, retry, validazione e cancellazione per consumatore in più pagine. **Verifica:** indice incompleto e variante mancante hanno esito documentato e non provocano un crash successivo della UI.

### C4. I test devono coprire anche le combinazioni usate dal lettore

**Priorità media.** Riferimenti: [helper dei test](../tests/helpers/modules.mjs), [reader.test](../tests/reader.test.mjs), [rendering.test](../tests/rendering.test.mjs), [deploy](../.github/workflows/deploy.yml), [package.json](../package.json).

I test veloci proteggono calcolo, dati, loader e persistenza. Quelli di Reader sostituiscono `PdfViewer`; quelli di rendering sostituiscono `AnnotationLayer`. Le combinazioni che hanno prodotto U1 e U2 restano fuori. L'harness transpila manualmente TSX, mantiene un resolver proprio e forza `BASE_URL` a `/`: non verifica il percorso di produzione `/paper-reader/`.

**Proposta:** conservare i test esistenti e aggiungere pochi test sui comportamenti reali: selezione con filtro/scheda, bozza durante redraw, cambio rapido di occorrenze, apertura di `?p=`, tastiera. Almeno una verifica deve attraversare DOM e rendering del browser e il base path di produzione. Se la suite DOM cresce, un runner che riusi la trasformazione Vite ridurrebbe il codice di infrastruttura da mantenere.

La pipeline attuale esegue `npm ci` e build, ma non i test o la validazione semantica dei paper. Rendere leggibile una sequenza di verifica e applicarla prima della pubblicazione e sulle pull request. Distinguere i controlli Python di importazione e predisporne esplicitamente l'ambiente quando vengono eseguiti.

**Beneficio:** i comportamenti già richiesti diventano una garanzia ripetibile. **Deletion test:** eliminare oggi l'harness senza sostituzione distribuirebbe compilazione e mock fra i test; la prima esigenza è colmare i percorsi mancanti. **Verifica:** un difetto come selezionare un passaggio nascosto deve fallire nei controlli prima di essere pubblicato.

### C5. Un manutentore deve poter iniziare e verificare senza un agente

**Priorità media per l'obiettivo di manutenzione umana.** Riferimenti: [CLAUDE.md](../CLAUDE.md), [package.json](../package.json), [script di importazione](../.claude/skills/import-paper/scripts).

Le informazioni principali sono in `CLAUDE.md`; manca un README. L'importazione viene presentata soprattutto come invocazione di una skill. Non è dichiarata una versione Node supportata, anche se il comando test dipende da un'opzione specifica del runtime; Node 22 compare soltanto nel deploy. Non sono presenti comandi/convenzioni di lint e formattazione condivisi.

**Proposta:**

- README con scopo, prerequisiti, avvio, test/build, breve mappa dei moduli e comportamento del deploy.
- Una procedura per modificare/importare dati: file sorgente e generati, comandi esatti, verifiche, riferimenti da aggiornare e parte editoriale da svolgere leggendo il paper. Chiarire ciò che gli script estraggono e ciò che deve essere scritto/revisionato da una persona.
- Regole del dominio in un documento umano condiviso: ID pubblicati stabili, indici pagina 0/1-based, coordinate normalizzate, variante e livello, persistenza e backup. `CLAUDE.md` rimanda a queste istruzioni per evitare due fonti divergenti.
- Versione Node dichiarata e pochi comandi di verifica riconoscibili. Formattazione automatica, controlli React/hooks e accessibilità del JSX con regole moderate; una sola convenzione per import ed estensioni. Evitare una riformattazione massiva nello stesso cambiamento che corregge i comportamenti.

**Beneficio:** l'Interface di sviluppo diventa utilizzabile da chi legge il repository. La manutenzione quotidiana richiede trovare un modulo e seguire un comando, invece di ricostruire istruzioni dell'agente. **Deletion test:** la documentazione condivisa elimina duplicazioni; aggiungere un README che copia tutto `CLAUDE.md` le aumenterebbe. **Verifica:** una persona nuova riesce ad avviare l'app, cambiare una spiegazione e verificare la modifica usando soltanto i documenti e i comandi del progetto.

### C6. CSS e nomi devono rendere visibili le intenzioni

**Priorità medio-bassa; incrementale.** Riferimenti: [CSS](../src/index.css), [types](../src/types.ts), [NotesPane](../src/components/NotesPane.tsx), [ExplanationNote](../src/components/ExplanationNote.tsx).

Il CSS ha 2272 righe, ma sezioni riconoscibili: la lunghezza da sola non richiede una migrazione. I problemi verificati sono uso dell'accento con colori sovrapposti incompatibili, dimensioni/controlli adattati con regole globali e vocabolario «commento/nota» ambiguo.

**Proposta:** pochi token condivisi per colore sopra l'accento, testo, spaziature, dimensioni dei controlli e stati. Separare gli stili di libreria, lettore e ripasso quando si interviene su quelle superfici; mantenere una base piccola. Uniformare il vocabolario fra UI, tipi e documentazione, chiarendo che un passaggio può avere più ancore PDF ma una sola identità editoriale.

**Beneficio:** maggiore Locality degli stili e meno eccezioni implicite. **Deletion test:** piccoli file che reimportano soltanto regole globali non aumentano la Depth; la divisione serve se un manutentore trova e modifica una superficie senza ispezionare l'intero foglio. **Verifica:** uno stato attivo usa la stessa regola nelle schermate pertinenti, in entrambi i temi, e le scelte di layout si leggono nel file della superficie.

## Cosa conservare

- `lib/papers.ts`: cache, retry e cancellazione per consumatore hanno un confine utile; completare il contratto.
- `lib/userData.ts` e `lib/storage.ts`: migrazioni, scrittura atomica, errori recuperabili e sincronizzazione devono restare condivisi. Rimetterli nelle pagine duplicherebbe la parte difficile.
- `lib/pdfText.ts`: ricerca testuale e glossario hanno bisogno della stessa lettura coerente del PDF.
- ID e coordinate dei contenuti pubblicati: una riorganizzazione della UI non deve cambiare identità di passaggi, concetti o domande referenziate dal ripasso.
- Guide, mappe, diagrammi e approfondimenti: migliorare la loro presentazione preservando il lavoro editoriale.
- React, Vite e TypeScript strict: lo stack attuale permette gli interventi proposti. L'introduzione di nuove astrazioni va motivata da una responsabilità concreta.

## Sequenza di intervento consigliata

1. **Affidabilità:** conservazione bozze, selezione che rivela il bersaglio, scroll interno del glossario, cancellazione delle navigazioni obsolete, esito vero della copia. Aggiungere regressioni sui percorsi corretti.
2. **Lettura e comandi:** gerarchia della scheda attiva, toolbar con strumenti accessibili su tutte le dimensioni, input pagina e stati di ricerca, semantica/focus/contrasto. Verificare nel browser durante il lavoro.
3. **Manutenzione:** consolidare le regole di interazione mentre si correggono i percorsi; completare validazione, documentazione umana e controlli automatici. Tenere eventuali riordini/formattazioni separati dai cambiamenti di comportamento.
4. **Continuità:** libreria mobile, livello coerente all'apertura, ripresa della lettura e annullamento dell'ultima operazione. Valutare le alternative con schermate e piccoli percorsi d'uso.

## Prova visiva ancora da completare

Usare un paper breve e uno lungo, passaggi con diagrammi/approfondimenti e concetti con molte definizioni collegate. Verificare almeno 390 px, circa 768 px, 1024 px e un desktop ampio; tema chiaro/scuro; testo ingrandito; tastiera e focus.

I percorsi da osservare sono scelta dalla libreria, click PDF con scheda/filtro già attivi, lettura sequenziale, apertura/scorrimento del glossario, ritorno dopo un salto, ricerca rapida, annotazione durante resize e ripasso con recupero di un voto. Confrontare le proposte sulla facilità di trovare il contenuto, numero di correzioni manuali e mantenimento del punto di lettura, oltre all'aspetto delle schermate.

# Vocabolario del progetto

- **Paper:** PDF originale con metadati e contenuti editoriali; identificato da uno slug stabile.
- **Passaggio:** unità editoriale con un ID stabile, testo sorgente e spiegazioni. Può avere più ancore su pagine diverse. Il tipo storico `Paragraph` rappresenta questo oggetto.
- **Ancora:** pagina zero-based e rettangoli normalizzati del PDF che localizzano un passaggio.
- **Spiegazione:** testo editoriale per una variante; distinta dalla nota personale.
- **Variante:** combinazione di lingua e livello, identificata da `Variant.key`.
- **Nota personale:** annotazione di testo o disegno dell'utente, salvata nel browser.
- **Sessione del lettore PDF:** selezione, scheda, apertura del pannello e filtri coordinati. La richiesta di un passaggio apre le spiegazioni e rimuove un filtro che lo esclude.
- **Il filo:** passaggi che enunciano o sostengono le tesi della mappa; un filtro esplicito delle spiegazioni.
- **Guida:** percorso delle sezioni che chiarisce oggetti, meccanismo e scopo dei passaggi.
- **Tappa:** un'idea della guida, con obiettivo, significato e riferimenti ai passaggi originali. Conserva l'ID editoriale dello step.
- **Sessione della lettura guidata:** orientamento, tappa o sintesi, posizione, variante, tappe esplorate, dubbi e sintesi personale. Una tappa esplorata non equivale a comprensione verificata.
- **Dubbio:** scelta personale di rivedere una tappa; continuare lo conserva, rileggerla e dichiararla chiara lo rimuove. L'aggiunta al ripasso è un'azione distinta.
- **Mappa:** tesi, prove e dipendenze dell'argomento del paper.
- **Card di ripasso:** riferimento stabile a concetto, passaggio o domanda, con una pianificazione locale.
- **Posizione di lettura:** pagina, passaggio e variante da cui riprendere un paper.
- **Perimetro delle spiegazioni:** contenuto effettivamente curato rispetto all'originale. Contare le pagine con ancore non dimostra che il contenuto scientifico sia completo.

Formati, comandi e invarianti: [guida di sviluppo](docs/development.md).

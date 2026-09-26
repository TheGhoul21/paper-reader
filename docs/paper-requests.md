# Richiedere un paper

Chiunque può chiedere di aggiungere un paper alla libreria aprendo una issue su GitHub. Questa guida spiega come farlo e cosa succede dopo, sia per chi chiede sia per chi importa.

## Per chi chiede

### Tre modi per aprire una richiesta

1. **Da una citazione, nel reader.** Clicca un riferimento bibliografico nel PDF (es. `[24]`). Nel riquadro che si apre trovi:
   - **Cerca su arXiv / Google Scholar / DOI**: per trovare il paper e il suo link;
   - **Richiedi questo paper**: apre una issue già compilata con la citazione, il paper da cui arriva e il livello che stavi leggendo. Se hai trovato il link, incollalo nel campo *Link*.
2. **Dall'header del sito**: *Richiedi un paper* apre lo stesso modulo, vuoto.
3. **Direttamente su GitHub**: [New issue → Richiesta di un paper](https://github.com/TheGhoul21/paper-reader/issues/new?template=paper-request.yml).

### Cosa scrivere

- **Riferimento** (obbligatorio): titolo, autori e anno, o la voce di bibliografia così com'è.
- **Link** (molto utile): arXiv se c'è, altrimenti DOI o pagina dell'editore.
- **Livello e lingua** delle spiegazioni: *nessun background*, *laurea in un campo affine* o *esperto del sottocampo*. Se il paper è già in libreria ma a un altro livello, chiedilo lo stesso: si aggiunge una variante, non si reimporta.
- **Perché ti interessa** (facoltativo): aiuta a scegliere cosa spiegare meglio.

### Cosa succede dopo

| Etichetta | Significato |
|---|---|
| `paper-request` | Richiesta nuova, da lavorare (messa automaticamente dal modulo). |
| `needs-link` | Non siamo riusciti a identificare il paper con certezza: serve un link o un dettaglio in più da te. |
| `license-blocked` | Il paper esiste ma la sua licenza non ne permette la ripubblicazione (vedi *Licenze*). |
| `duplicate` | È già in libreria: nel commento trovi il link. Se chiedevi un altro livello, la richiesta resta aperta finché la variante non è aggiunta. |

Quando il paper è importato, la issue viene chiusa con un commento che contiene il link al paper nel reader.

## Licenze

La libreria pubblica il PDF originale così com'è, quindi si possono importare **solo paper la cui licenza permette la ridistribuzione**:

- **Sì:** CC BY, CC BY-SA, CC0 (licenze indicate nella pagina arXiv del paper, o dall'editore per le riviste open access come *Quantum*, *Physical Review Research*, *EPTCS*).
- **No senza permesso:** la licenza arXiv di default *non-exclusive distribution* (`arxiv.org/licenses/nonexclusive-distrib/1.0/`), che concede la distribuzione solo ad arXiv, e i paper a pagamento. In questi casi si cerca una versione open dell'editore; se non c'è, la issue prende l'etichetta `license-blocked`.

## Per chi importa

Il lavoro si fa con lo skill `import-paper` (Claude Code), sezione *Importing from a GitHub issue* del suo `SKILL.md`. In sintesi:

1. **Leggi la richiesta**: `gh issue view <N>`.
2. **Identifica il paper** a partire dal link o dal riferimento:
   ```
   uv run .claude/skills/import-paper/scripts/find_paper.py "<link o riferimento>"
   ```
   Ordine di ricerca: link fornito → id arXiv o DOI nel testo → ricerca per titolo su arXiv → Google Scholar a mano → chiedere al richiedente (`needs-link`). Se il punteggio di somiglianza del titolo è sotto 0.8, verifica autori e anno a mano.
3. **Duplicati**: lo script segnala se il paper è già in libreria. Se sì e manca il livello richiesto, usa il workflow *Adding a variant* invece di reimportare.
4. **Licenza**: lo script legge la licenza dalla pagina arXiv. Se non è ridistribuibile, cerca una versione open dell'editore; altrimenti etichetta `license-blocked`, commenta e chiudi.
5. **Importa** con lo skill, al livello e nella lingua richiesti, con tutti i passi (spiegazioni, glossario, domande di ripasso, mappa) e i controlli (`check_paper.py`, `check_concepts.mjs`).
6. **Chiudi il cerchio**: commit con `Closes #<N>` nel messaggio, poi un commento sulla issue con il link `https://theghoul21.github.io/paper-reader/paper/<slug>`.

# Istruzioni per agenti — Paper Reader

Documentazione condivisa con i manutentori: [README](README.md), [CONTRIBUTING](CONTRIBUTING.md), [vocabolario](CONTEXT.md) e [formati/sviluppo](docs/development.md). Leggerla prima di modificare codice o contenuti.

- Per importare un paper gli agenti possono usare `.claude/skills/import-paper/SKILL.md`; i comandi manuali sono nella guida di sviluppo.
- Preservare gli ID pubblicati, le coordinate estratte e i dati dell'utente. Le modifiche editoriali richiedono il contesto del PDF originale.
- Non aggiungere righe Co-Authored-By ai commit.
- Non creare file `.ipynb`.
- Non servire o commettere `legacy/`: è solo un riferimento locale.
- Eseguire `npm run verify`; per interazioni del lettore anche `npm run test:browser`, per la pipeline di importazione `npm run test:import`.

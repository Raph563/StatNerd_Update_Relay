# StatNerd Relay (Windows / macOS)

Application desktop locale pour exécuter la mise à jour StatNerd en 1 clic depuis l’addon.

## Ce qui est inclus

- Exécution en arrière-plan avec icône dans la barre d’état (tray).
- Menu clic droit sur l’icône:
  - `Lancer au démarrage`
  - `Langue` (FR/EN)
  - `Redémarrer le relay`
  - `Redémarrer l'application`
- Interface basique d’installation/configuration (fenêtre desktop).
- API locale:
  - `GET /health`
  - `POST /v1/update`

## Fonctionnement

- L’addon appelle `http://127.0.0.1:17863/v1/update`.
- Le relay lance le script local:
  - Windows: `addon/scripts/update-from-github.ps1`
  - macOS: `addon/scripts/update-from-github.sh`
- Le relay renvoie le résultat à l’addon.

## Développement local

```bash
npm install
npm start
```

## Build installateurs

Windows:

```bash
npm run build:win
```

macOS:

```bash
npm run build:mac
```

Sorties dans `dist/`.

## Notes

- Le relay doit tourner sur la même machine que Grocy.
- Port par défaut: `17863` (localhost uniquement).

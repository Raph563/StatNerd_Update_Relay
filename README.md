# StatNerd Relay (Windows / macOS)

Application relais locale pour exécuter la mise à jour StatNerd en 1 clic depuis les paramètres de l’addon (sans taper de commande).

## Fonctionnement

- L’addon appelle `http://127.0.0.1:17863/v1/update`.
- Le relais lance le script local:
  - Windows: `addon/scripts/update-from-github.ps1`
  - macOS: `addon/scripts/update-from-github.sh`
- Le relais renvoie le résultat à l’addon.

## Développement

```bash
cd desktop/relay
npm install
npm start
```

## Build exécutable

```bash
cd desktop/relay
npm install
npm run build:pkg
```

Sortie dans `desktop/relay/dist/`:
- `statnerd-relay-win.exe`
- `statnerd-relay-macos`
- `statnerd-relay-macos-arm64`

## Utilisation

1. Lance l’app `statnerd-relay` sur ton poste.
2. Dans StatNerd > Paramètres > Mises à jour:
   - bouton `Tester l’app desktop`
   - bouton `Mettre à jour automatiquement`

## Notes

- Le relais doit être lancé sur la même machine que Grocy.
- Port par défaut: `17863` (localhost uniquement).
- Changer le port: variable env `STATNERD_RELAY_PORT`.

# 🍷 Millésime — Cave à Vin pour Home Assistant

Visualisation animée et gestion complète de votre cave à vin dans Home Assistant.

## Fonctionnalités

- **Visualisation animée** — affichage graphique de votre cave avec tous ses étages
- **Multi-étages** — créez autant d'étages que vous voulez, nommez-les librement
- **Deux dispositions** — côte à côte ou tête-bêche par étage
- **Gestion complète** — ajout, modification, suppression de bouteilles via l'interface
- **Fiche bouteille** — prix, millésime, arômes, accords mets-vins, fenêtre de dégustation, note /100
- **Filtres par type** — rouge, blanc, rosé, effervescent, liquoreux
- **Capteurs HA** — total bouteilles, valeur estimée, nombre d'étages

---

## Installation

### Méthode manuelle

1. Copiez `custom_components/millesime/` dans votre dossier `config/custom_components/`
2. Copiez `www/millesime/millesime-card.js` dans `config/www/millesime/`
3. Redémarrez Home Assistant

### Enregistrement de la ressource Lovelace

Dans **Paramètres → Tableaux de bord → Ressources**, ajoutez :

```
URL  : /local/millesime/millesime-card.js
Type : Module JavaScript
```

Ou dans `configuration.yaml` :

```yaml
lovelace:
  resources:
    - url: /local/millesime/millesime-card.js
      type: module
```

---

## Configuration

### 1. Ajouter l'intégration

**Paramètres → Appareils & Services → + Ajouter → Millésime**

### 2. Ajouter la carte Lovelace

```yaml
type: custom:millesime-card
```

---

## Services disponibles

### `millesime.add_floor`
```yaml
service: millesime.add_floor
data:
  name: "Bordeaux"
  columns: 6
  rows: 2
  layout: side_by_side   # ou alternating (tête-bêche)
```

### `millesime.add_bottle`
```yaml
service: millesime.add_bottle
data:
  floor_id: "abc12345"
  slot: 0
  name: "Château Pétrus"
  vintage: "2015"
  type: red
  appellation: "Pomerol"
  producer: "Château Pétrus"
  price: 3500
  quantity: 1
  drink_from: "2025"
  drink_until: "2050"
  aromas: ["Fruits noirs", "Truffe", "Chocolat"]
  pairings: ["Filet de bœuf", "Agneau"]
  rating: 98
  notes: "Exceptionnel, à garder précieusement."
```

### `millesime.update_bottle`
```yaml
service: millesime.update_bottle
data:
  bottle_id: "xyz67890"
  notes: "Ouvert le 15/12/2024, parfait avec l'agneau."
  rating: 99
```

### `millesime.remove_bottle`
```yaml
service: millesime.remove_bottle
data:
  bottle_id: "xyz67890"
```

### `millesime.remove_floor`
```yaml
service: millesime.remove_floor
data:
  floor_id: "abc12345"
```

---

## Capteurs

| Capteur | Description |
|---|---|
| `sensor.millesime_total_bouteilles` | Nombre total de bouteilles |
| `sensor.millesime_etages` | Nombre d'étages |
| `sensor.millesime_valeur_totale` | Valeur totale estimée (€) |

---

## Structure des fichiers

```
ha-millesime/
├── custom_components/
│   └── millesime/
│       ├── __init__.py
│       ├── config_flow.py
│       ├── sensor.py
│       ├── manifest.json
│       ├── services.yaml
│       ├── strings.json
│       └── translations/
│           └── fr.json
├── www/
│   └── millesime/
│       └── millesime-card.js
├── lovelace-example.yaml
├── hacs.json
└── README.md
```

---

## Licence

MIT

---

*Santé ! 🥂*

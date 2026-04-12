# 🍷 Millésime — Cave à Vin pour Home Assistant

> Gérez et visualisez votre cave à vin directement dans Home Assistant.  
> Design inspiré de Vinotag — cercles colorés sur clayette bois, thème noir élégant.  
> Auto-complétion des informations via l'API Vivino.

![Version](https://img.shields.io/badge/version-3.0.1-C0392B?style=flat-square)
![HA](https://img.shields.io/badge/Home%20Assistant-2024%2B-41BDF5?style=flat-square)
![Licence](https://img.shields.io/badge/licence-MIT-green?style=flat-square)

---

## ✨ Fonctionnalités

- 🍾 **Visualisation animée** — cercles colorés par type sur clayette bois
- 🏗️ **Multi-étages** — créez autant d'étages que vous voulez
- ↕️ **Deux dispositions** — côte à côte ou tête-bêche par étage
- 🔍 **Auto-complétion Vivino** — tapez 3 lettres, tout se remplit automatiquement (nom, millésime, appellation, région, note, photo)
- 📋 **Fiche bouteille complète** — prix, millésime, région, fenêtre de dégustation, note Vivino, lien Vivino
- 🎨 **Filtres par type** — rouge, blanc, rosé, effervescent, liquoreux
- 📊 **3 capteurs HA** — total bouteilles, valeur estimée, nombre d'étages
- 📱 **Mobile friendly** — modal bottom-sheet, compatible iPhone et Android

---

## 🚀 Installation

### Étape 1 — Copier les fichiers dans Home Assistant

Via **File Editor** (addon HA) :

| Source (ce repo) | Destination dans HA |
|---|---|
| `custom_components/millesime/` | `/homeassistant/custom_components/millesime/` |
| `www/millesime/millesime-card.js` | `/homeassistant/www/millesime/millesime-card.js` |

### Étape 2 — Enregistrer la ressource Lovelace

**Paramètres → Tableaux de bord → Ressources → +**

```
URL  : /local/millesime/millesime-card.js
Type : Module JavaScript
```

### Étape 3 — Redémarrer Home Assistant

**Paramètres → Système → Redémarrer**

### Étape 4 — Ajouter l'intégration

**Paramètres → Appareils & Services → + Ajouter une intégration → Millésime**

### Étape 5 — Ajouter la carte dans un tableau de bord

Éditez un tableau de bord → **+ Ajouter une carte** → **Manuel** :

```yaml
type: custom:millesime-card
```

---

## 🖥️ Utilisation

### Créer un étage
Cliquez sur **+ Étage** → donnez un nom, choisissez le nombre de colonnes/rangées et la disposition.

### Ajouter une bouteille
- Cliquez sur **+ Vin** ou directement sur un emplacement vide
- Tapez le nom du vin dans le champ de recherche → Vivino remplit tout automatiquement
- Ajustez si besoin, choisissez l'étage et l'emplacement, validez

### Consulter une bouteille
- **1er clic** sur un cercle → sélection (contour doré)
- **2e clic** → fiche complète avec tous les détails

---

## 📁 Structure du projet

```
ha-millesime/
├── custom_components/
│   └── millesime/
│       ├── __init__.py          ← Backend : WebSocket + services + stockage JSON
│       ├── config_flow.py       ← Configuration via UI HA
│       ├── sensor.py            ← 3 capteurs (bouteilles, valeur, étages)
│       ├── manifest.json
│       ├── strings.json
│       └── translations/
│           └── fr.json
├── www/
│   └── millesime/
│       └── millesime-card.js    ← Carte Lovelace custom
├── hacs.json
└── README.md
```

Les données sont stockées dans `/homeassistant/millesime_data.json`.

---

## 📡 Capteurs disponibles

| Entité | Description | Unité |
|---|---|---|
| `sensor.millesime_bouteilles` | Nombre total de bouteilles | bouteilles |
| `sensor.millesime_valeur` | Valeur estimée de la cave | € |
| `sensor.millesime_etages` | Nombre d'étages | étages |

---

## 🔧 Architecture technique

La carte Lovelace communique avec le backend Python via une **commande WebSocket HA native** (`millesime/get_data`), en utilisant la connexion déjà authentifiée de Home Assistant. Cela évite tout problème de token HTTP ou d'authentification.

Les données sont persistées dans un fichier **JSON local** (`millesime_data.json`) dans le répertoire de configuration HA.

---

## 📋 Changelog

### v3.0.1 *(actuelle)*
- ✅ Correction import `websocket_api` compatible HA 2024+
- ✅ Lecture données via commande WebSocket native (zéro problème d'auth)
- ✅ Design épuré : fond noir `#080808`, rouge rubis `#C0392B`, clayette bois
- ✅ Verre de vin rouge SVG animé dans le header
- ✅ Modal bottom-sheet stable (indépendant du re-render HA)
- ✅ Auto-complétion Vivino via proxy allorigins

### v3.0.0
- Réécriture complète — stockage fichier JSON
- Nouveau design inspiré Vinotag

### v2.x
- Tentatives diverses — instable

### v1.x
- Version initiale

---

## 📄 Licence

MIT — libre d'utilisation, modification et distribution.

---

*Santé ! 🥂*

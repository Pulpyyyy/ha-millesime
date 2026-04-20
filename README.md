# 🍷 Millésime — Cave à Vin pour Home Assistant

<p align="center">
  <img src="custom_components/millesime/icon.png" width="140" alt="Millésime logo"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/version-5.0.0-8B1A2A?style=flat-square"/>
  <img src="https://img.shields.io/badge/Home%20Assistant-2024%2B-41BDF5?style=flat-square"/>
  <img src="https://img.shields.io/badge/HACS-custom-orange?style=flat-square"/>
  <img src="https://img.shields.io/badge/licence-MIT-green?style=flat-square"/>
</p>

<p align="center">
  <a href="https://www.paypal.com/donate/?business=MWJCVFGTNC4T4&no_recurring=1&currency_code=EUR" target="_blank">
    <img src="https://img.shields.io/badge/Offrir%20un%20verre%20de%20vin-🍷-8B1A2A?style=flat-square&labelColor=555555" alt="Offrir un verre de vin"/>
  </a>
</p>

---

> **Gérez votre cave à vin directement dans Home Assistant.**
> Visualisation style Vinotag, intelligence artificielle Gemini, scan d'étiquettes, suivi de valeur — tout ce qu'il faut pour un amateur de vin exigeant.

---

## 🌟 Pourquoi Millésime ?

La gestion d'une cave à vin mérite mieux qu'un tableur. Millésime transforme Home Assistant en véritable gestionnaire de cave avec une interface pensée pour le mobile, une IA qui remplit les fiches automatiquement, et un suivi de la valeur de votre collection dans le temps.

---

## ✨ Fonctionnalités

### 🏗️ Visualisation de la cave
- **Style Vinotag** — cercles colorés sur clayettes bois, vue intuitive de votre cave
- **Multi-étages** — créez autant d'étages que votre cave en contient
- **Deux dispositions** — côte à côte ou tête-bêche par étage
- **Compteurs** — nombre de bouteilles par type affiché sur chaque étage
- **Taux de remplissage** — pourcentage d'occupation visible sur chaque clayette

### 🤖 Intelligence Artificielle (Gemini)
- **Recherche texte** — tapez 3 lettres, suggestions en temps réel via Gemini 2.5 Flash Lite
- **Scan d'étiquette** — prenez une photo, Gemini 2.5 Flash identifie le vin et remplit tout
- **Prix automatique** — estimez le prix marché d'un vin en un clic depuis la fiche détail
- **Notes de dégustation** — arômes, texture, finale générés automatiquement
- **Accords mets-vins** — suggestions d'accompagnement pour chaque bouteille
- **Fenêtre de dégustation** — dates optimales de consommation
- **Fallback Open Food Facts** — 150 000+ vins accessibles sans clé Gemini
- **Cascade de modèles** — si Gemini Flash est saturé, bascule automatiquement sur Flash Lite
- **Retry automatique** — 503/429 gérés avec backoff, aucune erreur silencieuse

### 📋 Gestion des bouteilles
- **Fiche complète** — nom, millésime, appellation, région, pays, producteur, prix, quantité
- **Notes personnelles** — impressions, occasion, souvenir
- **Événement** — 🚫 Ne pas toucher · 📦 À garder · 🎉 Grande occasion · 🥂 Petite Occasion · 🍽️ Vin de table
- **Duplication** — dupliquer une bouteille sur plusieurs emplacements (idéal pour les caisses)
- **Modification** — éditez n'importe quel champ à tout moment

### 🔍 Filtres & Recherche
- **Filtre par type** — rouge, blanc, rosé, effervescent, liquoreux
- **Filtre par événement** — filtrez les bouteilles par occasion
- **Menus déroulants** — optimisés iPhone, aucun scroll horizontal

### 📈 Suivi de valeur
- **Valeur en temps réel** — calculée automatiquement depuis les prix de vos bouteilles
- **Historique de valeur** — enregistrez des relevés datés (jusqu'à 365 points)
- **Graphique SVG** — courbe d'évolution avec aire dégradée, axe des valeurs, labels de dates
- **Résumé** — valeur actuelle, nombre de bouteilles, nombre de relevés

### 📊 Capteurs Home Assistant
| Entité | Description |
|--------|-------------|
| `sensor.millesime_bouteilles` | Nombre total de bouteilles |
| `sensor.millesime_valeur` | Valeur estimée de la cave (€) |
| `sensor.millesime_etages` | Nombre d'étages configurés |

### 📱 Interface Mobile-first
- **Optimisé iPhone** — modals en haut de l'écran, footer toujours visible
- **Menus déroulants** — remplacement des boutons de filtre pour faciliter la sélection tactile
- **Scan photo natif** — accès direct à l'appareil photo iOS
- **Toasts de notification** — feedback visuel pour chaque action

---

## 🚀 Installation

### Pré-requis
- Home Assistant 2024.1 ou supérieur
- HACS installé ([guide officiel](https://hacs.xyz/docs/setup/download))

### Étape 1 — Ajouter le dépôt dans HACS

1. Ouvrez **HACS** dans la barre latérale
2. Cliquez sur **Intégrations**
3. Cliquez sur les **⋮** en haut à droite → **Dépôts personnalisés**
4. Collez l'URL : `https://github.com/yourusername/ha-millesime`
5. Catégorie : **Intégration** → **Ajouter**
6. Recherchez **Millésime** et cliquez **Télécharger**
7. **Redémarrez Home Assistant**

### Étape 2 — Enregistrer la ressource Lovelace

1. Allez dans **Paramètres → Tableaux de bord → Ressources**
2. Cliquez **+ Ajouter une ressource**
3. Renseignez :
   ```
   URL  : /local/millesime/millesime-card.js
   Type : Module JavaScript
   ```
4. Cliquez **Créer**

> 💡 Si le menu Ressources n'est pas visible : activez le **Mode avancé** dans votre profil utilisateur.

### Étape 3 — Ajouter l'intégration

1. Allez dans **Paramètres → Appareils & Services**
2. Cliquez **+ Ajouter une intégration**
3. Recherchez **Millésime**
4. Renseignez le **nom de votre cave**
5. *(Optionnel)* Collez votre **clé API Gemini** pour activer l'IA

### Étape 4 — Ajouter la carte Lovelace

1. Ouvrez votre tableau de bord
2. Passez en mode édition → **+ Ajouter une carte**
3. Choisissez **Custom: Millésime Cave à Vin**

Ou directement en YAML :
```yaml
type: custom:millesime-card
```

---

## 🔑 Clé API Gemini (optionnelle mais recommandée)

La clé Gemini est **gratuite** et débloque toutes les fonctionnalités IA.

### Obtenir une clé en 30 secondes

1. Allez sur **[aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey)**
2. Connectez-vous avec votre compte Google
3. Cliquez **Create API Key**
4. Copiez la clé (commence par `AI...`)

### Configurer la clé

**Paramètres → Appareils & Services → Millésime → ⚙️ Configurer**

La clé peut être ajoutée ou modifiée à tout moment, sans réinstaller.

### Quotas gratuits

| Modèle | Usage | Limite gratuite |
|--------|-------|-----------------|
| `gemini-2.5-flash-lite` | Recherche texte | 1 000 req/jour |
| `gemini-2.5-flash` | Scan photo | 500 req/jour |

Chaque utilisateur utilise **sa propre clé** — vous ne payez rien pour les autres.

Sans clé → Open Food Facts (150 000+ vins, gratuit, sans notes de dégustation).

---

## 🖥️ Guide d'utilisation

### Créer un étage
Cliquez **+ Étage** → donnez un nom, définissez colonnes × rangées et la disposition.

### Ajouter une bouteille
- Cliquez sur un **emplacement vide** ou sur **+ Vin**
- Tapez le nom → sélectionnez dans les suggestions → la fiche se remplit automatiquement
- Ou cliquez 📷 pour **scanner l'étiquette** avec votre téléphone

### Consulter une bouteille
- **1er clic** → sélection (contour doré)
- **2e clic** → fiche détail complète

### Depuis la fiche détail
- **💰 Prix** — Gemini estime le prix marché et met à jour la fiche
- **⎘ Dupliquer** — copiez la bouteille sur un ou plusieurs emplacements
- **✏️ Modifier** — éditez tous les champs
- **🗑 Retirer** — supprime la bouteille de la cave

### Suivi de valeur
Cliquez sur le **logo verre** en haut à gauche → historique de valeur avec graphique.
Cliquez **📸 Enregistrer la valeur** pour ajouter un point à l'historique.

---

## 📁 Structure du projet

```
ha-millesime/
├── custom_components/millesime/
│   ├── __init__.py           ← Backend Python (WebSocket, Gemini, OFF, services)
│   ├── config_flow.py        ← Configuration UI (nom cave + clé Gemini)
│   ├── sensor.py             ← 3 capteurs HA
│   ├── manifest.json         ← version 5.0.0
│   ├── services.yaml         ← Déclaration des services
│   ├── strings.json          ← Textes UI avec lien clé Gemini
│   ├── icon.png              ← Icône 512×512
│   ├── brand/
│   │   └── icon.png          ← Icône pour HA 2026.3+ et HACS
│   └── translations/
│       └── fr.json
├── www/millesime/
│   └── millesime-card.js     ← Carte Lovelace custom
├── assets/
│   └── donate.svg
├── icon.png                  ← Icône racine (HACS store)
├── hacs.json
└── README.md
```

Les données sont persistées dans `/homeassistant/millesime_data.json`.

---

## ⚙️ Architecture technique

| Composant | Technologie |
|-----------|-------------|
| Backend | Python, Home Assistant integration framework |
| Communication | WebSocket HA natif (authentifié, zéro token) |
| Frontend | JavaScript ES2020, Lovelace custom card |
| IA texte | Gemini 2.5 Flash Lite (`gemini-2.5-flash-lite`) |
| IA vision | Gemini 2.5 Flash (`gemini-2.5-flash`) |
| Fallback | Open Food Facts REST API v1 |
| Stockage | JSON local (`millesime_data.json`) |
| Cache | In-memory 5 min (économise les quotas Gemini) |
| Graphiques | SVG inline DOM (`createElementNS`) |

---

## 📋 Changelog

### v5.0.0 *(actuelle)*
- ✅ Bouton **💰 Estimer le prix** — Gemini calcule le prix marché depuis la fiche détail
- ✅ **⎘ Duplication** de bouteille vers n'importe quel étage et emplacement
- ✅ **📈 Historique de valeur** avec graphique SVG (courbe + aire dégradée)
- ✅ **Événement "Petite Occasion"** remplace "À boire"
- ✅ Graphique SVG DOM pur — compatible Safari, iPhone, tous navigateurs
- ✅ Footer modal toujours visible sur iPhone (flex column, pas de sticky)
- ✅ Modals s'ouvrent en haut de l'écran
- ✅ Filtres en menus déroulants (optimisé tactile)
- ✅ Icône dans dossier `brand/` (HA 2026.3+)

### v4.0.2
- ✅ Deux modèles Gemini séparés — quotas indépendants texte/vision
- ✅ Retry x3 avec backoff sur 503/429
- ✅ Cascade de modèles si Flash surchargé → Flash Lite
- ✅ `maxOutputTokens` photo porté à 2048 + détection troncature
- ✅ Prix auto-rempli depuis Gemini (prompt + parser)

### v4.0.0
- ✅ Migration `gemini-2.5-flash-lite` + `gemini-2.5-flash`
- ✅ Champ Événement + filtre dédié
- ✅ Filtres menus déroulants
- ✅ Header redesigné, boutons sous les stats
- ✅ Taille des cercles ajustable, mode tête-bêche amélioré
- ✅ `services.yaml` créé
- ✅ Icône 512×512 pour HACS

### v3.x
- Intégration Gemini 1.5 Flash + Open Food Facts
- Scan d'étiquette par photo
- WebSocket HA natif
- Design Vinotag

---

## 📄 Licence

MIT — libre d'utilisation, modification et distribution.

---

<p align="center">Fait avec ❤️ et 🍷 pour la communauté Home Assistant</p>

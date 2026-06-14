# 🍷 Millésime — Cave à vin pour Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=flat-square)](https://github.com/hacs/integration)
[![version](https://img.shields.io/badge/version-6.1.2-7B1D2E.svg?style=flat-square)](https://github.com/Redsklns/ha-millesime/releases)
[![Offrir un verre de vin](https://img.shields.io/badge/🍷_Offrir_un_verre_de_vin-PayPal-7B1D2E.svg?style=flat-square)](https://paypal.me/Redsklns)

**Millésime** transforme Home Assistant en gestionnaire de cave à vin complet : visualisez vos bouteilles dans une scène **3D réaliste**, scannez les étiquettes par **photo**, suivez la valeur de votre collection et tenez un **journal de dégustation**.

Intégration 100 % locale (vos données restent chez vous), pensée **mobile-first** pour un usage quotidien depuis l'application Home Assistant.

---

## ✨ Fonctionnalités

### Visualisation
- **Trois vues** au choix : 🍾 Bouteilles 2D, ⠿ Pastilles, 🧊 **Scène 3D** (WebGL/Three.js)
- **Rendu 3D réaliste** : bouteilles modelées par forme (bordelaise, bourguignonne, champenoise avec muselet et bouchon champignon, flûte d'Alsace, ligérienne), verre teinté transparent laissant voir la robe du vin, étiquette nominative sur chaque bouteille, ombres de contact douces
- **Casiers configurables** : meuble complet avec étagères internes, 5 essences de bois (chêne, noyer, merisier, grisé, wengé) ou structure en **fer forgé**, montants, pieds, croisillons et toit optionnels
- **Dispositions** : côte à côte, tête-bêche, semi-couché
- **Drag & drop** en 3D pour déplacer ou permuter les bouteilles
- Vue mémorisée d'une session à l'autre, et configurable via YAML (`default_view`)
- S'adapte au **thème** Home Assistant (clair / sombre)

### Gestion des vins
- **Ajout par photo** 📷 : l'IA lit l'étiquette et remplit automatiquement la fiche
- **Recherche par nom** : trouvez n'importe quel vin (nom, producteur, appellation, région, millésime)
- **Estimation de prix** automatique et suivi de la **valeur de la cave** dans le temps (graphique)
- **Formats** : 75 cl, magnum, demi… chaque bouteille rendue à l'échelle dans son emplacement
- **Coup de cœur** ⭐, commentaire par bouteille, fenêtre de dégustation (✅ à boire / ⏳ trop tôt / 🔴 passé l'apogée)
- **Anti-doublon** : impossible de placer deux bouteilles au même emplacement
- **Déplacement d'un casier entier** 📦 en un clic
- **Rafraîchissement des fiches** ♻️ : fusion des doublons et complétion automatique des champs vides

### Journal & import
- **Journal de dégustation** 📓 : marquez une bouteille comme bue (note ⭐, date, commentaire), elle est archivée avec statistiques (nombre, note moyenne, total dépensé)
- **Import Vinotag** 📥 : importez votre cave depuis un export CSV

### Intelligence artificielle
- **Google Gemini 3** pour la recherche texte et la lecture de photo (repli automatique sur Gemini 2.5 si indisponible)
- **Open Food Facts** en secours, sans clé requise — 150 000+ vins référencés
- Clé Gemini **gratuite** et optionnelle

---

## 📦 Installation

### Via HACS (recommandé)
1. HACS → ⋮ → **Dépôts personnalisés**
2. Ajoutez `https://github.com/Redsklns/ha-millesime` — catégorie **Intégration**
3. Installez **Millésime**, puis redémarrez Home Assistant
4. **Paramètres → Appareils et services → Ajouter une intégration → Millésime**

### Manuelle
1. Copiez `custom_components/millesime/` dans le dossier `config/` de Home Assistant
2. Copiez `www/millesime/millesime-card.js` dans `config/www/millesime/`
3. Redémarrez Home Assistant et ajoutez l'intégration

### Carte Lovelace
Ajoutez la ressource (**Paramètres → Tableaux de bord → ⋮ → Ressources**) :
```
/local/millesime/millesime-card.js
```
Puis dans votre tableau de bord :
```yaml
type: custom:millesime-card
# Options facultatives :
default_view: 3d          # 2d | dot | 3d
rack_defaults:
  material: chene         # chene | noyer | merisier | grise | wenge | fer
racks:
  Cave principale:
    material: fer
    accent: "#7B1D2E"
```

---

## 🔑 Configuration de la clé Gemini (optionnelle)

1. Créez une clé gratuite sur [aistudio.google.com](https://aistudio.google.com)
2. Renseignez-la à la configuration de l'intégration (ou plus tard via ⚙️)

Sans clé, Millésime fonctionne avec Open Food Facts (recherche par nom et code-barres, sans notes de dégustation IA).

---

## 🛠️ Services disponibles

Gestion des vins (`add_wine`, `update_wine`, `remove_wine`), des emplacements (`add_slot`, `update_slot`, `move_slot`, `remove_slot`), des casiers (`add_rack`, `update_rack`, `remove_rack`), dégustation (`drink_bottle`, `delete_tasting`), maintenance (`refresh_wines`, `value_snapshot`, `rename_cellar`) et import (`import_vinotag`).

> Les anciens services (`add_bottle`, `add_floor`…) restent acceptés comme alias pour la compatibilité des automatisations existantes.

---

## 🤖 Un projet développé avec l'IA

L'intégralité de Millésime a été conçue et développée en collaboration avec **Claude** (Anthropic), de l'architecture backend Python à la carte Lovelace 3D — une expérience grandeur nature des capacités de l'IA sur un vrai projet logiciel.

---

## 📝 Changelog

### [6.1.2] — 2026-06
Dispositions enrichies, formats et formes de bouteille, liste exportable.

- **Liste des bouteilles** : un clic sur le compteur « Bouteilles » ouvre la liste complète (nom, type, appellation, producteur, emplacement, prix, note) avec **export CSV** (compatible Excel)
- **Orientation par casier** : choix piqûre (cul) ou goulot vers l'avant ; pour les dispositions tête-bêche, choix de la bouteille de départ
- **Disposition Semi-couché** rétablie (bouteilles inclinées, culot posé et goulot relevé)
- **Texte explicatif** sous le choix de disposition, mis à jour selon la sélection
- **Format de bouteille** au format menu déroulant à l'ajout d'un vin : Demi 37,5 cl, Bouteille 75 cl, Magnum 150 cl, Jéroboam 300 cl, Réhoboam 450 cl, Mathusalem 600 cl
- **Forme de bouteille** sélectionnable : automatique (détectée par l'IA lors du scan, repli sur le type de vin) ou choix manuel parmi six silhouettes (bordelaise, bourguignonne, champenoise, flûte d'Alsace, Provence/rosé, ligérienne)
- **Tailles harmonisées** dans l'en-tête et le menu d'options pour un rendu homogène

### [6.1.1] — 2026-06
Ajustements d'affichage, notamment pour l'usage sur iPhone.

- **Bouton Options** ⚙️ ajouté dans l'en-tête (à côté du journal) pour ouvrir le menu d'options — remplace l'ouverture par le logo
- **Ajout d'un casier** déplacé dans le menu d'options (en première position)
- **En-tête compacté** : les quatre icônes (vue, recherche, journal, options) et le bouton **+ Vin** sont réalignés sous les statistiques pour éviter tout débordement sur petits écrans
- **Menu des repères 3D** raccourci
- **Espacement vertical uniforme** entre les casiers en vue 3D : la bulle d'information est désormais rattachée à son casier et l'espace réservé s'adapte au mode de repère choisi (étiquette, bulle ou les deux) — plus aucun chevauchement

### [6.1.0] — 2026-06
Réorganisation de l'en-tête et options d'affichage.

- **Évolution de la valeur** accessible en cliquant directement sur la case **Valeur** de l'en-tête
- **En-tête réaligné** : sélecteur de vue, recherche 🔍 et journal 📓 regroupés ; boutons **+ Casier** et **+ Vin** alignés sous les statistiques
- **Menu d'options repliable** (clic sur le verre 🍷 du logo) regroupant les actions avancées : **import de données** 📥 et **complétion des fiches** ♻️
- **Repères des étagères en 3D** configurables : afficher l'**étiquette** sur la planche (n° d'étagère), la **bulle** d'information (nom + remplissage), ou **les deux** — choix mémorisé

### [6.0.0] — 2026-06
Version majeure développée en collaboration avec **[@Pulpyyyy](https://github.com/Pulpyyyy)** 🤝

- **Nouveau modèle de données** : une fiche vin → plusieurs emplacements (`wines[]` + `slots[]`), casiers avec étagères internes (`racks[]`) ; migration automatique des données existantes
- **Vue 3D entièrement repensée** : profils de bouteilles réalistes par type (champenoise avec muselet, bouchon champignon, collerette), verre transparent teinté laissant voir le vin, meubles complets (5 essences de bois ou fer forgé, montants, pieds, croisillons, toit), plaque nominative par étagère
- **Drag & drop** en 3D : déplacer ou permuter les bouteilles directement dans la scène
- **Trois vues** (Bouteilles / Pastilles / 3D) avec sélecteur dans l'en-tête, vue mémorisée et configurable (`default_view`)
- **Import Vinotag** depuis un fichier CSV
- **Formats de bouteille** (magnum, demi…) rendus à l'échelle
- **Coup de cœur** ⭐, commentaire par bouteille, fenêtre de dégustation colorée
- **Rafraîchissement des fiches** ♻️ : fusion des doublons et complétion via IA
- **Thème clair/sombre** Home Assistant
- **Gemini 3** (texte et photo) avec repli automatique sur Gemini 2.5
- Ombres de contact douces, étiquette au nom réel du vin, verre champenois vert bouteille

### [5.4.0] — 2026-06
- Migration vers **Gemini 3** avec repli automatique sur la génération 2.5
- Vert bouteille réaliste pour les effervescents, étiquettes nominatives en 3D

### [5.3.0] — 2026-06
- **Vue 3D isométrique** (Three.js / WebGL) avec éclairage studio et tête-bêche
- Bascule 2D / 3D, repli automatique en 2D si WebGL indisponible

### [5.1.0] — 2026-05
- **Journal de dégustation** (note, date, commentaire) avec statistiques
- **Recherche** par nom dans toute la cave
- **Déplacement d'un casier** entier, **anti-doublon** d'emplacement
- Quantité → emplacements physiques distincts, sélecteur d'emplacement visuel
- Fiche détail enrichie (fenêtre de dégustation, accords mets-vins), thème clair/sombre
- Correctif scan photo sur Android

### [5.0.0] — 2026-04
- Lecture d'étiquette par **photo** (Gemini Vision)
- Estimation de prix et **historique de valeur** de la cave
- Recherche texte avec suggestions, messages d'erreur détaillés

### Avant 5.0.0
Versions initiales : visualisation 2D de la cave, ajout manuel de bouteilles et d'étages, recherche de base et premiers réglages de l'intégration.

---

## ❤️ Soutenir le projet

Millésime est gratuit et open source. Si l'intégration vous plaît, vous pouvez [**offrir un verre de vin** 🍷](https://paypal.me/Redsklns).

---

## 📄 Licence

Projet open source — voir le fichier [LICENSE](LICENSE).

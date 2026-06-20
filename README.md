# 🍷 Millésime — Cave à vin pour Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=flat-square)](https://github.com/hacs/integration)
[![version](https://img.shields.io/badge/version-6.3.2-7B1D2E.svg?style=flat-square)](https://github.com/Redsklns/ha-millesime/releases)
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

### [6.3.2] — 2026-06
Réorganisation de l'interface et clés Gemini.

- **Clé Gemini** : la validation à la saisie est assouplie — les clés qui ne commencent pas par « AI » sont désormais acceptées (le nettoyage gère aussi les guillemets et espaces collés au copier-coller)

- **En-tête** : bouton recherche retiré ; bouton « ➕ Casier » sorti du menu options et placé avant « + Vin »
- **Liste des vins** : barre de recherche intégrée en haut (filtre vin, région, producteur, millésime) ; un clic sur un vin bascule sur la cave et met la bouteille en surbrillance
- **Zones température / hygrométrie** réduites : icône suivie de la valeur, sans texte
- **Bouton filtres** : icône tire-bouchon, libellé « Occasion » affiché au survol
- **Repères 3D** (menu options) : sélecteur segmenté à trois positions (Étiquette / Bulle / Les deux) à la place du menu déroulant

### [6.3.0] — 2026-06
Suivi de la température et de l'hygrométrie de la cave.

- **Deux zones d'affichage** (température et hygrométrie) à côté des filtres, alimentées par vos capteurs Home Assistant en temps réel, dans le même style que les autres indicateurs
- **Sélection des capteurs** depuis le menu options (🌡️ Capteurs T° / humidité) : listes déroulantes de vos entités classées par type (température, humidité, autres)
- **Courbes d'évolution** : un clic sur la température ou l'hygrométrie ouvre un graphique d'historique réel issu de l'enregistreur de Home Assistant, avec choix de la période (24 h, 7 j, 30 j)
- **Filtres Type / Événement** déplacés dans un sous-menu repliable (bouton ⚲) pour laisser la place aux nouvelles zones

### [6.2.2] — 2026-06
- **Liste des bouteilles** : le style de la nouvelle présentation (arborescence Couleur → Région → Châteaux) s'applique enfin correctement dans la fenêtre, avec adaptation au thème clair/sombre

### [6.2.1] — 2026-06
Liste des vins peaufinée et correction de la disposition semi-couchée.

- **Liste des bouteilles** : présentation affinée qui s'adapte au thème clair ou sombre de Home Assistant (le style ne s'appliquait pas dans la fenêtre) ; quantité affichée sous la forme « Qté : N » ; compteur retiré à côté des régions (conservé pour les couleurs)
- **Disposition semi-couchée** : les bouteilles reposent correctement sur la planche (elles ne dépassent plus sous la clayette) et un espace est réservé au-dessus du casier pour éviter tout chevauchement avec la clayette et les repères du dessus

### [6.2.0] — 2026-06
Liste des vins en arborescence détaillée et correction des capsules.

- **Liste des bouteilles** présentée en arborescence **Couleur → Région → Châteaux**, dans l'ordre Rouge, Blanc, Liquoreux, Rosé, Effervescent
- Chaque vin affiche ses informations disponibles : millésime, prix, appellation, producteur, note, fenêtre de dégustation, événement, format et coup de cœur
- Comptage des bouteilles par couleur et par région ; clic sur un vin pour ouvrir sa fiche ; **export CSV** conservé
- **Capsules des bouteilles** affinées en 3D : forme légèrement conique épousant le goulot, sans le bourrelet disgracieux à la base
- **Collerette** masquée pour les bouteilles en disposition semi-couchée
- **Disposition semi-couchée** : bouteilles correctement posées sur la planche (ne dépassent plus sous la clayette) et espace réservé au-dessus du casier pour éviter tout chevauchement avec la clayette et les repères du dessus

### [6.1.9] — 2026-06
Corrections d'affichage.

- **Capsule des bouteilles** raccourcie et alignée sur le goulot (elle ne remonte plus, rendu plus net)
- **Espacement des casiers en 3D** revu : la bulle d'information ne déborde plus sur le casier du dessous
- **Liste des bouteilles** : retour à la présentation en tableau (Couleur, Région, Château, Producteur, Année, Prix, À boire, Événement)
- **Descriptions** du formulaire casier (disposition, orientation) enfin affichées en petit, gris clair et italique (le style ne s'appliquait pas dans la fenêtre)

### [6.1.8] — 2026-06
Liste des vins hiérarchique et finitions.

- **Liste des bouteilles** réorganisée en arborescence claire : Couleur → Région → Châteaux, avec comptage par niveau ; clic sur un vin pour ouvrir sa fiche, export CSV conservé
- **Disposition semi-couchée** : orientation ajustée — l'extrémité choisie (piqûre ou goulot) est bien posée en bas à l'avant, l'autre relevée vers l'arrière
- **Descriptions** (disposition, première bouteille) affinées : plus petites, gris clair, italiques, avec un léger espace avant le texte

### [6.1.7] — 2026-06
Ajustements de la disposition semi-couchée et des descriptions.

- **Semi-couché** : orientation corrigée tout en conservant le rendu incliné (~32°) ; le sélecteur piqûre/goulot s'applique à nouveau (choix de l'extrémité posée en bas)
- **Descriptions** de disposition et d'orientation : léger espace ajouté avant le texte et passage en gris clair pour une meilleure lisibilité

### [6.1.6] — 2026-06
Disposition semi-couchée revue.

- **Semi-couché** : les bouteilles sont désormais quasi debout, piqûre posée en bas et goulot en haut, légèrement inclinées vers l'arrière — fidèle à une vraie clayette de présentation
- Le réglage d'orientation (piqûre/goulot) est masqué pour cette disposition, où la piqûre est toujours en bas

### [6.1.5] — 2026-06
Correction de l'orientation des bouteilles.

- **Orientation corrigée dans toute la cave** : « piqûre devant » place désormais réellement la piqûre (le cul) face à vous, et « goulot devant » le goulot — l'inversion précédente est résolue, en 2D comme en 3D
- **Disposition semi-couchée** : piqûre en bas vers l'avant, goulot relevé vers l'arrière, étiquette sur le dessus, conformément au rangement réel

### [6.1.4] — 2026-06
Corrections d'affichage.

- **Liste des bouteilles** : la fenêtre s'élargit pour profiter de la largeur de l'écran (ordinateur comme téléphone)
- **Bouchon des bouteilles** ajusté pour affleurer le goulot (il ne dépasse plus)
- **Disposition semi-couchée** : retour au rendu correct (bouteilles couchées et inclinées à ~32°, culot posé et goulot relevé)

### [6.1.3] — 2026-06
Corrections d'affichage.

- **Liste des bouteilles** présentée sous forme de **tableau** trié (Couleur, Région, Château, Producteur, Année, Prix, À boire, Événement)
- **Boutons de l'en-tête** harmonisés : les cinq boutons (vue, recherche, journal, options, + Vin) ont désormais la même largeur
- **Vue 3D** : répartition des bouteilles plus régulière sur la largeur des étagères (inclinaison aléatoire fortement réduite)
- **Disposition semi-couchée** corrigée : les bouteilles reposent sur leur piqûre, inclinées vers l'arrière, comme sur une clayette de présentation

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

# 🍷 Millésime — Cave à vin pour Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg?style=flat-square)](https://github.com/hacs/integration)
[![version](https://img.shields.io/badge/version-6.9.1-7B1D2E.svg?style=flat-square)](https://github.com/Redsklns/ha-millesime/releases)
[![Offrir un verre de vin](https://img.shields.io/badge/🍷_Offrir_un_verre_de_vin-PayPal-7B1D2E.svg?style=flat-square)](https://paypal.me/Redsklns)

**Millésime** transforme Home Assistant en gestionnaire de cave à vin complet : visualisez vos bouteilles dans une scène **3D réaliste**, scannez les étiquettes par **photo**, suivez la valeur de votre collection et tenez un **journal de dégustation**.

Intégration 100 % locale (vos données restent chez vous), pensée **mobile-first** pour un usage quotidien depuis l'application Home Assistant.

---

## ✨ Fonctionnalités

### Visualisation
- **Trois vues** au choix : 🍾 Bouteilles 2D, ⠿ Pastilles, 🧊 **Scène 3D** (WebGL/Three.js)
- **Rendu 3D réaliste** : bouteilles modelées par forme (bordelaise, bourguignonne, champenoise avec muselet et bouchon champignon, flûte d'Alsace, ligérienne), verre teinté transparent laissant voir la robe du vin, étiquette nominative sur chaque bouteille, ombres de contact douces
- **Casiers configurables** : meuble complet avec étagères internes, 5 essences de bois (chêne, noyer, merisier, grisé, wengé) ou structure en **fer forgé**, montants, pieds, croisillons et toit optionnels
- **Dispositions** : côte à côte, tête-bêche, semi-couché, **superposition** (2 à 4 niveaux de bouteilles par clayette)
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
- **Accords mets/vin** 🍽️ : ~900 plats classés par ordre alphabétique — pièces de boucherie nommées (côte de bœuf, onglet, araignée de porc…), poissons, fromages, recettes du monde — plus recherche libre et renfort IA

### Multi-caves
- **Plusieurs caves** dans la même instance : sélecteur dans l'en-tête de la carte, gestion (ajout, renommage, suppression) via ⚙️ Options
- **Capteurs T° / hygrométrie et historique de valeur propres à chaque cave** ; capteurs Home Assistant globaux + par cave (bouteilles, valeur)
- Option YAML `cellar_id` pour épingler une carte à une cave donnée (une carte par pièce/dashboard) ; le journal de dégustation reste commun

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
1. Copiez `custom_components/millesime/` dans le dossier `config/custom_components/` de Home Assistant
2. Redémarrez Home Assistant et ajoutez l'intégration — la carte est **intégrée au composant et servie automatiquement**, rien à copier dans `www/`

### Carte Lovelace
La ressource est **enregistrée automatiquement** au démarrage (`/millesime/millesime-card.js?v=…`), avec rechargement automatique à chaque mise à jour — rien à faire.
Ajoutez simplement la carte à votre tableau de bord :
```yaml
type: custom:millesime-card
# Options facultatives :
default_view: 3d          # 2d | dot | 3d
cellar_id: main           # épingle la carte à une cave (multi-caves) ; omis = sélecteur dans l'en-tête
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

Gestion des vins (`add_wine`, `update_wine`, `remove_wine`), des emplacements (`add_slot`, `update_slot`, `move_slot`, `remove_slot`), des casiers (`add_rack`, `update_rack`, `remove_rack` — avec `levels` pour la superposition et `cellar_id` pour la cave cible), des caves (`add_cellar`, `remove_cellar`, `rename_cellar`), dégustation (`drink_bottle`, `delete_tasting`), maintenance (`refresh_wines`, `value_snapshot`) et import (`import_vinotag`, avec `cellar_id` optionnel).

> Les anciens services (`add_bottle`, `add_floor`…) restent acceptés comme alias pour la compatibilité des automatisations existantes.

---

## 🤖 Un projet développé avec l'IA

L'intégralité de Millésime a été conçue et développée en collaboration avec **Claude** (Anthropic), de l'architecture backend Python à la carte Lovelace 3D — une expérience grandeur nature des capacités de l'IA sur un vrai projet logiciel.

---

## 📝 Changelog

*Les 30 derniers jours — l'historique complet est disponible dans les [releases GitHub](https://github.com/Redsklns/ha-millesime/releases).*

### [6.9.1] — 2026-07
Multi-caves, disposition « Superposition », refonte des accords mets/vin.

- **Multi-caves** : plusieurs caves dans la même instance HA, migration automatique de la cave existante. Sélecteur dans l'en-tête, fenêtre « Gérer les caves » dans ⚙️ Options, option YAML `cellar_id`, capteurs T°/hygro et historique de valeur **par cave**, capteurs HA par cave créés dynamiquement. Nouveaux services `add_cellar` / `remove_cellar`
- **Disposition « Superposition »** : 2 à 4 niveaux de bouteilles par clayette (capacité = colonnes × étagères × niveaux), rendu 3D avec une planche par étagère physique et libellés `ét. X · niv. Y · n°Z`
- **Accords mets/vin refondus** : famille « Styles de cuisine » supprimée, combinaisons génériques remplacées par ~75 **pièces de boucherie nommées** (côte de bœuf, onglet, hampe, araignée, pluma, souris d'agneau…) dans 6 nouvelles catégories, **tri alphabétique** des catégories et des plats — 913 plats au total
- **Fenêtre Options harmonisée** : le sélecteur des Repères 3D est intégré à sa tuile, plus de débordement sur mobile
- **Correctifs** : le choix des capteurs n'est plus écrasé par le service suivant (cache mémoire synchronisé) ; les capteurs HA bouteilles/valeur/casiers lisaient des clés obsolètes et retournaient 0

### [6.9.0] — 2026-07
Fenêtre Options, vue 3D par défaut, carte pleine largeur, appareil photo Android et 1000+ accords.

- **Fenêtre Options dédiée** : le menu repliable sous l'en-tête est remplacé par une vraie fenêtre (bouton ⚙️) regroupant Compléter les fiches, Capteurs, Import et Repères 3D. La barre de progression de la complétion s'affiche désormais sous l'en-tête de la carte
- **Vue 3D par défaut** : à la première installation, la carte s'ouvre en vue 3D. La dernière vue choisie reste bien sûr mémorisée
- **Carte pleine largeur** : dans le tableau de bord (disposition « sections »), la carte occupe désormais toute la largeur par défaut et reste redimensionnable (minimum 6 colonnes) — bien plus confortable sur PC
- **Appareil photo sur Android (correctif)** : le bouton « 📷 Prendre une photo » ouvrait la pellicule au lieu de l'appareil photo. Les entrées de capture sont désormais créées statiquement, ce que toutes les WebView Android respectent
- **Accords mets/vin : plus de 1000 plats** : la bibliothèque passe à **1011 plats** répartis en 34 catégories (gibier, fromages nommés, poissons par cuisson, fruits, apéritif, cuisines du monde, desserts…), générés avec des profils de vin cohérents. Le nombre exact est affiché dans l'onglet Accords. La recherche libre et le renfort IA restent disponibles

### [6.8.1] — 2026-06
Correctif de versioning.

- **Version affichée** : `manifest.json` était resté en retard sur le tag de release, la page Appareils de HA affichait une version différente de HACS (merci @chris94440 pour le signalement, issue #7). Ajouté à la checklist de publication

### [6.8.0] — 2026-06
Correction de la vue 3D et appareil photo direct sur mobile.

- **Vue 3D après un changement de vue Lovelace (fond noir)** : la carte remontait un fond noir au retour d'une subview, car la vue 3D était démontée au détachement sans jamais être reconstruite au retour. La carte détecte désormais son ré-attachement, se réabonne aux mises à jour et remonte la vue 3D automatiquement (merci @mrgrlscz pour le signalement)
- **Appareil photo direct sur mobile** : sur téléphone, le scan d'étiquette propose désormais « 📷 Prendre une photo » (ouvre directement l'appareil photo) ou « 🖼️ Galerie ». Le bloc photo du formulaire offre les deux mêmes boutons. Sur ordinateur, comportement inchangé (merci @chris94440 pour la suggestion)
- **Fiabilisation** : désabonnements nettoyés au détachement (plus de doublons), montage 3D annulé si la carte est détachée pendant le chargement, écouteur de pointeur attaché une seule fois

---

## ❤️ Soutenir le projet

Millésime est gratuit et open source. Si l'intégration vous plaît, vous pouvez [**offrir un verre de vin** 🍷](https://paypal.me/Redsklns).

---

## 📄 Licence

Projet open source — voir le fichier [LICENSE](LICENSE).

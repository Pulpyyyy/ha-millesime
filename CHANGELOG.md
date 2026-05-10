# Changelog

## [5.1.0] — 2026-05-10

### Gestion des emplacements

- **Quantité → N emplacements physiques** : ajouter un vin avec `qté=3` crée désormais 3 entrées séparées (`quantity: 1` chacune) sur 3 slots libres consécutifs, au lieu d'un seul enregistrement avec `quantity: 3`
- **Auto-détection du premier slot libre** : le bouton "+ Vin" de l'en-tête pré-sélectionne automatiquement le premier emplacement disponible du premier étage
- **Slot picker visuel** : le champ numérique de sélection d'emplacement est remplacé par une mini-grille cliquable représentant l'étage réel — les slots occupés affichent la bouteille (couleur), les libres sont cliquables
- **Validation des collisions** côté frontend (avertissement) et côté backend (`HomeAssistantError`) pour `add_bottle`, `update_bottle` et `duplicate_bottle`

### Déplacement et échange de bouteilles

- **Bouton "↕ Déplacer"** dans la fiche détail pour entrer en mode déplacement
- **Barre de déplacement** (bandeau rouge discret) affichée en haut de la cave pendant le mode déplacement, avec bouton "Annuler"
- **Clic sur un slot vide** en mode déplacement → déplace la bouteille sélectionnée
- **Clic sur un slot occupé** en mode déplacement → échange automatiquement les positions des deux bouteilles
- Fermeture d'un modal annule le mode déplacement

### Fiche détail enrichie

- **Emplacement physique** affiché : nom de l'étage + numéro de slot (ex. "Étage 1 · Emplacement n°3")
- **Badge fenêtre de dégustation** avec statut coloré :
  - ✅ À boire maintenant
  - ⏳ Trop tôt — avec compte à rebours en années
  - 🔴 Passé l'apogée
- **Accords mets-vins en chips** : chaque accord est affiché comme une étiquette individuelle (split sur virgule)
- **Millésime** ajouté dans le titre du header de la fiche
- **Appellation, région et pays** affichés séparément dans la grille d'informations
- **Labels de section** ajoutés : "Notes de dégustation", "Accords mets-vins", "Notes personnelles"
- **Sous-titre héro** complété avec producteur, appellation, région et pays

### Thème Home Assistant (clair / sombre)

- La carte s'adapte automatiquement au thème HA configuré (clair ou sombre) via les variables CSS de HA : `--card-background-color`, `--primary-text-color`, `--secondary-background-color`, `--divider-color`, etc.
- `_applyTheme()` injecte les variables du thème actif dans le shadow DOM et dans l'overlay modal
- Le graphique d'historique de valeur utilise les couleurs du thème pour le fond, les axes, les labels et la courbe
- Détection du changement de thème en temps réel via `set hass()`

### Backend

- Nouveau service `update_bottle` accepte les champs `floor_id` et `slot` pour les déplacements
- Nouvelle fonction `_slot_taken()` mutualisée pour la détection de collision d'emplacement
- `services.yaml` mis à jour avec les nouveaux champs de `update_bottle`

---

## [5.0.0] — 2026-05-04

- Version initiale publiée
- Recherche de vins via Gemini 2.5 Flash Lite (texte) et Gemini 2.5 Flash (photo)
- Fallback Open Food Facts sans clé API
- Gestion de cave multi-étages avec casiers visuels
- Capteurs Home Assistant : bouteilles, valeur totale, nombre d'étages
- Historique de valeur de la cave avec graphique SVG
- Carte Lovelace custom (`millesime-card`)
- Configuration via UI (config flow + options flow)

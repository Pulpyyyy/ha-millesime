[details="📦 Gestion des emplacements"]

**Quantité → N emplacements physiques**
Ajouter un vin avec `qté = 3` crée désormais **3 entrées séparées** sur 3 slots libres consécutifs, au lieu d'un seul enregistrement avec `quantity: 3`. Chaque bouteille occupe son propre emplacement physique dans le casier.

**Auto-détection du premier slot libre**
Le bouton **+ Vin** de l'en-tête pré-sélectionne automatiquement le premier emplacement disponible — plus de bouteilles qui s'empilent toutes sur le slot 0.

**Slot picker visuel**
Le champ numérique est remplacé par une **mini-grille cliquable** représentant l'étage réel. Les slots occupés affichent la couleur du vin, les libres sont cliquables directement.

**Étage modifiable à l'édition**
Le sélecteur d'étage est maintenant accessible y compris lors de la **modification** d'une bouteille existante, et pas uniquement à l'ajout.

**Validation des collisions**
Vérification côté frontend (avertissement immédiat) *et* côté backend (`HomeAssistantError`) pour `add_bottle`, `update_bottle` et `duplicate_bottle`.

[/details]

[details="↕️ Déplacement et échange de bouteilles"]

**Comment déplacer une bouteille :**
1. Cliquez sur une bouteille pour ouvrir sa fiche
2. Cliquez **↕ Déplacer**
3. Un bandeau apparaît en haut de la cave
4. Cliquez sur l'emplacement cible

- **Slot vide** → la bouteille est déplacée
- **Slot occupé** → les deux bouteilles **s'échangent** automatiquement
- Fermer un modal ou cliquer **Annuler** quitte le mode déplacement

[/details]

[details="🍷 Fiche détail enrichie"]

Nouvelles informations affichées :

| Champ | Description |
|---|---|
| 📍 Emplacement | Nom de l'étage + numéro de slot |
| 🕐 Fenêtre de dégustation | Badge ✅ À boire / ⏳ Trop tôt (avec compte à rebours) / 🔴 Passé l'apogée |
| 🍽️ Accords mets-vins | Affichés en chips individuels |
| Appellation / Région / Pays | Séparés dans la grille |

Le millésime est maintenant visible directement dans le titre du header de la fiche.

[/details]

[details="🎨 Thème Home Assistant (clair / sombre)"]

La carte s'adapte automatiquement au thème HA configuré. Les variables CSS de HA (`--card-background-color`, `--primary-text-color`, `--secondary-background-color`, `--divider-color`…) sont injectées dans le shadow DOM et dans les modals.

Le graphique d'historique de valeur adapte également ses couleurs (fond, axes, courbe) au thème actif, y compris lors d'un changement de thème en temps réel.

[/details]

[details="⚙️ Backend / développeurs"]

- `update_bottle` accepte maintenant `floor_id` et `slot` pour les déplacements
- Nouvelle fonction interne `_slot_taken()` mutualisée
- `services.yaml` mis à jour en conséquence

[/details]

[details="🛠️ Configuration YAML de la carte"]

La carte ne requiert aucun paramètre obligatoire. Options disponibles :

```yaml
type: custom:millesime-card
bottle_style: bottle   # "bottle" (défaut) | "dot"
bottle_label: none     # "none" (défaut) | "vintage" | "name" | "name_vintage" | "vintage_name"
```

---

**`bottle_style`** — forme des emplacements dans le casier

| Valeur | Rendu |
|---|---|
| `bottle` | Silhouette de bouteille SVG colorée *(défaut)* |
| `dot` | Cercle coloré compact |

---

**`bottle_label`** — texte affiché sous chaque bouteille

| Valeur | Affichage |
|---|---|
| `none` | Aucun label *(défaut)* |
| `vintage` | Millésime seul (ex. `2019`) |
| `name` | Nom court, tronqué à 15 caractères |
| `name_vintage` | Nom sur la 1ʳᵉ ligne, millésime sur la 2ᵉ |
| `vintage_name` | Millésime sur la 1ʳᵉ ligne, nom sur la 2ᵉ |

---

**Disposition des étagères** — configurable par étage depuis l'interface

Les 4 types de disposition sont accessibles via le bouton ⚙ de chaque étage :

| Valeur | Nom affiché | Description |
|---|---|---|
| `side_by_side` | Côte à côte | Grille rectangulaire standard, toutes les bouteilles alignées *(défaut)* |
| `alternating` | Tête-bêche | Rangées alternées décalées verticalement — imite les casiers en bois |
| `alternating_2d` | Tête-bêche alterné | Décalage en échiquier case par case |
| `quinconce` | Quinconce | Rangées impaires décalées d'une demi-bouteille — disposition optimale en tonneau |

> Ces valeurs sont stockées dans les données de la cave (non dans le YAML de la carte) et se modifient depuis l'UI.

---

**Exemple complet :**

```yaml
type: custom:millesime-card
bottle_style: dot
bottle_label: vintage
```

[/details]

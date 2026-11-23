# Ficha de Personagem

Interactive character creation sheet for a tabletop RPG. Plain HTML, CSS and JavaScript, with no dependencies and no build step. Dark fantasy / post-apocalyptic theme, responsive for desktop and mobile.

## How it works

- Four attributes (Corpo, Mente, Persona, Espírito) start at 0.
- The player raises or lowers attributes with the + and − buttons. There is no point limit: attributes can grow without a ceiling, but can't go below 0. The sheet shows the total points distributed.
- Derived statistics update instantly:

| Statistic | Formula |
| --- | --- |
| Defesa | ceil(2 + Corpo × 1.5) |
| Esquiva | ceil(2 + Mente × 2) |
| Pontos de Vida (PV) | 14 + Corpo × 6 |
| Pontos de Ação (PA) | Corpo × 12 |
| Valor de Especialização (VE) | 2 + Mente × 2 |
| Deslocamento | 5 + Corpo × 1.5 meters |

- "Redefinir atributos" resets everything to 0.
- Attribute values are remembered in the browser between visits.

### Perícias

- Three categories (Corpo, Mente, Persona), each with its own panel, Pontos de Perícia counter, training levels (0–5, bonus = level) and a roll button per Perícia.
- Cost: level 0 → 1 costs 1 point, every later level costs 2.
- Points come from the matching attribute and **accumulate** per attribute level (e.g. Corpo 3 = 4 + 4 + 5 = 13). Above 5 the attribute gives no extra points.
- Free trained Perícias (Corpo 2, Mente 3, Persona 2) are chosen with the ★ Grátis button: they start at level 1 at no cost.
- Lowering an attribute never removes training. If the points no longer cover the spending, the panel shows an "Alocação inválida" warning and blocks upgrades until it is fixed.
- "Redefinir perícias" resets training, free picks and Advantage counters.
- Dado de Dano: 1d4 + Corpo for Corpo 0–2, 2d4 + Corpo from Corpo 3 up, with its own roll button.

### Rolls and Advantage

- Normal check: 1d8 + Perícia bonus.
- Every Perícia has an Advantage counter (never below 0). With Advantage the check rolls 2d8, keeps the highest and adds the bonus. Both dice are shown.
- The Espírito resistance check uses the Espírito value as its bonus.

### Espírito

- Option A: Advantage in Fortitude and Espírito checks.
- Option B: pick one Perícia to receive Advantage.
- Option C: pick one special ability.

### Visual identity

Corpo is red (glow), Mente blue (floating particles), Persona purple (floating "!") and Espírito grey (fog). Effects are CSS-only and switch off when the device asks for reduced motion.

## Publish on GitHub Pages

1. Create a repository and upload `index.html`, `style.css`, `script.js` and `README.md` to the root.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select `main` and `/ (root)`, then save.
4. The site will be live at `https://<your-user>.github.io/<repo-name>/`.

## Changing the rules

The rules are at the top of `script.js`: `DERIVED` holds the formulas. The Perícias tables (`CATEGORIES`: skill lists, free picks and point gains per attribute level) and the Espírito abilities (`ABILITIES`) are in the Perícias block further down. If you change a formula, also update the description shown under that statistic in `index.html`.

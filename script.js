"use strict";

/* ==========================================================
   REGRAS DO SISTEMA
   ========================================================== */

// Não há limite de pontos: os atributos podem subir sem teto.
const ATTRS = ["corpo", "mente", "persona", "espirito"];

// Cada estatística derivada recebe os atributos { corpo, mente, persona, espirito }
const DERIVED = {
  defesa:  a => Math.ceil(2 + a.corpo * 1.5),
  esquiva: a => Math.ceil(2 + a.mente * 2),
  pv:      a => 14 + a.corpo * 6,
  pa:      a => a.corpo * 12,
  ve:      a => 2 + a.mente * 2,
  desloc:  a => 5 + a.corpo * 1.5, // em metros
};

// Mapeia cada estatística ao elemento que mostra o valor
const OUTPUT_IDS = {
  defesa: "out-defesa",
  esquiva: "out-esquiva",
  pv: "out-pv",
  pa: "out-pa",
  ve: "out-ve",
  desloc: "out-desloc",
};

/* DOM */

const STORAGE_KEY = "rpg-ficha-atributos";

const attrs = { corpo: 0, mente: 0, persona: 0, espirito: 0 };

const el = id => document.getElementById(id);
const sum = () => ATTRS.reduce((s, k) => s + attrs[k], 0);

const fmt = n => n.toLocaleString("pt-BR", { maximumFractionDigits: 1 });

function pulse(node) {
  node.classList.remove("pulse");
  void node.offsetWidth; // reinicia a animação
  node.classList.add("pulse");
}

function setText(node, text) {
  if (node.textContent !== text) {
    node.textContent = text;
    pulse(node);
  }
}

function save() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(attrs)); } catch (e) { /* ignore */ }
}

function load() {
  try {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!data) return;
    const next = {};
    for (const k of ATTRS) {
      const v = Math.floor(Number(data[k]));
      if (!Number.isFinite(v) || v < 0) return;
      next[k] = v;
    }
    Object.assign(attrs, next);
  } catch (e) { /* ignore */ }
}

function render() {
  // Atributos e botões (só o "−" trava, em 0)
  for (const k of ATTRS) {
    setText(el("val-" + k), String(attrs[k]));
    document.querySelector(`.step[data-attr="${k}"][data-dir="-1"]`).disabled = attrs[k] <= 0;
  }

  // Total de pontos distribuídos
  setText(el("pointsSpent"), String(sum()));

  // Estatísticas derivadas
  for (const key of Object.keys(DERIVED)) {
    setText(el(OUTPUT_IDS[key]), fmt(DERIVED[key](attrs)));
  }

  // Perícias, Espírito e Dado de Dano dependem dos atributos
  renderSkills();
}

function change(attr, dir) {
  const next = attrs[attr] + dir;
  if (next < 0) return;
  attrs[attr] = next;
  save();
  render();
}

document.querySelectorAll(".step").forEach(btn => {
  btn.addEventListener("click", () => change(btn.dataset.attr, Number(btn.dataset.dir)));
});

el("reset").addEventListener("click", () => {
  ATTRS.forEach(k => { attrs[k] = 0; });
  save();
  render();
});

/* ==========================================================
   PERÍCIAS
   ========================================================== */

const MAX_LEVEL = 5;          // nível máximo de treino
const TABLE_MAX = 5;          // maior valor de atributo coberto pelas tabelas de pontos
const SKILL_STORE = "rpg-ficha-pericias";
const RES_ESPIRITO = "res-espirito";   // teste de resistência de Espírito
const THEMES = ["corpo", "mente", "persona", "espirito"];
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const slug = s => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "-");
const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const rollDie = sides => 1 + Math.floor(Math.random() * sides);
const rand = (a, b) => a + Math.random() * (b - a);

/* `gains[n - 1]` = Pontos de Perícia ganhos ao chegar ao valor n do atributo.
   Os ganhos se acumulam (Corpo 3 = 4 + 4 + 5 = 13 pontos).
   `free` = perícias gratuitas (escolhidas pelo jogador, começam treinadas). */
const CATEGORIES = [
  {
    id: "corpo", name: "Corpo", free: 2, gains: [4, 4, 5, 5, 5],
    skills: ["Atletismo", "Acrobacia", "Luta Improvisada", "Levantamento", "Furtividade",
             "Fortitude", "Precisão", "Violência", "Iniciativa"],
  },
  {
    id: "mente", name: "Mente", free: 3, gains: [4, 5, 5, 6, 6],
    skills: ["Atualidades", "Ciências", "Pilotagem", "Percepção", "Investigação", "Medicina",
             "Tecnologia", "Sobrevivência", "Reflexos", "Tática", "Conhecimentos Ocultos", "Pontaria"],
  },
  {
    id: "persona", name: "Persona", free: 2, gains: [4, 3, 6, 3, 0],
    skills: ["Influência", "Intuição", "Adestramento", "Performance", "Crime"],
  },
];

const SKILLS = {};   // id -> { id, name, cat }
CATEGORIES.forEach(c => {
  c.ids = c.skills.map(name => {
    const id = slug(name);
    SKILLS[id] = { id, name, cat: c.id };
    return id;
  });
});

const ABILITIES = [
  {
    id: "odio", name: "Ódio Incontrolável",
    paras: ["Quando entrar em morrendo, você não cai. Ao invés disso, você entra em um estado de fúria incontrolável e incessante. Uma vez por turno, obrigatoriamente, você deve causar dano a um ser, seja um aliado ou um inimigo. Quando o combate acabar, você cai no chão, morrendo de verdade dessa vez, e deve ser salvo em uma quantidade de turnos igual seu valor em Espírito. Essa habilidade tem uma duração igual a d4 + Espírito de turnos durante o combate."],
  },
  {
    id: "controle", name: "Controle Corporal",
    paras: ["Após cair no chão em morrendo, você consegue realizar um teste de Fortitude/Espírito para agir uma vez no seu turno. Diferente de Ódio Incontrolável, você pode realizar quais ações desejar após ter sucesso no dado. O DT do teste é 4 + (Espírito x 1.5) e diminui em 1 a cada 2 turnos, caso você tenha sucesso. Ao falhar, a DT aumenta em 1."],
  },
  {
    id: "quem", name: "Quem decidiu isso?",
    paras: ["Ao entrar em morrendo, você consegue recuperar 2d4 + Espírito/Fortitude PVs e remover a condição de Morrendo. Você se recusa a morrer tão cedo, e seu corpo continua funcionando. Claro, isso só se aplica se você ainda tiver um corpo. Funciona uma vez por sessão."],
  },
  {
    id: "mania", name: "Mania",
    paras: ["Uma vez por cena, você consegue soltar uma quantidade de adrenalina no seu corpo capaz de matar alguém. Mas, você está acostumado a isso. Os seguintes efeitos se aplicam a você por 1d4 + Espírito turnos."],
    list: ["Vantagem em testes de Corpo", "Imunidade aos efeitos de Enjoado, Tonto e Fraco.", "+2m de Deslocamento."],
  },
  {
    id: "alem", name: "Além da Dor",
    paras: [
      "Ao estar ferido gravemente, você pode escolher ignorar os efeitos do mesmo. Sangramentos, desmembramentos, desmaios e etc. por uma quantidade de turnos igual a Espírito x 2. Você só consegue ignorar os efeitos se a habilidade for ativada antes deles acontecerem, no caso de desmaios e nocautes. Em desmembramentos e outros efeitos similares, você ignora o dano de condições até a habilidade acabar.",
      "Porém, os efeitos retornam quando os turnos acabarem. Além disso, todo dano que você teria recebido, que não provém de ataques, são reduzidos pela metade quando Além da Dor acabar.",
    ],
  },
  {
    id: "forca", name: "Força Mental",
    paras: ["Você recebe vantagem em testes contra tentativas de influenciar você, seja através de controle mental, manipulação social ou controle de implantes cerebrais através de ondas eletromagnéticas. Além disso, pode ter um sucesso por cena em testes de resistência mental."],
  },
];

/* ---------- Estado ---------- */

const pState = {
  skills: {},   // id -> { lv, adv, free }
  esp: { resist: false, advSkill: null, ability: null },
};
[...Object.keys(SKILLS), RES_ESPIRITO].forEach(id => {
  pState.skills[id] = { lv: 0, adv: 0, free: false };
});

let skillsBuilt = false;

const catOf = id => (has(SKILLS, id) ? CATEGORIES.find(c => c.id === SKILLS[id].cat) : null);
const totalPoints = c => c.gains.slice(0, Math.min(attrs[c.id], TABLE_MAX)).reduce((s, g) => s + g, 0);
// Nível 1 custa 1 ponto (0 se for gratuita); cada nível seguinte custa 2.
const skillCost = s => (s.lv <= 0 ? 0 : (s.free ? 0 : 1) + 2 * (s.lv - 1));
const spentPoints = c => c.ids.reduce((t, id) => t + skillCost(pState.skills[id]), 0);
const freeUsed = c => c.ids.filter(id => pState.skills[id].free).length;
const bonusOf = id => (id === RES_ESPIRITO ? attrs.espirito : pState.skills[id].lv);

function advSources(id) {
  const out = [];
  if (pState.skills[id].adv > 0) out.push("contador");
  if (pState.esp.resist && (id === "fortitude" || id === RES_ESPIRITO)) out.push("Espírito: resistência");
  if (pState.esp.advSkill === id) out.push("Espírito: perícia escolhida");
  return out;
}

function canUpgrade(c, id) {
  const s = pState.skills[id];
  if (s.lv >= MAX_LEVEL) return false;
  const left = totalPoints(c) - spentPoints(c);
  if (left < 0) return false;                    // alocação inválida: bloqueia melhorias
  return left >= (s.lv === 0 ? 1 : 2);
}

function saveSkills() {
  try { localStorage.setItem(SKILL_STORE, JSON.stringify(pState)); } catch (e) { /* ignore */ }
}

function loadSkills() {
  try {
    const d = JSON.parse(localStorage.getItem(SKILL_STORE));
    if (!d || typeof d !== "object") return;
    for (const id of Object.keys(pState.skills)) {
      const s = d.skills && d.skills[id];
      if (!s) continue;
      const lv = Math.floor(Number(s.lv));
      const adv = Math.floor(Number(s.adv));
      const t = pState.skills[id];
      t.lv = Number.isFinite(lv) ? Math.min(MAX_LEVEL, Math.max(0, lv)) : 0;
      t.adv = Number.isFinite(adv) ? Math.max(0, adv) : 0;
      t.free = s.free === true && t.lv >= 1;
    }
    CATEGORIES.forEach(c => {
      let n = 0;
      c.ids.forEach(id => {
        const s = pState.skills[id];
        if (s.free) { if (n >= c.free) s.free = false; else n++; }
      });
    });
    const e = d.esp || {};
    pState.esp.resist = e.resist === true;
    pState.esp.advSkill = typeof e.advSkill === "string" && has(SKILLS, e.advSkill) ? e.advSkill : null;
    pState.esp.ability = ABILITIES.some(a => a.id === e.ability) ? e.ability : null;
  } catch (err) { /* ignore */ }
}

const commit = () => { saveSkills(); renderSkills(); };

/* ---------- Ações ---------- */

function train(id, dir) {
  const c = catOf(id);
  const s = pState.skills[id];
  if (dir > 0) {
    if (!canUpgrade(c, id)) return;
    s.lv++;
  } else {
    if (s.lv <= 0) return;
    s.lv--;
    if (s.lv === 0) s.free = false;   // perícia gratuita sem treino libera a vaga
  }
  commit();
}

function toggleFree(id) {
  const c = catOf(id);
  const s = pState.skills[id];
  if (s.free) {
    s.free = false;
    if (s.lv === 1) s.lv = 0;          // só tinha o nível gratuito
  } else {
    if (freeUsed(c) >= c.free) return;
    s.free = true;
    if (s.lv === 0) s.lv = 1;
  }
  commit();
}

function changeAdv(id, dir) {
  const s = pState.skills[id];
  s.adv = Math.max(0, s.adv + dir);
  commit();
}

/* ---------- Rolagens ---------- */

const rollBoxHTML = () => `
  <div class="roll-box" data-box>
    <div class="roll-title" data-title>Nenhuma rolagem ainda</div>
    <div class="roll-dice" data-dice></div>
    <div class="roll-sum" data-sum></div>
    <span class="sr-only" data-live aria-live="polite"></span>
  </div>`;

function playRoll(box, cfg) {
  const title = box.querySelector("[data-title]");
  const diceEl = box.querySelector("[data-dice]");
  const sumEl = box.querySelector("[data-sum]");
  const live = box.querySelector("[data-live]");

  clearInterval(box._timer);
  box.classList.add("has-roll");
  title.textContent = cfg.title;
  sumEl.innerHTML = "";
  live.textContent = "";
  diceEl.innerHTML = cfg.dice.map(() =>
    `<div class="die-wrap"><div class="die d${cfg.sides} rolling"><span>?</span></div><small class="die-tag">&nbsp;</small></div>`
  ).join("");

  const wraps = [...diceEl.children];
  const faces = wraps.map(w => w.querySelector(".die span"));
  const started = performance.now();
  const duration = reduceMotion ? 120 : 750;

  const settle = () => {
    wraps.forEach((w, i) => {
      faces[i].textContent = cfg.dice[i];
      const die = w.querySelector(".die");
      die.classList.remove("rolling");
      die.classList.add("landed");
      if (cfg.kept !== null) {
        const keep = i === cfg.kept;
        w.classList.add(keep ? "kept" : "dropped");
        w.querySelector(".die-tag").textContent = keep ? "escolhido" : "descartado";
      }
    });
    const total = cfg.base + cfg.bonus;
    sumEl.innerHTML =
      `<div class="sum-part"><small>${cfg.baseLabel}</small><b>${cfg.base}</b></div>` +
      `<span class="op">+</span>` +
      `<div class="sum-part"><small>${cfg.bonusLabel}</small><b>${cfg.bonus}</b></div>` +
      `<span class="op">=</span>` +
      `<div class="sum-part total"><small>Final</small><b>${total}</b></div>`;
    live.textContent =
      `${cfg.title}: dados ${cfg.dice.join(" e ")}` +
      `${cfg.kept !== null ? `, escolhido ${cfg.dice[cfg.kept]}` : ""}` +
      `, ${cfg.bonusLabel} ${cfg.bonus}, resultado final ${total}.`;
  };

  box._timer = setInterval(() => {
    if (performance.now() - started < duration) {
      faces.forEach(f => { f.textContent = rollDie(cfg.sides); });
    } else {
      clearInterval(box._timer);
      settle();
    }
  }, 70);
}

function rollSkill(id, box) {
  const withAdv = advSources(id).length > 0;
  const dice = withAdv ? [rollDie(8), rollDie(8)] : [rollDie(8)];
  const kept = dice.length > 1 ? (dice[1] > dice[0] ? 1 : 0) : null;   // empate: primeiro dado
  const name = id === RES_ESPIRITO ? "Espírito (resistência)" : SKILLS[id].name;
  playRoll(box, {
    title: `${name}${withAdv ? " — com Vantagem" : ""}`,
    sides: 8,
    dice,
    kept,
    base: dice[kept === null ? 0 : kept],
    baseLabel: kept === null ? "Dado" : "Maior",
    bonus: bonusOf(id),
    bonusLabel: "Bônus",
  });
}

function rollDamage() {
  const n = attrs.corpo >= 3 ? 2 : 1;
  const dice = Array.from({ length: n }, () => rollDie(4));
  playRoll(el("damageCard").querySelector("[data-box]"), {
    title: `Dado de Dano — ${n}d4 + ${attrs.corpo}`,
    sides: 4,
    dice,
    kept: null,
    base: dice.reduce((a, b) => a + b, 0),
    baseLabel: "Dados",
    bonus: attrs.corpo,
    bonusLabel: "Corpo",
  });
}

/* ---------- Construção da interface ---------- */

function skillRow(id, name, opts) {
  const row = document.createElement("div");
  row.className = "skill";
  row.dataset.skill = id;
  row.innerHTML = `
    <div class="s-main">
      <span class="s-name">${name}</span>
      <span class="s-bonus" data-bonus>+0</span>
      <span class="s-badge" data-badge hidden>Vantagem</span>
    </div>
    ${opts.train ? `
    <div class="s-train">
      <button type="button" class="free" data-act="free" aria-pressed="false"
        title="Perícia gratuita: começa treinada sem gastar pontos"><span aria-hidden="true">★</span> Grátis</button>
      <button type="button" class="step sm" data-act="train-down" aria-label="Diminuir treino de ${name}">−</button>
      <span class="pips" data-pips role="img" aria-label="Nível 0 de ${MAX_LEVEL}">${"<i></i>".repeat(MAX_LEVEL)}</span>
      <button type="button" class="step sm" data-act="train-up" aria-label="Aumentar treino de ${name}">+</button>
      <span class="lvl" data-lvl>Sem treino</span>
    </div>` : `<div class="s-train s-note">${opts.note}</div>`}
    <div class="s-adv">
      <span class="s-lbl">Vantagem</span>
      <button type="button" class="step sm" data-act="adv-down" aria-label="Diminuir vantagem de ${name}">−</button>
      <b data-adv>0</b>
      <button type="button" class="step sm" data-act="adv-up" aria-label="Aumentar vantagem de ${name}">+</button>
    </div>
    <button type="button" class="roll-btn" data-act="roll" aria-label="Rolar teste de ${name}"><span data-rolllabel>Rolar 1d8</span></button>`;
  return row;
}

function buildPanels() {
  const host = el("skillPanels");
  CATEGORIES.forEach(c => {
    const sec = document.createElement("section");
    sec.className = `card panel themed t-${c.id}`;
    sec.dataset.cat = c.id;
    sec.setAttribute("aria-label", `Perícias de ${c.name}`);
    const gains = c.gains.map((g, i) => `${c.name} ${i + 1}: ${g ? "+" + g : "sem pontos"}`).join(" · ");
    sec.innerHTML = `
      <header class="panel-head">
        <h3 class="panel-title">${c.name}</h3>
        <div class="points" data-points>
          <span class="points-label">Pontos de Perícia</span>
          <span class="points-value"><b data-left>0</b> / <span data-total>0</span></span>
        </div>
      </header>
      <p class="hint">Pontos acumulados por valor — ${gains}.</p>
      <p class="free-line" data-freeline></p>
      <p class="warn" data-warn role="alert" hidden></p>
      <div class="skill-list" data-list></div>
      ${rollBoxHTML()}`;
    const list = sec.querySelector("[data-list]");
    c.ids.forEach(id => list.appendChild(skillRow(id, SKILLS[id].name, { train: true })));
    host.appendChild(sec);
  });
}

function buildEspirito() {
  const sec = document.createElement("section");
  sec.className = "card panel themed t-espirito";
  sec.setAttribute("aria-label", "Opções de Espírito");

  const chips = CATEGORIES.map(c => `
    <div class="chip-group t-${c.id}">
      <span class="chip-cat">${c.name}</span>
      ${c.ids.map(id => `<button type="button" class="chip" data-act="esp-skill" data-id="${id}" aria-pressed="false">${SKILLS[id].name}</button>`).join("")}
    </div>`).join("");

  const abilities = ABILITIES.map(a => `
    <label class="ability">
      <input type="radio" name="ability" class="sr-only" data-act="esp-ability" value="${a.id}">
      <span class="ability-body">
        <span class="ability-head"><strong>${a.name}</strong><span class="flag">Selecionada</span></span>
        ${a.paras.map(p => `<span class="ability-text">${p}</span>`).join("")}
        ${(a.list || []).map(li => `<span class="ability-li">${li}</span>`).join("")}
      </span>
    </label>`).join("");

  sec.innerHTML = `
    <header class="panel-head">
      <h3 class="panel-title">Opções de Espírito</h3>
      <div class="points">
        <span class="points-label">Valor de Espírito</span>
        <span class="points-value"><b data-espval>0</b></span>
      </div>
    </header>

    <h4 class="sub">Opção A · Vantagem em Testes de Resistência</h4>
    <label class="choice">
      <input type="checkbox" class="sr-only" data-act="esp-resist">
      <span class="choice-body">
        <strong>Resistência reforçada</strong> <span class="flag">Ativa</span>
        <span class="choice-desc">O personagem ganha Vantagem em Fortitude e Espírito.</span>
      </span>
    </label>
    <div class="skill-list" data-reslist></div>

    <h4 class="sub">Opção B · Vantagem em uma Perícia</h4>
    <p class="hint">Escolha UMA perícia para receber Vantagem. Toque de novo para remover.</p>
    <div class="chip-groups">${chips}</div>

    <h4 class="sub">Opção C · Habilidade Especial</h4>
    <p class="hint">Escolha UMA habilidade.</p>
    <div class="ability-grid">${abilities}</div>
    <div class="ability-actions">
      <button type="button" class="reset" data-act="esp-ability-clear" data-espclear hidden>Limpar habilidade</button>
    </div>
    ${rollBoxHTML()}`;

  const list = sec.querySelector("[data-reslist]");
  list.appendChild(skillRow("fortitude", "Fortitude", { train: false, note: "Mesmo bônus da perícia Fortitude (Corpo)" }));
  list.appendChild(skillRow(RES_ESPIRITO, "Espírito", { train: false, note: "Bônus = valor de Espírito" }));
  el("espiritoRoot").appendChild(sec);
}

function buildFx() {
  document.querySelectorAll(".themed").forEach(host => {
    const theme = THEMES.find(t => host.classList.contains("t-" + t));
    const fx = document.createElement("div");
    fx.className = "fx fx-" + theme;
    fx.setAttribute("aria-hidden", "true");
    const small = host.classList.contains("attr") || host.classList.contains("damage");
    const count = theme === "mente" ? (small ? 4 : 9) : theme === "persona" ? (small ? 3 : 6) : 0;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("i");
      const d = theme === "persona" ? rand(6, 11) : rand(10, 20);
      const size = theme === "persona" ? rand(12, 22).toFixed(0) : rand(2, 5).toFixed(1);
      p.style.cssText =
        `--x:${rand(2, 94).toFixed(1)}%;--y:${rand(10, 90).toFixed(1)}%;` +
        `--d:${d.toFixed(1)}s;--dl:-${rand(0, d).toFixed(1)}s;` +
        `--dx:${rand(-20, 20).toFixed(0)}px;--s:${size}px;--r:${rand(-15, 15).toFixed(0)}deg`;
      if (theme === "persona") p.textContent = "!";
      fx.appendChild(p);
    }
    host.prepend(fx);
  });
}

/* ---------- Renderização ---------- */

function updateRow(row) {
  const id = row.dataset.skill;
  const s = pState.skills[id];
  const q = sel => row.querySelector(sel);

  setText(q("[data-bonus]"), "+" + bonusOf(id));

  const up = q('[data-act="train-up"]');
  if (up) {
    const c = catOf(id);
    q('[data-act="train-down"]').disabled = s.lv <= 0;
    up.disabled = !canUpgrade(c, id);
    const fr = q('[data-act="free"]');
    fr.setAttribute("aria-pressed", String(s.free));
    fr.disabled = !s.free && freeUsed(c) >= c.free;
    q("[data-pips]").querySelectorAll("i").forEach((p, i) => p.classList.toggle("on", i < s.lv));
    q("[data-pips]").setAttribute("aria-label", `Nível ${s.lv} de ${MAX_LEVEL}`);
    setText(q("[data-lvl]"), s.lv === 0 ? "Sem treino" : s.lv === 1 ? "Treinada" : `Nível ${s.lv}`);
    row.classList.toggle("trained", s.lv > 0);
  }

  setText(q("[data-adv]"), String(s.adv));
  q('[data-act="adv-down"]').disabled = s.adv <= 0;

  const src = advSources(id);
  const badge = q("[data-badge]");
  badge.hidden = src.length === 0;
  badge.title = src.length ? "Vantagem por: " + src.join(", ") : "";
  q("[data-rolllabel]").textContent = src.length ? "Rolar 2d8" : "Rolar 1d8";
}

function renderSkills() {
  if (!skillsBuilt) return;

  CATEGORIES.forEach(c => {
    const panel = document.querySelector(`.panel[data-cat="${c.id}"]`);
    const total = totalPoints(c);
    const spent = spentPoints(c);
    const left = total - spent;
    const bad = left < 0;

    setText(panel.querySelector("[data-left]"), String(left));
    setText(panel.querySelector("[data-total]"), String(total));
    panel.querySelector("[data-points]").classList.toggle("invalid", bad);

    const warn = panel.querySelector("[data-warn]");
    warn.hidden = !bad;
    if (bad) {
      warn.textContent =
        `Alocação inválida: ${spent} pontos gastos, mas ${c.name} ${attrs[c.id]} dá apenas ${total}. ` +
        `Remova ${-left} ponto(s) de treino ou aumente ${c.name}. Novas melhorias ficam bloqueadas até corrigir.`;
    }

    const used = freeUsed(c);
    panel.querySelector("[data-freeline]").innerHTML =
      `Perícias gratuitas: <strong>${used}/${c.free}</strong> — ` +
      (used < c.free
        ? `escolha mais ${c.free - used} com ★ Grátis (começam no nível 1, sem custo).`
        : "todas escolhidas.");
  });

  document.querySelectorAll(".skill[data-skill]").forEach(updateRow);

  // Espírito
  document.querySelector('[data-act="esp-resist"]').checked = pState.esp.resist;
  document.querySelectorAll('[data-act="esp-skill"]').forEach(b =>
    b.setAttribute("aria-pressed", String(pState.esp.advSkill === b.dataset.id)));
  document.querySelectorAll('[data-act="esp-ability"]').forEach(i => {
    i.checked = pState.esp.ability === i.value;
  });
  document.querySelector("[data-espclear]").hidden = !pState.esp.ability;
  setText(document.querySelector("[data-espval]"), String(attrs.espirito));

  // Dado de Dano
  setText(el("out-dano"), `${attrs.corpo >= 3 ? 2 : 1}d4 + ${attrs.corpo}`);
}

/* ---------- Eventos ---------- */

document.addEventListener("click", e => {
  const b = e.target.closest("button[data-act]");
  if (!b) return;
  const row = b.closest(".skill[data-skill]");
  const id = row ? row.dataset.skill : b.dataset.id;

  switch (b.dataset.act) {
    case "train-up":   train(id, 1); break;
    case "train-down": train(id, -1); break;
    case "free":       toggleFree(id); break;
    case "adv-up":     changeAdv(id, 1); break;
    case "adv-down":   changeAdv(id, -1); break;
    case "roll":       rollSkill(id, row.closest(".panel").querySelector("[data-box]")); break;
    case "esp-skill":
      pState.esp.advSkill = pState.esp.advSkill === id ? null : id;
      commit();
      break;
    case "esp-ability-clear":
      pState.esp.ability = null;
      commit();
      break;
  }
});

document.addEventListener("change", e => {
  const t = e.target;
  if (!t.dataset || !t.dataset.act) return;
  if (t.dataset.act === "esp-resist") {
    pState.esp.resist = t.checked;
    commit();
  } else if (t.dataset.act === "esp-ability") {
    pState.esp.ability = t.checked ? t.value : null;
    commit();
  }
});

el("rollDamage").addEventListener("click", rollDamage);

el("resetSkills").addEventListener("click", () => {
  const ids = Object.keys(SKILLS);
  const any = ids.some(id => {
    const s = pState.skills[id];
    return s.lv > 0 || s.adv > 0 || s.free;
  });
  if (any && !confirm("Redefinir todas as perícias (treino, perícias gratuitas e vantagens)?")) return;
  ids.forEach(id => { pState.skills[id] = { lv: 0, adv: 0, free: false }; });
  commit();
});

/* ---------- Início ---------- */

loadSkills();
buildPanels();
buildEspirito();
el("damageCard").insertAdjacentHTML("beforeend", rollBoxHTML());
buildFx();
skillsBuilt = true;

load();
render();

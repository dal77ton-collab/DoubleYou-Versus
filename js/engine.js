/* DoubleYou Versus combat simulation — 60Hz, data-driven moves. */
(function (g) {
  const DT = 1 / 60;
  const GROUND = 0;
  const GRAVITY = 2200;
  const MOVE = 320;
  const JUMP_V = 1040;
  const DJUMP_V = 980;
  // Walkable checkered platform. Floor sits a bit above the front gold ledge
  // so feet rest on the tiles. Fall-off is a little past the visual corners.
  const ARENA_L = 48;
  const ARENA_R = 1232;
  const FLOOR_Y = 516;
  const MELEE = 132;
  const MID = 210;
  const BODY_W = 64;
  const BODY_H = 108;
  const CANVAS_W = 1280;
  const CANVAS_H = 720;

  function rand(a, b) {
    return a + Math.random() * (b - a);
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function moveKeyReady(f, key) {
    f._moveCD = f._moveCD || {};
    return !((f._moveCD[key] || 0) > 0);
  }

  function registerChain(f, key) {
    f._moveCD = f._moveCD || {};
    const windowOn = (f._comboWin || 0) > 0;
    const repeating = windowOn && f.lastMove === key;
    const chaining = windowOn && f.lastMove && f.lastMove !== key;
    const free = /:(punch|rush|djump)$/.test(String(key || ""));
    if (repeating) {
      f.comboHits = 0;
      f.animBoost = 1;
      f._repeatLag = free ? 0 : 0;
    } else if (chaining) {
      f.comboHits = (f.comboHits || 0) + 1;
      f.animBoost = Math.min(1.58, 1.2 + f.comboHits * 0.09);
      f._repeatLag = 0;
    } else {
      f.comboHits = 1;
      f.animBoost = 1;
      f._repeatLag = 0;
    }
    f.lastMove = key;
    f._comboWin = 0.72;
  }

  function scaleMoveTiming(f) {
    const boost = f.animBoost || 1;
    if (boost > 1 && f.locked > 0) f.locked = Math.max(0.08, f.locked / boost);
    if (f._repeatLag) f.locked += f._repeatLag;
    const scalePend = (p) => { if (p && p.t != null) p.t = Math.max(0.04, p.t / Math.max(1, boost)); };
    scalePend(f._pendKick); scalePend(f._pendProj); scalePend(f._pendWhip);
    scalePend(f._pendWave); scalePend(f._pendShock); scalePend(f._pendMulti);
    scalePend(f._pendCounter); scalePend(f._pendTP); scalePend(f._pendSlam);
    if (f._pendUlt) f._pendUlt = Math.max(0.04, f._pendUlt / Math.max(1, boost));
    syncHitsToAnimEnd(f);
  }

  function syncHitsToAnimEnd(f) {
    const t = Math.max(0.08, (Number(f.locked) || 0.28) * 0.9);
    ["_pendKick", "_pendProj", "_pendWhip", "_pendWave", "_pendShock", "_pendMulti", "_pendCounter", "_pendSlam"].forEach((k) => {
      if (f[k] && f[k].t != null) f[k].t = t;
    });
  }

  function tickChains(f, dt) {
    f._comboWin = Math.max(0, (f._comboWin || 0) - dt);
    if (f._moveCD) Object.keys(f._moveCD).forEach((k) => { f._moveCD[k] = Math.max(0, f._moveCD[k] - dt); });
    f._rushT = Math.max(0, (f._rushT || 0) - dt);
    if (f._rushT > 0) f.animBoost = Math.max(f.animBoost || 1, 2.05);
    else if (f._comboWin <= 0) { f.animBoost = 1; f.comboHits = 0; }
  }

  function applyRush(f) {
    if (!f || f.dead) return;
    f.animBoost = Math.max(f.animBoost || 1, 2.1);
    f._rushT = 0.5;
    if (f.locked > 0.08) f.locked = Math.max(0.06, f.locked / 1.4);
  }

  function fighter(id, side) {
    const d = g.DV.DATA.CHARACTERS[id];
    return {
      id, side, data: d,
      x: side === 0 ? 280 : 1000,
      y: FLOOR_Y,
      vx: 0, vy: 0,
      face: side === 0 ? 1 : -1,
      hp: d.health, maxHp: d.health,
      energy: (d && d.energy != null) ? Number(d.energy) : 10, maxEnergy: 10,
      stun: 0, invuln: 0, locked: 0,
      _pendProj: null, _pendWhip: null, _pendWave: null, _pendShock: null,
      _pendKick: null, _pendMulti: null, _pendCounter: null, _pendTP: null, _pendUlt: 0, _pendSlam: null,
      _vidAnim: null, _comboWas: {}, _cd: {},
      airborne: false, jumps: 0,
      anim: "idle", animT: 0, frame: 0, holdLeft: 8,
      attacking: false, meleeActive: false, dashing: false, emoting: false, emoteId: "pass",
      burn: 0, poison: 0, slow: 0, shockMark: 0, biteMark: 0,
      shieldHp: 0, shieldT: 0,
      metal: 0, flying: 0, gasMode: 0, _gasTrail: 0, shadowMode: 0,
      ult: 0, dmgMul: 1, dr: 0,
      dead: false, fallen: false,
      cursorX: side === 0 ? 900 : 300,
      cursorY: FLOOR_Y - 40,
      lastHurt: 0,
      comboHits: 0,
      freeze: 0,
      hitFlash: 0,
      pendingVx: 0,
      pendingVy: 0,
      skin: "default",
      uses: null,
      oshield: [],
      comboSeq: ["ArrowDown", "RightClick", "ArrowDown", "LeftClick"],
      comboStep: 0,
      comboCount: 0,
      comboT: 0,
      _comboAcc: 0,
      ultra: 0,
      ultraOn: 0,
      ultraTier: "",
    };
  }

  const USE_MAX = {
    "inferna:a": 2, "inferna:up": 1, "inferna:slam": 1, "inferna:counter": 2,
    "shade:up": 3, "shade:a": 3, "shade:right": 2, "shade:down": 1,
    "lumen:a": 3, "lumen:left": 2, "lumen:down": 1, "lumen:right": 1,
    "tide:a": 3, "tide:down": 1, "tide:left": 1, "tide:wdash": 2,
    "crown:a": 1, "crown:down": 1, "crown:up": 1, "crown:left": 1, "crown:right": 1,
    "viper:a": 1, "viper:down": 1, "viper:up": 1, "viper:right": 2, "viper:left": 2
  };
  const USE_NAME = {
    "inferna:a": "Fireball", "inferna:up": "Uppercut", "inferna:slam": "Slam", "inferna:counter": "Counter",
    "shade:up": "Teleport", "shade:a": "Kick", "shade:right": "Shadow Push", "shade:down": "Shadow Mode",
    "lumen:a": "Dash", "lumen:left": "Shock", "lumen:down": "Phase", "lumen:right": "Multi Punch",
    "tide:a": "Water Whip", "tide:down": "Water Shield", "tide:left": "Wave", "tide:wdash": "Water Dash",
    "crown:a": "Metal Projectile", "crown:down": "Metal Shield", "crown:up": "Metal Mode", "crown:left": "Slam", "crown:right": "Kick",
    "viper:a": "Venom", "viper:down": "Gas Jump", "viper:up": "Gas Mode", "viper:right": "Dash Kick", "viper:left": "Spin Kick"
  };
  function fillUses(f) {
    f.uses = {};
    Object.keys(USE_MAX).forEach((k) => {
      if (k.indexOf(f.id + ":") === 0) f.uses[k] = USE_MAX[k];
    });
  }
  function useLeft(f, key) {
    if (!f.uses) fillUses(f);
    if (USE_MAX[key] == null) return 99;
    if (f.uses[key] == null) f.uses[key] = USE_MAX[key];
    return f.uses[key];
  }
  function addOvershield(f, amt) {
    amt = Math.max(0, Number(amt) || 0);
    if (!amt) return 0;
    f.oshield = f.oshield || [];
    const cur = f.oshield.reduce((s, c) => s + c.amt, 0);
    const add = Math.min(amt, Math.max(0, 50 - cur));
    if (add > 0) f.oshield.push({ amt: add, age: 0 });
    return add;
  }
  function overshieldAmt(f) {
    return (f.oshield || []).reduce((s, c) => s + c.amt, 0);
  }
  function absorbDamage(def, dmg) {
    let left = Math.max(0, dmg);
    def.oshield = def.oshield || [];
    while (left > 0 && def.oshield.length) {
      const c = def.oshield[0];
      const take = Math.min(c.amt, left);
      c.amt -= take;
      left -= take;
      if (c.amt <= 0.05) def.oshield.shift();
    }
    return left;
  }
  function tickOvershield(f, dt) {
    f.oshield = f.oshield || [];
    f.oshield.forEach((c) => {
      c.age += dt;
      if (c.age >= 2.5) c.amt = Math.max(0, c.amt - 5 * dt);
    });
    f.oshield = f.oshield.filter((c) => c.amt > 0.05);
  }
  function rollCombo(f) {
    const bag = ["ArrowDown", "RightClick", "LeftClick"];
    const seq = [0, 1, 2].map(() => bag[Math.floor(Math.random() * bag.length)]);
    seq.push("LeftClick");
    f.comboSeq = seq;
    f.comboStep = 0;
    f.comboCount = 0;
    f.comboT = 0;
  }
  function comboLabel(seq) {
    const name = { ArrowDown: "DOWN", RightClick: "RMB", LeftClick: "LMB" };
    return (seq || []).map((t) => name[t] || t).join("  ");
  }
  function noteComboInput(f, token) {
    if (!f || f.comboT > 0) return;
    const seq = f.comboSeq || [];
    if (token === seq[f.comboStep || 0]) f.comboStep = (f.comboStep || 0) + 1;
    else if (token === seq[0]) f.comboStep = 1;
    else f.comboStep = 0;
  }
  function startCombo(m, f, foe) {
    f.comboT = 2.5;
    f._comboAcc = 0;
    f.comboStep = 0;
    f.comboCount = (f.comboCount || 0) + 1;
    const stun = f.comboCount === 1 ? 2.5 : 0.7;
    foe.stun = Math.max(foe.stun || 0, stun);
    foe.locked = Math.max(foe.locked || 0, stun);
    setAnim(foe, "hurt", true);
    setAnim(f, "combo", true);
    f.locked = Math.max(f.locked || 0, 2.5);
    fillUses(f);
    addUltra(f, 1);
    addFx(m, "burst", foe.x, foe.y - 80, { c: f.data.color, life: 0.45 });
  }
  function addUltra(f, n) {
    if (!f || f.dead) return;
    f.ultra = Math.max(0, Math.min(100, (f.ultra || 0) + n));
  }
  const USE_INPUT = {
    "inferna:a": "RMB+LMB", "inferna:up": "RMB+Up", "inferna:slam": "RMB+Down air", "inferna:counter": "RMB+Down",
    "shade:up": "RMB+Up", "shade:a": "RMB+LMB", "shade:right": "RMB+Right", "shade:down": "RMB+Down",
    "lumen:a": "RMB+LMB", "lumen:left": "RMB+Left", "lumen:down": "RMB+Down", "lumen:right": "RMB+Right",
    "tide:a": "RMB+LMB", "tide:down": "RMB+Down", "tide:left": "RMB+Left", "tide:wdash": "RMB+Right",
    "crown:a": "RMB+LMB", "crown:down": "RMB+Down", "crown:up": "RMB+Up", "crown:left": "RMB+Left", "crown:right": "RMB+Right",
    "viper:a": "RMB+LMB", "viper:down": "RMB+Down", "viper:up": "RMB+Up", "viper:right": "RMB+Right", "viper:left": "RMB+Left"
  };
  function usesEmpty(f) {
    const keys = Object.keys(USE_MAX).filter((k) => k.indexOf(f.id + ":") === 0);
    return keys.length > 0 && keys.every((k) => (f.uses && f.uses[k] || 0) <= 0);
  }
  function ultraZone(pos) {
    if (pos >= 0.42 && pos <= 0.58) return "green";
    if (pos >= 0.22 && pos <= 0.78) return "yellow";
    return "red";
  }
  function playUltraVoice(id) {
    try {
      if (g.DV.audio && g.DV.audio.ultraVoice) g.DV.audio.ultraVoice(id);
    } catch (e) {}
  }
  function beginUltraEffect(m, f, zone) {
    const foe = m.p[1 - f.side];
    f.ultra = 0;
    f.ultraTier = zone;
    if (f.id === "inferna") {
      f.ultraOn = zone === "green" ? 10 : zone === "yellow" ? 5 : 3;
      f.dmgMul = 2;
      addFx(m, "ult", f.x, f.y - 80, { c: "#ff6a1a", life: 0.8 });
    } else if (f.id === "shade") {
      const t = zone === "green" ? 8 : zone === "yellow" ? 5 : 2;
      f.ultraOn = t;
      if (foe) m.blackout[foe.side] = t;
      addFx(m, "ult", f.x, f.y - 80, { c: "#9b5cff", life: 0.6 });
    } else if (f.id === "lumen") {
      const t = zone === "green" ? 12 : zone === "yellow" ? 9 : 6;
      f.ultraOn = t;
      if (foe) foe.slow = Math.max(foe.slow || 0, t);
      m.lumenTint = t;
      addFx(m, "ult", f.x, f.y - 80, { c: "#ffe14a", life: 0.7 });
    } else if (f.id === "tide") {
      f.ultraOn = zone === "green" ? 9 : zone === "yellow" ? 6 : 3;
      m.rain = Math.max(m.rain || 0, f.ultraOn);
      addFx(m, "ult", f.x, f.y - 80, { c: "#4ec8ff", life: 0.7 });
    } else if (f.id === "crown") {
      const dmg = zone === "green" ? 90 : zone === "yellow" ? 60 : 30;
      f.ultraOn = 1.4;
      f.airborne = true;
      f.vy = -640;
      f.locked = Math.max(f.locked || 0, 0.8);
      setAnim(f, "fly", true);
      f._pendProj = { t: 0.45, kind: "metalUltra", speed: 0, dmg: [dmg, dmg], extra: { r: 54, life: 1.4, vx: 0, vy: 980, fromY: f.y - 220, splash: dmg / 2, ultra: true } };
      addFx(m, "ult", f.x, f.y - 120, { c: "#ffd24a", life: 0.8 });
    } else if (f.id === "viper") {
      const poison = zone === "green" ? 9 : zone === "yellow" ? 6 : 3;
      f.ultraOn = poison;
      m.viperWave = { x: f.x, y: f.y - 70, r: 30, owner: f.side, poison: poison, hit: false, life: 1.6 };
      m.viperTint = poison;
      addFx(m, "ult", f.x, f.y - 70, { c: "#46ff6e", life: 0.6 });
    }
  }
  function stopTiming(m, forced) {
    const bar = m.timing;
    if (!bar || bar.done) return;
    bar.done = true;
    const pos = Math.max(0, Math.min(0.999, bar.t / bar.dur));
    const zone = forced ? "red" : ultraZone(pos);
    bar.zone = zone;
    const f = m.p[bar.side];
    if (!f || f.dead) { m.timing = null; return; }
    setAnim(f, "pose", true);
    f.locked = Math.max(f.locked || 0, 0.42);
    f.vx = 0;
    playUltraVoice(f.id);
    f._ultraPose = 0.38;
    f._ultraZone = zone;
    m.timing = null;
  }
  function tryUltra(m, f) {
    if (!f || f.dead || f.stun > 0) return;
    if ((f.ultra || 0) < 100) return;
    if (m.timing) return;
    if (f._ultraPose > 0 || f.ultraOn > 0) return;
    m.timing = { side: f.side, t: 0, dur: 1 + Math.random() * 0.6, done: false };
    if (g.DV.audio && g.DV.audio.announce) g.DV.audio.announce();
  }

  function createMatch(opts) {
    const list = (g.DV.DATA && g.DV.DATA.ARENAS) || [];
    const arena = opts.arena || list[Math.floor(Math.random() * Math.max(1, list.length))];
    const m = {
      mode: opts.mode || "quick",
      practice: !!opts.practice,
      p: [fighter(opts.p1, 0), fighter(opts.p2, 1)],
      names: [opts.n1 || "PLAYER", opts.n2 || "RIVAL"],
      ranks: [opts.r1 || "ROOKIE", opts.r2 || "ROOKIE"],
      mastery: [opts.m1 || "NO MASTERY", opts.m2 || "NO MASTERY"],
      arena,
      time: 0,
      round: 1,
      score: [0, 0],
      phase: "countdown",
      phaseT: 0,
      overlay: "3",
      projectiles: [],
      pools: [],
      fx: [],
      floats: [],
      shake: 0,
      hitstop: 0,
      rain: 0,
      blackout: [0, 0],
      ended: false,
      winner: null,
      dummy: !!opts.practice,
      deaths: [0, 0],
      sudden: false,
      matchLimit: opts.practice ? Infinity : 60,
      matchClock: 0,
      cam: { x: 640, y: 360, z: 1 },
    };
    const fy = floorY(m);
    m.p.forEach((f) => { f.y = fy; fillUses(f); rollCombo(f); });
    return m;
  }

  function isStudio(m) {
    return !!(m && m.arena && m.arena.id === "studio");
  }
  function arenaScroll(m) {
    return isStudio(m);
  }
  function arenaBlast(m) {
    return !isStudio(m);
  }
  function floorY(m) {
    return isStudio(m) ? 568 : FLOOR_Y;
  }

  function updateCamera(m) {
    m.cam = m.cam || { x: 640, y: 360, z: 1 };
    m.cam.x = 640;
    m.cam.y = 360;
    m.cam.z = 1;
  }

  function stepStudioHazards(m) {
    if (!isStudio(m) || m.phase !== "fight") return;
    let t = 0;
    if (g.DV.render && g.DV.render.studioClock) t = g.DV.render.studioClock();
    else t = (m.time || 0) % 12.08;
    const sparkOn = (t >= 3.8 && t <= 4.7) || (t >= 7.4 && t <= 8.3);
    m._sparkOn = sparkOn;
    if (!sparkOn) { m._sparkHit = {}; return; }
    m._sparkHit = m._sparkHit || {};
    const fy = floorY(m);
    const zones = [118, 1162];
    m.p.forEach((f) => {
      if (!f || f.dead || f.invuln > 0) return;
      if (Math.abs((f.y || 0) - fy) > 28) return;
      const onSpark = zones.some((zx) => Math.abs(f.x - zx) < 82);
      if (!onSpark || m._sparkHit[f.side]) return;
      m._sparkHit[f.side] = true;
      f.hp = Math.max(0, f.hp - 15);
      f.stun = Math.max(f.stun || 0, 0.18);
      setAnim(f, "hurt");
      addFx(m, "burst", f.x, f.y - 40, { c: "#ffd24a", life: 0.45 });
      floatDmg(m, f.x, f.y - 90, 15, false);
      if (f.hp <= 0) { f.dead = true; f.hp = 0; }
    });
  }

  function addFx(m, kind, x, y, extra) {
    m.fx.push(Object.assign({ kind, x, y, t: 0, life: 0.45 }, extra || {}));
  }
  function floatDmg(m, x, y, n, crit) {
    m.floats.push({ x, y, n: Math.round(n), t: 0, crit: !!crit });
  }

  const ANIM_ALIAS = {
    fly: "fly", shock: "shock", counter: "counter", land: "land",
    djump: "djump",
    guard: "block", mode: "mode", proj: "proj", fireball: "fireball",
    slash: "slash", waterdash: "waterdash", whip: "whip", coil: "coil",
    bite: "bite", multi: "multi", faze: "faze", teleport: "teleport",
    upper: "kick", flamedash: "dash", shadowdash: "dash", viperdash: "dash",
    spit: "spit", wave: "wave", field: "field", slam: "slam",
    punch: "crouchpunch",
  };
  function clipOf(f, name) {
    const pack = g.DV.SPRITES && g.DV.SPRITES.chars && g.DV.SPRITES.chars[f.id];
    if (!pack) return null;
    return pack[name] || pack[ANIM_ALIAS[name] || ""] || pack.idle || null;
  }
  function setAnim(f, name, force) {
    if (!name) return;
    if (f.anim === name && !force) return;
    f.anim = name;
    f.animT = 0;
    f.frame = 0;
    f._vidAnim = null;
    const c = clipOf(f, name);
    f.holdLeft = c && c.frames[0] ? c.frames[0].hold : 6;
  }
  function tickAnim(f) {
    const c = clipOf(f, f.anim);
    if (!c || !c.frames.length) return;
    f.holdLeft -= 1;
    if (f.holdLeft > 0) return;
    f.frame += 1;
    if (f.frame >= c.frames.length) {
      if (c.loop) f.frame = 0;
      else f.frame = c.frames.length - 1;
    }
    f.holdLeft = c.frames[f.frame].hold;
  }

  function spend(f, n, key) {
    if (!key || USE_MAX[key] == null) return true;
    if (useLeft(f, key) <= 0) return false;
    f.uses[key] -= 1;
    if (key === "tide:a") f.uses[key] = Math.min(3, f.uses[key]);
    return true;
  }

  function noteEnergyUse(f, key, cost) {
    if (!f || !key || !cost) return;
    f._moveCD = f._moveCD || {};
    if (f._lastEnergy === key) f._energyStreak = (f._energyStreak || 1) + 1;
    else { f._lastEnergy = key; f._energyStreak = 1; }
    if (f._energyStreak >= 2) f._moveCD[key] = Math.max(f._moveCD[key] || 0, Number(cost) || 0);
  }

  function weaknessMul(atkType, defWeak) {
    return atkType === defWeak ? 1.15 : 1;
  }

  function behindBonus(att, def) {
    if (att.id !== "shade") return 1;
    const attackingFromRight = att.x > def.x;
    const defFacingRight = def.face > 0;
    const fromBehind = (attackingFromRight && defFacingRight) || (!attackingFromRight && !defFacingRight);
    return fromBehind ? 1.5 : 1;
  }

  function hitstopTime(dmg, opts) {
    opts = opts || {};
    if (opts.noHitstop) return 0;
    if (opts.shield) return 0.05;
    let ticks = 4 + Math.min(10, Math.round(dmg * 0.32));
    if (opts.crit || dmg >= 18) ticks += 3;
    if (opts.kill) ticks += 8;
    if (opts.ult) ticks += 4;
    if (opts.multi) ticks = Math.min(ticks, 4);
    return Math.min(18, ticks) / 60;
  }

  function applyHitstop(m, att, def, dmg, opts) {
    const t = hitstopTime(dmg, opts);
    if (t <= 0) return;
    if (att) {
      att.freeze = Math.max(att.freeze, t);
      att.hitFlash = Math.max(att.hitFlash, Math.min(0.08, t));
    }
    if (def) {
      def.freeze = Math.max(def.freeze, t);
      def.hitFlash = Math.max(def.hitFlash, Math.min(0.1, t));
    }
    m.hitstop = Math.max(m.hitstop, t);
    m.shake = Math.min(16, m.shake + 2 + Math.min(8, dmg * 0.2));
  }

  function applyDamage(m, att, def, raw, opts) {
    opts = opts || {};
    if (def.invuln > 0 || def.dead) return 0;
    if (def.shieldHp > 0) {
      def.shieldHp -= raw;
      addFx(m, "spark", def.x, def.y - 60, { c: def.data.color });
      applyHitstop(m, att, def, raw, { shield: true, noHitstop: opts.noHitstop });
      if (def.shieldHp <= 0) {
        def.shieldHp = 0; def.shieldT = 0;
        addFx(m, "burst", def.x, def.y - 50, { c: def.data.color, life: 0.5 });
        applyHitstop(m, att, def, 12, { crit: true });
        if (Math.abs(att.x - def.x) < MELEE + 20) {
          def.pendingVx += att.face * 420;
          def.stun = Math.max(def.stun, 0.5);
        }
      }
      return 0;
    }
    if (opts.noDmg) {
      if (opts.stun) def.stun = Math.max(def.stun, opts.stun);
      if (opts.biteMark) def.biteMark = Math.max(def.biteMark || 0, opts.biteMark);
      return 0;
    }
    let d = raw * (att.dmgMul || 1) * behindBonus(att, def) * weaknessMul(att.data.type, def.data.weakness);
    d *= (1 - (def.dr || 0));
    if (att && att.id === "inferna" && att.ultraOn > 0 && !opts.burnTick) d *= 2;
    if (opts.kick && (def.biteMark || 0) > 0) d *= 1.25;
    d = Math.max(1, d);
    stopEmote(def);
    const leftover = absorbDamage(def, d);
    def.hp = Math.max(0, def.hp - leftover);
    if (opts.biteMark) def.biteMark = Math.max(def.biteMark || 0, opts.biteMark);
    def.lastHurt = 0.2;
    const hurtFor = opts.stun ? opts.stun : 0.2;
    if (opts.down) { setAnim(def, "down"); def.locked = Math.max(def.locked, Math.max(0.85, hurtFor)); }
    else {
      setAnim(def, Math.abs(opts.kb || 0) > 200 ? "knockback" : "hurt");
      def.locked = Math.max(def.locked, hurtFor);
    }
    if (opts.stun) def.stun = Math.max(def.stun, opts.stun);
    else def.stun = 0;
    if (opts.oshield) addOvershield(att, opts.oshield);
    if (opts.kb) {
      def.pendingVx += opts.kb;
      if (Math.abs(opts.kb) >= 220) {
        def.airborne = true;
        def.pendingVy += -80;
        def._launched = Math.max(def._launched || 0, 0.35);
      }
    }
    if (opts.lift) {
      def.airborne = true;
      def.pendingVy += opts.lift;
      def._launched = Math.max(def._launched || 0, 0.4);
    }
    if (opts.poison) def.poison = Math.max(def.poison || 0, opts.poison);
    floatDmg(m, def.x, def.y - 130, d, d >= 18);
    addFx(m, "hit", def.x + def.face * -20, def.y - 70, { c: att.data.color, life: 0.28 });
    addFx(m, "spark", def.x + def.face * -16, def.y - 72, { c: "#fff", life: 0.16 });
    g.DV.audio.hit();
    if (att && d > 0 && !opts.noUltra) {
      att._ultraDmg = (att._ultraDmg || 0) + d;
      while (att._ultraDmg >= 5) { att._ultraDmg -= 5; addUltra(att, 1); }
      if (att.id === "inferna" && att.ultraOn > 0) { def.burn = 3; def.burnDps = 5; }
    }
    if (def.hp <= 0) def.dead = true;
    applyHitstop(m, att, def, d, {
      crit: d >= 18,
      kill: def.dead,
      ult: att.ult > 0,
      multi: opts.multi,
      noHitstop: opts.noHitstop,
    });
    return d;
  }

  function spawnProj(m, f, kind, speed, dmg, extra) {
    extra = extra || {};
    const handsX = f.x + f.face * 62;
    const handsY = extra.fromY != null ? extra.fromY : (f.y - 148);
    const aimX = extra.tx != null ? extra.tx : (f.cursorX != null ? f.cursorX : f.x + f.face * 200);
    const aimY = extra.ty != null ? extra.ty : (f.cursorY != null ? f.cursorY : handsY);
    const ang = Math.atan2(aimY - handsY, aimX - handsX);
    const r = kind === "fireball" ? 26 : 16;
    m.projectiles.push(Object.assign({
      owner: f.side, kind, x: handsX, y: handsY,
      vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
      dmg, life: 1.8, r, element: f.data.type,
    }, extra || {}));
  }

  function moveDef(f, id) {
    const list = (f.data && f.data.moves) || [];
    return list.find((x) => x.id === id) || {};
  }
  function rollDmg(def) {
    const a = def.dmg || [5, 10];
    return rand(Number(a[0]) || 0, Number(a[1] != null ? a[1] : a[0]) || 0);
  }
  function tokenOn(inp, t) {
    if (!inp) return false;
    if (t === "LeftClick") return !!(inp.punch);
    if (t === "RightClick") return !!(inp.mod || inp.rightPulse);
    if (t === "DoubleLeftClick") return false;
    if (t === "DoubleRightClick") return false;
    if (t === "ArrowLeft") return !!inp.left;
    if (t === "ArrowRight") return !!inp.right;
    if (t === "ArrowUp") return !!(inp.up || inp.jump);
    if (t === "ArrowDown") return !!inp.down;
    if (t === "Shift") return !!inp.shift;
    if (t === "Space") return !!inp.emote;
    return !!(inp.codes && inp.codes[t]);
  }
  function comboOn(inp, combo) {
    if (!combo || !combo.length) return false;
    return combo.every((t) => tokenOn(inp, t));
  }
  function namedMoveWhich(f, id) {
    const table = {
      inferna: { fireball: "a", upper: "up", slam: "down", counter: "down" },
      shade: { kick: "a", teleport: "up", push: "right", mode: "down" },
      lumen: { dash: "a", shock: "left", faze: "down", multi: "right" },
      tide: { whip: "a", wave: "left", shield: "down" },
      crown: { proj: "a", shield: "down", mode: "up", slam: "left", kick: "right" },
      viper: { bite: "a", venom: "a", gasjump: "down", mode: "up", dash: "right", coil: "left" },
    };
    return table[f.id] && table[f.id][id];
  }
  function tryNamedMove(m, f, id) {
    if (!id || f.dead) return false;
    if (id === "rush" || id === "speed") { applyRush(f); return true; }
    if (id === "punch") { tryPunch(m, f); return true; }
    if (id === "ult") { activateUlt(m, f); return true; }
    if (id === "wdash" || id === "waterdash") { waterDash(m, f); return true; }
    const which = namedMoveWhich(f, id);
    if (which) { special(m, f, which); return true; }
    return false;
  }
  function fireBoundMove(m, f, mv) {
    if (f._cd && f._cd[mv.id] > 0) return true;
    if (mv.cooldown) {
      f._cd = f._cd || {};
      f._cd[mv.id] = Number(mv.cooldown) || 0;
    }
    if (mv.id === "punch") { tryPunch(m, f); return true; }
    if (mv.id === "ult") { activateUlt(m, f); return true; }
    if (mv.id === "rush" || mv.id === "speed") { applyRush(f); return true; }
    if (mv.id === "djump") return true;
    const map = {
      fireball: "a", kick: "a", dash: "a", whip: "a", proj: "a",
      fly: "up", teleport: "up",
      slam: "down", counter: "down", mode: "down", faze: "down", shield: "down",
      push: "right", multi: "right", spit: "right", bite: "right",
      shock: "left", wave: "left", coil: "left",
    };
    special(m, f, map[mv.id] || "a");
    return true;
  }
  function tryCustomMoves(m, f, inp) {
    const list = ((f.data && f.data.moves) || []).filter((mv) => mv.controls && mv.controls.length);
    if (!list.length) return false;
    list.sort((a, b) => b.controls.length - a.controls.length);
    f._comboWas = f._comboWas || {};
    let used = false;
    list.forEach((mv) => {
      const on = comboOn(inp, mv.controls);
      const fire = on && !f._comboWas[mv.id];
      f._comboWas[mv.id] = on;
      if (fire && !used) used = fireBoundMove(m, f, mv);
    });
    Object.keys(f._comboWas).forEach((id) => {
      if (!list.some((mv) => mv.id === id)) delete f._comboWas[id];
    });
    if (f._cd) Object.keys(f._cd).forEach((k) => { f._cd[k] = Math.max(0, f._cd[k] - 1 / 60); });
    return used;
  }
  function tryPunch(m, f) {
    if (f.stun > 0 || f.dead) return;
    const meleeNow = /^(punch|kick|slash|multi|upper|slam|spin|bite|coil)$/.test(f.anim);
    if (meleeNow || f.meleeActive) applyRush(f);
    if (f.locked > 0 && meleeNow) return;
    if (f.locked > 0) return;
    if (!moveKeyReady(f, f.id + ":punch")) return;
    const def = moveDef(f, "punch");
    f.animBoost = Math.max(f.animBoost || 1, 1.7);
    setAnim(f, def.anim || "punch"); f.attacking = true; f.meleeActive = true;
    const lock = def.duration != null ? Number(def.duration) : (f.id === "inferna" ? 0.18 : (f.id === "shade" || f.id === "lumen" ? 0.5 : (f.id === "viper" ? 0.62 : 0.28)));
    f.locked = Math.min(2.4, (isFinite(lock) ? lock : 0.28) * 2);
    registerChain(f, f.id + ":punch");
    scaleMoveTiming(f);
    if (f.id === "inferna") (g.DV.audio.fireBurst || g.DV.audio.fire)();
    else g.DV.audio.punch();
    const foe = m.p[1 - f.side];
    const reach = def.range === "mid" ? MID : def.range === "long" ? 400 : MELEE;
    f._pendKick = {
      t: Math.max(0.1, f.locked * 0.9),
      dmg: [rollDmg(def), rollDmg(def)],
      range: reach,
      kb: f.face * (Number(def.kb) || 80),
      stun: Number(def.stun) || 0,
      comboFinisher: (f.comboStep || 0) >= ((f.comboSeq || []).length),
      shadeUlt: false
    };
  }

  function stopEmote(f) {
    if (!f || !f.emoting) return;
    f.emoting = false;
    if (f.anim === "emote") {
      f.locked = 0;
      setAnim(f, f.airborne ? "fall" : "idle");
    }
  }

  function tryEmote(m, f) {
    if (!f || f.dead || f.stun > 0 || f.locked > 0) return;
    const equipped = f.emoteId || "pass";
    if (equipped === "basic" || equipped === "none") return;
    const prof = g.DV._profile;
    if (prof && g.DV.profile && g.DV.profile.passUnlocked && !g.DV.profile.passUnlocked(prof, f.id, 3) && !prof.promoUnlock) return;
    f.emoting = true;
    f.vx = 0;
    f.attacking = false;
    f.meleeActive = false;
    const ultEmote = /supernova|eclipse|thunderstrike|tsunami|ironreign|venomstorm/.test(equipped);
    setAnim(f, ultEmote ? "ult" : "emote", true);
    f.locked = ultEmote ? 2.4 : 5.8;
    f.animT = 0;
  }

  function startDash(m, f, dir, dist, dmgRange, invuln) {
    if (!moveKeyReady(f, f.id + ":dash")) return;
    f.dashing = true; setAnim(f, "dash"); f.locked = f.id === "lumen" ? 0.52 : 0.28;
    f.vx = dir * dist;
    f._dashPierce = f.id === "lumen";
    f._dashConsumed = false;
    if (invuln) f.invuln = Math.max(f.invuln, invuln);
    addFx(m, "dash", f.x, f.y - 50, { c: f.data.color, face: dir });
    g.DV.audio.whoosh();
    if (dmgRange) f._dashDmg = dmgRange;
    registerChain(f, f.id + ":dash");
    scaleMoveTiming(f);
  }

  function special(m, f, which) {
    if (f.stun > 0 || f.locked > 0 || f.dead) return;
    if (f.id === "shade" && (f.shadowMode || 0) > 0) return;
    const chainKey = f.id + ":" + which;
    if (!moveKeyReady(f, chainKey)) return;
    const foe = m.p[1 - f.side];
    const lockBefore = f.locked;
    const animBefore = f.anim;
    const dist = Math.abs(f.x - foe.x);

    if (f.id === "inferna") {
      if (which === "a") { // fireball
        if (!spend(f, 3, chainKey)) return;
        setAnim(f, "fireball", true); f.animT = 0; f.locked = 0.82;
        f._pendProj = { t: 0.64, kind: "fireball", speed: 620, dmg: [5, 5], extra: { burn: 2, burnDps: rand(5, 10) } };
        g.DV.audio.whoosh();
      } else if (which === "up") {
        if (!spend(f, 1, "inferna:up")) return;
        setAnim(f, "upper");
        f.animT = 0;
        f.locked = 0.72;
        f.meleeActive = true;
        f._pendKick = { t: 0.48, dmg: [15, 20], range: MELEE + 16, kb: f.face * 340, lift: -460, stun: 0.18, oshield: 15 };
        addFx(m, "burst", f.x + f.face * 40, f.y - 90, { c: "#ff6a1a" });
        (g.DV.audio.fireBurst || g.DV.audio.fire)();
      } else if (which === "down") {
        if (f._canSlam || f.flying > 0) {
          f._wantSlam = false;
          f._canSlam = false;
          if (!spend(f, 1, "inferna:slam")) return;
          const tx = f.cursorX != null ? f.cursorX : f.x;
          f.x += (tx - f.x) * 0.55;
          f.vy = 1200; f.airborne = true; f.flying = 0;
          setAnim(f, "slam"); f.locked = 0.78; f._slam = true;
          (g.DV.audio.fireBurst || g.DV.audio.fire)();
        } else {
          if (!(foe.meleeActive && dist < MELEE + 28)) return;
          if (!spend(f, 1, "inferna:counter")) return;
          setAnim(f, "counter");
          f.locked = 1.05;
          f.invuln = Math.max(f.invuln, 1.08);
          f._pendCounter = { t: 0.54, dmg: 15, stun: 0.4, kb: f.face * 280 };
          foe.meleeActive = false;
          foe.attacking = false;
          (g.DV.audio.fireBurst || g.DV.audio.fire)();
        }
      }
    } else if (f.id === "shade") {
      if (which === "a") {
        if (!spend(f, 3, chainKey)) return;
        setAnim(f, "slash"); f.animT = 0; f.locked = 0.55; f.meleeActive = true;
        f._pendKick = { t: 0.48, dmg: [20, 20], range: MELEE + 20, kb: f.face * 220, kick: true };
      } else if (which === "up") {
        if ((f.lastHurt || 0) > 0.8) return;
        if (!spend(f, 1, chainKey)) return;
        addFx(m, "burst", f.x, f.y - 50, { c: "#9b5cff" });
        const tx = clamp(f.cursorX, ARENA_L - 40, ARENA_R + 40);
        const ty = clamp(f.cursorY + 70, 80, FLOOR_Y);
        setAnim(f, "teleport");
        f.locked = 0.28;
        f.invuln = Math.max(f.invuln, 0.7);
        f._pendTP = { t: 0.22, x: tx, y: ty };
      } else if (which === "right") {
        if (!spend(f, 3, chainKey)) return;
        const push = rand(5, 20);
        setAnim(f, "proj"); f.locked = 0.7;
        f._pendProj = { t: 0.42, kind: "shadow", speed: 500, dmg: [push, push], extra: { stun: 0.3, kb: 680, life: 0.5, r: 40, oshield: 20 - push } };
      } else if (which === "down") {
        if (!spend(f, 4, chainKey)) return;
        f.invuln = 2; f.ultStyle = "shadowmode"; f.shadowMode = 2; setAnim(f, "mode"); f.locked = 0.28;
        addFx(m, "burst", f.x, f.y - 40, { c: "#4b1a88", life: 0.6 });
      }
    } else if (f.id === "lumen") {
      if (which === "a") {
        if (!spend(f, 4, chainKey)) return;
        const dir = Math.sign(f.cursorX - f.x) || f.face;
        startDash(m, f, dir, 1680, [10, 15], 0);
        f._dashHit = true;
        f._dashBonus = foe.shockMark > 0 ? 1.5 : 1;
      } else if (which === "left" || which === "right") {
        if (which === "right" && f.energy >= 3) {
          if (!spend(f, 3, chainKey)) return;
          setAnim(f, "multi"); f.locked = 0.96; f._pendMulti = { t: 0.88, dmg: rand(5, 20) };
        } else {
          if (!spend(f, 2, chainKey)) return;
          setAnim(f, "shock"); f.locked = 0.6; f.meleeActive = true;
          f._pendShock = { t: 0.48, dmg: 5, oshield: 15 };
        }
      } else if (which === "down") {
        if (!spend(f, 3, chainKey)) return;
        f.invuln = 2; f.locked = 2; setAnim(f, "faze"); f.vx = 0;
      }
    } else if (f.id === "tide") {
      if (which === "a") {
        if (!spend(f, 2, chainKey)) return;
        setAnim(f, "whip"); f.locked = 0.62;
        f._pendWhip = { t: 0.38 };
        f._pendProj = { t: 0.12, kind: "whip", speed: 420, dmg: [0, 0], extra: { noDmg: true, r: 34, life: 0.55, kb: 0, fromY: f.y - 80 } };
        addFx(m, "whip", f.x + f.face * 40, f.y - 70, { c: "#4ec8ff", face: f.face, life: 0.55 });
      } else if (which === "down") {
        if (!spend(f, 4, chainKey)) return;
        f.shieldHp = 25; f.shieldT = 2; setAnim(f, "guard"); f.locked = 0.95;
      } else if (which === "left") {
        if (!spend(f, 3, chainKey)) return;
        setAnim(f, "wave"); f.locked = 0.7;
        f._pendWave = { t: 0.18 };
        addFx(m, "wave", f.x + f.face * 40, f.y - 20, { face: f.face, c: "#3aa7ff", life: 0.55 });
      }
    } else if (f.id === "crown") {
      if (which === "a") {
        if (f.metal > 0) return;
        if (!spend(f, 4, chainKey)) return;
        const aimX = f.cursorX;
        const aimY = f.cursorY;
        setAnim(f, "proj", true); f.locked = 1.55; f.animT = 0;
        f._pendProj = {
          t: 1.5,
          kind: "metal",
          speed: 720,
          dmg: [40, 50],
          extra: { r: 18, tx: aimX, ty: aimY, fromY: f.y - 210 }
        };
      } else if (which === "down") {
        if (!spend(f, 3, chainKey)) return;
        f.invuln = 1; f._deflect = 1; setAnim(f, "guard"); f.locked = 1; f.animT = 0;
      } else if (which === "up") {
        if (!spend(f, 6, chainKey)) return;
        f.metal = 6.5; f.dr = Math.max(f.dr, 0.2);
        addOvershield(f, 15);
        setAnim(f, "mode"); f.locked = 1.2; f.animT = 0;
      } else if (which === "left") {
        if (f.metal <= 0) return;
        if (!spend(f, 3, chainKey)) return;
        setAnim(f, "slam"); f.locked = 1.28; f.animT = 0; f.meleeActive = true;
        f._pendSlam = { t: 0.92 };
      } else if (which === "right") {
        if (f.metal <= 0) return;
        if (!spend(f, 2, chainKey)) return;
        setAnim(f, "kick"); f.locked = 1.15; f.animT = 0; f.meleeActive = true;
        f._pendKick = { t: 0.52, dmg: [15, 25], range: MELEE + 32, kb: f.face * 480 };
      }
    } else if (f.id === "viper") {
      if (which === "a") {
        if (!spend(f, 3, chainKey)) return;
        setAnim(f, "bite"); f.animT = 0; f.locked = 0.72; f.meleeActive = true;
        f._pendKick = { t: 0.52, dmg: [5, 10], range: MELEE - 8, kb: f.face * 70, poison: 4, venom: true };
        f._pendProj = null;
      } else if (which === "down") {
        if (!spend(f, 3, chainKey)) return;
        setAnim(f, "gasjump"); f.animT = 0; f.locked = 0.55;
        f.airborne = true; f.jumps = Math.max(f.jumps || 0, 1);
        f.vy = -1480;
        m._gasSlot = ((m._gasSlot || 0) + 1) % 3;
        m.pools.push({ x: f.x, y: f.y - 36, t: 4, owner: f.side, dps: 5, tick: 1, gas: true, slot: m._gasSlot });
        addFx(m, "burst", f.x, f.y - 40, { c: "#46ff6e", life: 0.4 });
      } else if (which === "up") {
        if (f.gasMode > 0) {
          f.gasMode = 0;
          f.flying = 0;
          setAnim(f, "mode_out"); f.animT = 0; f.locked = 0.62;
          return;
        }
        if (!spend(f, 6, chainKey)) return;
        f.gasMode = 2.5;
        f.flying = 2.5;
        f.invuln = 0;
        f._gasTrail = 0.5;
        f._gasDpsAcc = 0;
        f.animBoost = Math.max(f.animBoost || 1, 2.2);
        setAnim(f, "mode"); f.animT = 0; f.locked = 0.32;
      } else if (which === "right") {
        if (!spend(f, 3, chainKey)) return;
        const dir = Math.sign(f.cursorX - f.x) || f.face;
        f.face = dir;
        setAnim(f, "kick"); f.animT = 0;
        f.dashing = true;
        f.vx = dir * 720;
        f.locked = 0.88;
        f.meleeActive = true;
        f._pendKick = { t: 0.8, dmg: [20, 20], range: MELEE + 36, kb: dir * 420, kick: true };
        f.invuln = Math.max(f.invuln, 0.2);
        addFx(m, "dash", f.x, f.y - 50, { c: f.data.color, face: dir });
        if (g.DV.audio && g.DV.audio.whoosh) g.DV.audio.whoosh();
      } else if (which === "left") {
        if (!spend(f, 4, chainKey)) return;
        setAnim(f, "spin"); f.animT = 0; f.locked = 0.48; f.meleeActive = true;
        f._pendKick = { t: 0.4, dmg: [10, 25], range: MELEE + 28, kb: f.face * 80, kick: true };
      }
    }
    if (f.locked > lockBefore || f.anim !== animBefore) {
      registerChain(f, chainKey);
      scaleMoveTiming(f);
    }
  }

  function waterDash(m, f) {
    if (f.id !== "tide" || f.stun > 0 || f.locked > 0) return;
    if (!moveKeyReady(f, f.id + ":wdash")) return;
    if (!spend(f, 1, f.id + ":wdash")) return;
    f.vx = -f.face * 980; f.dashing = true; f.locked = 0.38; setAnim(f, "dash");
    f._healOver = (f._healOver || 0) + 10;
    addFx(m, "dash", f.x, f.y - 40, { c: "#3aa7ff", face: -f.face });
  }

  function activateUlt(m, f) { tryUltra(m, f); }

  function stepFighter(m, f, inp, dt) {
    if (f.freeze > 0) {
      f.freeze = Math.max(0, f.freeze - dt);
      f.hitFlash = Math.max(0, f.hitFlash - dt);
      f.lastHurt = Math.max(0, f.lastHurt - dt);
      if (f.freeze <= 0) {
        f.vx += f.pendingVx;
        f.vy += f.pendingVy;
        f.pendingVx = 0;
        f.pendingVy = 0;
      }
      return;
    }
    f.hitFlash = Math.max(0, f.hitFlash - dt);
    if (f.pendingVx || f.pendingVy) {
      f.vx += f.pendingVx;
      f.vy += f.pendingVy;
      f.pendingVx = 0;
      f.pendingVy = 0;
    }
    if (f.dead) {
      f.vy += GRAVITY * dt;
      f.y += f.vy * dt;
      setAnim(f, f.y > FLOOR_Y + 40 ? "down" : "hurt");
      tickAnim(f);
      return;
    }
    if ((f._energyLock || 0) > 0) f._energyLock = Math.max(0, f._energyLock - dt);
    if ((f._energyLock || 0) <= 0 && (f.stun || 0) <= 0) f.energy = Math.min(10, f.energy + dt);
    tickOvershield(f, dt);
    f.stun = Math.max(0, (f.stun || 0) - dt);
    if ((f._healOver || 0) > 0) {
      f._healAcc2 = (f._healAcc2 || 0) + dt;
      if (f._healAcc2 >= 1) {
        f._healAcc2 = 0;
        f._healOver = Math.max(0, f._healOver - 1);
        f.hp = Math.min(f.maxHp, f.hp + 1);
      }
    }
    if ((f.comboT || 0) > 0) {
      f.comboT -= dt;
      f._comboAcc = (f._comboAcc || 0) + dt;
      if (f._comboAcc >= 0.7) {
        f._comboAcc = 0;
        const foe = m.p[1 - f.side];
        if (foe && !foe.dead) applyDamage(m, f, foe, rand(1, 8), { stun: 0, noHitstop: true });
      }
      if (f.comboT <= 0) { f.comboT = 0; if (f.anim === "combo") setAnim(f, "idle"); }
    }
    if (inp) {
      if (inp.down && !f._cDown) noteComboInput(f, "ArrowDown");
      if ((inp.mod || inp.rightPulse) && !f._cMod) noteComboInput(f, "RightClick");
      if (inp.punch && !f._cPunch) noteComboInput(f, "LeftClick");
      f._cDown = !!inp.down; f._cMod = !!(inp.mod || inp.rightPulse); f._cPunch = !!inp.punch;
    }
    f.invuln = Math.max(0, f.invuln - dt);
    f.locked = Math.max(0, Math.min(2.8, f.locked) - dt);
    if (f._pendProj) {
      f._pendProj.t -= dt;
      if (f._pendProj.t <= 0) {
        const p = f._pendProj;
        f._pendProj = null;
        spawnProj(m, f, p.kind, p.speed, p.dmg, p.extra);
        if (p.kind === "fireball") (g.DV.audio.fireBurst || g.DV.audio.fire)();
      }
    }
    if (f._pendSlam) {
      f._pendSlam.t -= dt;
      if (f._pendSlam.t <= 0) {
        f._pendSlam = null;
        const foe = m.p[1 - f.side];
        if (!foe.dead && Math.abs(f.x - foe.x) < MELEE + 36 && Math.abs(f.y - foe.y) < 140) {
          applyDamage(m, f, foe, (f._pendSlam && f._pendSlam.dmg) || rand(15, 25), { stun: 1, kb: f.face * 160, down: true });
          foe.pendingVy += 220;
          setAnim(foe, "down");
          foe.locked = Math.max(foe.locked, 0.9);
        }
      }
    }
    if (f._pendMulti) {
      f._pendMulti.t -= dt;
      if (f._pendMulti.t <= 0) {
        f._pendMulti = null;
        const foe = m.p[1 - f.side];
        if (Math.abs(f.x - foe.x) < MELEE + 24) {
          applyDamage(m, f, foe, (f._pendMulti && f._pendMulti.dmg) || rand(5, 20), { kb: f.face * 180 });
        }
      }
    }
    if (f._pendWave) {
      f._pendWave.t -= dt;
      if (f._pendWave.t <= 0) {
        f._pendWave = null;
        spawnProj(m, f, "water", 560, [5, 5], { kb: 420, stun: 0.3, slow: 3, r: 52, life: 0.72, y: f.y - 70, vy: 0, vx: f.face * 560, whipBack: 2 });
      }
    }
    if (f._pendWhip) {
      f._pendWhip.t -= dt;
      if (f._pendWhip.t <= 0) {
        f._pendWhip = null;
        const foe2 = m.p[1 - f.side];
        if (foe2 && Math.abs(foe2.x - f.x) < 370) {
          const dist = Math.abs(foe2.x - f.x);
          const fall = Math.max(0, Math.min(1, (dist - 40) / 330));
          const dmg = Math.round(5 + fall * 15);
          applyDamage(m, f, foe2, dmg, { kb: f.face * (140 + fall * 120) });
        }
      }
    }
    if (f._pendShock) {
      f._pendShock.t -= dt;
      if (f._pendShock.t <= 0) {
        f._pendShock = null;
        const foe = m.p[1 - f.side];
        if (Math.abs(f.x - foe.x) < MELEE + 16) {
          applyDamage(m, f, foe, 5, { oshield: 15 });
          foe.shockMark = 2;
          addOvershield(f, 15);
        }
      }
    }
    if (f._pendKick) {
      f._pendKick.t -= dt;
      if (f._pendKick.t <= 0) {
        const k = f._pendKick;
        f._pendKick = null;
        const foe = m.p[1 - f.side];
        const d = Math.abs(f.x - foe.x);
        const reach = k.range != null ? k.range : MELEE + 8;
        const dmg = k.dmg ? rand(k.dmg[0], k.dmg[1]) : rand(10, 20);
        const kb = k.kb != null ? k.kb : f.face * 420;
        if (d < reach) {
          applyDamage(m, f, foe, dmg, {
            kb, stun: k.stun || 0, poison: k.poison || 0, lift: k.lift || 0,
            kick: !!k.kick, biteMark: k.biteMark || 0, noDmg: !!k.noDmg,
            oshield: k.oshield || 0
          });
          if (k.comboFinisher && !foe.dead) startCombo(m, f, foe);
          if (k.venom) { foe.poison = 4; foe._venomFrom = f.side; foe._venomDps = dmg; }
          if (k.oshield) addOvershield(f, k.oshield);
          if (k.biteMark) foe.biteMark = Math.max(foe.biteMark || 0, k.biteMark);
          if (k.gasBurst) addFx(m, "burst", foe.x, foe.y - 80, { c: "#3dff6a", life: 0.38 });
          if (k.ultHeal) f.hp = Math.min(f.maxHp, f.hp + k.ultHeal);
          if (k.shadeUlt || (f.id === "shade" && f.ult > 0)) { f.hp = Math.min(f.maxHp, f.hp + (k.shadeUlt ? 5 : 20)); m.blackout[foe.side] = 1; }
        }
        if (k.gasBurst) {
          spawnProj(m, f, "gascloud", 280, [0, 0], {
            life: 0.9, r: 36, stun: 2, noDmg: true,
            fromY: f.y - 130, tx: f.x + f.face * 160, ty: f.y - 130
          });
        }
      }
    }
    if (f._pendCounter) {
      f._pendCounter.t -= dt;
      if (f._pendCounter.t <= 0) {
        const c = f._pendCounter;
        f._pendCounter = null;
        const foe = m.p[1 - f.side];
        applyDamage(m, f, foe, c.dmg, { stun: c.stun, kb: c.kb });
      }
    }
    if (f._pendTP) {
      f._pendTP.t -= dt;
      if (f._pendTP.t <= 0) {
        const tp = f._pendTP;
        f._pendTP = null;
        f.x = tp.x;
        f.y = tp.y;
        if (f.y < FLOOR_Y - 8) { f.airborne = true; f.vy = 0; }
        else { f.airborne = false; f.vy = 0; }
        addFx(m, "burst", f.x, f.y - 50, { c: "#9b5cff" });
        setAnim(f, "teleport_in");
        f.locked = 0.26;
      }
    }
    if (f._pendUlt) {
      f._pendUlt -= dt;
      if (f._pendUlt <= 0) {
        f._pendUlt = 0;
        if (f.id === "inferna") {
          f.ult = 30;
          f.dmgMul = 1.5;
          addFx(m, "burst", f.x, f.y - 70, { c: "#ff6a1a", life: 0.7 });
          (g.DV.audio.fireBurst || g.DV.audio.fire)();
        } else if (f.id === "shade") {
          f.ult = 30;
          addFx(m, "burst", f.x, f.y - 70, { c: "#9b5cff", life: 0.7 });
        } else if (f.id === "lumen") {
          const foe = m.p[1 - f.side];
          f.ult = 30;
          f.hp = Math.min(f.maxHp, f.hp + 15);
          foe.slow = Math.max(foe.slow, 30);
          addFx(m, "burst", f.x, f.y - 70, { c: "#ffe14a", life: 0.7 });
        }
      }
    }
    const wasShadow = (f.shadowMode || 0) > 0;
    f.shadowMode = Math.max(0, (f.shadowMode || 0) - dt);
    if (wasShadow && f.shadowMode <= 0 && f.id === "shade") f.ultStyle = "";
    tickChains(f, dt);
    f.burn = Math.max(0, f.burn - dt);
    f.poison = Math.max(0, f.poison - dt);
    f.slow = Math.max(0, f.slow - dt);
    f.shockMark = Math.max(0, f.shockMark - dt);
    f.biteMark = Math.max(0, (f.biteMark || 0) - dt);
    const hadShield = f.shieldT > 0 && f.shieldHp > 0;
    f.shieldT = Math.max(0, f.shieldT - dt);
    if (f.shieldT <= 0) f.shieldHp = 0;
    if (hadShield && f.shieldT <= 0 && f.id === "tide") {
      const foe = m.p[1 - f.side];
      if (foe && !foe.dead && Math.abs(f.x - foe.x) < MELEE && Math.abs(f.y - foe.y) < 160) {
        applyDamage(m, f, foe, 5, { kb: f.face * 90 });
        addFx(m, "burst", foe.x, foe.y - 60, { c: "#4ec8ff", life: 0.35 });
      }
    }
    const wasMetal = f.metal > 0;
    f.metal = Math.max(0, f.metal - dt);
    if (wasMetal && f.metal <= 0 && f.id === "crown") {
      setAnim(f, "mode_out"); f.locked = 1.15; f.animT = 0;
      if (f.flying <= 0) f.dr = 0;
    }
    if (f.flying > 0 && f.id === "inferna") {
      f._flySfx = (f._flySfx || 0) + dt;
      if (f._flySfx >= 0.45) {
        f._flySfx = 0;
        if (g.DV.audio.fireSizzle) g.DV.audio.fireSizzle();
      }
    }
    f.flying = Math.max(0, f.flying - dt);
    const wasGas = f.gasMode > 0;
    f.gasMode = Math.max(0, (f.gasMode || 0) - dt);
    if (wasGas && f.gasMode <= 0 && f.id === "viper" && f.anim !== "mode_out") {
      setAnim(f, "mode_out"); f.locked = Math.max(f.locked, 0.65); f.animT = 0;
    }
    if (f.gasMode > 0 && f.id === "viper") {
      f.invuln = 0;
      f.flying = Math.max(f.flying, f.gasMode);
      f._gasTrail = (f._gasTrail || 0) + dt;
      if (f._gasTrail >= 0.45) {
        f._gasTrail = 0;
        m._gasSlot = ((m._gasSlot || 0) + 1) % 3;
        m.pools.push({ x: f.x, y: f.y - 36, t: 1.5, owner: f.side, dps: rand(1, 5), tick: 1, gas: true, slot: m._gasSlot });
      }
      f._gasDpsAcc = (f._gasDpsAcc || 0) + dt;
      if (f._gasDpsAcc >= 1) {
        f._gasDpsAcc = 0;
        const foe = m.p[1 - f.side];
        if (foe && !foe.dead && Math.abs(foe.x - f.x) < 110 && Math.abs(foe.y - f.y) < 140) {
          applyDamage(m, f, foe, 5, { noHitstop: true });
          addFx(m, "burst", foe.x, foe.y - 90, { c: "#46ff6e", life: 0.35 });
        }
      }
    }
    f.ult = Math.max(0, f.ult - dt);
    if (f.ult <= 0) { if (f.id === "inferna") f.dmgMul = 1; }
    f.lastHurt = Math.max(0, f.lastHurt - dt);
    f.animT += dt;
    tickAnim(f);
    f.meleeActive = f.meleeActive && f.locked > 0.05;
    if (f.dashing && f.locked <= 0) {
      f.dashing = false;
      if (Math.abs(f.vx) > MOVE) f.vx = Math.sign(f.vx) * MOVE;
    }

    if (f._multi > 0) {
      f._multiAcc += dt;
      if (f._multiAcc >= 0.2) {
        f._multiAcc = 0; f._multi -= 1;
        const foe = m.p[1 - f.side];
        if (Math.abs(f.x - foe.x) < MELEE + 10) applyDamage(m, f, foe, 2, { multi: true });
        setAnim(f, "punch", true); f.animT = 0;
        if (f._multi <= 0) f.locked = 0.1;
      }
    }

    if (f.burn > 0) {
      f._burnAcc = (f._burnAcc || 0) + dt;
      if (f._burnAcc >= 1) {
        f._burnAcc = 0;
        f.hp = Math.max(0, f.hp - (f.burnDps || rand(5, 10)));
        f.hitFlash = 0.22;
        f.burnFlash = 0.28;
        f.lastHurt = 0.28;
        floatDmg(m, f.x, f.y - 140, 5);
        if (g.DV.audio.fireSizzle) g.DV.audio.fireSizzle();
        else g.DV.audio.fire();
        if (f.hp <= 0) f.dead = true;
      }
    }
    f.burnFlash = Math.max(0, (f.burnFlash || 0) - dt);
    if (f.poison > 0) {
      f._poiAcc = (f._poiAcc || 0) + dt;
      if (f._poiAcc >= 1) { f._poiAcc = 0; f.hp = Math.max(0, f.hp - 5); floatDmg(m, f.x, f.y - 140, 5); if (f.hp <= 0) f.dead = true; }
    }
    if (m.rain > 0 && f.id === "tide") {
      f._healAcc = (f._healAcc || 0) + dt;
      if (f._healAcc >= 1) { f._healAcc = 0; f.hp = Math.min(f.maxHp, f.hp + 3); }
    }

    const canAct = f.stun <= 0 && f.locked <= 0 && m.phase === "fight";
    const spd = MOVE * (f.slow > 0 ? 0.5 : 1) * ((f.biteMark || 0) > 0 ? 0.75 : 1);

    if (inp && inp.cursor) {
      f.cursorX = inp.cursor.x;
      f.cursorY = inp.cursor.y;
    }
    f.face = f.cursorX >= f.x ? 1 : -1;
    if (m.practice && (f.dummy || f.side === 1)) {
      const foe = m.p[1 - f.side];
      if (foe) f.face = foe.x >= f.x ? 1 : -1;
      f.vx = 0;
      if (f.dummy && !f.airborne) f.x = f._homeX != null ? f._homeX : f.x;
    }

    if (f.emoting) {
      const cut = inp && (inp.left || inp.right || inp.up || inp.down || inp.jump || inp.punch || inp.mod || inp.ult || inp.moveId || inp.waterDash);
      if (cut || f.stun > 0 || f.locked <= 0) stopEmote(f);
      else f.vx = 0;
    }
    if (inp && inp.emote && !f.emoting) tryEmote(m, f);

    if (inp && inp.down && !inp.mod && !f._downWas) applyRush(f);
    f._downWas = !!(inp && inp.down && !inp.mod);

    if (canAct && inp) {
      if (inp.left) f.vx = -spd;
      else if (inp.right) f.vx = spd;
      else if (!f.dashing) f.vx *= 0.7;

      if ((f.flying > 0 && (f.id === "inferna" || f.id === "crown")) || (f.id === "viper" && f.gasMode > 0)) {
        if (inp.up || inp.jumpHeld) f.vy = -spd;
        else if (inp.down) f.vy = spd;
        else f.vy *= 0.85;
        if (inp.left) f.vx = -spd;
        else if (inp.right) f.vx = spd;
        else f.vx *= 0.85;
      } else if (inp.mod && inp.up && f.id === "inferna") {
        special(m, f, "up");
      } else if (!inp.mod && inp.jump && !f.airborne) {
        f.vy = -JUMP_V; f.airborne = true; f.jumps = 1; setAnim(f, "jump", true);
      } else if (!inp.mod && inp.jump && f.airborne && f.jumps === 1 && f.id === "inferna") {
        if (spend(f, 1)) { f.vy = -DJUMP_V; f.jumps = 2; f._canSlam = true; setAnim(f, "djump"); }
      }

      if (f.id === "inferna" && f._canSlam && f.airborne && inp.down && !inp.mod) {
        f._wantSlam = true;
        special(m, f, "down");
      }

      if (inp.waterDash) waterDash(m, f);
      if (inp.moveId) {
        tryNamedMove(m, f, inp.moveId);
      } else if (!tryCustomMoves(m, f, inp)) {
        if (inp.ult) activateUlt(m, f);
        else if (inp.punch && !inp.mod) tryPunch(m, f);
        else if (inp.mod) {
          if (inp.punch) special(m, f, "a");
          else if (inp.up) special(m, f, "up");
          else if (inp.down) special(m, f, "down");
          else if (inp.left) special(m, f, "left");
          else if (inp.right) special(m, f, "right");
        }
      }
    } else if (!f.dashing && f.stun <= 0) {
      f.vx *= 0.82;
    }

    if (f.flying > 0 || (f.id === "viper" && f.gasMode > 0)) {
      f.airborne = true;
      if (f.y < 90) { f.y = 90; if (f.vy < 0) f.vy = 0; }
      if (f.y > FLOOR_Y - 8) { f.y = FLOOR_Y - 8; if (f.vy > 0) f.vy = 0; }
    } else {
      f.vy += GRAVITY * dt;
    }
    f.x += f.vx * dt;
    f.y += f.vy * dt;
    if (f.dashing) {
      const edgeL = ARENA_L + 12;
      const edgeR = ARENA_R - 12;
      if (f._dashPierce) {
        f._trailAcc = (f._trailAcc || 0) + dt;
        if (f._trailAcc >= 0.016) {
          f._trailAcc = 0;
          addFx(m, "trail", f.x, f.y, { c: f.data.color2 || "#ffe24a", face: Math.sign(f.vx) || f.face, life: 0.26 });
        }
      }
      if (f.x <= edgeL) { f.x = edgeL; f.vx = 0; }
      if (f.x >= edgeR) { f.x = edgeR; f.vx = 0; }
    }

    if (f._launched > 0) f._launched = Math.max(0, f._launched - dt);

    const fy = floorY(m);
    const onPad = arenaScroll(m) || (f.x >= ARENA_L && f.x <= ARENA_R);
    if (f.flying <= 0 && f.y >= fy && onPad && !(f._launched > 0 && Math.abs(f.vx) > 180)) {
      if (f._slam) {
        f._slam = false;
        addFx(m, "burst", f.x, fy, { c: "#ff6a1a", life: 0.55 });
        const foe = m.p[1 - f.side];
        if (Math.abs(f.x - foe.x) < 160 && foe.y >= fy - 80)
          applyDamage(m, f, foe, rand(20, 30), { stun: 0.3, kb: f.face * 200 });
      }
      const wasAir = f.airborne || f.vy > 80;
      f.y = fy; f.vy = 0; f.airborne = false; f.jumps = 0; f._canSlam = false;
      if (wasAir && f.locked <= 0 && f.stun <= 0 && !f.dashing) {
        setAnim(f, "land");
        f.locked = Math.max(f.locked, 0.14);
      }
    } else if (!arenaScroll(m) && !f.dashing && (f.x < ARENA_L || f.x > ARENA_R)) {
      f.airborne = true;
      if (f.y >= fy - 4) f.vy = Math.max(f.vy, 320);
      if (f.x < ARENA_L) f.vx = Math.min(f.vx, -120);
      if (f.x > ARENA_R) f.vx = Math.max(f.vx, 120);
    }

    if (arenaBlast(m) && (f.y > fy + 180 || f.x < 20 || f.x > CANVAS_W - 20)) {
      f.dead = true; f.fallen = true; f.hp = 0;
    } else if (arenaScroll(m) && f.y > fy + 8) {
      f.y = fy; f.vy = 0; f.airborne = false;
    }

    if (f.locked <= 0 && f.stun <= 0 && !f.dashing) {
      if (f.flying > 0) setAnim(f, "fly");
      else if (f.airborne) setAnim(f, f.vy < 0 ? "jump" : "fall");
      else if (Math.abs(f.vx) > 80) setAnim(f, "run");
      else if (Math.abs(f.vx) > 40) setAnim(f, "walk");
      else if (f.id === "lumen" && f.invuln > 0.2) setAnim(f, "faze");
      else if (f.id === "shade" && (f.shadowMode || 0) > 0) setAnim(f, "idle");
      else setAnim(f, "idle");
    }
  }

  function bodyCollide(m) {
    const a = m.p[0], b = m.p[1];
    if (a.dead || b.dead) return;
    if ((a.dashing && a._dashPierce) || (b.dashing && b._dashPierce)) return;
    if (a.invuln > 0 || b.invuln > 0) return;
    if ((a._launched > 0 && Math.abs(a.vx) > 160) || (b._launched > 0 && Math.abs(b.vx) > 160)) return;
    if (a.stun > 0.05 && Math.abs(a.vx) > 220) return;
    if (b.stun > 0.05 && Math.abs(b.vx) > 220) return;
    const dx = b.x - a.x;
    if (Math.abs(dx) < BODY_W && Math.abs(a.y - b.y) < BODY_H) {
      if (a.dashing && b.dashing) {
        a.pendingVx += -Math.sign(dx || 1) * 420;
        b.pendingVx += Math.sign(dx || 1) * 420;
        a.dashing = b.dashing = false; a.stun = b.stun = 0.25;
        addFx(m, "burst", (a.x + b.x) / 2, a.y - 50, { c: "#fff", life: 0.35 });
        applyHitstop(m, a, b, 16, { crit: true });
        return;
      }
      const dir = Math.sign(dx || 1);
      const gap = BODY_W + 1;
      if (a.vx * dir > 0) { a.x = b.x - dir * gap; a.vx = 0; }
      if (b.vx * -dir > 0) { b.x = a.x + dir * gap; b.vx = 0; }
      if (Math.abs(b.x - a.x) < BODY_W) {
        a.x = b.x - dir * gap;
        a.vx = 0;
      }
    }
  }

  function stepProjectiles(m, dt) {
    const keep = [];
    for (const p of m.projectiles) {
      p.x += p.vx * dt; p.y += p.vy * dt; p.life -= dt;
      const foe = m.p[1 - p.owner];
      if (foe._deflect > 0) {
        const att = m.p[p.owner];
        p.owner = foe.side;
        const ang = Math.atan2(foe.cursorY - p.y, foe.cursorX - p.x);
        p.vx = Math.cos(ang) * 700; p.vy = Math.sin(ang) * 700;
        foe._deflect = 0;
      }
      const bodyX = foe.x;
      const headY = foe.y - BODY_H;
      const chestY = foe.y - 110;
      const hipY = foe.y - 52;
      const rad = 34 + (p.r || 16);
      const hit = !foe.dead && (
        Math.hypot(p.x - bodyX, p.y - headY) < rad ||
        Math.hypot(p.x - bodyX, p.y - chestY) < rad ||
        Math.hypot(p.x - bodyX, p.y - hipY) < rad
      );
      if (hit) {
        const att = m.p[p.owner];
        const dmg = Array.isArray(p.dmg) ? rand(p.dmg[0], p.dmg[1]) : p.dmg;
        applyDamage(m, att, foe, dmg, {
          stun: p.stun || 0,
          kb: (p.kb || 120) * Math.sign(p.vx || att.face),
          biteMark: p.biteMark || 0,
          noDmg: !!p.noDmg || (Array.isArray(p.dmg) && p.dmg[0] === 0 && p.dmg[1] === 0)
        });
        if (p.biteMark) foe.biteMark = Math.max(foe.biteMark || 0, p.biteMark);
        if (p.burn) { foe.burn = Math.max(foe.burn, p.burn); if (p.burnDps) foe.burnDps = p.burnDps; }
        if (p.long || p.kind === "fireball" || p.kind === "water" || p.kind === "metal" || p.kind === "shadow" || p.kind === "venom") addUltra(att, 1);
        if (p.kind === "metalUltra") p._direct = true;
        if (p.slow) foe.slow = Math.max(foe.slow || 0, p.slow);
        if (p.poison) foe.poison = Math.max(foe.poison || 0, p.poison);
        addFx(m, "burst", p.x, p.y, { c: att.data.color });
      } else if (p.kind === "metalUltra" && (p.y >= floorY(m) - 8 || p.x < 40 || p.x > 1240 || p.life <= 0)) {
        const att = m.p[p.owner];
        addFx(m, "burst", p.x, Math.min(p.y, floorY(m) - 10), { c: "#ffd24a", life: 0.55 });
        addFx(m, "spark", p.x, floorY(m) - 20, { c: "#fff", life: 0.4 });
        if (!p._direct && foe && !foe.dead && Math.abs(foe.x - p.x) < 240) {
          applyDamage(m, att, foe, p.splash || 15, { kb: Math.sign(foe.x - p.x || 1) * 180, noUltra: true });
        }
      } else if (p.life > 0 && p.x > -80 && p.x < 1360 && p.y < floorY(m) + 20) keep.push(p);
    }
    m.projectiles = keep;
    m.pools = m.pools.filter((pl) => {
      pl.t -= dt;
      const foe = m.p[1 - pl.owner];
      if (!foe.dead && Math.abs(foe.x - pl.x) < (pl.gas ? 88 : 70) && Math.abs((foe.y - 40) - pl.y) < (pl.gas ? 90 : 80)) {
        if (pl.gas) {
          pl._acc = (pl._acc || 0) + dt;
          if (pl._acc >= 1) {
            pl._acc = 0;
            const att = m.p[pl.owner];
            applyDamage(m, att, foe, rand(1, 5), { noHitstop: true });
            addFx(m, "burst", foe.x, foe.y - 90, { c: "#46ff6e", life: 0.4 });
            addFx(m, "spark", foe.x, foe.y - 110, { c: "#b6ff8a", life: 0.22 });
          }
        } else {
          pl._acc = (pl._acc || 0) + dt;
          const tick = pl.tick || 1;
          if (pl._acc >= tick) {
            pl._acc = 0;
            const att = m.p[pl.owner];
            applyDamage(m, att, foe, pl.dps, { noHitstop: true });
            if (pl.slow) foe.slow = Math.max(foe.slow, 3);
          }
        }
      }
      return pl.t > 0;
    });
    m.p.forEach((f) => { if (f._deflect) f._deflect = Math.max(0, f._deflect - dt); });
  }

  function stepFx(m, dt) {
    m.fx = m.fx.filter((e) => { e.t += dt; return e.t < e.life; });
    m.floats = m.floats.filter((e) => { e.t += dt; e.y -= 40 * dt; return e.t < 0.8; });
    m.shake *= 0.86;
    const tideRain = (m.p || []).some((f) => f && f.id === "tide" && (f.ult || 0) > 0);
    if (tideRain) m.rain = Math.max(m.rain, 8);
    else m.rain = Math.max(0, m.rain - dt);
    m.blackout[0] = Math.max(0, m.blackout[0] - dt);
    m.blackout[1] = Math.max(0, m.blackout[1] - dt);
  }

  function beginKo(m, win, matchOver) {
    m.phase = "ko";
    m.phaseT = 0;
    m.koHold = 0;
    m.koReady = false;
    m.roundWinner = win;
    m.winner = win;
    m.matchOver = !!matchOver;
    m.overlay = m.p[win].data.name + " WINS!";
    const loser = m.p[1 - win];
    const winner = m.p[win];
    setAnim(loser, "down", true);
    loser.locked = 4;
    loser.vx = 0;
    setAnim(winner, "idle", true);
    winner.locked = 4;
    winner.vx = 0;
  }

  function checkRound(m) {
    if (m.phase !== "fight") return;
    const a = m.p[0], b = m.p[1];
    if (m.practice) {
      if (a.dead || b.dead) {
        const win = a.dead ? 1 : 0;
        m.score[win] = (m.score[win] || 0) + 1;
        m.deaths = m.deaths || [0, 0];
        m.deaths[1 - win] = (m.deaths[1 - win] || 0) + 1;
        beginKo(m, win, false);
      }
      return;
    }
    let win = null;
    if (a.dead && !b.dead) win = 1;
    else if (b.dead && !a.dead) win = 0;
    else if (a.dead && b.dead) win = (a.hp >= b.hp) ? 1 : 0;
    if (win != null) {
      m.score[win] = (m.score[win] || 0) + 1;
      m.deaths = m.deaths || [0, 0];
      m.deaths[1 - win] = (m.deaths[1 - win] || 0) + 1;
      const timeUp = !m.sudden && (m.matchClock || 0) >= (m.matchLimit || 60);
      beginKo(m, win, !!timeUp);
      return;
    }
    if (!m.sudden && (m.matchClock || 0) >= (m.matchLimit || 60)) endByClock(m);
  }

  function endByClock(m) {
    if (m.ended || m.phase === "matchend") return;
    if ((m.score[0] || 0) === (m.score[1] || 0)) {
      m.sudden = true;
      m.overlay = "SUDDEN DEATH";
      resetRound(m);
      return;
    }
    const w = m.score[0] > m.score[1] ? 0 : 1;
    beginKo(m, w, true);
  }

  function resetRound(m) {
    m.time = 0; m.projectiles = []; m.pools = []; m.fx = []; m.floats = [];
    m.rain = 0; m.blackout = [0, 0]; m.hitstop = 0; m.shake = 0;
    m.p.forEach((f, i) => {
      const fresh = fighter(f.id, i);
      fresh.skin = f.skin || "default";
      fresh.emoteId = f.emoteId || f.emote || "pass";
      fresh.ultra = f.ultra || 0;
      fresh._ultraDmg = f._ultraDmg || 0;
      fresh.cursorX = f.cursorX; fresh.cursorY = f.cursorY;
      fresh._homeX = f._homeX;
      fillUses(fresh);
      rollCombo(fresh);
      m.p[i] = fresh;
    });
    const fy = floorY(m);
    m.p.forEach((f, i) => { f.y = fy; f.x = i === 0 ? 280 : 1000; });
    m.phase = "countdown"; m.phaseT = 0; m.overlay = m.sudden ? "SUDDEN DEATH" : "3";
  }

  function step(m, inputs, dt) {
    dt = dt || DT;
    if (m.ended) return m;

    if (m.phase === "countdown") {
      m.phaseT += dt;
      if (m.phaseT < 1) m.overlay = m.sudden ? "SUDDEN DEATH" : "3";
      else if (m.phaseT < 2) m.overlay = "2";
      else if (m.phaseT < 3) m.overlay = "1";
      else if (m.phaseT < 3.4) m.overlay = "FIGHT!";
      else { m.phase = "fight"; m.overlay = ""; m.time = 0; }
      if (!m.practice && !m.sudden) {
        m.matchClock = (m.matchClock || 0) + dt;
        if (m.matchClock >= (m.matchLimit || 60)) endByClock(m);
      }
      m.p.forEach((f, i) => stepFighter(m, f, null, dt));
      updateCamera(m);
      return m;
    }

    if (m.phase === "roundend" || m.phase === "ko") {
      m.phaseT += dt;
      m.p.forEach((f) => {
        f.vx = 0;
        f.locked = Math.max(f.locked, 0.2);
        f.animT = (f.animT || 0) + dt;
        if (f.anim === "down" && f.animT >= 0.85) m.koReady = true;
      });
      if (m.phaseT >= 0.9) m.koReady = true;
      if (m.koReady) m.koHold = (m.koHold || 0) + dt;
      if ((m.koHold || 0) >= 1.2) {
        if (m.practice) { resetRound(m); return m; }
        if (!m.sudden && (m.matchClock || 0) >= (m.matchLimit || 60) && (m.score[0] || 0) === (m.score[1] || 0)) {
          m.sudden = true;
          resetRound(m);
          return m;
        }
        if (m.matchOver || (!m.sudden && (m.matchClock || 0) >= (m.matchLimit || 60))) {
          m.ended = true;
          m.winner = (m.score[0] === m.score[1]) ? m.roundWinner : (m.score[0] > m.score[1] ? 0 : 1);
          m.phase = "matchend";
          m.overlay = m.p[m.winner].data.name + " WINS!";
        } else {
          m.round += 1;
          resetRound(m);
        }
      }
      updateCamera(m);
      return m;
    }

    if (m.phase === "fight") {
      const frozen = m.hitstop > 0 || m.p[0].freeze > 0 || m.p[1].freeze > 0;
      if (!frozen) {
        m.time += dt;
        if (!m.practice && !m.sudden) m.matchClock = (m.matchClock || 0) + dt;
      }
      else m.hitstop = Math.max(0, m.hitstop - dt);
      if (m.timing && !m.timing.done) {
        m.timing.t += dt;
        const inp = inputs[m.timing.side];
        if (inp && inp.punch) { stopTiming(m, false); inp.punch = false; }
        if (m.timing && m.timing.side === 1 && m.mode !== "local" && m.timing.t >= 0.55 * m.timing.dur) stopTiming(m, false);
        else if (m.timing.t >= m.timing.dur) stopTiming(m, true);
      }
      m.p.forEach((f) => {
        if (!f || f.dead) return;
        f._uTime = (f._uTime || 0) + dt;
        if (f._uTime >= 0.5) { f._uTime -= 0.5; addUltra(f, 1); }
        const empty = usesEmpty(f);
        if (empty && !f._emptyPaid) { f._emptyPaid = true; addUltra(f, 3); }
        if (!empty) f._emptyPaid = false;
        if (f._ultraPose > 0) {
          f._ultraPose -= dt;
          if (f._ultraPose <= 0) beginUltraEffect(m, f, f._ultraZone || "red");
        }
        if (f.ultraOn > 0) {
          f.ultraOn = Math.max(0, f.ultraOn - dt);
          if (f.id === "tide") {
            f._uHeal = (f._uHeal || 0) + dt;
            if (f._uHeal >= 1) { f._uHeal = 0; f.hp = Math.min(f.maxHp, f.hp + 5); }
            m.rain = Math.max(m.rain || 0, f.ultraOn);
          }
          if (f.id === "lumen") {
            const foe = m.p[1 - f.side];
            if (foe) foe.slow = Math.max(foe.slow || 0, 0.2);
            m.lumenTint = Math.max(m.lumenTint || 0, f.ultraOn);
          }
          if (f.id === "shade") {
            const foe = m.p[1 - f.side];
            if (foe) m.blackout[foe.side] = Math.max(m.blackout[foe.side] || 0, f.ultraOn);
          }
          if (f.ultraOn <= 0 && f.id === "inferna") f.dmgMul = 1;
        }
      });
      if (m.viperWave) {
        const w = m.viperWave;
        w.r += 1100 * dt;
        w.life -= dt;
        const foe = m.p[1 - w.owner];
        if (!w.hit && foe && !foe.dead) {
          const dist = Math.hypot(foe.x - w.x, (foe.y - 70) - w.y);
          if (dist <= w.r) {
            w.hit = true;
            const dmg = dist < 160 ? 50 : dist < 420 ? 25 : 10;
            applyDamage(m, m.p[w.owner], foe, dmg, { poison: w.poison, noUltra: true });
            foe.poison = Math.max(foe.poison || 0, w.poison);
            foe._poiDps = 5;
          }
        }
        if (w.r > 1500 || w.life <= 0) m.viperWave = null;
      }
      if (m.lumenTint) m.lumenTint = Math.max(0, m.lumenTint - dt);
      if (m.viperTint) m.viperTint = Math.max(0, m.viperTint - dt);
      stepFighter(m, m.p[0], frozen ? null : inputs[0], dt);
      stepFighter(m, m.p[1], frozen ? null : inputs[1], dt);
      if (!frozen) {
        bodyCollide(m);
        stepProjectiles(m, dt);
        function dashPassHit(f, foe) {
          if (!f.dashing || f._dashConsumed || !f._dashHit) return;
          if (Math.abs(f.x - foe.x) < BODY_W + 36 && Math.abs(f.y - foe.y) < BODY_H) {
            const marked = foe.shockMark > 0;
            const mul = marked ? 1.5 : 1;
            applyDamage(m, f, foe, rand(10, 15) * mul, { kb: 0 });
            f._dashConsumed = true;
            if (marked) foe.shockMark = 0;
          }
        }
        dashPassHit(m.p[0], m.p[1]);
        dashPassHit(m.p[1], m.p[0]);
        stepStudioHazards(m);
        checkRound(m);
      }
      updateCamera(m);
      stepFx(m, dt);
    }
    return m;
  }

  g.DV = g.DV || {};
  g.DV.engine = {
    createMatch, step, DT, FLOOR_Y, floorY, ARENA_L, ARENA_R, BODY_W, BODY_H, CANVAS_W, CANVAS_H, setAnim,
    USE_MAX, USE_NAME, USE_INPUT, overshieldAmt, comboLabel, endPractice: function (m) { if (m) { m.ended = true; m.phase = "matchend"; m.winner = 0; } }
  };
})(window);

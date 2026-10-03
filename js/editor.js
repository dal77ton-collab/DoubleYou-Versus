(function (g) {
  const PASS = "Gamez4life";
  const KEY = "DV_MASTER_V1";
  const ANIM_LIST = ["idle","walk","run","jump","fall","land","crouch","crouchpunch","turn","dash","dashback","block","hurt","knockback","down","getup","win","ult"];
  const KEY_OPTS = [
    "ArrowLeft","ArrowRight","ArrowUp","ArrowDown",
    "LeftClick","RightClick","DoubleLeftClick","DoubleRightClick",
    "Shift","Space","KeyQ","KeyE","KeyR","KeyF","KeyC","KeyZ","KeyX","KeyV",
  ];
  const KEY_LABEL = {
    ArrowLeft: "Left Arrow", ArrowRight: "Right Arrow", ArrowUp: "Up Arrow", ArrowDown: "Down Arrow",
    LeftClick: "Left Click", RightClick: "Right Click", DoubleLeftClick: "Double Left Click",
    DoubleRightClick: "Double Right Click", Shift: "Shift", Space: "Space",
    KeyQ: "Q", KeyE: "E", KeyR: "R", KeyF: "F", KeyC: "C", KeyZ: "Z", KeyX: "X", KeyV: "V",
  };

  let defaults = null;
  let charId = "inferna";
  let selKind = "anim";
  let selId = "idle";
  let clip = { loop: true, frames: [] };
  let playing = false;
  let slow = false;
  let speed = 1;
  let frameI = 0;
  let holdLeft = 0;
  let raf = 0;
  let undo = [];
  let redo = [];
  let atlasImg = {};
  let lib = [];
  let replaceIndex = -1;
  let pickMode = "add";

  function freezeDefaults() {
    if (defaults) return;
    defaults = {
      chars: JSON.parse(JSON.stringify(g.DV.DATA.CHARACTERS)),
      sprites: JSON.parse(JSON.stringify(g.DV.SPRITES)),
    };
  }
  function loadPatch() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}"); } catch (e) { return {}; }
  }
  function savePatch(p) { localStorage.setItem(KEY, JSON.stringify(p)); }

  function parseInput(str) {
    if (!str) return [];
    const s = String(str).toLowerCase();
    const out = [];
    if (s.includes("double left")) out.push("DoubleLeftClick");
    else if (s.includes("left click")) out.push("LeftClick");
    if (s.includes("double right")) out.push("DoubleRightClick");
    else if (s.includes("right click")) out.push("RightClick");
    if (s.includes("left arrow") || s.endsWith("+ left") || s.includes("+ left") && !s.includes("click")) out.push("ArrowLeft");
    if (s.includes("right arrow") || (s.includes("+ right") && !s.includes("click"))) out.push("ArrowRight");
    if (s.includes("+ up") || s.includes("up arrow")) out.push("ArrowUp");
    if (s.includes("+ down") || s.includes("down arrow")) out.push("ArrowDown");
    if (s.includes("shift")) out.push("Shift");
    if (s.includes("space")) out.push("Space");
    return out.filter((v, i, a) => a.indexOf(v) === i);
  }

  function applySaved() {
    freezeDefaults();
    const p = loadPatch();
    if (!p.chars) return;
    Object.keys(p.chars).forEach((id) => {
      const src = p.chars[id];
      const dst = g.DV.DATA.CHARACTERS[id];
      if (!dst || !src) return;
      if (src.moves) {
        dst.moves = dst.moves.map((m) => {
          const over = src.moves[m.id];
          if (!over) return m;
          const next = Object.assign({}, m, over);
          next.dmg = [over.dmgMin != null ? over.dmgMin : (m.dmg ? m.dmg[0] : 0), over.dmgMax != null ? over.dmgMax : (m.dmg ? m.dmg[1] : 0)];
          if (over.controls) next.controls = over.controls.slice();
          return next;
        });
      }
      if (src.clips && g.DV.SPRITES.chars[id]) {
        Object.keys(src.clips).forEach((clipName) => {
          g.DV.SPRITES.chars[id][clipName] = JSON.parse(JSON.stringify(src.clips[clipName]));
        });
      }
    });
  }

  function snapshot() {
    undo.push(JSON.stringify(loadPatch()));
    if (undo.length > 40) undo.shift();
    redo = [];
  }

  function currentMove() {
    const c = g.DV.DATA.CHARACTERS[charId];
    return (c.moves || []).find((m) => m.id === selId) || null;
  }

  function framePool(id) {
    const pack = g.DV.SPRITES.chars[id] || {};
    const seen = {};
    const out = [];
    Object.keys(pack).forEach((k) => {
      (pack[k].frames || []).forEach((fr) => {
        const key = fr.x + "," + fr.y;
        if (seen[key]) return;
        seen[key] = 1;
        out.push({ x: fr.x, y: fr.y, w: fr.w, h: fr.h, hold: fr.hold || 4, clip: k });
      });
    });
    return out;
  }

  function loadClip() {
    const pack = g.DV.SPRITES.chars[charId] || {};
    const src = pack[selId] || pack.idle || { loop: false, frames: [] };
    clip = JSON.parse(JSON.stringify({ loop: !!src.loop, frames: src.frames || [] }));
    frameI = 0;
    holdLeft = clip.frames[0] ? clip.frames[0].hold : 4;
  }

  function drawFrame(ctx, fr, img, x, y, dw, dh) {
    if (!fr || !img || !img.complete) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, fr.x, fr.y, fr.w, fr.h, x, y, dw, dh);
  }

  function openPicker(mode, index) {
    pickMode = mode;
    replaceIndex = index == null ? -1 : index;
    const ov = document.getElementById("edPicker");
    const grid = document.getElementById("edPickerGrid");
    grid.innerHTML = "";
    lib = framePool(charId);
    lib.forEach((fr) => {
      const wrap = document.createElement("div");
      wrap.className = "fr";
      wrap.title = fr.clip;
      const cv = document.createElement("canvas");
      cv.width = 56; cv.height = 84;
      drawFrame(cv.getContext("2d"), fr, atlasImg[charId], 0, 0, 56, 84);
      const cap = document.createElement("div");
      cap.textContent = fr.clip;
      cap.style.fontSize = "10px";
      wrap.appendChild(cv);
      wrap.appendChild(cap);
      wrap.onclick = () => {
        snapshot();
        const cell = { x: fr.x, y: fr.y, w: fr.w, h: fr.h, hold: fr.hold || 4 };
        if (pickMode === "replace" && replaceIndex >= 0) clip.frames[replaceIndex] = cell;
        else clip.frames.push(cell);
        ov.classList.remove("show");
        paintTimeline();
      };
      grid.appendChild(wrap);
    });
    ov.classList.add("show");
  }

  function paintLib() {
    const root = document.getElementById("edLib");
    if (!root) return;
    root.innerHTML = "";
    framePool(charId).forEach((fr) => {
      const wrap = document.createElement("div");
      wrap.className = "fr";
      wrap.title = "Add " + fr.clip;
      const cv = document.createElement("canvas");
      cv.width = 40; cv.height = 60;
      drawFrame(cv.getContext("2d"), fr, atlasImg[charId], 0, 0, 40, 60);
      wrap.appendChild(cv);
      wrap.onclick = () => { snapshot(); clip.frames.push({ x: fr.x, y: fr.y, w: fr.w, h: fr.h, hold: fr.hold || 4 }); paintTimeline(); };
      root.appendChild(wrap);
    });
  }

  function paintTimeline() {
    const root = document.getElementById("edFrames");
    if (!root) return;
    root.innerHTML = "";
    clip.frames.forEach((fr, i) => {
      const chip = document.createElement("div");
      chip.className = "ed-chip";
      chip.draggable = true;
      chip.dataset.i = String(i);
      const cv = document.createElement("canvas");
      cv.width = 48; cv.height = 72;
      drawFrame(cv.getContext("2d"), fr, atlasImg[charId], 0, 0, 48, 72);
      chip.appendChild(cv);
      const lab = document.createElement("div");
      lab.textContent = "FRAME " + (i + 1);
      chip.appendChild(lab);
      const inp = document.createElement("input");
      inp.type = "number"; inp.min = "1"; inp.max = "30"; inp.value = fr.hold || 4;
      inp.title = "Frame hold";
      inp.onchange = () => { snapshot(); clip.frames[i].hold = Math.max(1, +inp.value || 4); };
      chip.appendChild(inp);
      const row = document.createElement("div");
      row.style.display = "flex"; row.style.gap = "3px";
      const mk = (t, fn) => { const b = document.createElement("button"); b.className = "btn"; b.textContent = t; b.onclick = fn; return b; };
      row.appendChild(mk("DUP", () => { snapshot(); clip.frames.splice(i + 1, 0, JSON.parse(JSON.stringify(clip.frames[i]))); paintTimeline(); }));
      row.appendChild(mk("SWAP", () => openPicker("replace", i)));
      row.appendChild(mk("DELETE", () => {
        snapshot();
        clip.frames.splice(i, 1);
        if (frameI >= clip.frames.length) frameI = Math.max(0, clip.frames.length - 1);
        paintTimeline();
      }));
      chip.appendChild(row);
      chip.ondragstart = (e) => e.dataTransfer.setData("text/plain", String(i));
      chip.ondragover = (e) => e.preventDefault();
      chip.ondrop = (e) => {
        e.preventDefault();
        const from = +e.dataTransfer.getData("text/plain");
        const to = +chip.dataset.i;
        if (from === to) return;
        snapshot();
        const item = clip.frames.splice(from, 1)[0];
        clip.frames.splice(to, 0, item);
        paintTimeline();
      };
      root.appendChild(chip);
    });
  }

  function controlChips(mv) {
    let cur = (mv.controls && mv.controls.slice()) || parseInput(mv.input) || [];
    return cur;
  }

  function paintProps() {
    const box = document.getElementById("edProps");
    if (!box) return;
    const mv = currentMove();
    if (!mv) {
      box.innerHTML = `<h2>ANIMATION</h2>
        <label>LOOP</label><select id="edLoop"><option value="1"${clip.loop?" selected":""}>YES</option><option value="0"${clip.loop?"":" selected"}>NO</option></select>
        <p class="ed-log">This is a locomotion/reaction clip. Use ADD FRAME and the timeline. Controls and combat stats are on Moves.</p>`;
      const sel = box.querySelector("#edLoop");
      if (sel) sel.onchange = () => { clip.loop = sel.value === "1"; };
      return;
    }
    const ctr = controlChips(mv);
    box.innerHTML = `
      <h2>MOVE CONTROLS</h2>
      <div id="ctrlList" class="row"></div>
      <select id="ctrlAdd">${KEY_OPTS.map((k) => `<option value="${k}">${KEY_LABEL[k]||k}</option>`).join("")}</select>
      <button class="btn" id="ctrlPlus">ADD INPUT</button>
      <button class="btn" id="ctrlClear">CLEAR INPUTS</button>
      <p class="ed-log" id="ctrlPreview">Combo: ${ctr.map((t)=>KEY_LABEL[t]||t).join(" + ") || "(none — uses default)"}</p>
      <h2>MOVE PROPERTIES</h2>
      <label>MOVE NAME</label><input id="pName" value="${mv.name || ""}" />
      <label>ENERGY COST</label><input id="pEn" type="number" value="${mv.energy || 0}" />
      <label>MIN DAMAGE</label><input id="pDmin" type="number" value="${(mv.dmg&&mv.dmg[0])||0}" />
      <label>MAX DAMAGE</label><input id="pDmax" type="number" value="${(mv.dmg&&mv.dmg[1])||0}" />
      <label>RANGE</label>
      <select id="pRange"><option>melee</option><option>mid</option><option>long</option><option>none</option></select>
      <label>STUN (sec)</label><input id="pStun" type="number" step="0.05" value="${mv.stun || 0}" />
      <label>KNOCKBACK</label><input id="pKb" type="number" value="${mv.kb || 0}" />
      <label>KB DIRECTION</label><select id="pKbDir"><option>away</option><option>up</option><option>down</option></select>
      <label>MOVE DISTANCE</label><input id="pDist" type="number" value="${mv.moveDist || 0}" />
      <label>ANIMATION DURATION (sec)</label><input id="pDur" type="number" step="0.05" value="${mv.duration != null ? mv.duration : 0.3}" />
      <label>HITBOX START (sec)</label><input id="pHitS" type="number" step="0.01" value="${mv.hitStart || 0}" />
      <label>HITBOX END (sec)</label><input id="pHitE" type="number" step="0.01" value="${mv.hitEnd || 0.28}" />
      <label>NUMBER OF HITS</label><input id="pHits" type="number" value="${mv.hits || 1}" />
      <label>COOLDOWN (sec)</label><input id="pCd" type="number" step="0.05" value="${mv.cooldown || 0}" />
      <label>INVINCIBILITY (sec)</label><input id="pInv" type="number" step="0.05" value="${mv.invuln || 0}" />
      <label>MOVE SPEED CHANGE</label><input id="pSpd" type="number" value="${mv.moveSpeed || 0}" />
      <label>HEAL</label><input id="pHeal" type="number" value="${mv.heal || 0}" />
      <label>BURN (sec)</label><input id="pBurn" type="number" value="${mv.burn || 0}" />
      <label>POISON (sec)</label><input id="pPoi" type="number" value="${mv.poison || 0}" />
      <label>SLOW (sec)</label><input id="pSlow" type="number" value="${mv.slow || 0}" />
      <label>NOTES</label><textarea id="pDesc">${mv.desc || ""}</textarea>
    `;
    box.querySelector("#pRange").value = mv.range || "melee";
    if (mv.kbDir) box.querySelector("#pKbDir").value = mv.kbDir;
    let ctrState = ctr.slice();
    const list = box.querySelector("#ctrlList");
    const paintCtr = () => {
      list.innerHTML = "";
      ctrState.forEach((t, i) => {
        const b = document.createElement("button");
        b.className = "btn";
        b.textContent = (KEY_LABEL[t] || t) + " ✕";
        b.onclick = () => { ctrState.splice(i, 1); paintCtr(); };
        list.appendChild(b);
      });
      const prev = box.querySelector("#ctrlPreview");
      if (prev) prev.textContent = "Combo: " + (ctrState.map((t)=>KEY_LABEL[t]||t).join(" + ") || "(none)");
      list.dataset.controls = JSON.stringify(ctrState);
    };
    paintCtr();
    box.querySelector("#ctrlPlus").onclick = () => {
      const v = box.querySelector("#ctrlAdd").value;
      if (!ctrState.includes(v)) ctrState.push(v);
      paintCtr();
    };
    box.querySelector("#ctrlClear").onclick = () => { ctrState = []; paintCtr(); };
  }

  function readProps() {
    const mv = currentMove();
    if (!mv) return null;
    const $ = (id) => document.getElementById(id);
    if (!$("pName")) return null;
    let controls = [];
    const list = document.getElementById("ctrlList");
    try { controls = JSON.parse(list.dataset.controls || "[]"); } catch (e) { controls = []; }
    return {
      name: $("pName").value,
      energy: +$("pEn").value || 0,
      dmgMin: +$("pDmin").value || 0,
      dmgMax: +$("pDmax").value || 0,
      dmg: [+$("pDmin").value || 0, +$("pDmax").value || 0],
      range: $("pRange").value,
      stun: +$("pStun").value || 0,
      kb: +$("pKb").value || 0,
      kbDir: $("pKbDir").value,
      moveDist: +$("pDist").value || 0,
      duration: +$("pDur").value || 0,
      hitStart: +$("pHitS").value || 0,
      hitEnd: +$("pHitE").value || 0,
      hits: +$("pHits").value || 1,
      cooldown: +$("pCd").value || 0,
      invuln: +$("pInv").value || 0,
      moveSpeed: +$("pSpd").value || 0,
      heal: +$("pHeal").value || 0,
      burn: +$("pBurn").value || 0,
      poison: +$("pPoi").value || 0,
      slow: +$("pSlow").value || 0,
      desc: $("pDesc").value,
      anim: selId,
      controls,
      input: controls.map((t) => KEY_LABEL[t] || t).join(" + "),
    };
  }

  function tickPreview() {
    const cv = document.getElementById("edCanvas");
    if (!cv) { raf = requestAnimationFrame(tickPreview); return; }
    const ctx = cv.getContext("2d");
    ctx.fillStyle = "#0b0d14";
    ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.fillStyle = "rgba(255,210,80,.25)";
    ctx.fillRect(20, cv.height - 18, cv.width - 40, 3);
    const img = atlasImg[charId];
    const fr = clip.frames[frameI];
    if (fr && img) drawFrame(ctx, fr, img, cv.width / 2 - 48, cv.height - 18 - 144, 96, 144);
    ctx.fillStyle = "#ffe08a";
    ctx.font = "12px sans-serif";
    ctx.fillText((frameI + 1) + " / " + clip.frames.length + (playing ? "  PLAYING" : "  PAUSED"), 10, 16);
    if (playing && clip.frames.length) {
      holdLeft -= speed * (slow ? 0.35 : 1);
      if (holdLeft <= 0) {
        frameI += 1;
        if (frameI >= clip.frames.length) {
          if (clip.loop) frameI = 0;
          else { frameI = clip.frames.length - 1; playing = false; }
        }
        holdLeft = (clip.frames[frameI] && clip.frames[frameI].hold) || 4;
      }
    }
    raf = requestAnimationFrame(tickPreview);
  }

  function confirmModal(msg, yes) {
    const el = document.getElementById("edConfirm");
    el.querySelector(".msg").textContent = msg;
    el.classList.add("show");
    el.querySelector(".yes").onclick = () => { el.classList.remove("show"); yes(); };
    el.querySelector(".no").onclick = () => el.classList.remove("show");
  }

  function persistMove() {
    const props = readProps();
    if (!props) return false;
    const patch = loadPatch();
    patch.chars = patch.chars || {};
    patch.chars[charId] = patch.chars[charId] || { moves: {}, clips: {} };
    patch.chars[charId].moves[selId] = props;
    savePatch(patch);
    applySaved();
    return true;
  }
  function persistAnim() {
    const patch = loadPatch();
    patch.chars = patch.chars || {};
    patch.chars[charId] = patch.chars[charId] || { moves: {}, clips: {} };
    patch.chars[charId].clips[selId] = { loop: !!clip.loop, frames: clip.frames };
    savePatch(patch);
    applySaved();
  }
  function persistAll() {
    persistAnim();
    persistMove();
    writeGrokNotes();
  }

  function writeGrokNotes() {
    const patch = loadPatch();
    const lines = [
      "DOUBLEYOU VERSUS — Master Editor briefing",
      "Saved: " + new Date().toISOString(),
      "Use this file/paste when asking Grok to update the game.",
      ""
    ];
    Object.keys(patch.chars || {}).forEach((id) => {
      const ch = patch.chars[id];
      lines.push("CHARACTER " + id.toUpperCase());
      Object.keys(ch.moves || {}).forEach((mid) => {
        const m = ch.moves[mid];
        lines.push("  MOVE " + mid + " name=" + (m.name || mid) +
          " energy=" + (m.energy || 0) +
          " dmg=" + (m.dmgMin || 0) + "-" + (m.dmgMax || 0) +
          " stun=" + (m.stun || 0) +
          " kb=" + (m.kb || 0) +
          " duration=" + (m.duration || 0) +
          " cooldown=" + (m.cooldown || 0) +
          " controls=" + ((m.controls || []).join("+") || "default"));
      });
      Object.keys(ch.clips || {}).forEach((cid) => {
        const cl = ch.clips[cid];
        lines.push("  ANIM " + cid + " frames=" + ((cl.frames || []).length) + " loop=" + !!cl.loop);
      });
      lines.push("");
    });
    const text = lines.join("\n");
    const payload = { savedAt: new Date().toISOString(), text, patch };
    localStorage.setItem("DV_GROK_BRIEFING", JSON.stringify(payload));
    return { text, payload };
  }

  function copyGrokNotes() {
    const { text, payload } = writeGrokNotes();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "doubleyou-editor-notes.json";
    a.click();
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
    return text;
  }

  function goMainMenu() {
    if (g.DV.ui && g.DV.ui.goMenu) g.DV.ui.goMenu();
    else {
      document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
      const menu = document.getElementById("menu");
      if (menu) menu.classList.add("active");
    }
  }

  function testMove() {
    const mv = currentMove();
    const log = document.getElementById("edLog");
    const lines = [
      "TEST  " + charId.toUpperCase() + " → " + selId,
      mv ? ("Damage " + ((mv.dmg && mv.dmg[0]) || 0) + "–" + ((mv.dmg && mv.dmg[1]) || 0)) : "Animation only",
      mv ? ("Energy " + (mv.energy || 0) + "  Stun " + (mv.stun || 0) + "s  KB " + (mv.kb || 0)) : "",
      mv ? ("Controls " + ((mv.controls || []).map((t) => KEY_LABEL[t] || t).join(" + ") || "default")) : "",
    ].filter(Boolean);
    if (log) log.textContent = lines.join("\n");
    playing = true; frameI = 0; holdLeft = clip.frames[0] ? clip.frames[0].hold : 4;
  }

  function breadcrumb() {
    const c = g.DV.DATA.CHARACTERS[charId];
    const mv = currentMove();
    return c.name + "  →  " + (mv ? mv.name : selId.toUpperCase()) + "  →  " + selId.toUpperCase();
  }

  function renderShell() {
    const root = document.getElementById("edRoot");
    root.innerHTML = `
      <div class="ed-top">
        <h2>MASTER EDITOR</h2>
        <div id="edPath">${breadcrumb()}</div>
        <button class="btn" id="edSaveMove">SAVE MOVE</button>
        <button class="btn" id="edSaveAnim">SAVE ANIMATION</button>
        <button class="btn" id="edApply">APPLY CHANGES</button>
        <button class="btn" id="edReset">RESET CHANGES</button>
        <button class="btn" id="edUndo">UNDO</button>
        <button class="btn" id="edRedo">REDO</button>
        <button class="btn" id="edTest">TEST MOVE</button>
        <button class="btn" id="edCopyNotes">COPY NOTES FOR GROK</button>
        <button class="btn" id="edSaveExit">SAVE & MAIN MENU</button>
        <button class="btn" id="edExit">MAIN MENU</button>
      </div>
      <div class="ed-col ed-char" id="edChars"></div>
      <div class="ed-col" id="edLists"></div>
      <div class="ed-preview">
        <canvas id="edCanvas" width="420" height="240"></canvas>
        <div class="row">
          <button class="btn" id="edPlay">PLAY ANIMATION</button>
          <button class="btn" id="edPause">PAUSE</button>
          <button class="btn" id="edStop">RESTART</button>
          <button class="btn" id="edPrev">STEP BACK</button>
          <button class="btn" id="edNext">STEP FWD</button>
          <button class="btn" id="edSlow">SLOW</button>
        </div>
        <label>ANIMATION SPEED <input id="edSpeed" type="range" min="0.25" max="2" step="0.25" value="1" /></label>
        <div class="row">
          <button class="btn" id="edAddFrame">ADD FRAME</button>
          <button class="btn" id="edDelFrame">DELETE FRAME</button>
        </div>
        <div class="ed-log" id="edLog"></div>
        <div class="ed-lib" id="edLib"></div>
      </div>
      <div class="ed-col ed-props" id="edProps"></div>
      <div class="ed-tl">
        <div style="margin-bottom:6px;color:#ffe08a">TIMELINE — drag to reorder — number is how long that frame stays on screen</div>
        <div class="ed-frames" id="edFrames"></div>
      </div>
      <div id="edConfirm"><div class="box"><p class="msg"></p><div class="row"><button class="btn yes">YES</button><button class="btn no">CANCEL</button></div></div></div>
      <div id="edPicker"><div class="box" style="max-width:760px;max-height:80vh;overflow:auto">
        <h2>CHOOSE A SPRITE</h2>
        <p>Only ${charId.toUpperCase()} frames from the provided sheet.</p>
        <div class="ed-lib" id="edPickerGrid"></div>
        <button class="btn" id="edPickerClose">CANCEL</button>
      </div></div>
    `;
    const chars = document.getElementById("edChars");
    Object.values(g.DV.DATA.CHARACTERS).forEach((c) => {
      const d = document.createElement("div");
      d.className = "ed-item" + (c.id === charId ? " sel" : "");
      d.innerHTML = `<img src="assets/bodies/${c.id}.png" /> ${c.name}`;
      d.onclick = () => { charId = c.id; selKind = "anim"; selId = "idle"; refresh(); };
      chars.appendChild(d);
    });
    const lists = document.getElementById("edLists");
    const c = g.DV.DATA.CHARACTERS[charId];
    lists.innerHTML = "<h2>ANIMATIONS</h2>";
    ANIM_LIST.forEach((id) => {
      const d = document.createElement("div");
      d.className = "ed-item" + (selKind === "anim" && selId === id ? " sel" : "");
      d.textContent = id.toUpperCase();
      d.onclick = () => { selKind = "anim"; selId = id; loadClip(); paintTimeline(); paintProps(); paintLib(); document.getElementById("edPath").textContent = breadcrumb(); };
      lists.appendChild(d);
    });
    const h = document.createElement("h2");
    h.style.marginTop = "10px";
    h.textContent = "MOVES";
    lists.appendChild(h);
    (c.moves || []).forEach((m) => {
      const d = document.createElement("div");
      d.className = "ed-item" + (selKind === "move" && selId === m.id ? " sel" : "");
      d.textContent = m.name;
      d.onclick = () => { selKind = "move"; selId = m.id; loadClip(); paintTimeline(); paintProps(); paintLib(); document.getElementById("edPath").textContent = breadcrumb(); };
      lists.appendChild(d);
    });
    paintLib();
    paintTimeline();
    paintProps();
    bind();
  }

  function bind() {
    const $ = (id) => document.getElementById(id);
    $("edPlay").onclick = () => { playing = true; if (frameI >= clip.frames.length - 1) { frameI = 0; holdLeft = clip.frames[0] ? clip.frames[0].hold : 4; } };
    $("edPause").onclick = () => { playing = false; };
    $("edStop").onclick = () => { playing = false; frameI = 0; holdLeft = clip.frames[0] ? clip.frames[0].hold : 4; };
    $("edPrev").onclick = () => { playing = false; frameI = Math.max(0, frameI - 1); };
    $("edNext").onclick = () => { playing = false; frameI = Math.min(clip.frames.length - 1, frameI + 1); };
    $("edSlow").onclick = () => { slow = !slow; $("edSlow").textContent = slow ? "NORMAL SPEED" : "SLOW"; };
    $("edSpeed").oninput = (e) => { speed = +e.target.value; };
    $("edAddFrame").onclick = () => openPicker("add");
    $("edDelFrame").onclick = () => {
      if (!clip.frames.length) { $("edLog").textContent = "No frames to delete."; return; }
      snapshot();
      clip.frames.splice(frameI, 1);
      frameI = Math.max(0, Math.min(frameI, clip.frames.length - 1));
      holdLeft = clip.frames[frameI] ? clip.frames[frameI].hold : 4;
      paintTimeline();
      $("edLog").textContent = "Deleted frame. Save Animation to keep it.";
    };
    $("edPickerClose").onclick = () => $("edPicker").classList.remove("show");
    $("edTest").onclick = testMove;
    $("edSaveMove").onclick = () => {
      if (!currentMove()) { $("edLog").textContent = "Select a MOVE, not just an animation."; return; }
      confirmModal("Save changes to " + breadcrumb() + "?", () => {
        snapshot(); persistMove(); writeGrokNotes();
        $("edLog").textContent = "Move saved and applied to the live game.";
        confirmModal("Saved. Return to the main menu?", goMainMenu);
      });
    };
    $("edSaveAnim").onclick = () => {
      confirmModal("Save animation frames for " + breadcrumb() + "?", () => {
        snapshot(); persistAnim(); writeGrokNotes();
        $("edLog").textContent = "Animation saved and applied to the live game.";
        confirmModal("Saved. Return to the main menu?", goMainMenu);
      });
    };
    $("edApply").onclick = () => {
      confirmModal("Apply all current edits for " + g.DV.DATA.CHARACTERS[charId].name + " to live matches?", () => {
        snapshot(); persistAll();
        $("edLog").textContent = "Applied to live matches.";
        confirmModal("Saved. Return to the main menu?", goMainMenu);
      });
    };
    $("edCopyNotes").onclick = () => {
      const text = copyGrokNotes();
      $("edLog").textContent = "Notes copied and downloaded. Paste that file/text to Grok on the next update.";
    };
    $("edSaveExit").onclick = () => {
      confirmModal("Save all editor changes and return to the main menu?", () => {
        snapshot(); persistAll(); copyGrokNotes(); goMainMenu();
      });
    };
    $("edExit").onclick = goMainMenu;
    $("edReset").onclick = () => {
      confirmModal("Reset " + breadcrumb() + " back to original defaults?", () => {
        snapshot();
        const patch = loadPatch();
        if (patch.chars && patch.chars[charId]) {
          if (patch.chars[charId].moves) delete patch.chars[charId].moves[selId];
          if (patch.chars[charId].clips) delete patch.chars[charId].clips[selId];
          savePatch(patch);
        }
        g.DV.DATA.CHARACTERS[charId] = JSON.parse(JSON.stringify(defaults.chars[charId]));
        g.DV.SPRITES.chars[charId] = JSON.parse(JSON.stringify(defaults.sprites.chars[charId]));
        applySaved();
        refresh();
      });
    };
    $("edUndo").onclick = () => {
      if (!undo.length) return;
      redo.push(JSON.stringify(loadPatch()));
      localStorage.setItem(KEY, undo.pop());
      applySaved(); refresh();
    };
    $("edRedo").onclick = () => {
      if (!redo.length) return;
      undo.push(JSON.stringify(loadPatch()));
      localStorage.setItem(KEY, redo.pop());
      applySaved(); refresh();
    };
  }

  function refresh() {
    cancelAnimationFrame(raf);
    loadClip();
    renderShell();
    tickPreview();
  }

  function openEditor() {
    freezeDefaults();
    applySaved();
    ["inferna","shade","lumen","tide","crown","viper"].forEach((id) => {
      if (!atlasImg[id]) {
        const im = new Image();
        im.src = "assets/atlas/" + id + ".png";
        atlasImg[id] = im;
        im.onload = () => { paintLib(); paintTimeline(); };
      }
    });
    charId = "inferna"; selKind = "anim"; selId = "idle";
    refresh();
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById("editor").classList.add("active");
  }

  function checkPass(code) { return String(code || "") === PASS; }

  g.DV = g.DV || {};
  g.DV.editor = { applySaved, freezeDefaults, openEditor, checkPass };
})(window);

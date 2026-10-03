(function (g) {
  const keys = Object.create(null);
  let mouse = { x: 720, y: 400, left: false, right: false, leftClick: false, rightClick: false };
  let lastLeft = 0;
  let lastRight = 0;
  let pendingUlt = false;
  let pendingDRight = false;
  let pendingJump = false;
  let pendingEmote = false;
  const touch = {
    left: false, right: false, up: false, down: false,
    jump: false, punch: false, mod: false, ult: false,
    aimx: 900, aimy: 300
  };
  const tapCount = { punch: 0, special: 0, lastPunch: 0, lastSpecial: 0 };
  const moveQueue = [];

  window.addEventListener("keydown", (e) => {
    if (!keys[e.code] && e.code === "ArrowUp") pendingJump = true;
    if (!keys[e.code] && e.code === "Space") pendingEmote = true;
    keys[e.code] = true;
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
  }, { passive: false });
  window.addEventListener("keyup", (e) => { keys[e.code] = false; });
  window.addEventListener("blur", () => { for (const k in keys) keys[k] = false; });

  function reset() {
    mouse.left = mouse.right = false;
    mouse.leftClick = mouse.rightClick = false;
    pendingUlt = false;
    pendingDRight = false;
    pendingJump = false;
    pendingEmote = false;
    touch.left = touch.right = touch.up = touch.down = touch.jump = touch.punch = touch.mod = touch.ult = false;
    tapCount.punch = tapCount.special = 0;
    moveQueue.length = 0;
    const pad = document.getElementById("pad");
    if (pad) pad.querySelectorAll(".on").forEach((b) => b.classList.remove("on"));
  }

  function bindCanvas(cv) {
    if (cv && cv._dvBound) { reset(); return; }
    if (cv) cv._dvBound = true;
    const map = (e) => {
      const r = cv.getBoundingClientRect();
      mouse.x = ((e.clientX - r.left) / r.width) * 1280;
      mouse.y = ((e.clientY - r.top) / r.height) * 720;
    };
    cv.addEventListener("mousemove", map);
    cv.addEventListener("mousedown", (e) => {
      map(e);
      if (e.button === 0) {
        const now = performance.now();
        if (now - lastLeft < 280) pendingUlt = true;
        lastLeft = now;
        mouse.left = true; mouse.leftClick = true;
      }
      if (e.button === 2) {
        const now = performance.now();
        if (now - lastRight < 280) pendingDRight = true;
        lastRight = now;
        mouse.right = true; mouse.rightClick = true;
      }
      e.preventDefault();
    });
    cv.addEventListener("mouseup", (e) => {
      if (e.button === 0) mouse.left = false;
      if (e.button === 2) mouse.right = false;
    });
    cv.addEventListener("contextmenu", (e) => e.preventDefault());
    cv.addEventListener("touchstart", onTouch, { passive: false });
    cv.addEventListener("touchmove", onTouch, { passive: false });
    cv.addEventListener("touchend", onTouchEnd, { passive: false });
    bindPad();
    rebuildPad();
  }

  function shortMoveName(mv) {
    const n = String((mv && mv.name) || mv.id || "MOVE").toUpperCase();
    if (n.length <= 12) return n;
    return n.replace(/^(ULT OF |THE )/, "").split(" ").slice(0, 2).join("\n");
  }

  function rebuildPad(charId) {
    const box = document.getElementById("padMoves");
    if (!box) return;
    const id = charId || (g.DV && g.DV._padChar) || "inferna";
    g.DV = g.DV || {};
    g.DV._padChar = id;
    const ch = g.DV.DATA && g.DV.DATA.CHARACTERS && g.DV.DATA.CHARACTERS[id];
    const moves = ((ch && ch.moves) || []).filter((mv) => mv && mv.id && mv.id !== "djump");
    if (!moves.some((mv) => mv.id === "rush")) moves.splice(1, 0, { id: "rush", name: "DOWN" });
    box.innerHTML = "";
    moves.forEach((mv) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "pad-btn pad-move" + (mv.id === "punch" ? " pad-punch" : "") + (mv.id === "ult" ? " pad-ult" : "");
      b.textContent = shortMoveName(mv);
      b.dataset.move = mv.id;
      box.appendChild(b);
    });
  }

  function countTap(kind) {
    const now = performance.now();
    if (kind === "punch") {
      tapCount.punch = (now - tapCount.lastPunch < 320) ? tapCount.punch + 1 : 1;
      tapCount.lastPunch = now;
      if (tapCount.punch >= 2) pendingUlt = true;
    } else if (kind === "special") {
      tapCount.special = (now - tapCount.lastSpecial < 320) ? tapCount.special + 1 : 1;
      tapCount.lastSpecial = now;
      if (tapCount.special >= 2) pendingDRight = true;
    }
  }

  function bindPad() {
    const pad = document.getElementById("pad");
    if (!pad || pad._bound) return;
    pad._bound = true;
    const setKey = (key, on) => {
      if (key === "left") touch.left = on;
      else if (key === "right") touch.right = on;
      else if (key === "up") {
        touch.up = on;
        touch.jump = on;
        if (on) pendingJump = true;
      } else if (key === "down") touch.down = on;
      else if (key === "punch") {
        touch.punch = on;
        if (on) countTap("punch");
      } else if (key === "special") {
        touch.mod = on;
        if (on) {
          countTap("special");
          touch.punch = true;
        } else if (!pad.querySelector('[data-pad="punch"].on')) {
          touch.punch = false;
        }
      }
    };
    pad.querySelectorAll("[data-pad]").forEach((btn) => {
      const key = btn.getAttribute("data-pad");
      const down = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setKey(key, true);
        btn.classList.add("on");
      };
      const up = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setKey(key, false);
        btn.classList.remove("on");
      };
      btn.addEventListener("pointerdown", down);
      btn.addEventListener("pointerup", up);
      btn.addEventListener("pointercancel", up);
      btn.addEventListener("lostpointercapture", up);
      btn.addEventListener("contextmenu", (e) => e.preventDefault());
    });
    const movesBox = document.getElementById("padMoves");
    if (movesBox && !movesBox._bound) {
      movesBox._bound = true;
      const down = (e) => {
        const btn = e.target.closest("[data-move]");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        moveQueue.push(btn.dataset.move);
        btn.classList.add("on");
      };
      const up = (e) => {
        const btn = e.target.closest("[data-move]");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove("on");
      };
      movesBox.addEventListener("pointerdown", down);
      movesBox.addEventListener("pointerup", up);
      movesBox.addEventListener("pointercancel", up);
    }
    window.addEventListener("blur", () => {
      touch.left = touch.right = touch.up = touch.down = touch.jump = touch.punch = touch.mod = touch.ult = false;
      pad.querySelectorAll(".on").forEach((b) => b.classList.remove("on"));
    });
  }

  function aimFromEvent(e, cv) {
    const r = cv.getBoundingClientRect();
    const src = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]);
    if (!src) return;
    const nx = (src.clientX - r.left) / r.width;
    const ny = (src.clientY - r.top) / r.height;
    touch.aimx = nx * 1280;
    touch.aimy = ny * 720;
  }

  function onTouch(e) {
    e.preventDefault();
    aimFromEvent(e, e.currentTarget || e.target);
  }
  function onTouchEnd(e) {
    e.preventDefault();
    aimFromEvent(e, e.currentTarget || e.target);
  }

  function p1() {
    const ult = pendingUlt;
    pendingUlt = false;
    const dRight = pendingDRight;
    pendingDRight = false;
    const punch = mouse.leftClick;
    mouse.leftClick = false;
    const rClick = mouse.rightClick;
    mouse.rightClick = false;
    const usingTouch = "ontouchstart" in window && window.matchMedia("(pointer: coarse)").matches;
    return {
      left: !!keys.ArrowLeft || touch.left,
      right: !!keys.ArrowRight || touch.right,
      up: !!keys.ArrowUp || touch.up,
      down: !!keys.ArrowDown || touch.down,
      jumpHeld: !!keys.ArrowUp || touch.up || touch.jump,
      jump: (function () { const j = pendingJump || touch.jump || touch.up; pendingJump = false; return j; })(),
      emote: (function () { const e = pendingEmote; pendingEmote = false; return e; })(),
      punch: punch || touch.punch,
      mod: mouse.right || touch.mod,
      ult: ult || dRight || touch.ult,
      waterDash: (mouse.right || touch.mod) && (!!keys.ArrowRight || touch.right),
      shift: !!keys.ShiftLeft || !!keys.ShiftRight,
      codes: keys,
      rightPulse: (rClick || (touch.mod && tapCount.special === 1)) && !dRight,
      doubleRight: dRight,
      cursor: usingTouch ? { x: touch.aimx, y: touch.aimy } : { x: mouse.x, y: mouse.y },
      moveId: moveQueue.shift() || null,
    };
  }

  function p2() {
    return {
      left: !!keys.KeyA,
      right: !!keys.KeyD,
      up: !!keys.KeyW,
      down: !!keys.KeyS,
      jump: !!keys.KeyW,
      punch: !!keys.KeyF,
      mod: !!keys.KeyG,
      ult: !!keys.KeyR,
      waterDash: !!keys.KeyG && !!keys.KeyD,
      cursor: { x: keys.KeyA ? 240 : keys.KeyD ? 1040 : 480, y: 480 },
    };
  }

  g.DV = g.DV || {};
  g.DV.input = { bindCanvas, reset, p1, p2, keys, mouse, rebuildPad };
})(window);

(function (g) {
  function think(m, side, difficulty) {
    const me = m.p[side], foe = m.p[1 - side];
    const inp = { left: false, right: false, up: false, down: false, jump: false, punch: false, mod: false, ult: false, waterDash: false, cursor: { x: foe.x, y: foe.y - 60 } };
    if (m.phase !== "fight" || me.dead) return inp;

    const diff = difficulty || "medium";
    const react = diff === "easy" ? 0.22 : diff === "hard" ? 0.88 : 0.68;
    if (Math.random() > react) return inp;

    const dx = foe.x - me.x;
    const dist = Math.abs(dx);
    const dir = Math.sign(dx) || 1;

    if (diff === "easy") {
      if (dist > 180) {
        if (Math.random() < 0.55) { inp.left = dx < 0; inp.right = dx > 0; }
      } else if (dist < 70 && Math.random() < 0.35) {
        inp.left = dx > 0; inp.right = dx < 0;
      } else if (dist < 110 && Math.random() < 0.16) {
        inp.punch = true;
      }
      if (Math.random() < 0.03) inp.jump = true;
      return inp;
    }

    if (m.time >= m.ultUnlock && me.energy >= 10 && me.ult <= 0) {
      if (me.hp < 55 || foe.hp < 40 || m.time > 40) inp.ult = true;
    }

    if (me.hp < 30 && dist < 90 && Math.random() < 0.4) {
      if (me.id === "shade") { inp.mod = true; inp.up = true; inp.cursor.x = me.x - dir * 220; }
      else if (me.id === "lumen") { inp.mod = true; inp.down = true; }
      else if (me.id === "tide") { inp.waterDash = true; inp.down = true; inp.mod = true; inp.left = true; }
      else if (me.id === "viper") { inp.mod = true; inp.right = true; }
      else { inp.left = dir > 0; inp.right = dir < 0; }
      return inp;
    }

    if (dist > 200) {
      inp.left = dx < 0; inp.right = dx > 0;
      if (me.energy >= 3 && Math.random() < 0.35) {
        inp.mod = true; inp.punch = true;
      }
    } else if (dist > 90) {
      if (Math.random() < 0.5) { inp.left = dx < 0; inp.right = dx > 0; }
      if (me.energy >= 3 && Math.random() < 0.4) {
        inp.mod = true;
        const r = Math.random();
        if (r < 0.45) inp.punch = true;
        else if (r < 0.7) inp.left = true;
        else inp.right = true;
      }
    } else {
      if (Math.random() < 0.55) inp.punch = true;
      else if (me.energy >= 3 && Math.random() < 0.5) { inp.mod = true; inp.punch = true; }
      if (foe.attacking && me.energy >= 3 && Math.random() < 0.3) { inp.mod = true; inp.down = true; }
    }

    if (Math.random() < (diff === "hard" ? 0.12 : 0.06)) inp.jump = true;
    return inp;
  }

  g.DV = g.DV || {};
  g.DV.ai = { think };
})(window);

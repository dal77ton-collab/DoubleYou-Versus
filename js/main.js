(function () {
  const $ = (s) => document.querySelector(s);
  const screens = {};
  document.querySelectorAll(".screen").forEach((el) => (screens[el.id] = el));

  let profile = DV.profile.load();
  DV._profile = profile;
  if (!profile.registered && (!profile.name || profile.name === "PLAYER" || !/^PLAYER\d+$/.test(profile.name))) {
    profile.name = DV.profile.guestName();
    DV.profile.save(profile); DV._profile = profile;
  }
  let mode = "quick";
  let selected = "inferna";
  let selected2 = "shade";
  let practiceMap = "studio";
  let localTwo = false;
  let aiDiff = "medium";
  let match = null;
  let raf = 0;
  let acc = 0;
  let last = 0;
  let pending = null;
  let room = null;
  let queueTimer = 0;
  let queueIv = null;
  let queueCh = null;
  let queueId = "";

  function killSplash() {
    const root = document.getElementById("bootSplash");
    if (!root) return;
    root.classList.add("done");
    root.style.display = "none";
    root.style.pointerEvents = "none";
  }

  function show(id) {
    const next = screens[id];
    if (!next) {
      console.warn("missing screen", id);
      id = "menu";
    }
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    (screens[id] || screens.menu).classList.add("active");
    killSplash();
    if (id === "fight") {
      document.body.classList.add("play-landscape");
      try {
        if (screen.orientation && screen.orientation.lock) screen.orientation.lock("landscape").catch(function(){});
      } catch (e) {}
    } else {
      document.body.classList.remove("play-landscape");
    }
    if (id === "menu") playHubVideo();
  }

  function pct(s) { return s.played ? ((s.wins / s.played) * 100).toFixed(0) + "%" : "0%"; }
  function refreshHeader() {
    const r = DV.profile.rankInfo(profile);
    const q = profile.stats.quick, c = profile.stats.competitive;
    const allP = q.played + c.played, allW = q.wins + c.wins;
    if ($("#pname")) {
      $("#pname").textContent = profile.name;
      paintNamePlate($("#pname"), profile);
    }
    const boost = profile.cpBoost || { charges: 0 };
    if ($("#hubBoostLine")) {
      $("#hubBoostLine").style.display = boost.charges > 0 ? "block" : "none";
      $("#hubBoostLine").textContent = "2x CP " + boost.charges + "/25";
    }
    const hubPfp = $("#hubPfp");
    if (hubPfp) {
      const src = DV.profile.pfpSrc(profile);
      hubPfp.style.display = src ? "block" : "none";
      if (src) hubPfp.src = src;
    }
    if ($("#coins")) $("#coins").textContent = profile.coins.toLocaleString();
    if ($("#hubRankLine")) $("#hubRankLine").innerHTML = DV.profile.withRankBadge(r.name);
    if ($("#hubCPLine")) $("#hubCPLine").textContent = (r.quota === Infinity ? String(r.cp) : r.cp + " / " + r.quota) + " CP";
    if ($("#hubStatsBox")) {
      $("#hubStatsBox").innerHTML =
        "<div style='display:grid;grid-template-columns:1fr 1fr;gap:2px 10px'>" +
        "<span>GAMES PLAYED (QUICK)<br><b>" + q.played + "</b></span>" +
        "<span>WIN RATE (QUICK)<br><b>" + pct(q) + "</b></span>" +
        "<span>GAMES PLAYED (COMP)<br><b>" + c.played + "</b></span>" +
        "<span>WIN RATE (COMP)<br><b>" + pct(c) + "</b></span>" +
        "<span style='grid-column:1/-1'>OVERALL WIN RATE <b>" + (allP ? ((allW / allP) * 100).toFixed(0) + "%" : "0%") + "</b></span></div>";
    }
    let bestM = DV.DATA.MASTERY[0];
    Object.keys(profile.chars || {}).forEach((id) => {
      const m = DV.profile.masteryFor(profile.chars[id] || { roundsWon: 0, played: 0, wins: 0 });
      const row = DV.DATA.MASTERY.find((x) => (x.id || x.name) === m.id) || DV.DATA.MASTERY.find((x) => x.name === m.name);
      if (row && DV.DATA.MASTERY.indexOf(row) >= DV.DATA.MASTERY.indexOf(bestM)) bestM = row;
    });
    const nextM = DV.DATA.MASTERY[DV.DATA.MASTERY.indexOf(bestM) + 1];
    if ($("#hubProgBox")) $("#hubProgBox").innerHTML = "";
    if ($("#hubBoardBox")) {
      const top = godlikePlayers().slice(0, 3);
      const rows = [];
      for (let i = 0; i < 3; i++) {
        rows.push(top[i] ? (i + 1) + ". " + top[i].name : (i + 1) + ".");
      }
      $("#hubBoardBox").innerHTML = rows.join("<br>");
    }
  }

  function goMenu() {
    match = null;
    stopWatch();
    stopQueue();
    cancelAnimationFrame(raf);
    DV.audio.startMusic("menu");
    refreshHeader();
    show("menu");
  }
  window.DV = window.DV || {};
  window.DV.ui = { show, goMenu };

  document.querySelectorAll("[data-back]").forEach((b) => b.addEventListener("click", goMenu));
  document.querySelectorAll("#menu [data-go]").forEach((b) => {
    b.addEventListener("click", () => {
      try {
        killSplash();
        DV.audio.ui();
        DV.audio.unlock();
        const go = b.dataset.go;
        if (go === "quick") startSelect("quick", false);
        else if (go === "comp") startSelect("comp", false);
        else if (go === "practice") startSelect("practice", false);
        else if (go === "progress") openProgress();
        else if (go === "charsHub") show("charsHub");
        else if (go === "info") openInfo("details");
        else if (go === "board") openBoard();
        else if (go === "store") openStore();
        else if (go === "campaign") show("campaign");
        else if (go === "settings") openSettings();
        else if (go === "powerpass") openPowerPass();
        else if (go === "friend") show("friend");
        else if (go === "friends") show("friends");
        else if (go === "profile") openProfile();
      } catch (err) {
        console.warn(err);
        show("menu");
      }
    });
  });
  if ($("#btnProfile")) $("#btnProfile").onclick = null;
  const playerCard = $("#hubPlayerCard");
  if (playerCard) {
    playerCard.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      DV.audio.ui();
      openProfile();
    });
  }
  document.querySelectorAll("[data-charsec]").forEach((b) => {
    b.addEventListener("click", () => { DV.audio.ui(); openInfo(b.getAttribute("data-charsec")); });
  });
  if ($("#btnInfoBack")) $("#btnInfoBack").addEventListener("click", () => { DV.audio.ui(); show("charsHub"); });
  if ($("#btnFriendsInvite")) $("#btnFriendsInvite").onclick = () => show("friend");

  function startSelect(m, two) {
    mode = m;
    localTwo = two;
    selected = selected || "inferna";
    selected2 = selected2 || "shade";
    if ($("#selTitle")) $("#selTitle").textContent =
      m === "practice" ? "PRACTICE — SELECT FIGHTER" :
      m === "comp" ? "COMPETITIVE — SELECT FIGHTER" :
      m === "local" ? "LOCAL 1V1 — P1 THEN P2" : "QUICK MATCH — SELECT FIGHTER";
    if ($("#diffRow")) $("#diffRow").style.display = m === "quick" ? "flex" : "none";
    if ($("#mapRow")) $("#mapRow").style.display = "none";
    if ($("#selHint")) $("#selHint").textContent = two
      ? "Click a fighter for Player 1, click READY, then pick Player 2."
      : "Secret pick. Opponent is revealed on the VS screen.";
    try { paintRoster(); } catch (e) { console.warn(e); }
    show("select");
  }

  function currentSkin(id) {
    profile.equipped = profile.equipped || { aura: null, title: null, skin: {}, victory: {}, intro: {}, outro: {} };
    profile.equipped.skin = profile.equipped.skin || {};
    return profile.equipped.skin[id] || "default";
  }

  function setSkin(id, skinId) {
    const def = ((DV.DATA.SKINS && DV.DATA.SKINS[id]) || []).find((s) => s.id === skinId);
    if (def && def.pass && !DV.profile.passUnlocked(profile, id, def.pass)) return;
    profile.equipped = profile.equipped || { aura: null, title: null, skin: {}, victory: {}, intro: {}, outro: {} };
    profile.equipped.skin = profile.equipped.skin || {};
    profile.equipped.skin[id] = skinId;
    DV.profile.save(profile); DV._profile = profile;
  }
  function currentPresent(kind, id) {
    profile.equipped = profile.equipped || { victory: {}, intro: {}, outro: {} };
    profile.equipped[kind] = profile.equipped[kind] || {};
    return profile.equipped[kind][id] || "basic";
  }
  function setPresent(kind, id, value) {
    profile.equipped = profile.equipped || { victory: {}, intro: {}, outro: {} };
    profile.equipped[kind] = profile.equipped[kind] || {};
    profile.equipped[kind][id] = value;
    DV.profile.save(profile); DV._profile = profile;
  }

  function paintNamePlate(el, p) {
    if (!el) return;
    const pass = DV.profile.ensurePass(p);
    const frame = pass.frame && DV.profile.frameUnlocked(p, pass.frame) ? pass.frame : null;
    const banner = pass.banner && DV.profile.bannerUnlocked(p, pass.banner) ? pass.banner : null;
    el.classList.add("name-plate");
    el.style.backgroundImage = banner ? "url('assets/pass/banner/" + banner + ".jpg')" : "none";
    el.style.backgroundSize = "cover";
    el.style.backgroundPosition = "center 30%";
    el.style.borderImage = "none";
    if (frame) {
      el.style.border = "14px solid transparent";
      el.style.borderImage = "url('assets/pass/frame/" + frame + ".jpg') 72 fill";
      el.style.borderImageSlice = "72 fill";
      el.style.borderImageRepeat = "stretch";
    } else {
      el.style.border = "";
    }
    const badge = DV.profile.finalistBadge(p);
    let mark = el.querySelector(".finalist-mini");
    if (badge) {
      if (!mark) {
        mark = document.createElement("img");
        mark.className = "finalist-mini";
        el.appendChild(mark);
      }
      mark.src = "assets/pass/badge/" + badge + ".jpg";
      mark.alt = badge;
    } else if (mark) mark.remove();
  }

  function queueGauntletReveal() {
    const pass = DV.profile.ensurePass(profile);
    const eligible = Object.keys(DV.DATA.CHARACTERS).filter((id) => DV.profile.passLevel(profile, id) >= 10);
    const names = eligible.map((id) => DV.DATA.CHARACTERS[id].name).join(", ");
    const body = document.createElement("div");
    body.className = "screen";
    body.id = "gauntletReveal";
    body.innerHTML = `<div class="panel" style="max-width:720px;text-align:center">
      <img src="assets/pass/badge/bronze.jpg" alt="Season Zero Finalist" style="width:120px;height:120px" />
      <h2 style="color:#ffd24a">SEASON ZERO FINALIST</h2>
      <p class="info-moves">Bronze Finalist badge granted.</p>
      <img src="assets/pass/gauntlet.jpg" alt="Victory Gauntlet" style="width:100%;max-width:420px;margin:10px 0" />
      <h3 style="color:#ffe08a">VICTORY GAUNTLET</h3>
      <p class="info-moves">You are invited. Eligible heroes: ${names || "none yet"}.</p>
      <p class="info-moves">You may only enter on a character that reached Power Pass Level 10.</p>
      <div class="row"><button class="btn" id="btnGauntletOk">CONTINUE</button></div>
    </div>`;
    document.body.appendChild(body);
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    body.classList.add("active");
    $("#btnGauntletOk").onclick = () => { body.remove(); goMenu(); };
  }

  function paintRoster() {
    const root = $("#roster");
    root.innerHTML = "";
    Object.values(DV.DATA.CHARACTERS).forEach((c) => {
      const d = document.createElement("div");
      d.className = "card" + (c.id === selected ? " sel" : "");
      d.innerHTML = `<img src="${skinArt(c.id, currentSkin(c.id))}" alt="${c.name}" onerror="this.onerror=null;this.src='assets/select/${c.id}_panel.jpg'" /><div class="nm">${c.name}</div>`;
      d.onclick = () => { selected = c.id; paintRoster(); DV.audio.ui(); };
      root.appendChild(d);
    });
  }

  document.querySelectorAll("[data-diff]").forEach((b) => {
    b.onclick = () => { aiDiff = b.dataset.diff; DV.audio.ui(); b.parentElement.querySelectorAll(".btn").forEach((x) => x.style.outline = ""); b.style.outline = "2px solid #e8c36a"; };
  });
  function openMapPick() {
    const grid = $("#mapGrid");
    if (grid) {
      grid.innerHTML = "";
      (DV.DATA.ARENAS || []).forEach((a) => {
        const d = document.createElement("button");
        d.className = "map-card";
        d.type = "button";
        d.innerHTML = `<img src="${a.thumb || "assets/arena_play.jpg"}" alt="${a.name}" /><div class="nm">${a.name}</div>`;
        d.onclick = () => {
          practiceMap = a.id;
          DV.audio.ui();
          beginVs();
        };
        grid.appendChild(d);
      });
    }
    show("mapPick");
  }
  if ($("#btnMapBack")) $("#btnMapBack").onclick = () => { DV.audio.ui(); show("select"); };

  let pickStage = 1;
  $("#btnReady").onclick = () => {
    DV.audio.ui();
    if (localTwo && pickStage === 1) {
      selected2wait = selected;
      pickStage = 2;
      $("#selHint").textContent = "Player 2 — select your fighter, then READY.";
      return;
    }
    if (localTwo && pickStage === 2) {
      selected2 = selected;
      selected = selected2wait;
      pickStage = 1;
    }
    if (mode === "comp") startCompetitiveQueue();
    else if (mode === "practice") openMapPick();
    else beginVs();
  };
  let selected2wait = "shade";

  function randomFoe() {
    const ids = Object.keys(DV.DATA.CHARACTERS);
    return ids[Math.floor(Math.random() * ids.length)];
  }

  function stopQueue() {
    if (queueIv) { clearInterval(queueIv); queueIv = null; }
    if (queueCh) { try { queueCh.close(); } catch (e) {} queueCh = null; }
  }

  function startCompetitiveQueue() {
    pending = {
      p1: selected,
      p2: randomFoe(),
      mode: "comp",
      localTwo: false,
      aiDiff: "medium",
      found: false,
      n2: DV.profile.guestName(),
      s1: currentSkin(selected),
      s2: "default",
    };
    queueId = Math.random().toString(36).slice(2, 8);
    queueTimer = 15;
    $("#queueMsg").textContent = "Searching for a ranked opponent…";
    $("#queueTime").textContent = "15";
    show("queue");
    try {
      queueCh = new BroadcastChannel("dv_comp_queue");
      queueCh.onmessage = (ev) => {
        const d = ev.data || {};
        if (!d || d.id === queueId || !pending || pending.found) return;
        if (d.t === "search" || d.t === "hello" || d.t === "accept") {
          pending.found = true;
          pending.p2 = d.char || pending.p2;
          pending.n2 = d.name || "PLAYER";
          if (queueCh) {
            try { queueCh.postMessage({ t: "accept", id: queueId, char: selected, name: profile.name }); } catch (e) {}
          }
          $("#queueMsg").textContent = "Opponent found — " + pending.n2;
          stopQueue();
          setTimeout(beginVs, 600);
        }
      };
      queueCh.postMessage({ t: "search", id: queueId, char: selected, name: profile.name });
    } catch (e) {}
    queueIv = setInterval(() => {
      queueTimer -= 1;
      const el = $("#queueTime");
      if (el) el.textContent = String(Math.max(0, queueTimer));
      if (queueCh) {
        try { queueCh.postMessage({ t: "search", id: queueId, char: selected, name: profile.name }); } catch (e) {}
      }
      if (queueTimer <= 0 && pending && !pending.found) {
        stopQueue();
        pending.n2 = DV.profile.guestName();
        const msg = $("#queueMsg");
        if (msg) msg.textContent = "Opponent found — " + pending.n2;
        setTimeout(beginVs, 700);
      }
    }, 1000);
  }

  const cancelBtn = $("#btnCancelQueue");
  if (cancelBtn) cancelBtn.onclick = () => { stopQueue(); pending = null; goMenu(); };

  function beginVs() {
    if (!pending || pending.mode !== "comp") {
      const p2id = localTwo || mode === "practice" ? (mode === "practice" ? selected : selected2) : randomFoe();
      pending = {
        p1: selected,
        p2: mode === "practice" ? selected : p2id,
        mode,
        localTwo,
        aiDiff,
        n2: localTwo ? "PLAYER 2" : mode === "practice" ? "DUMMY" : DV.profile.guestName(),
        s1: currentSkin(selected),
        s2: mode === "practice" ? currentSkin(selected) : "default",
        arenaId: mode === "practice" ? practiceMap : null,
      };
    }
    try {
      if (DV.render.warmVideos) {
        DV.render.warmVideos(pending.p1);
        DV.render.warmVideos(pending.p2);
      }
      if (DV.render.unlockVideos) DV.render.unlockVideos();
    } catch (e) {}
    paintVs();
    show("vs");
    DV.audio.announce();
    setTimeout(playIntros, 5000);
  }

  function introSrc(charId) {
    const c = DV.DATA.CHARACTERS[charId];
    if (!c) return "";
    const pick = currentPresent("intro", charId);
    if (pick === "phoenix") return "assets/intro/inferna_phoenix.mp4";
    if (pick === "midknight") return "assets/intro/shade_midknight.mp4";
    if (pick === "bright") return "assets/intro/lumen_bright.mp4";
    if (pick === "aqua") return "assets/intro/tide_aqua.mp4";
    if (pick === "queen") return "assets/intro/crown_queen.mp4";
    return c.introVideo || "";
  }
  function outroSrc(charId) {
    const c = DV.DATA.CHARACTERS[charId];
    if (!c) return "";
    const pick = currentPresent("outro", charId);
    if (pick === "phoenix") return "assets/outro/inferna_phoenix.mp4";
    if (pick === "midknight") return "assets/outro/shade_midknight.mp4";
    if (pick === "bright") return "assets/outro/lumen_bright.mp4";
    if (pick === "aqua") return "assets/outro/tide_aqua.webm";
    if (pick === "queen") return "assets/outro/crown_queen.mp4";
    if (pick === "serpent") return "assets/outro/viper_serpent.webm";
    return c.victoryVideo || "";
  }
  function formatPlayTime(ms) {
    const sec = Math.max(0, Math.round((Number(ms) || 0) / 1000));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }
  function fillIntroHud(charId, label, mine) {
    const left = document.getElementById("introLeft");
    const right = document.getElementById("introRight");
    if (!left || !right) return;
    const c = DV.DATA.CHARACTERS[charId] || {};
    const data = mine ? profile : (DV.profile.getPublic(label) || { name: label, rankIndex: 1, cp: 0, chars: {}, powerPass: {} });
    const s = ((data.chars && data.chars[charId]) || (mine ? DV.profile.ensureChar(profile, charId) : { played: 0, wins: 0, timeMs: 0 }));
    const m = DV.profile.masteryFor(s);
    const r = mine ? DV.profile.rankInfo(profile) : (DV.DATA.RANKS[data.rankIndex] || DV.DATA.RANKS[1]);
    const played = Number(s.played) || 0;
    const wins = Number(s.wins) || 0;
    const wr = played ? Math.round((wins / played) * 100) + "%" : "0%";
    const badge = DV.profile.finalistBadge(mine ? profile : data);
    left.innerHTML = `
      <div id="introPlate">${label || data.name || "PLAYER"}</div>
      <div class="intro-stat">RANK<br><b>${DV.profile.withRankBadge(r.name || "ROOKIE")}</b></div>
      <div class="intro-stat">MASTERY<br><b>${DV.profile.withNoviceBadge(m)}</b></div>
      <div class="intro-stat">FIGHTER<br><b>${(c.name || charId).toUpperCase()}</b></div>`;
    paintNamePlate(document.getElementById("introPlate"), mine ? profile : data);
    right.innerHTML = `
      <div class="intro-stat">WIN % ON ${ (c.name || "").toUpperCase() }<br><b>${wr}</b></div>
      <div class="intro-stat">TIME PLAYED<br><b>${formatPlayTime(s.timeMs)}</b></div>
      <div class="intro-stat">GAMES<br><b>${played} PLAYED · ${wins} W</b></div>
      ${badge ? `<div class="intro-stat">SEASON FINALIST<br><img src="assets/pass/badge/${badge}.jpg" alt="" style="height:42px" /></div>` : ""}`;
  }

  function playIntros() {
    if (!pending) { startFight(); return; }
    const seq = [
      { id: pending.p1, label: profile.name },
      { id: pending.p2, label: pending.n2 || "RIVAL" }
    ];
    let i = 0;
    let safety = null;
    const v = document.getElementById("introVid");
    const cap = document.getElementById("introCap");
    function finish() {
      if (safety) { clearTimeout(safety); safety = null; }
      if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (e) {} }
      startFight();
    }
    function next() {
      if (safety) { clearTimeout(safety); safety = null; }
      while (i < seq.length && !introSrc(seq[i].id)) i += 1;
      if (i >= seq.length || !v) { finish(); return; }
      const it = seq[i++];
      const c = DV.DATA.CHARACTERS[it.id];
      show("intro");
      fillIntroHud(it.id, it.label, i === 1);
      if (cap) cap.textContent = (it.label || "") + "  ·  " + ((c && c.name) || "").toUpperCase();
      v.onended = next;
      v.onerror = next;
      v.src = introSrc(it.id);
      v.muted = false;
      v.playsInline = true;
      v.play().catch(() => next());
      safety = setTimeout(next, 7200);
    }
    next();
  }

  function skinFilter(charId, skinId) {
    const list = (DV.DATA.SKINS && DV.DATA.SKINS[charId]) || [];
    const sk = list.find((s) => s.id === (skinId || "default")) || list[0];
    return (sk && sk.filter && sk.filter !== "none") ? sk.filter : "none";
  }
  function skinArt(charId, skinId) {
    const skin = skinId && skinId !== "default" ? skinId : "default";
    return "assets/select/" + charId + "_" + skin + ".jpg";
  }

  function charWinPct(id) {
    const s = DV.profile.ensureChar(profile, id);
    const played = Number(s.played) || 0;
    const wins = Number(s.wins) || 0;
    if (!played) return "0%";
    return Math.round((wins / played) * 100) + "%";
  }
  function paintVs() {
    const c1 = DV.DATA.CHARACTERS[pending.p1];
    const c2 = DV.DATA.CHARACTERS[pending.p2];
    const r = DV.profile.rankInfo(profile);
    const s1 = DV.profile.ensureChar(profile, pending.p1);
    const m1 = DV.profile.masteryFor(s1);
    const p2Name = pending.localTwo ? "PLAYER 2" : pending.mode === "practice" ? "DUMMY" : (pending.n2 || "RIVAL AI");
    const p2Mastery = pending.localTwo ? "NO MASTERY" : pending.mode === "practice" ? "TRAINING" : (pending.m2 || "NO MASTERY");
    const p2Rank = pending.mode === "comp" ? (pending.r2 || r.name) : pending.mode === "practice" ? "TRAINING" : (pending.r2 || "ROOKIE");
    const p2Win = pending.mode === "practice" ? "—" : (pending.w2 || "0%");
    const wr1 = worldRankFor(profile.name, r.name);
    const wr2 = worldRankFor(p2Name, p2Rank);
    $("#vsBody").innerHTML = `
      <div class="vs-slot left">
        <div class="vs-user">${profile.name}</div>
        <div class="vs-frame">
          <img class="vs-art" src="${skinArt(c1.id, pending.s1)}" alt="${c1.name}" onerror="this.onerror=null;this.src='assets/select/${c1.id}_panel.jpg'" />
          <div class="vs-rank">${DV.profile.withRankBadge(r.name)}</div>
          <div class="vs-mast">${DV.profile.withNoviceBadge(m1)}</div>
        </div>
        <div class="vs-win">WIN ${charWinPct(pending.p1)}</div>
        ${wr1 && wr1 <= 500 ? `<div class="vs-world">WORLD #${wr1}</div>` : ""}
      </div>
      <div class="vs-slot right">
        <div class="vs-user">${p2Name}</div>
        <div class="vs-frame">
          <img class="vs-art" src="${skinArt(c2.id, pending.s2)}" alt="${c2.name}" onerror="this.onerror=null;this.src='assets/select/${c2.id}_panel.jpg'" />
          <div class="vs-rank">${DV.profile.withRankBadge(p2Rank)}</div>
          <div class="vs-mast">${DV.profile.withNoviceBadge(p2Mastery)}</div>
        </div>
        <div class="vs-win">WIN ${p2Win}</div>
        ${wr2 && wr2 <= 500 ? `<div class="vs-world">WORLD #${wr2}</div>` : ""}
      </div>`;
  }

  function startFight() {
    cancelAnimationFrame(raf);
    if (DV.input && DV.input.reset) DV.input.reset();
    const arenas = DV.DATA.ARENAS || [];
    const picked = pending && pending.arenaId && arenas.find((a) => a.id === pending.arenaId);
    const arena = picked || arenas[Math.floor(Math.random() * Math.max(1, arenas.length))];
    match = DV.engine.createMatch({
      p1: pending.p1,
      p2: pending.p2,
      mode: pending.mode,
      practice: pending.mode === "practice",
      n1: profile.name,
      n2: pending.n2 || (pending.localTwo ? "PLAYER 2" : pending.mode === "practice" ? "DUMMY" : "RIVAL"),
      r1: DV.profile.rankInfo(profile).name,
      arena,
    });
    if (match.p[0]) match.p[0].skin = pending.s1 || currentSkin(pending.p1);
    if (match.p[1]) match.p[1].skin = pending.s2 || "default";
    const endBtn = document.getElementById("btnEndPractice");
    if (endBtn) {
      endBtn.style.display = pending.mode === "practice" ? "block" : "none";
      endBtn.onclick = () => { if (match && DV.engine.endPractice) DV.engine.endPractice(match); };
    }
    if (match.p[0]) match.p[0].emoteId = currentPresent("emote", pending.p1);
    if (match.p[1]) match.p[1].emoteId = currentPresent("emote", pending.p2 || pending.p1);
    if (match.practice) {
      match.p[1].dummy = true;
      match.p[1].x = 1000;
      match.p[1]._homeX = 1000;
      match.p[1].vx = 0;
    }
    if (!pending.localTwo && match.p[1]) {
      match.p[1].maxHp = 100;
      match.p[1].hp = 100;
    }
    if (pending.aiDiff === "easy" && match.p[1] && !pending.localTwo && pending.mode !== "practice") {
      match.p[1].dmgMul = 0.55;
    }
    if (DV.replay) DV.replay.begin(match);
    const cv = $("#cv");
    DV.input.bindCanvas(cv);
    if (DV.input.rebuildPad) DV.input.rebuildPad(pending.p1);
    DV.audio.startMusic("fight");
    show("fight");
    last = performance.now();
    acc = 0;
    loop(last);
  }

  function loop(now) {
    if (!match) return;
    DV._match = match;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    acc += dt;
    const inputs = [DV.input.p1(), match.practice ? dummyInput() : pending.localTwo ? DV.input.p2() : DV.ai.think(match, 1, pending.aiDiff)];
    while (acc >= DV.engine.DT) {
      try { DV.engine.step(match, inputs, DV.engine.DT); } catch (err) { console.error(err); }
      try { if (DV.replay) DV.replay.push(match); } catch (err) { console.error(err); }
      acc -= DV.engine.DT;
    }
    const ctx = $("#cv").getContext("2d");
    DV.render.render(ctx, match);
    if (match.practice && DV.input.keys.KeyU) resetDummy();
    if (DV.input.keys.Escape) {
      if (match.practice && !match.ended) {
        match.ended = true;
        match.winner = 0;
        match.phase = "matchend";
        finishMatch();
      } else {
        goMenu();
      }
      return;
    }
    creditMasteryRounds();
    if (match.ended) {
      const winner = match.p[match.winner] || match.p[0];
      const loser = match.p[1 - (match.winner || 0)] || match.p[1];
      const posePick = winner && currentPresent("victory", winner.id);
      const poseOn = winner && ((posePick === "phoenix" && winner.id === "inferna") || (posePick === "midknight" && winner.id === "shade") || (posePick === "bright" && winner.id === "lumen") || (posePick === "aqua" && winner.id === "tide") || (posePick === "queen" && winner.id === "crown"));
      if (poseOn && !match._poseDone) {
        if (!match._posing) {
          match._posing = true;
          match._poseT = 2.4;
          try {
            if (winner) { DV.engine.setAnim(winner, "pose", true); winner.locked = 2.4; winner.vx = 0; }
            if (loser) { DV.engine.setAnim(loser, "down", true); loser.locked = 2.4; loser.vx = 0; }
          } catch (e) {}
        }
        match._poseT -= dt;
        if (match._poseT > 0) { raf = requestAnimationFrame(loop); return; }
        match._poseDone = true;
      }
      finishMatch();
      return;
    }
    raf = requestAnimationFrame(loop);
  }

  function dummyInput() {
    const d = match.p[1];
    const p = match.p[0];
    d.vx = 0;
    if (d._homeX != null) d.x = d._homeX;
    const faceX = p ? p.x : d.x - 40;
    d.face = faceX >= d.x ? 1 : -1;
    return { left: false, right: false, jump: false, punch: false, mod: false, ult: false, cursor: { x: faceX, y: (p ? p.y : d.y) - 60 } };
  }

  function resetDummy() {
    const d = match.p[1];
    d.hp = d.maxHp; d.x = 1000; d.y = DV.engine.FLOOR_Y; d.vx = 0; d.vy = 0;
    d.stun = 0; d.burn = 0; d.poison = 0; d.slow = 0; d.dead = false; d.fallen = false;
  }

  function countingPassMode(mode) {
    return mode === "quick" || mode === "comp" || mode === "campaign";
  }

  function creditPassRounds() {
    if (!match || !countingPassMode(pending.mode) || match._passCredited) return;
    match._passCredited = true;
    DV.profile.addPassRounds(profile, pending.p1, 1);
    DV.profile.save(profile); DV._profile = profile;
  }

  function creditMasteryRounds() {
    creditPassRounds();
    if (!match || pending.mode === "practice" || pending.mode === "local") return;
    match._savedRounds = match._savedRounds || 0;
    const won = match.score[0] || 0;
    if (won <= match._savedRounds) return;
    const add = won - match._savedRounds;
    match._savedRounds = won;
    const ch = DV.profile.ensureChar(profile, pending.p1);
    ch.roundsWon = (ch.roundsWon || 0) + add;
    DV.profile.save(profile); DV._profile = profile;
  }

  const RANK_PLATES = {
    rookie: "assets/ranks/rookie.jpg",
    sidekick: "assets/ranks/sidekick.jpg",
    vigilante: "assets/ranks/vigilante.jpg",
    hero: "assets/ranks/hero.jpg",
    superhero: "assets/ranks/superhero.jpg",
    "elite hero": "assets/ranks/elitehero.jpg",
    powerhouse: "assets/ranks/powerhouse.jpg",
    legend: "assets/ranks/legend.jpg",
    icon: "assets/ranks/icon.jpg",
    godlike: "assets/ranks/godlike.jpg",
  };
  const MAST_PLATES = {
    novice: "assets/badges/novice.jpg",
    apprentice: "assets/badges/apprentice.jpg",
    disciple: "assets/badges/disciple.jpg",
    combatant: "assets/badges/combatant.jpg",
    expert: "assets/badges/expert.jpg",
    master: "assets/badges/master.jpg",
    grandmaster: "assets/badges/grandmaster.jpg",
    monk: "assets/badges/monk.jpg",
    "blue monk": "assets/badges/monk_blue.jpg",
    "purple monk": "assets/badges/monk_purple.jpg",
    "yellow monk": "assets/badges/monk_yellow.jpg",
  };
  let achieveQueue = [];

  function showAchieve(item) {
    const pop = $("#achievePop");
    if (!pop || !item) return;
    $("#achieveKicker").textContent = item.kind === "rank" ? "NEW RANK ACHIEVED" : "NEW MASTERY ACHIEVED";
    $("#achieveTitle").textContent = item.to;
    $("#achieveSub").textContent = item.from ? ("Promoted from " + item.from) : "A new title has been unlocked";
    const src = item.kind === "rank"
      ? RANK_PLATES[String(item.to).toLowerCase()]
      : (item.badge || MAST_PLATES[String(item.to).toLowerCase()]);
    const img = $("#achieveImg");
    if (src) { img.src = src; img.style.display = "inline-block"; }
    else { img.removeAttribute("src"); img.style.display = "none"; }
    pop.hidden = false;
    try { DV.audio.ult(); } catch (e) {}
    try { DV.audio.win(); } catch (e) {}
  }
  function queueAchieve(item) {
    if (!item || !item.to) return;
    achieveQueue.push(item);
    const pop = $("#achievePop");
    if (pop && pop.hidden) showAchieve(achieveQueue.shift());
  }
  function closeAchieve() {
    const pop = $("#achievePop");
    if (pop) pop.hidden = true;
    if (achieveQueue.length) showAchieve(achieveQueue.shift());
  }
  if ($("#achieveOk")) $("#achieveOk").onclick = () => { try { DV.audio.ui(); } catch (e) {} closeAchieve(); };

  function bindVictoryVideo() {
    const v = $("#victoryVid");
    const pop = $("#victoryPop");
    if (!v || !pop) return;
    let done = false;
    const freeze = () => {
      if (done) return;
      done = true;
      try { v.pause(); v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
      pop.classList.add("show");
      try { DV.audio.startMusic("menu"); } catch (e) {}
    };
    v.muted = false;
    v.volume = 1;
    v.removeAttribute("muted");
    try { if (DV.audio && DV.audio.stopMusic) DV.audio.stopMusic(); } catch (e) {}
    v.addEventListener("ended", freeze);
    v.addEventListener("error", freeze);
    const kick = () => v.play().catch(() => freeze());
    if (v.readyState >= 2) kick();
    else v.addEventListener("canplay", kick, { once: true });
    v.addEventListener("loadedmetadata", () => {
      const wait = Math.ceil(((v.duration || 6) + 0.4) * 1000);
      setTimeout(() => { if (!pop.classList.contains("show")) freeze(); }, wait);
    }, { once: true });
  }

  function victoryMarkup(c, tag, extra) {
    const art = (c && (c.victory || c.portrait)) || "";
    const pick = c && currentPresent("victory", c.id);
    const outroPick = c && currentPresent("outro", c.id);
    const vid = (outroPick === "phoenix" && c && c.id === "inferna")
      ? "assets/outro/inferna_phoenix.mp4"
      : (outroPick === "midknight" && c && c.id === "shade")
      ? "assets/outro/shade_midknight.mp4"
      : (c && (pick === "basic" || !pick) && c.victoryVideo);
    if (vid) {
      return `
        <div class="victory-cine">
          <video id="victoryVid" class="victory-vid" playsinline preload="auto">
            <source src="${vid}" type="video/mp4" />
          </video>
          <div class="victory-pop" id="victoryPop">
            <div class="victory-tag">${tag}</div>
            <h2>${c.name} WINS!</h2>
            ${extra || ""}
          </div>
        </div>`;
    }
    return `
      <div class="victory${loss ? " loss" : ""}">
        <img class="victory-art" src="${art}" alt="${c.name}" />
        <div>
          <div class="victory-tag">${tag}</div>
          <h2>${c.name} ${loss ? "FALLS" : "WINS!"}</h2>
          ${extra || ""}
        </div>
      </div>`;
  }

  function finishMatch() {
    cancelAnimationFrame(raf);
    const win = match.winner === 0;
    const charId = pending.p1;
    const ch = DV.profile.ensureChar(profile, charId);
    const bucket = pending.mode === "comp" ? profile.stats.competitive : profile.stats.quick;
    if (pending.mode !== "practice" && pending.mode !== "local") {
      bucket.played++;
      ch.played++;
      ch.timeMs = (Number(ch.timeMs) || 0) + Math.round((match.time || 0) * 1000);
      if (win) { bucket.wins++; ch.wins++; } else { bucket.losses++; ch.losses++; }
      creditMasteryRounds();
      ch.roundsLost += match.score[1];
      const coins = win ? (pending.mode === "comp" ? 2 : 1) : 0;
      if (coins) profile.coins += coins;
      creditPassRounds();
      ch.kills = (ch.kills || 0) + (match.score[0] || 0);
      const kd = (match.score[0] || 0) / Math.max(1, (match.deaths && match.deaths[0]) || 0);
      const t = Math.max(0, Math.min(1, kd / 3));
      const rankId = (DV.profile.rankInfo(profile).id || "");
      let delta = 0;
      if (win) delta = Math.round(15 + t * 10);
      else {
        const heavy = Math.max(0, Math.min(1, (((match.deaths && match.deaths[0]) || 0) - (match.score[0] || 0)) / 5));
        if (rankId === "godlike") delta = -Math.round(15 + heavy * 10);
        else if (rankId === "powerhouse" || rankId === "legend" || rankId === "icon") delta = -Math.round(15 + heavy * 5);
        else delta = -Math.round(10 + heavy * 10);
      }
      const mul = DV.profile.consumeCpBoost(profile, win, pending.mode);
      if (win && mul > 1) delta *= mul;
      const res = pending.mode === "comp" ? DV.profile.addCP(profile, delta) : { rankedUp: false };
      let rankMsg = pending.mode === "comp" ? `<p>COMPETITIVE ${delta >= 0 ? "+" : ""}${delta} CP</p>` : "";
      if (res.rankedUp) {
        rankMsg += `<p style="color:#ffe08a">RANK UP! ${DV.profile.withRankBadge(res.from)} → ${DV.profile.withRankBadge(res.to)}</p>`;
        queueAchieve({ kind: "rank", from: res.from, to: res.to });
        if (DV.profile.addAccoladeRank) DV.profile.addAccoladeRank(profile, res.to);
      }
      const kills = match.score[0] || 0;
      const deaths = (match.deaths && match.deaths[0]) || 0;
      const ratio = deaths ? (kills / deaths).toFixed(2) : String(kills);
      const beforeStats = {
        kills: Math.max(0, (ch.kills || 0) - kills),
        roundsWon: Math.max(0, (ch.roundsWon || 0) - kills),
        played: Math.max(0, (ch.played || 0) - 1),
        wins: Math.max(0, (ch.wins || 0) - (win ? 1 : 0)),
      };
      const beforeM = DV.profile.masteryFor(beforeStats);
      const afterM = DV.profile.masteryFor(ch);
      let mast = "";
      if (beforeM.id !== afterM.id) {
        const up = DV.DATA.MASTERY.findIndex((x) => (x.id || x.name) === afterM.id) > DV.DATA.MASTERY.findIndex((x) => (x.id || x.name) === beforeM.id);
        if (up) {
          profile.coins += 100;
          if (DV.profile.addAccoladeMastery) DV.profile.addAccoladeMastery(profile, charId, afterM.name);
        }
        mast = `<p style="color:#ffe08a">MASTERY ${DV.profile.withNoviceBadge(beforeM)} → ${DV.profile.withNoviceBadge(afterM)}${up ? "  ·  +100 W COINS" : ""}</p>`;
        queueAchieve({ kind: "mastery", from: beforeM.name, to: afterM.name, badge: afterM.badge });
      }
      DV.profile.save(profile); DV._profile = profile;
      const winnerId = win ? pending.p1 : pending.p2;
      const c = DV.DATA.CHARACTERS[winnerId] || DV.DATA.CHARACTERS[charId];
      $("#resultBody").innerHTML = victoryMarkup(c, win ? "VICTORY" : "DEFEAT", `
        <p>${profile.name}</p>
        <p>${DV.profile.withRankBadge(DV.profile.rankInfo(profile).name)}</p>
        <p>MASTERY ${DV.profile.withNoviceBadge(afterM)}</p>
        <p>KILLS ${kills} · DEATHS ${deaths} · K/D ${ratio}</p>
        <p>MASTERY +${kills}</p>
        ${coins ? `<p class="coins"><img class="wcoin" src="assets/wcoin.png" alt="" />+${coins} W COINS</p>` : `<p class="coins">NO W COINS EARNED</p>`}
        ${rankMsg}${mast}`);
    } else if (pending.mode === "local") {
      const c = DV.DATA.CHARACTERS[match.p[match.winner].id];
      $("#resultBody").innerHTML = victoryMarkup(c, "VICTORY", `<p>LOCAL MATCH  ${match.score[0]} – ${match.score[1]}</p>`);
    } else {
      const c = DV.DATA.CHARACTERS[charId];
      $("#resultBody").innerHTML = victoryMarkup(c, "PRACTICE", `
        <p>${c.name}  ·  dummy ${match.p[1].dead ? "DOWN" : "STANDING"}</p>
        <p>PLAY AGAIN uses the same fighter. MAIN MENU returns home.</p>`);
    }
    recordFinishedMatch();
    DV.audio.win();
    if (win) DV.audio.coin();
    show("result");
    bindVictoryVideo();
  }

  $("#btnAgain").onclick = () => {
    DV.audio.ui();
    if (!pending) { goMenu(); return; }
    if (pending.mode === "comp") {
      selected = pending.p1;
      startCompetitiveQueue();
      return;
    }
    pickStage = 1;
    paintVs();
    show("vs");
    setTimeout(startFight, 5000);
  };

  function openProgress() {
    const ranks = DV.DATA.RANKS;
    let need = 0;
    let rankRows = "";
    ranks.forEach((rk, i) => {
      const toReach = need;
      if (rk.quota && rk.quota !== Infinity) need += rk.quota;
      const cpTxt = i === 0 ? "0 CP" : rk.quota === Infinity ? toReach + "+ CP" : toReach + " CP";
      rankRows += `<tr><td>${DV.profile.withRankBadge(rk.name)}</td><td>${cpTxt}</td><td>${DV.profile.withRankBadge(rk.reward || "—")}</td></tr>`;
    });
    let mastRows = "";
    DV.DATA.MASTERY.forEach((m) => {
      const wr = m.winPct ? Math.round(m.winPct * 100) + "% match win rate" : "—";
      mastRows += `<tr><td>${DV.profile.withNoviceBadge(m)}</td><td>${m.rounds} lifetime rounds</td><td>${wr}</td><td>${m.reward || "—"}</td></tr>`;
    });
    let charMast = "";
    let bestM = DV.DATA.MASTERY[0];
    let lifeRounds = 0;
    Object.values(DV.DATA.CHARACTERS).forEach((ch) => {
      const s = DV.profile.ensureChar(profile, ch.id);
      const cur = DV.profile.masteryFor(s);
      const nextTxt = cur.next == null ? "MAX" : (s.roundsWon || 0) + " / " + cur.next;
      charMast += `<tr><td>${ch.name}</td><td>${s.roundsWon || 0}</td><td>${DV.profile.withNoviceBadge(cur)}</td><td>${nextTxt}</td></tr>`;
      lifeRounds += Number(s.roundsWon) || 0;
      const row = DV.DATA.MASTERY.find((x) => (x.id || x.name) === cur.id) || DV.DATA.MASTERY.find((x) => x.name === cur.name);
      if (row && DV.DATA.MASTERY.indexOf(row) >= DV.DATA.MASTERY.indexOf(bestM)) bestM = row;
    });
    const nowRank = DV.profile.rankInfo(profile);
    const cpLine = nowRank.quota === Infinity ? String(nowRank.cp || profile.cp || 0) + " CP" : (nowRank.cp || profile.cp || 0) + " / " + nowRank.quota + " CP";
    const progressRoot = $("#progressBody");
    if (!progressRoot) { show("progress"); return; }
    progressRoot.innerHTML = `
      <div class="prog-pager">
        <button class="btn prog-page-btn on" id="progRankBtn" type="button">PAGE 1 · RANKS</button>
        <button class="btn prog-page-btn" id="progMastBtn" type="button">PAGE 2 · MASTERY</button>
      </div>
      <div id="progRankPage">
        <div class="prog-now">
          <p>CURRENT RANK  ${DV.profile.withRankBadge(nowRank.name)}</p>
          <p>CURRENT CP  <b>${cpLine}</b></p>
        </div>
        <h2>COMPETITIVE RANKS</h2>
        <p class="info-moves">Earn Competitive Points in Competitive Match. Points fill the current rank bar, then you promote.</p>
        <table>
          <tr><th>Rank</th><th>CP to reach</th><th>Reward</th></tr>
          ${rankRows}
        </table>
      </div>
      <div id="progMastPage" style="display:none">
        <div class="prog-now">
          <p>CURRENT MASTERY  ${DV.profile.withNoviceBadge(bestM)}</p>
          <p>LIFETIME ROUNDS WON  <b>${lifeRounds}</b></p>
        </div>
        <h2>CHARACTER MASTERY</h2>
        <p class="info-moves">Mastery is per fighter and counts lifetime rounds won with that character. Higher Monk tiers also need a match win rate on that fighter. If the win rate drops, the Monk plate drops a tier.</p>
        <table>
          <tr><th>Mastery</th><th>Lifetime rounds</th><th>Win rate</th><th>Reward</th></tr>
          ${mastRows}
        </table>
        <h2 style="margin-top:16px">YOUR FIGHTERS</h2>
        <table>
          <tr><th>Fighter</th><th>Rounds won</th><th>Mastery</th><th>Toward next</th></tr>
          ${charMast}
        </table>
      </div>`;
    const rankBtn = $("#progRankBtn");
    const mastBtn = $("#progMastBtn");
    const rankPage = $("#progRankPage");
    const mastPage = $("#progMastPage");
    function showProg(which) {
      const ranks = which === "rank";
      rankPage.style.display = ranks ? "block" : "none";
      mastPage.style.display = ranks ? "none" : "block";
      rankBtn.classList.toggle("on", ranks);
      mastBtn.classList.toggle("on", !ranks);
    }
    if (rankBtn) rankBtn.onclick = () => { DV.audio.ui(); showProg("rank"); };
    if (mastBtn) mastBtn.onclick = () => { DV.audio.ui(); showProg("mast"); };
    show("progress");
  }

  let viewedName = null;
  let viewedMatches = [];
  let viewedReplay = null;

  function formatDuration(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return m + ":" + String(s).padStart(2, "0");
  }

  function nameLink(name) {
    if (!name) return "";
    return `<span class="profile-link" data-profile="${escapeAttr(name)}">${escapeHtml(name)}</span>`;
  }

  function escapeHtml(s) {
    return String(s || "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
  function escapeAttr(s) {
    return escapeHtml(s).replace(/"/g, "&quot;");
  }

  function recordFinishedMatch() {
    if (!match || !pending) return;
    const rec = {
      id: "m" + Date.now().toString(36),
      at: Date.now(),
      mode: pending.mode || "quick",
      duration: match.time || 0,
      myName: profile.name,
      oppName: pending.n2 || match.names[1] || "RIVAL",
      myChar: pending.p1,
      oppChar: pending.p2,
      myRounds: match.score[0] || 0,
      oppRounds: match.score[1] || 0,
      won: match.winner === 0,
    };
    DV.profile.recordMatch(profile, rec);
    if (DV.replay && match && match._recFrames && match._recFrames.length) {
      DV.replay.save(rec.id, match._recFrames, rec);
    }
    DV.profile.upsertPublicStub(rec.oppName, {
      registered: false,
      match: {
        id: rec.id + "-opp",
        at: rec.at,
        mode: rec.mode,
        duration: rec.duration,
        myName: rec.oppName,
        oppName: rec.myName,
        myChar: rec.oppChar,
        oppChar: rec.myChar,
        myRounds: rec.oppRounds,
        oppRounds: rec.myRounds,
        won: !rec.won,
      },
    });
  }

  function bindProfileLinks(root) {
    (root || document).querySelectorAll("[data-profile]").forEach((el) => {
      el.onclick = (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        openProfileView(el.getAttribute("data-profile"));
      };
    });
  }

  function bestMasteryEntry(data) {
    let best = { id: null, name: "", mastery: DV.DATA.MASTERY[0] };
    Object.values(DV.DATA.CHARACTERS).forEach((ch) => {
      const s = (data.chars && data.chars[ch.id]) || {};
      const m = DV.profile.masteryFor(s);
      const row = DV.DATA.MASTERY.find((x) => (x.id || x.name) === m.id) || DV.DATA.MASTERY[0];
      const cur = DV.DATA.MASTERY.find((x) => (x.id || x.name) === best.mastery.id) || best.mastery;
      if (DV.DATA.MASTERY.indexOf(row) >= DV.DATA.MASTERY.indexOf(cur)) {
        best = { id: ch.id, name: ch.name, mastery: row };
      }
    });
    return best;
  }

  function seasonBadgeList(data) {
    const pass = (data && data.powerPass) || {};
    const list = [];
    if (pass.finalist) list.push({ season: "S0", tier: pass.finalist, src: "assets/pass/badge/" + pass.finalist + ".jpg" });
    return list;
  }

  function identityCardHTML(data, mine) {
    const pass = DV.profile.ensurePass(mine ? profile : Object.assign({ powerPass: data.powerPass || {} }, data));
    const r = mine ? DV.profile.rankInfo(profile) : (DV.DATA.RANKS[data.rankIndex] || DV.DATA.RANKS[1]);
    const rankKey = String(r.name || "").toLowerCase();
    const rankSrc = RANK_PLATES[rankKey] || RANK_PLATES.rookie;
    const frame = pass.frame && (!mine || DV.profile.frameUnlocked(profile, pass.frame)) ? pass.frame : null;
    const banner = pass.banner && (!mine || DV.profile.bannerUnlocked(profile, pass.banner)) ? pass.banner : null;
    const pfp = mine ? DV.profile.pfpSrc(profile) : (DV.profile.pfpSrc(data) || "");
    const best = bestMasteryEntry(data);
    const mastSrc = best.mastery.badge || MAST_PLATES[String(best.mastery.id || best.mastery.name || "").toLowerCase()];
    const badges = seasonBadgeList(mine ? profile : data);
    const badgeHtml = badges.map((b) => `<img class="id-badge" src="${b.src}" alt="${b.season} ${b.tier}" title="${b.season} ${String(b.tier).toUpperCase()}" />`).join("");
    return `<div class="id-wrap">
      ${pfp ? `<img class="id-pfp" src="${pfp}" alt="" />` : `<div class="id-pfp empty"></div>`}
      <div class="id-frame" style="${frame ? "background-image:url('assets/pass/frame/" + frame + ".jpg');border:none;" : ""}">
        <div class="id-badges">${badgeHtml}</div>
        <div class="id-banner" style="${banner ? "background-image:url('assets/pass/banner/" + banner + ".jpg')" : ""}">
          <div class="id-name">${escapeHtml(data.name || "PLAYER")}</div>
        </div>
        <div class="id-bottom">
          <div class="id-rank"><img src="${rankSrc}" alt="${r.name || ""}" /><span>${r.name || ""}</span></div>
          <div class="id-mast">${mastSrc ? `<img src="${mastSrc}" alt="" />` : ""}<span>${best.name || ""}</span></div>
        </div>
      </div>
    </div>`;
  }

  function charNameButtons(kind) {
    return Object.values(DV.DATA.CHARACTERS).map((c) =>
      `<button class="btn pass-name" data-coskind="${kind}" data-coschar="${c.id}">${c.name}</button>`
    ).join("");
  }

  function openCosmeticPick(kind, charId) {
    const ch = DV.DATA.CHARACTERS[charId];
    const pass = DV.profile.ensurePass(profile);
    let title = "PROFILE PICTURES";
    let items = [];
    if (kind === "pfp") {
      items = (DV.DATA.PFPS || []).filter((p) => p.char === charId).map((p) => ({
        id: p.id,
        src: p.src,
        name: p.pass ? "POWER PASS" : "EXPERT",
        unlocked: DV.profile.pfpUnlocked(profile, p.id),
        on: profile.pfp === p.id
      }));
    } else if (kind === "banner") {
      title = "NAME BANNERS";
      const unlocked = DV.profile.bannerUnlocked(profile, charId);
      items = [{
        id: charId,
        src: "assets/pass/banner/" + charId + ".jpg",
        name: ch.name + " BANNER",
        unlocked: unlocked,
        on: pass.banner === charId
      }];
    } else {
      title = "BANNER FRAMES";
      const unlocked = DV.profile.frameUnlocked(profile, charId);
      items = [{
        id: charId,
        src: "assets/pass/frame/" + charId + ".jpg",
        name: ch.name + " FRAME",
        unlocked: unlocked,
        on: pass.frame === charId
      }];
    }
    const grid = items.map((it) => `
      <button class="pfp-pick ${it.on ? "on" : ""} ${it.unlocked ? "" : "locked"}" data-pick="${it.id}" ${it.unlocked ? "" : "disabled"}>
        <img src="${it.src}" alt="" />
        <span>${it.name}</span>
        <small>${it.unlocked ? (it.on ? "EQUIPPED" : "SELECT") : "LOCKED"}</small>
      </button>`).join("");
    $("#profileBody").innerHTML = `
      <p><button class="btn" id="btnCosBack">BACK</button></p>
      <h2>${ch.name} · ${title}</h2>
      <div class="pfp-grid">${grid || "<p class='info-moves'>No options yet.</p>"}</div>`;
    $("#btnCosBack").onclick = () => { DV.audio.ui(); openProfileView(null); };
    $("#profileBody").querySelectorAll("[data-pick]").forEach((b) => {
      b.onclick = () => {
        DV.audio.ui();
        if (kind === "pfp") profile.pfp = b.getAttribute("data-pick");
        if (kind === "banner") pass.banner = b.getAttribute("data-pick");
        if (kind === "frame") pass.frame = b.getAttribute("data-pick");
        DV.profile.save(profile); DV._profile = profile;
        DV.profile.publishPublic(profile);
        refreshHeader();
        openCosmeticPick(kind, charId);
      };
    });
    show("profile");
  }

  function openProfileView(name) {
    viewedName = name && name !== profile.name ? name : null;
    const pub = viewedName ? DV.profile.getPublic(viewedName) : null;
    const data = viewedName ? (pub || { name: viewedName, registered: false, rankIndex: 1, cp: 0, stats: { quick: { played: 0, wins: 0, losses: 0 }, competitive: { played: 0, wins: 0, losses: 0 } }, chars: {}, matchHistory: [] }) : profile;
    const r = viewedName
      ? (DV.DATA.RANKS[data.rankIndex] || DV.DATA.RANKS[1])
      : DV.profile.rankInfo(profile);
    const q = (data.stats && data.stats.quick) || { played: 0, wins: 0, losses: 0 };
    const c = (data.stats && data.stats.competitive) || { played: 0, wins: 0, losses: 0 };
    const pctn = (s) => s.played ? ((s.wins / s.played) * 100).toFixed(1) + "%" : "N/A";
    let rows = "";
    Object.values(DV.DATA.CHARACTERS).forEach((ch) => {
      const s = (data.chars && data.chars[ch.id]) || { played: 0, wins: 0, losses: 0, roundsWon: 0 };
      const m = DV.profile.masteryFor(s);
      rows += `<tr><td>${ch.name}</td><td>${s.played || 0}</td><td>${s.wins || 0}</td><td>${s.roundsWon || 0}</td><td>${DV.profile.withNoviceBadge(m)}</td></tr>`;
    });
    const mine = !viewedName;
    $("#profileBody").innerHTML = `
      ${identityCardHTML(data, mine)}
      <p>COMPETITIVE POINTS  <b>${data.cp || 0}${mine && r.quota !== Infinity ? " / " + r.quota : ""}</b></p>
      ${(() => { const wr = worldRankFor(data.name, viewedName ? (r.name || "") : r.name); return wr ? `<p class="world-rank">GODLIKE WORLD RANK <b>#${wr}</b></p>` : ""; })()}
      ${mine ? `<p class="coins"><img class="wcoin" src="assets/wcoin.png" alt="" />${profile.coins} W COINS</p>` : ""}
      <p>${data.registered ? "REGISTERED PLAYER" : "GUEST / PUBLIC RECORD"}</p>
      <h2 style="margin-top:14px">QUICK MATCH</h2>
      <p>${q.played || 0} played · ${q.wins || 0} W / ${q.losses || 0} L · ${pctn(q)}</p>
      <h2 style="margin-top:14px">COMPETITIVE</h2>
      <p>${c.played || 0} played · ${c.wins || 0} W / ${c.losses || 0} L · ${pctn(c)}</p>
      <h2 style="margin-top:14px">CHARACTER MASTERY</h2>
      <table><tr><th>Fighter</th><th>Games</th><th>Wins</th><th>Rounds Won</th><th>Mastery</th></tr>${rows}</table>
      ${mine ? `
      <h2 style="margin-top:16px">PROFILE PICTURE</h2>
      <p class="pfp-hint">Pick a character, then choose a portrait.</p>
      <div class="pass-names">${charNameButtons("pfp")}</div>
      <h2 style="margin-top:16px">NAME BANNER</h2>
      <p class="pfp-hint">Unlock a character banner at Disciple mastery on that fighter.</p>
      <div class="pass-names">${charNameButtons("banner")}</div>
      <h2 style="margin-top:16px">BANNER FRAME</h2>
      <p class="pfp-hint">Unlock a banner frame at Combatant mastery on that fighter.</p>
      <div class="pass-names">${charNameButtons("frame")}</div>
      <div class="row" style="margin-top:12px">
        <button class="btn" id="btnExportPlayer">DOWNLOAD PLAYER FILE</button>
        <label class="btn" for="playerFileIn">IMPORT PLAYER FILE</label>
        <input id="playerFileIn" type="file" accept="application/json,.json" style="display:none" />
      </div>` : ""}`;
    if (!viewedName) {
      const exp = $("#btnExportPlayer");
      if (exp) exp.onclick = () => {
        const blob = new Blob([JSON.stringify(DV.profile.playerFile(profile), null, 2)], { type: "application/json" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = (profile.name || "player") + "-doubleyou-data.json";
        a.click();
        URL.revokeObjectURL(a.href);
      };
      const inp = $("#playerFileIn");
      if (inp) inp.onchange = () => {
        const f = inp.files && inp.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const data = JSON.parse(String(reader.result || "{}"));
            DV.profile.applyPlayerFile(profile, data);
            DV.profile.save(profile); DV._profile = profile;
            DV.profile.publishPublic(profile);
            refreshHeader();
            openProfileView(null);
          } catch (e) { alert("Could not read that player file."); }
        };
        reader.readAsText(f);
      };
      $("#profileBody").querySelectorAll("[data-coskind]").forEach((btn) => {
        btn.onclick = () => {
          DV.audio.ui();
          openCosmeticPick(btn.getAttribute("data-coskind"), btn.getAttribute("data-coschar"));
        };
      });
    }
    const histBtn = $("#btnMatchHistory");
    if (histBtn) histBtn.style.display = "";
    show("profile");
  }

  function openProfile() {
    openProfileView(null);
  }

  function matchesFor(name) {
    if (!name || name === profile.name) return profile.matchHistory || [];
    const pub = DV.profile.getPublic(name);
    return (pub && pub.matchHistory) || [];
  }

  function openMatchHistory(name) {
    viewedName = name && name !== profile.name ? name : null;
    viewedMatches = matchesFor(viewedName || profile.name);
    $("#matchesTitle").textContent = viewedName ? ("MATCHES · " + viewedName) : "LAST 10 MATCHES";
    if (!viewedMatches.length) {
      $("#matchesBody").innerHTML = "<p>No matches recorded yet.</p>";
    } else {
      $("#matchesBody").innerHTML = `
        <table class="match-list">
          <tr><th>Mode</th><th>Character</th><th>Opponent</th><th>Rounds Won</th><th>Length</th><th></th></tr>
          ${viewedMatches.map((rec) => `
            <tr>
              <td>${escapeHtml((rec.mode || "").toUpperCase())}</td>
              <td>${escapeHtml((DV.DATA.CHARACTERS[rec.myChar] || {}).name || rec.myChar)}</td>
              <td>${nameLink(rec.oppName)}</td>
              <td>${rec.myRounds || 0} – ${rec.oppRounds || 0}</td>
              <td>${formatDuration(rec.duration)}</td>
              <td><button class="btn" data-replay="${escapeAttr(rec.id)}">REPLAY</button></td>
            </tr>`).join("")}
        </table>`;
    }
    bindProfileLinks($("#matchesBody"));
    $("#matchesBody").querySelectorAll("[data-replay]").forEach((b) => {
      b.onclick = () => openReplay(b.getAttribute("data-replay"), viewedName || profile.name);
    });
    show("matches");
  }

  function openReplay(id, ownerName) {
    viewedMatches = matchesFor(ownerName);
    viewedReplay = viewedMatches.find((r) => r.id === id) || null;
    if (!viewedReplay) {
      $("#replayBody").innerHTML = "<p>Replay not found.</p>";
      show("replay");
      return;
    }
    const rec = viewedReplay;
    const myChar = (DV.DATA.CHARACTERS[rec.myChar] || {}).name || rec.myChar;
    const oppChar = (DV.DATA.CHARACTERS[rec.oppChar] || {}).name || rec.oppChar;
    $("#replayBody").innerHTML = `
      <div class="replay-grid">
        <div class="replay-card">
          <h3>${escapeHtml(myChar)}</h3>
          <p>${nameLink(rec.myName)}</p>
          <p>Rounds won: <b>${rec.myRounds || 0}</b></p>
        </div>
        <div class="replay-card">
          <h3>${escapeHtml(oppChar)}</h3>
          <p>${nameLink(rec.oppName)}</p>
          <p>Rounds won: <b>${rec.oppRounds || 0}</b></p>
        </div>
      </div>
      <p style="margin-top:14px"><b>Mode</b> ${escapeHtml((rec.mode || "").toUpperCase())}</p>
      <p><b>Match length</b> ${formatDuration(rec.duration)}</p>
      <p><b>Result</b> ${rec.won ? "WIN" : "LOSS"}</p>
      <p class="info-moves">Click WATCH MATCH to play the recording. Pause, rewind, or fast forward, then EXIT back here. Click a name to open that player's profile.</p>`;
    bindProfileLinks($("#replayBody"));
    show("replay");
  }

  let watchState = null;
  let watchRaf = 0;

  function applyReplayFrame(ghost, frame) {
    if (!ghost || !frame) return;
    ghost.time = frame.t || 0;
    ghost.round = frame.r || 1;
    ghost.score = frame.s ? frame.s.slice() : [0, 0];
    ghost.phase = frame.ph || "fight";
    ghost.projectiles = (frame.pr || []).map((p) => ({
      x: p.x, y: p.y, kind: p.k, face: p.f, r: p.r || 10,
    }));
    (frame.p || []).forEach((s, i) => {
      const f = ghost.p[i];
      if (!f || !s) return;
      if (s.id && s.id !== f.id) {
        ghost.p[i] = Object.assign({}, f, { id: s.id, data: DV.DATA.CHARACTERS[s.id] || f.data });
      }
      const t = ghost.p[i];
      t.x = s.x; t.y = s.y; t.face = s.face; t.anim = s.anim || "idle";
      t.hp = s.hp; t.energy = s.en; t.dead = !!s.dead;
      t.flying = s.fly ? 1 : 0;
      t.shockMark = s.mark ? 1 : 0;
      t.airborne = t.y < DV.engine.FLOOR_Y - 4;
    });
  }

  function stopWatch() {
    watchRaf = 0;
    if (watchState) watchState.running = false;
  }

  function paintWatch() {
    if (!watchState || !watchState.frames.length) return;
    const i = Math.max(0, Math.min(watchState.frames.length - 1, Math.floor(watchState.i)));
    applyReplayFrame(watchState.ghost, watchState.frames[i]);
    const cv = $("#replayCv");
    if (cv) DV.render.render(cv.getContext("2d"), watchState.ghost);
    const scrub = $("#repScrub");
    if (scrub && document.activeElement !== scrub) {
      scrub.max = String(Math.max(1, watchState.frames.length - 1));
      scrub.value = String(i);
    }
    if ($("#repTime")) $("#repTime").textContent = formatDuration((watchState.frames[i] && watchState.frames[i].t) || 0);
  }

  function tickWatch(now) {
    if (!watchState || !watchState.running) return;
    const dt = Math.min(0.05, (now - watchState.last) / 1000);
    watchState.last = now;
    if (!watchState.paused) {
      watchState.i += dt * 30 * watchState.speed;
      if (watchState.i < 0) watchState.i = 0;
      if (watchState.i > watchState.frames.length - 1) {
        watchState.i = watchState.frames.length - 1;
        watchState.paused = true;
      }
    }
    paintWatch();
    watchRaf = requestAnimationFrame(tickWatch);
  }

  async function startWatch() {
    if (!viewedReplay) return;
    const packed = DV.replay ? await DV.replay.load(viewedReplay.id) : null;
    const frames = packed && packed.frames;
    if (!frames || !frames.length) {
      $("#replayBody").insertAdjacentHTML("beforeend", "<p style='color:#ff8a8a'>No recording found for this match. Play a new match to record one.</p>");
      return;
    }
    const ghost = DV.engine.createMatch({
      p1: viewedReplay.myChar,
      p2: viewedReplay.oppChar,
      mode: viewedReplay.mode,
      practice: true,
      n1: viewedReplay.myName,
      n2: viewedReplay.oppName,
    });
    ghost._replayPlaying = true;
    ghost.practice = false;
    watchState = { frames, i: 0, speed: 1, paused: false, running: true, last: performance.now(), ghost };
    show("watch");
    paintWatch();
    watchRaf = requestAnimationFrame(tickWatch);
  }

  let infoId = "inferna";
  let infoMode = "details";
  let infoPickKind = null;
  function openInfo(mode) {
    infoMode = mode || "details";
    infoPickKind = null;
    infoId = infoId || "inferna";
    const titles = { skins: "SKINS AND ACCESSORIES", details: "CHARACTER DETAILS", moves: "MOVES AND COMBOS" };
    if ($("#infoTitle")) $("#infoTitle").textContent = titles[infoMode] || "CHARACTERS";
    paintInfoRoster();
    fillInfo(infoId);
    show("info");
  }
  function paintInfoRoster() {
    const root = $("#infoRoster");
    root.innerHTML = "";
    Object.values(DV.DATA.CHARACTERS).forEach((c) => {
      const d = document.createElement("div");
      d.className = "card" + (c.id === infoId ? " sel" : "");
      d.innerHTML = `<img src="${skinArt(c.id, currentSkin(c.id))}" alt="${c.name}" onerror="this.onerror=null;this.src='assets/select/${c.id}_panel.jpg'" /><div class="nm">${c.name}</div>`;
      d.onclick = () => { infoId = c.id; paintInfoRoster(); fillInfo(c.id); DV.audio.ui(); };
      root.appendChild(d);
    });
  }
  function fillInfo(id) {
    const c = DV.DATA.CHARACTERS[id];
    const art = $("#infoArt");
    const showSkin = infoPickKind === "skin" ? currentSkin(c.id) : currentSkin(c.id);
    art.src = skinArt(c.id, showSkin);
    art.onerror = function () { this.onerror = null; this.src = "assets/select/" + c.id + "_panel.jpg"; };
    art.style.filter = "none";
    art.style.objectFit = "contain";
    art.style.background = "#111";
    if (infoMode === "skins") {
      const skins = (DV.DATA.SKINS && DV.DATA.SKINS[c.id]) || [{ id: "default", name: "Basic Skin" }];
      const pres = DV.DATA.PRESENTATIONS || {};
      const forChar = (list) => (list || []).filter((s) => !s.char || s.char === c.id);
      const victories = forChar(pres.victory || [{ id: "basic", name: "Basic Victory" }]);
      const intros = forChar(pres.intro || [{ id: "basic", name: "Basic Intro" }]);
      const outros = forChar(pres.outro || [{ id: "basic", name: "Basic Outro" }]);
      const emotes = pres.emote || [{ id: "basic", name: "None" }, { id: "pass", name: "Power Pass Emote", pass: 3 }];
      const labelOf = (list, id) => ((list.find((s) => s.id === id) || list[0] || {}).name || id);
      const row = (title, kind, list, cur) => `
        <h4>${title}</h4>
        <div class="equip-row">
          <div class="equip-now">${labelOf(list, cur)}</div>
          <button class="btn" data-change="${kind}">CHANGE</button>
        </div>`;
      if (infoPickKind) {
        const map = { skin: skins, victory: victories, intro: intros, outro: outros, emote: emotes };
        const list = map[infoPickKind] || [];
        const cur = infoPickKind === "skin" ? currentSkin(c.id) : currentPresent(infoPickKind, c.id);
        const cards = list.map((s) => {
          const locked = !!(s.pass && !DV.profile.passUnlocked(profile, c.id, s.pass));
          const on = cur === s.id;
          const thumb = infoPickKind === "skin" ? `<img class="cos-art" src="${skinArt(c.id, s.id)}" alt="" />` : "";
          return `<button class="cos-card${on ? " on" : ""}${locked ? " locked" : ""}" data-kind="${infoPickKind}" data-id="${s.id}" ${locked ? "disabled" : ""}>
            ${thumb}
            ${locked ? "<span class=\"cos-lock\">🔒</span><span class=\"cos-tint\"></span>" : ""}
            <span class="cos-name">${s.name || s.id}</span>
            <small>${locked ? "LOCKED" : (on ? "EQUIPPED" : "SELECT")}</small>
          </button>`;
        }).join("");
        $("#infoText").innerHTML = `
          <p><button class="btn" id="btnInfoPickBack">BACK</button></p>
          <h2 style="color:${c.color}">${c.name}</h2>
          <h3>${infoPickKind === "skin" ? "SKINS" : infoPickKind.toUpperCase()}</h3>
          <div class="cos-grid">${cards}</div>`;
        const back = $("#btnInfoPickBack");
        if (back) back.onclick = () => { DV.audio.ui(); infoPickKind = null; fillInfo(c.id); };
        $("#infoText").querySelectorAll("[data-kind]").forEach((b) => {
          b.onclick = () => {
            if (b.disabled) return;
            DV.audio.ui();
            if (b.dataset.kind === "skin") {
              setSkin(c.id, b.dataset.id);
              const artEl = $("#infoArt");
              if (artEl) artEl.src = skinArt(c.id, b.dataset.id);
            } else setPresent(b.dataset.kind, c.id, b.dataset.id);
            infoPickKind = null;
            fillInfo(c.id);
          };
        });
        return;
      }
      $("#infoText").innerHTML = `
        <h2 style="color:${c.color}">${c.name}</h2>
        <h3>SKINS</h3>
        ${row("SKIN", "skin", skins, currentSkin(c.id))}
        <h3 style="margin-top:14px">ACCESSORIES</h3>
        ${row("VICTORY ANIMATION", "victory", victories, currentPresent("victory", c.id))}
        ${row("INTRO", "intro", intros, currentPresent("intro", c.id))}
        ${row("OUTRO", "outro", outros, currentPresent("outro", c.id))}
        ${row("EMOTE", "emote", emotes, currentPresent("emote", c.id))}`;
      $("#infoText").querySelectorAll("[data-change]").forEach((b) => {
        b.onclick = () => { DV.audio.ui(); infoPickKind = b.getAttribute("data-change"); fillInfo(c.id); };
      });
      return;
    }
    if (infoMode === "moves") {
      $("#infoText").innerHTML = `
        <h2 style="color:${c.color}">${c.name}</h2>
        <p>Hold <b>right click</b> + the listed key for specials. Left click is punch. Double right click is ultimate after 30s.</p>
        ${c.moves.map((mv) => `<p><b>${mv.name}</b><br>${mv.input || ""} · ${mv.energy} EN · ${mv.dmg[0]}–${mv.dmg[1]} dmg · ${mv.range}<br>${mv.desc || ""}</p>`).join("")}`;
      return;
    }
    $("#infoText").innerHTML = `
      <h2 style="color:${c.color}">${c.name}</h2>
      <p><b>Type</b> ${c.type} · <b>Weakness</b> ${c.weakness}</p>
      <p><b>Health</b> ${c.health} · <b>Energy</b> ${c.energy}</p>
      <p>${c.desc || ""}</p>
      <p><b>Personality</b> ${c.personality || "—"}<br><b>Style</b> ${c.style || "—"}</p>
      ${c.passive ? `<p><b>Passive</b> ${c.passive}</p>` : ""}`;
  }

  function godlikeIndex() {
    const i = DV.DATA.RANKS.findIndex((r) => r.id === "godlike");
    return i < 0 ? DV.DATA.RANKS.length - 1 : i;
  }
  function godlikePlayers() {
    const gi = godlikeIndex();
    const byName = {};
    let list = [];
    try { list = JSON.parse(localStorage.getItem("DV_GODLIKE_BOARD") || "[]"); } catch (e) { list = []; }
    (list || []).forEach((p) => { if (p && p.name) byName[p.name] = p; });
    (DV.profile.listPublic ? DV.profile.listPublic() : []).forEach((p) => {
      if (!p || !p.name) return;
      if ((p.rankIndex || 0) < gi) return;
      const st = (p.stats && p.stats.competitive) || {};
      byName[p.name] = {
        name: p.name,
        cp: p.cp || 0,
        w: st.wins || 0,
        l: st.losses || 0,
      };
    });
    if (profile.rankIndex >= gi) {
      byName[profile.name] = {
        name: profile.name,
        cp: profile.cp || 0,
        w: profile.stats.competitive.wins || 0,
        l: profile.stats.competitive.losses || 0,
      };
    } else {
      delete byName[profile.name];
    }
    list = Object.keys(byName).map((k) => byName[k]);
    list.sort((a, b) => (b.cp || 0) - (a.cp || 0) || String(a.name).localeCompare(String(b.name)));
    localStorage.setItem("DV_GODLIKE_BOARD", JSON.stringify(list));
    return list;
  }
  function isGodlikeName(rankLabel) {
    return String(rankLabel || "").toUpperCase().replace(/\s+/g, "") === "GODLIKE";
  }
  function worldRankFor(name, rankLabel) {
    if (!name || name === "DUMMY" || name === "PLAYER 2" || name === "RIVAL AI") return null;
    const gi = godlikeIndex();
    let god = isGodlikeName(rankLabel);
    if (name === profile.name) god = god || profile.rankIndex >= gi;
    else {
      const pub = DV.profile.getPublic(name);
      god = god || (pub && (pub.rankIndex || 0) >= gi);
    }
    if (!god) return null;
    const list = godlikePlayers();
    const i = list.findIndex((p) => p.name === name);
    return i >= 0 ? i + 1 : null;
  }
  function openBoard() {
    const list = godlikePlayers();
    const rows = list.length ? list : [{ name: "", cp: "", w: "", l: "" }, { name: "", cp: "", w: "", l: "" }, { name: "", cp: "", w: "", l: "" }, { name: "", cp: "", w: "", l: "" }, { name: "", cp: "", w: "", l: "" }];
    $("#boardTable").innerHTML = "<tr><th>#</th><th>Name</th><th>CP</th><th>W</th><th>L</th></tr>" +
      rows.map((r, i) => `<tr><td>${i + 1}</td><td>${r.name ? nameLink(r.name) : ""}</td><td>${r.cp === "" ? "" : r.cp}</td><td>${r.w === "" ? "" : r.w}</td><td>${r.l === "" ? "" : r.l}</td></tr>`).join("");
    bindProfileLinks($("#boardTable"));
    show("board");
  }

  function paypalUrl(pack) {
    const ret = location.origin + location.pathname + "?paid=" + encodeURIComponent(pack.id);
    const q = new URLSearchParams({
      cmd: "_xclick",
      business: DV.DATA.PAYPAL_EMAIL,
      item_name: "DoubleYou Versus — " + pack.name,
      amount: pack.usd,
      currency_code: "USD",
      no_shipping: "1",
      return: ret,
      cancel_return: location.origin + location.pathname + "?store=1",
    });
    return "https://www.paypal.com/cgi-bin/webscr?" + q.toString();
  }

  function buyCoinPack(packId) {
    const pack = (DV.DATA.COIN_PACKS || []).find((p) => p.id === packId);
    if (!pack) return;
    sessionStorage.setItem("dv_pending_pack", JSON.stringify({ id: pack.id, coins: pack.coins, usd: pack.usd, t: Date.now() }));
    DV.profile.notifyStudio("purchase-started", {
      username: profile.name,
      email: profile.email || "guest",
      pack: pack.name,
      coins: pack.coins,
      usd: pack.usd,
      action: "paypal checkout started",
    });
    location.href = paypalUrl(pack);
  }

  function grantPendingPack() {
    const params = new URLSearchParams(location.search);
    if (params.get("store") === "1") {
      history.replaceState({}, "", location.pathname);
      openStore();
      return true;
    }
    if (params.get("paid")) {
      let pendingPack = null;
      try { pendingPack = JSON.parse(sessionStorage.getItem("dv_pending_pack") || "null"); } catch (e) { pendingPack = null; }
      const pack = (DV.DATA.COIN_PACKS || []).find((p) => p.id === params.get("paid"));
      if (pack && pendingPack && pendingPack.id === pack.id) {
        profile.coins = (Number(profile.coins) || 0) + pack.coins;
        if (DV.profile.addPayment) {
          DV.profile.addPayment(profile, { method: "paypal", pack: pack.name, usd: pack.usd, coins: pack.coins });
          DV.profile.addBought(profile, { id: pack.id, type: "coins", name: pack.name, usd: pack.usd, coins: pack.coins });
        }
        DV.profile.save(profile); DV._profile = profile;
        sessionStorage.removeItem("dv_pending_pack");
        DV.profile.notifyStudio("purchase", {
          username: profile.name,
          email: profile.email || "guest",
          pack: pack.name,
          coins: pack.coins,
          usd: pack.usd,
          newBalance: profile.coins,
          action: "purchase completed",
        });
        history.replaceState({}, "", location.pathname);
        openStore();
        const body = $("#storeBody");
        if (body) body.insertAdjacentHTML("beforeend", '<p class="info-moves" style="color:#7dff9a">+' + pack.coins + " W COINS added.</p>");
        refreshHeader();
        return true;
      }
      history.replaceState({}, "", location.pathname);
    }
    return false;
  }

  function openStore() {
    const packs = DV.DATA.COIN_PACKS || [];
    const cfg = DV.DATA.POWER_PASS;
    const owned = !!(profile.powerPass && profile.powerPass.bought);
    $("#storeBody").innerHTML = `
      <h2><img class="wcoin" src="assets/wcoin.png" alt="" /> W COIN STORE</h2>
      <button class="btn" id="btnUltBundle">ULTIMATE LEGACY BUNDLE · 300 W COINS</button>
      <p class="coins"><img class="wcoin" src="assets/wcoin.png" alt="" />${profile.coins} W COINS</p>
      <p class="info-moves">Buy W Coins with PayPal. Payment goes to DoubleYou Studio.</p>
      <button class="pass-store-btn" id="btnStorePass" ${owned ? "disabled" : ""} title="Buy Power Pass">
        <video src="assets/pass_loop.mp4" autoplay muted loop playsinline></video>
        <span>${owned ? "POWER PASS OWNED" : "BUY POWER PASS · " + cfg.price + " W COINS"}</span>
      </button>
      <div class="pack-grid">
        ${packs.map((p) => `<button class="btn pack-btn" data-pack="${p.id}"><b>${p.name}</b><span>$${p.usd}</span></button>`).join("")}
      </div>
      <div class="promo-box">
        <h3>PROMO CODE</h3>
        <div class="equip-row">
          <input id="promoInput" type="text" placeholder="ENTER CODE" autocomplete="off" />
          <button class="btn" id="btnPromo">APPLY</button>
        </div>
        <p id="promoMsg" class="info-moves">${profile.promoUnlock ? "All items unlocked." : ""}</p>
      </div>`;
    const passBtn = $("#btnStorePass");
    if (passBtn && !owned) passBtn.onclick = () => { DV.audio.ui(); buyPowerPass(openStore); };
    $("#storeBody").querySelectorAll("[data-pack]").forEach((b) => {
      b.onclick = () => buyCoinPack(b.dataset.pack);
    });
    const applyCode = () => {
      const raw = (($("#promoInput") && $("#promoInput").value) || "").trim().toUpperCase();
      if (raw === "KASIEMOBI2026W") {
        DV.profile.applyPromo(profile);
        DV.profile.save(profile); DV._profile = profile;
        DV.audio.ui();
        openStore();
        if ($("#promoMsg")) $("#promoMsg").textContent = "Code accepted. All items unlocked.";
      } else if ($("#promoMsg")) {
        $("#promoMsg").textContent = "Invalid code.";
      }
    };
    if ($("#btnUltBundle")) $("#btnUltBundle").onclick = () => {
      if (profile.ownedUltLegacy) { alert("Ultimate Legacy Bundle already owned."); return; }
      if ((profile.coins || 0) < 300) { alert("Not enough W Coins."); return; }
      profile.coins -= 300;
      profile.ownedUltLegacy = true;
      profile.ownedEmotes = profile.ownedEmotes || [];
      ["supernova", "eclipse", "thunderstrike", "tsunami", "ironreign", "venomstorm"].forEach((id) => {
        if (profile.ownedEmotes.indexOf(id) < 0) profile.ownedEmotes.push(id);
      });
      DV.profile.save(profile);
      openStore();
    };
    if ($("#promoInput")) $("#promoInput").onkeydown = (e) => { if (e.key === "Enter") applyCode(); };
    show("store");
  }

  let passChar = "inferna";
  function buyPowerPass(then) {
    const cfg = DV.DATA.POWER_PASS;
    const pass = DV.profile.ensurePass(profile);
    if (pass.bought) return then && then();
    if ((Number(profile.coins) || 0) < cfg.price) {
      alert("Not enough W Coins to buy the Power Pass.");
      return;
    }
    profile.coins -= cfg.price;
    pass.bought = true;
    if (DV.profile.addBought) DV.profile.addBought(profile, { id: "powerpass", type: "pass", name: "Power Pass", coins: cfg.price });
    if (DV.profile.notifyStudio) DV.profile.notifyStudio("purchase", { username: profile.name, email: profile.email || "guest", item: "Power Pass", coins: cfg.price });
    DV.profile.save(profile); DV._profile = profile;
    refreshHeader();
    if (then) then();
  }

  function openPowerPass() {
    const cfg = DV.DATA.POWER_PASS;
    const pass = DV.profile.ensurePass(profile);
    const chars = Object.values(DV.DATA.CHARACTERS);
    const names = chars.map((c) => {
      const played = DV.profile.passRounds(profile, c.id);
      const lv = DV.profile.passLevel(profile, c.id);
      const next = Math.min(10, lv + 1) * 11;
      const left = lv >= 10 ? 0 : Math.max(0, next - played);
      return `<button class="btn pass-name" data-passchar="${c.id}">${c.name}<span>${played} matches, ${left} to Level ${Math.min(10, lv + 1)}</span></button>`;
    }).join("");
    $("#passBody").innerHTML = `
      <p class="info-moves">Choose a character. You earn that character's Power Pass by playing them. Buy the pass to claim rewards.</p>
      <p class="coins"><img class="wcoin" src="assets/wcoin.png" alt="" />${profile.coins} W COINS</p>
      <p>${pass.bought
        ? '<span style="color:#7dff9a">POWER PASS OWNED</span>'
        : `<button class="btn" id="btnBuyPass">BUY POWER PASS · ${cfg.price} W COINS</button>`}</p>
      <div class="pass-names">${names}</div>`;
    $("#passBody").querySelectorAll("[data-passchar]").forEach((b) => {
      b.onclick = () => { DV.audio.ui(); openPassRewards(b.dataset.passchar); };
    });
    const buy = $("#btnBuyPass");
    if (buy) buy.onclick = () => { DV.audio.ui(); buyPowerPass(openPowerPass); };
    show("powerpass");
  }

  function openPassRewards(id) {
    const cfg = DV.DATA.POWER_PASS;
    const pass = DV.profile.ensurePass(profile);
    passChar = id;
    const ch = DV.DATA.CHARACTERS[id];
    const rounds = DV.profile.passRounds(profile, id);
    const unlocked = DV.profile.passLevel(profile, id);
    const claimed = (pass.claimed[id] || []);
    const skinName = (cfg.skins[id] && cfg.skins[id].name) || "Skin";
    const rows = cfg.levels.map((row) => {
      const ready = unlocked >= row.lv;
      const taken = claimed.indexOf(row.lv) >= 0;
      let award = row.reward;
      if (row.lv === 10) award = skinName;
      if (row.later) award += " · COMING LATER";
      let act = "LOCKED";
      if (!pass.bought) act = ready ? "BUY PASS TO CLAIM" : "LOCKED";
      else if (taken) act = "OWNED";
      else if (ready) act = "CLAIM";
      const claimBtn = pass.bought && ready && !taken ? `<button class="btn" data-claim="${row.lv}">CLAIM</button>` : act;
      return `<tr>
        <td>LEVEL ${row.lv}</td>
        <td>${row.rounds} ROUNDS</td>
        <td class="pass-award">${award}</td>
        <td>${claimBtn}</td>
      </tr>`;
    }).join("");
    const boost = profile.cpBoost || { charges: 0 };
    let extras = "";
    if (unlocked >= 5) extras += `<p><button class="btn" data-equip="pfp">EQUIP ${ch.name.toUpperCase()} PROFILE PICTURE</button></p>`;
    if (unlocked >= 7) extras += `<p><button class="btn" data-equip="frame">EQUIP ${ch.name.toUpperCase()} BANNER FRAME</button></p>`;
    if (unlocked >= 8) extras += `<p><button class="btn" data-equip="banner">EQUIP ${ch.name.toUpperCase()} NAME BANNER</button></p>`;
    if (pass.gauntletRevealed) extras += `<p><button class="btn" id="btnOpenGauntlet">VICTORY GAUNTLET</button></p>`;
    $("#passBody").innerHTML = `
      <p><button class="btn" id="btnPassBack">ALL CHARACTERS</button></p>
      <h3 style="color:#ffd24a;margin:8px 0">${ch.name} REWARDS</h3>
      ${(() => {
        const per = cfg.roundsPerLevel || 150;
        const into = rounds % per;
        const need = unlocked >= 10 ? per : per;
        const nextNeed = unlocked >= 10 ? rounds : (unlocked + 1) * per;
        const pct = unlocked >= 10 ? 100 : Math.min(100, Math.round((into / per) * 100));
        return `<p>${rounds} / ${nextNeed} rounds · Level ${unlocked} / 10</p>
        <div class="pass-meter"><span style="width:${pct}%"></span></div>
        <p class="info-moves">${unlocked >= 10 ? "MAX LEVEL" : (per - into) + " matches to level " + (unlocked + 1)}</p>`;
      })()}
      <p class="info-moves">11 completed Quick, Competitive, or Campaign matches per level. Practice does not count.</p>
      <p class="coins"><img class="wcoin" src="assets/wcoin.png" alt="" />${profile.coins} W COINS${boost.charges ? " · 2x CP " + boost.charges + "/25" : ""}</p>
      <p>${pass.bought
        ? '<span style="color:#7dff9a">POWER PASS OWNED</span>'
        : `<button class="btn" id="btnBuyPass">BUY POWER PASS · ${cfg.price} W COINS</button>`}</p>
      <div class="table-wrap"><table class="info-table">
        <tr><th>LEVEL</th><th>ROUNDS NEEDED</th><th>AWARD</th><th></th></tr>
        ${rows}
      </table></div>
      ${extras}`;
    const back = $("#btnPassBack");
    if (back) back.onclick = () => { DV.audio.ui(); openPowerPass(); };
    const buy = $("#btnBuyPass");
    if (buy) buy.onclick = () => { DV.audio.ui(); buyPowerPass(() => openPassRewards(id)); };
    const gbtn = $("#btnOpenGauntlet");
    if (gbtn) gbtn.onclick = () => { DV.audio.ui(); openGauntletHub(); };
    $("#passBody").querySelectorAll("[data-equip]").forEach((b) => {
      b.onclick = () => {
        DV.audio.ui();
        if (b.dataset.equip === "pfp") profile.pfp = "pass-" + id;
        if (b.dataset.equip === "frame") pass.frame = id;
        if (b.dataset.equip === "banner") pass.banner = id;
        DV.profile.save(profile); DV._profile = profile;
        refreshHeader();
      };
    });
    $("#passBody").querySelectorAll("[data-claim]").forEach((b) => {
      b.onclick = () => {
        DV.audio.ui();
        if (!pass.bought) return;
        const lv = Number(b.dataset.claim);
        if (DV.profile.passLevel(profile, id) < lv) return;
        const granted = DV.profile.grantPassLevel(profile, id, lv);
        if (DV.profile.addEarned) DV.profile.addEarned(profile, { id: "pass-" + id + "-" + lv, type: "pass", name: "Level " + lv });
        DV.profile.save(profile); DV._profile = profile;
        refreshHeader();
        if (granted.reveal) queueGauntletReveal();
        else openPassRewards(id);
      };
    });
    show("powerpass");
  }

  function openGauntletHub() {
    const pass = DV.profile.ensurePass(profile);
    if (!pass.gauntletRevealed) return;
    const eligible = Object.keys(DV.DATA.CHARACTERS).filter((id) => DV.profile.passLevel(profile, id) >= 10);
    const names = eligible.map((id) => DV.DATA.CHARACTERS[id].name).join(", ") || "None";
    const tier = pass.finalist || "bronze";
    $("#passBody").innerHTML = `
      <p><button class="btn" id="btnPassBack">BACK</button></p>
      <img src="assets/pass/gauntlet.jpg" alt="" style="width:100%;max-width:420px" />
      <h3 style="color:#ffd24a">VICTORY GAUNTLET</h3>
      <p><img src="assets/pass/badge/${tier}.jpg" alt="" style="width:72px;height:72px;vertical-align:middle" /> ${tier.toUpperCase()} FINALIST</p>
      <p class="info-moves">Eligible heroes: ${names}</p>
      <p class="info-moves">Gauntlet matches do not award Power Pass rounds and do not use the 2x CP coin. Bracket format is coming.</p>
      <p class="info-moves">Wins needed for badge upgrades: Silver 1 · Gold 2 · Diamond 3.</p>`;
    $("#btnPassBack").onclick = () => { DV.audio.ui(); openPowerPass(); };
    show("powerpass");
  }

  function openSettings() {
    $("#btnMute").textContent = DV.audio.isMuted() ? "UNMUTE AUDIO" : "MUTE AUDIO";
    const st = $("#accountStatus");
    if (st) {
      st.textContent = profile.registered
        ? ("Signed in as " + profile.name + " · " + profile.email)
        : ("Guest · " + profile.name);
    }
    if ($("#acctMsg")) $("#acctMsg").textContent = "";
    show("settings");
  }
  $("#btnMute").onclick = () => {
    DV.audio.setMuted(!DV.audio.isMuted());
    $("#btnMute").textContent = DV.audio.isMuted() ? "UNMUTE AUDIO" : "MUTE AUDIO";
  };
  if ($("#btnSignup")) $("#btnSignup").onclick = () => {
    const res = DV.profile.signup(profile, $("#acctEmail").value, $("#acctUser").value);
    if ($("#acctMsg")) $("#acctMsg").textContent = res.ok ? "Account saved. +50 W Coins granted. Competitive stats and mastery stay with this email." : (res.error || "Could not sign up.");
    if (res.ok) { refreshHeader(); openSettings(); }
    DV.audio.ui();
  };
  if ($("#btnLogin")) $("#btnLogin").onclick = () => {
    const res = DV.profile.login($("#acctEmail").value);
    if (res.ok && res.profile) profile = res.profile;
    if ($("#acctMsg")) $("#acctMsg").textContent = res.ok ? "Logged in. Progress loaded." : (res.error || "Could not log in.");
    if (res.ok) { refreshHeader(); openSettings(); }
    DV.audio.ui();
  };

  if ($("#btnMatchHistory")) {
    $("#btnMatchHistory").onclick = () => {
      DV.audio.ui();
      openMatchHistory(viewedName || profile.name);
    };
  }
  if ($("#btnMatchesBack")) {
    $("#btnMatchesBack").onclick = () => {
      DV.audio.ui();
      openProfileView(viewedName);
    };
  }
  if ($("#btnReplayBack")) {
    $("#btnReplayBack").onclick = () => {
      DV.audio.ui();
      openMatchHistory(viewedName || profile.name);
    };
  }
  if ($("#btnWatchMatch")) {
    $("#btnWatchMatch").onclick = () => {
      DV.audio.ui();
      startWatch();
    };
  }
  if ($("#repPlay")) $("#repPlay").onclick = () => {
    if (!watchState) return;
    watchState.paused = false;
    watchState.speed = 1;
    if (!watchState.running) {
      watchState.running = true;
      watchState.last = performance.now();
      watchRaf = requestAnimationFrame(tickWatch);
    }
  };
  if ($("#repPause")) $("#repPause").onclick = () => { if (watchState) watchState.paused = true; };
  if ($("#repRewind")) $("#repRewind").onclick = () => {
    if (!watchState) return;
    watchState.paused = false;
    watchState.speed = watchState.speed < 0 ? (watchState.speed === -1 ? -2 : -4) : -1;
  };
  if ($("#repFF")) $("#repFF").onclick = () => {
    if (!watchState) return;
    watchState.paused = false;
    watchState.speed = watchState.speed > 1 ? (watchState.speed === 2 ? 4 : 2) : 2;
  };
  if ($("#repScrub")) $("#repScrub").oninput = () => {
    if (!watchState) return;
    watchState.i = Number($("#repScrub").value) || 0;
    paintWatch();
  };
  if ($("#repExit")) $("#repExit").onclick = () => {
    stopWatch();
    DV.audio.ui();
    if (viewedReplay) openReplay(viewedReplay.id, viewedName || profile.name);
    else openMatchHistory(viewedName || profile.name);
  };

  $("#btnHost").onclick = () => {
    const code = (Math.random().toString(36).slice(2, 7)).toUpperCase();
    $("#roomInput").value = code;
    hookRoom(code, true);
  };
  $("#btnJoin").onclick = () => hookRoom(($("#roomInput").value || "").toUpperCase(), false);

  function hookRoom(code, host) {
    if (!code) return;
    if (room) try { room.close(); } catch (e) {}
    room = new BroadcastChannel("dv_" + code);
    $("#roomStatus").textContent = host ? "Room " + code + " — waiting for opponent in another tab…" : "Joined " + code + " — waiting…";
    room.onmessage = (ev) => {
      if (ev.data === "hello") {
        room.postMessage("hello");
        $("#roomStatus").textContent = "Connected. Starting Quick Match.";
        startSelect("quick", false);
      }
    };
    room.postMessage("hello");
  }

  if (DV.editor) {
    DV.editor.freezeDefaults();
    DV.editor.applySaved();
  }

  let logoTaps = [];
  const logo = document.querySelector(".logo-wrap img");
  if (logo) {
    logo.addEventListener("click", (e) => {
      const now = Date.now();
      logoTaps = logoTaps.filter((t) => now - t < 2600);
      logoTaps.push(now);
      if (logoTaps.length >= 7) {
        logoTaps = [];
        e.stopPropagation();
        const gp = $("#gatePass");
        if (gp) gp.value = "";
        const ge = $("#gateErr");
        if (ge) ge.textContent = "";
        show("gate");
      }
    });
  }
  const gateGo = $("#gateGo");
  if (gateGo) {
    gateGo.onclick = () => {
      const code = ($("#gatePass").value || "");
      if (DV.editor && DV.editor.checkPass(code)) {
        $("#gateErr").textContent = "";
        DV.editor.openEditor();
      } else {
        $("#gateErr").textContent = "Access denied.";
        $("#gatePass").value = "";
      }
    };
    $("#gatePass").addEventListener("keydown", (e) => {
      if (e.key === "Enter") gateGo.click();
    });
  }

  const hubVid = document.getElementById("hubVid");
  function playHubVideo() {
    if (!hubVid) return;
    hubVid.muted = true;
    hubVid.loop = true;
    hubVid.playsInline = true;
    hubVid.setAttribute("playsinline", "");
    hubVid.setAttribute("webkit-playsinline", "");
    try { hubVid.playbackRate = 1; } catch (e) {}
    const run = () => hubVid.play().catch(() => {});
    if (hubVid.readyState < 2) {
      hubVid.load();
      hubVid.addEventListener("canplay", run, { once: true });
    }
    run();
  }
  playHubVideo();
  document.addEventListener("pointerdown", playHubVideo);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) playHubVideo(); });
  function waitGameReady() {
    return new Promise((resolve) => {
      const urls = [
        "assets/credits/produced.jpg",
        "assets/credits/thanks.jpg",
        "assets/wcoin.png",
        "assets/menu_loop.mp4"
      ];
      Object.values(DV.DATA.CHARACTERS || {}).forEach((c) => {
        urls.push(c.portrait);
        urls.push("assets/select/" + c.id + "_panel.jpg");
        urls.push("assets/pass/banner/" + c.id + ".jpg");
        urls.push("assets/pass/frame/" + c.id + ".jpg");
      });
      let left = urls.length;
      let settled = false;
      const ping = () => {
        left -= 1;
        if (left <= 0 && !settled) { settled = true; resolve(); }
      };
      urls.forEach((u) => {
        if (/\.mp4$/i.test(u)) {
          const v = document.createElement("video");
          v.preload = "auto";
          v.muted = true;
          v.src = u;
          v.oncanplaythrough = ping;
          v.onerror = ping;
          try { v.load(); } catch (e) { ping(); }
        } else {
          const im = new Image();
          im.onload = ping;
          im.onerror = ping;
          im.src = u;
        }
      });
      setTimeout(() => { if (!settled) { settled = true; resolve(); } }, 18000);
    });
  }

  function playBootSplash() {
    const root = document.getElementById("bootSplash");
    const img = document.getElementById("bootImg");
    const loadEl = document.getElementById("bootLoad");
    if (!root || !img) {
      DV.audio.startMusic("menu");
      return;
    }
    let finished = false;
    let ready = false;
    let slidesDone = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (loadEl) loadEl.classList.remove("on");
      root.classList.add("done");
      try { DV.audio.startMusic("menu"); } catch (e) {}
      try { if (DV.render.unlockVideos) DV.render.unlockVideos(); } catch (e) {}
      try { playHubVideo(); } catch (e) {}
    };
    root.addEventListener("click", finish);
    window.addEventListener("keydown", finish);
    waitGameReady().then(() => {
      ready = true;
      if (slidesDone) finish();
    });
    setTimeout(finish, 8000);
    const slides = [
      "assets/credits/produced.jpg",
      "assets/credits/thanks.jpg"
    ];
    let i = 0;
    function showSlide() {
      img.classList.remove("on", "flash");
      img.src = slides[i];
      requestAnimationFrame(() => {
        img.classList.add("on", "flash");
        try { DV.audio.unlock(); DV.audio.logoSting(); } catch (e) {}
        setTimeout(() => img.classList.remove("flash"), 180);
      });
      setTimeout(() => {
        if (i < slides.length - 1) {
          img.classList.remove("on");
          setTimeout(() => {
            i += 1;
            showSlide();
          }, 1000);
        } else {
          slidesDone = true;
          if (loadEl) loadEl.classList.add("on");
          if (ready) finish();
        }
      }, 2500);
    }
    const kick = () => { try { DV.audio.unlock(); } catch (e) {} };
    window.addEventListener("pointerdown", kick, { once: true });
    showSlide();
  }

  DV.render.preload();
  document.addEventListener("pointerdown", () => {
    try { if (DV.render.unlockVideos) DV.render.unlockVideos(); } catch (e) {}
    playHubVideo();
  }, { once: true });
  refreshHeader();
  grantPendingPack();
  window.addEventListener("pointerdown", () => DV.audio.unlock(), { once: true });
  playBootSplash();
})();

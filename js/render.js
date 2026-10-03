(function (g) {
  const portraits = {};
  const bodies = {};
  const atlases = {};
  const videos = {};
  const modeSkin = new Image();
  modeSkin.src = "assets/videos/shade/mode_skin.png";
  const crownModeSkin = new Image();
  crownModeSkin.src = "assets/videos/crown/mode_skin.png";
  const vidOff = document.createElement("canvas");
  const arenaImg = new Image();
  arenaImg.src = "assets/arena_play.jpg";
  const arenaVid = document.createElement("video");
  arenaVid.src = "assets/arena_loop.mp4";
  arenaVid.muted = true;
  arenaVid.loop = true;
  arenaVid.playsInline = true;
  arenaVid.preload = "auto";
  arenaVid.setAttribute("playsinline", "");
  arenaVid.setAttribute("webkit-playsinline", "");
  try { arenaVid.play().catch(() => {}); } catch (e) {}
  const studioVid = document.createElement("video");
  studioVid.src = "assets/arena_studio.mp4";
  studioVid.muted = true;
  studioVid.loop = true;
  studioVid.playsInline = true;
  studioVid.preload = "auto";
  studioVid.setAttribute("playsinline", "");
  studioVid.setAttribute("webkit-playsinline", "");
  try { studioVid.play().catch(() => {}); } catch (e) {}
  const INFERNA_VIDS = ["idle","walk","run","jump","djump","fall","land","punch","fireball","fly","slam","counter","hurt","knockback","block","down","ult","upper"];
  const SHADE_VIDS = ["idle", "walk", "run", "jump", "djump", "fall", "land", "hurt", "knockback", "down", "punch", "teleport", "teleport_in", "slash", "kick", "proj", "mode", "ult", "shadow_idle", "shadow_walk", "shadow_jump", "shadow_fall", "shadow_punch", "shadow_bolt"];
  const LUMEN_VIDS = ["idle", "walk", "run", "jump", "djump", "fall", "land", "hurt", "knockback", "down", "punch", "ult", "dash", "dashback", "shock", "faze", "multi"];
  const TIDE_VIDS = ["idle", "walk", "jump", "djump", "fall", "land", "hurt", "knockback", "down", "punch", "whip", "guard", "wave", "dash", "ult", "whip_bolt", "wave_bolt"];
  const CROWN_VIDS = ["idle", "walk", "jump", "djump", "fall", "land", "hurt", "knockback", "down", "punch", "ult", "fly", "proj", "guard", "mode", "mode_out", "slam", "kick", "metal_idle", "metal_walk", "metal_jump", "metal_punch", "metal_land", "metal_bolt"];
  const VIPER_VIDS = ["idle", "walk", "run", "jump", "djump", "fall", "land", "hurt", "knockback", "down", "punch", "kick", "spin", "gas", "bite", "gasjump", "mode", "mode_out", "ult", "venom", "gascloud"];
  const VID_ALIAS = {
    crouchpunch: "punch", punch: "punch", run: "walk",
    win: "idle", block: "block", guard: "guard",
    waterdash: "dash", flamedash: "dash", shadowdash: "dash",
    viperdash: "kick", coil: "spin"
  };

  const DRAW_W = 96;
  const DRAW_H = 144;
  const VID_W = 118;
  const VID_H = 176;

  const ALIAS = {
    fly: "fly", shock: "shock", counter: "counter", land: "land",
    djump: "djump",
    guard: "block", mode: "mode", proj: "proj", fireball: "fireball",
    slash: "slash", waterdash: "dash", whip: "whip", coil: "coil",
    bite: "bite", multi: "multi", faze: "faze", teleport: "teleport",
    upper: "upper", flamedash: "dash", shadowdash: "dash", viperdash: "dash",
    spit: "spit", wave: "wave", field: "ult", slam: "slam",
    waterdash: "waterdash", punch: "crouchpunch",
  };

  function vidBank() {
    let box = document.getElementById("vidBank");
    if (!box) {
      box = document.createElement("div");
      box.id = "vidBank";
      box.setAttribute("aria-hidden", "true");
      box.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none";
      document.body.appendChild(box);
    }
    return box;
  }
  function bindVidSrc(v, id, name, eager, skin) {
    const file = ((id === "inferna" || id === "shade" || id === "lumen" || id === "tide" || id === "crown" || id === "viper") && name === "fall") ? "down" : name;
    const paths = skin ? [
      "assets/videos/" + id + "/" + skin + "/" + file + ".webm",
      "assets/videos/" + id + "/" + file + ".webm",
      "videos/" + id + "/" + file + ".webm"
    ] : [
      "assets/videos/" + id + "/" + file + ".webm",
      "videos/" + id + "/" + file + ".webm"
    ];
    let i = 0;
    v.setAttribute("playsinline", "");
    v.setAttribute("webkit-playsinline", "");
    v.muted = true;
    v.playsInline = true;
    v.preload = eager ? "auto" : "metadata";
    v.dataset.char = id;
    v.dataset.move = name;
    v.src = paths[0];
    if (eager) { try { v.load(); } catch (e) {} }
    v.addEventListener("error", function onErr() {
      i += 1;
      if (i < paths.length) {
        v.src = paths[i];
        try { v.load(); } catch (e) {}
      } else v.removeEventListener("error", onErr);
    });
    vidBank().appendChild(v);
  }
  function warmVideos(id) {
    Object.keys(videos).forEach((k) => {
      if (!k.startsWith(id + ".")) return;
      const v = videos[k];
      if (!v) return;
      v.preload = "auto";
      try { v.load(); } catch (e) {}
      v.play().then(() => v.pause()).catch(() => {});
    });
  }
  function unlockVideos() {
    try { arenaVid.play().catch(() => {}); } catch (e) {}
    try { studioVid.play().catch(() => {}); } catch (e) {}
    Object.keys(videos).forEach((k) => {
      const v = videos[k];
      if (!v) return;
      v.muted = true;
      v.play().then(() => { if (v.loop !== true) v.pause(); }).catch(() => {});
    });
  }

  function preload() {
    Object.values(g.DV.DATA.CHARACTERS).forEach((c) => {
      const im = new Image(); im.src = c.portrait; portraits[c.id] = im;
      const bd = new Image(); bd.src = "assets/bodies/" + c.id + ".png"; bodies[c.id] = bd;
      const at = new Image(); at.src = "assets/atlas/" + c.id + ".png"; atlases[c.id] = at;
    });
    const CORE = { idle: 1, walk: 1, run: 1, jump: 1, punch: 1 };
    INFERNA_VIDS.forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "inferna", name, !!CORE[name]);
      v.muted = true;
      v.loop = (name === "idle" || name === "walk" || name === "run" || name === "block");
      if (name === "idle" || name === "walk" || name === "run") v.dataset.nokey = "1";
      v.playsInline = true;
      v.playbackRate = name === "idle" ? 1.05 : (name === "upper" ? 0.72 : ((name === "down" || name === "fall") ? 1.2 : ((name === "fireball" || name === "slam" || name === "counter" || name === "ult") ? 1 : 1.55)));
      if (name === "down" || name === "fall") v.dataset.nokey = "1";
      v.addEventListener("ended", () => {
        try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
        v.pause();
      });
      videos["inferna." + name] = v;
    });
    ["punch", "jump", "land", "down", "slam", "ult", "upper", "djump", "fireball", "counter", "idle", "hurt", "pose", "combo"].forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "inferna", name, true, "phoenix");
      v.muted = true;
      v.playsInline = true;
      v.loop = name === "idle";
      v.playbackRate = name === "idle" ? 1.1 : (name === "punch" ? 1.55 : 1.45);
      v.dataset.nokey = "1";
      if (name !== "idle") {
        v.addEventListener("ended", () => {
          try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
          v.pause();
        });
      }
      videos["inferna.phoenix." + name] = v;
    });
    videos["inferna.phoenix.fall"] = videos["inferna.phoenix.jump"];
    videos["inferna.phoenix.knockback"] = videos["inferna.phoenix.down"];
    videos["inferna.phoenix.walk"] = videos["inferna.walk"];
    videos["inferna.phoenix.run"] = videos["inferna.walk"];
    videos["inferna.fall"] = videos["inferna.jump"];
    SHADE_VIDS.forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "shade", name, !!CORE[name]);
      v.muted = true;
      v.loop = (name === "idle" || name === "walk" || name === "run" || name === "block" || name === "shadow_idle" || name === "shadow_walk");
      if (/^(idle|walk|run|shadow_idle|shadow_walk)$/.test(name)) v.dataset.nokey = "1";
      v.playsInline = true;
      if (name === "down" || name === "fall") v.dataset.nokey = "1";
      v.playbackRate = name === "idle" ? 1.05 : ((name === "down" || name === "fall") ? 1.15 : ((name === "teleport" || name === "teleport_in" || name === "mode") ? 1 : ((name === "proj" || name === "ult") ? 1 : 1.45)));
      v.addEventListener("ended", () => {
        try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
        v.pause();
      });
      videos["shade." + name] = v;
    });
    ["idle", "pose", "punch", "ult", "teleport", "teleport_in", "kick", "proj", "jump", "down", "combo"].forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "shade", name, true, "midknight");
      v.muted = true;
      v.playsInline = true;
      v.loop = name === "idle";
      v.dataset.nokey = "1";
      v.playbackRate = name === "idle" ? 1.15 : (name === "punch" || name === "kick" || name === "proj" ? 1.45 : (name === "teleport" || name === "teleport_in" ? 1.35 : 1.2));
      if (name !== "idle") {
        v.addEventListener("ended", () => {
          try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
          v.pause();
        });
      }
      videos["shade.midknight." + name] = v;
    });
    videos["shade.midknight.slash"] = videos["shade.midknight.kick"];
    videos["shade.midknight.fall"] = videos["shade.midknight.jump"];
    videos["shade.midknight.land"] = videos["shade.midknight.jump"];
    videos["shade.midknight.djump"] = videos["shade.midknight.jump"];
    videos["shade.midknight.knockback"] = videos["shade.midknight.down"];
    LUMEN_VIDS.forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "lumen", name, !!CORE[name]);
      v.muted = true;
      v.loop = (name === "idle" || name === "walk" || name === "run" || name === "block" || name === "faze");
      if (/^(idle|walk|run)$/.test(name)) v.dataset.nokey = "1";
      v.playsInline = true;
      if (name === "down" || name === "fall") v.dataset.nokey = "1";
      v.playbackRate = name === "idle" ? 1.05 : ((name === "down" || name === "fall") ? 1.2 : (name === "ult" ? 1 : 1.4));
      v.addEventListener("ended", () => {
        try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
        v.pause();
      });
      videos["lumen." + name] = v;
    });
    TIDE_VIDS.forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "tide", name, !!CORE[name]);
      v.muted = true;
      v.loop = (name === "idle" || name === "walk" || name === "run");
      v.playsInline = true;
      if (name === "idle" || name === "walk" || name === "run" || name === "down" || name === "fall") v.dataset.nokey = "1";
      else v.dataset.keyplate = "1";
      v.playbackRate = name === "idle" ? 1.12 : ((name === "down" || name === "fall") ? 1.2 : (name === "whip_bolt" || name === "wave_bolt" ? 1.55 : (name === "whip" ? 1.35 : 1.4)));
      v.addEventListener("ended", () => {
        try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
        v.pause();
      });
      videos["tide." + name] = v;
    });
    ["idle", "walk", "jump", "hurt", "punch", "ult", "shock", "faze", "multi", "pose", "combo"].forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "lumen", name, true, "bright");
      v.muted = true; v.playsInline = true; v.dataset.nokey = "1";
      v.loop = name === "idle" || name === "walk" || name === "faze";
      v.playbackRate = name === "idle" ? 1.1 : (name === "pose" ? 1.15 : 1.35);
      if (name !== "idle" && name !== "walk") {
        v.addEventListener("ended", () => { try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {} v.pause(); });
      }
      videos["lumen.bright." + name] = v;
    });
    videos["lumen.bright.dash"] = videos["lumen.bright.walk"];
    videos["lumen.bright.run"] = videos["lumen.bright.walk"];
    videos["lumen.bright.land"] = videos["lumen.bright.jump"];
    videos["lumen.bright.fall"] = videos["lumen.bright.jump"];
    videos["lumen.bright.djump"] = videos["lumen.bright.jump"];
    videos["lumen.bright.knockback"] = videos["lumen.bright.hurt"];
    ["idle", "punch", "wave", "whip", "jump", "hurt", "down", "combo"].forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "tide", name, true, "aqua");
      v.muted = true; v.playsInline = true; v.dataset.nokey = "1";
      v.loop = name === "idle";
      v.playbackRate = name === "idle" ? 1.1 : 1.3;
      if (name !== "idle") {
        v.addEventListener("ended", () => { try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {} v.pause(); });
      }
      videos["tide.aqua." + name] = v;
    });
    videos["tide.aqua.dash"] = videos["tide.aqua.whip"];
    videos["tide.aqua.land"] = videos["tide.aqua.jump"];
    videos["tide.aqua.fall"] = videos["tide.aqua.jump"];
    videos["tide.aqua.djump"] = videos["tide.aqua.jump"];
    videos["tide.aqua.knockback"] = videos["tide.aqua.hurt"];
    ["pose", "combo"].forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "tide", name, true, "aqua");
      v.muted = true; v.playsInline = true; v.dataset.nokey = "1";
      v.playbackRate = 1.15;
      v.addEventListener("ended", () => { try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {} v.pause(); });
      videos["tide.aqua." + name] = v;
    });
    ["idle", "walk", "jump", "hurt", "punch", "proj", "guard", "down", "pose", "mode", "mode_out", "metal_idle", "metal_walk", "metal_jump", "metal_punch", "metal_kick", "metal_slam", "metal_down", "combo"].forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "crown", name, true, "queen");
      v.muted = true; v.playsInline = true; v.dataset.nokey = "1";
      v.loop = name === "idle" || name === "walk" || name === "metal_idle" || name === "metal_walk";
      v.playbackRate = (name === "idle" || name === "metal_idle") ? 1.1 : 1.3;
      if (name !== "idle" && name !== "walk" && name !== "metal_idle" && name !== "metal_walk") {
        v.addEventListener("ended", () => { try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {} v.pause(); });
      }
      videos["crown.queen." + name] = v;
    });
    videos["crown.queen.run"] = videos["crown.queen.walk"];
    videos["crown.queen.land"] = videos["crown.queen.jump"];
    videos["crown.queen.fall"] = videos["crown.queen.jump"];
    videos["crown.queen.djump"] = videos["crown.queen.jump"];
    videos["crown.queen.knockback"] = videos["crown.queen.hurt"];
    videos["crown.queen.metal_land"] = videos["crown.queen.metal_jump"];
    CROWN_VIDS.forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "crown", name, !!CORE[name]);
      v.muted = true;
      v.loop = (name === "idle" || name === "walk" || name === "run" || name === "fly" || name === "metal_idle" || name === "metal_walk" || name === "metal_bolt");
      if (/^(idle|walk|run|metal_idle|metal_walk)$/.test(name)) v.dataset.nokey = "1";
      v.playsInline = true;
      if (name === "down" || name === "fall") v.dataset.nokey = "1";
      else v.dataset.keyplate = "1";
      v.playbackRate = name === "idle" ? 1.15 : ((name === "down" || name === "fall") ? 1.2 : (name === "proj" ? 1 : (name === "fly" ? 1.2 : 1.4)));
      v.addEventListener("ended", () => {
        try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
        v.pause();
      });
      videos["crown." + name] = v;
    });
    VIPER_VIDS.forEach((name) => {
      const v = document.createElement("video");
      bindVidSrc(v, "viper", name, !!CORE[name]);
      v.muted = true;
      v.loop = (name === "idle" || name === "walk" || name === "run");
      v.playsInline = true;
      if (name === "idle" || name === "walk" || name === "run" || name === "down" || name === "fall") v.dataset.nokey = "1";
      else v.dataset.keyblack = "1";
      v.playbackRate = name === "idle" ? 1.2 : ((name === "down" || name === "fall") ? 1.35 : (name === "gasjump" ? 2.35 : (name === "spin" ? 3.05 : (name === "mode" || name === "mode_out" ? 2.45 : (name === "kick" || name === "dash" || name === "coil" || name === "gas" || name === "spit" || name === "proj" ? 2.35 : (name === "jump" || name === "djump" || name === "land" || name === "hurt" || name === "knockback" || name === "bite" || name === "punch" ? 1.85 : (name === "ult" ? 1.55 : 1.5)))))));
      v.addEventListener("ended", () => {
        try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
        v.pause();
      });
      videos["viper." + name] = v;
    });
    ["inferna", "shade", "lumen", "tide", "crown", "viper"].forEach((id) => {
      const v = document.createElement("video");
      bindVidSrc(v, id, "emote", true);
      v.muted = true;
      v.playsInline = true;
      v.loop = false;
      v.dataset.nokey = "1";
      v.playbackRate = 1;
      v.addEventListener("ended", () => {
        try { v.currentTime = Math.max(0, (v.duration || 0) - 0.04); } catch (e) {}
        v.pause();
      });
      videos[id + ".emote"] = v;
    });
    for (let i = 0; i < 3; i++) {
      const tv = document.createElement("video");
      tv.muted = true;
      tv.loop = true;
      tv.playsInline = true;
      tv.preload = "auto";
      tv.dataset.keyplate = "1";
      tv.src = "assets/videos/viper/gas_trail.webm";
      tv.playbackRate = 2.15;
      videos["fx.gas_trail" + i] = tv;
    }
  }

  function pickVid(id, name, skin) {
    const sk = skin && skin !== "default" ? skin : "";
    return (sk && videos[id + "." + sk + "." + name]) ||
      (sk && videos[id + "." + sk + "." + (VID_ALIAS[name] || "")]) ||
      videos[id + "." + name] ||
      videos[id + "." + (VID_ALIAS[name] || "")] ||
      (name === "run" ? videos[id + ".walk"] : null) ||
      (name === "djump" ? videos[id + ".jump"] : null) ||
      (name === "down" ? (videos[id + ".down"] || videos[id + ".fall"] || videos[id + ".knockback"] || videos[id + ".hurt"]) : null) ||
      (name === "win" ? videos[id + ".idle"] : null) ||
      videos[id + ".idle"] || null;
  }
  function infernaVideo(anim, skin) {
    return pickVid("inferna", VID_ALIAS[anim] || anim, skin);
  }
  function shadeVideo(anim, skin) {
    return pickVid("shade", VID_ALIAS[anim] || anim, skin);
  }
  function lumenVideo(anim, skin) {
    return pickVid("lumen", VID_ALIAS[anim] || anim, skin);
  }
  function tideVideo(anim, skin) {
    const name = VID_ALIAS[anim] || anim;
    const sk = skin && skin !== "default" ? skin : "";
    if (sk && videos["tide." + sk + "." + name]) return videos["tide." + sk + "." + name];
    if (name === "run") return videos["tide.walk"] || null;
    if (name === "block" || name === "guard") return videos["tide.guard"] || videos["tide.block"] || null;
    if (name === "waterdash" || name === "dash") return videos["tide.dash"] || null;
    return videos["tide." + name] || null;
  }
  function crownVideo(anim, skin) {
    const name = VID_ALIAS[anim] || anim;
    const sk = skin && skin !== "default" ? skin : "";
    if (sk && videos["crown." + sk + "." + name]) return videos["crown." + sk + "." + name];
    if (name === "run") return videos["crown.walk"] || null;
    if (name === "block" || name === "guard") return videos["crown.guard"] || videos["crown.block"] || null;
    return videos["crown." + name] || null;
  }
  function crownMetalVideo(anim, skin) {
    const map = {
      idle: "metal_idle", walk: "metal_walk", run: "metal_walk",
      jump: "metal_jump", djump: "metal_jump",
      fall: "metal_land", land: "metal_land",
      punch: "metal_punch", crouchpunch: "metal_punch",
      kick: "metal_kick", slam: "metal_slam", down: "metal_down", knockback: "metal_down"
    };
    const name = map[anim] || anim;
    const sk = skin && skin !== "default" ? skin : "";
    if (sk && videos["crown." + sk + "." + name]) return videos["crown." + sk + "." + name];
    if (map[anim]) return videos["crown." + map[anim]] || null;
    return crownVideo(anim, skin);
  }
  function viperVideo(anim) {
    const name = VID_ALIAS[anim] || anim;
    if (name === "run") return videos["viper.walk"] || null;
    if (name === "djump") return videos["viper.jump"] || videos["viper.djump"] || null;
    if (name === "fall") return videos["viper.fall"] || videos["viper.jump"] || null;
    if (name === "land") return videos["viper.land"] || videos["viper.fall"] || videos["viper.jump"] || null;
    if (name === "knockback") return videos["viper.knockback"] || videos["viper.hurt"] || null;
    if (name === "dash" || name === "viperdash") return videos["viper.kick"] || null;
    if (name === "coil") return videos["viper.spin"] || videos["viper.coil"] || null;
    if (name === "spit" || name === "proj") return videos["viper.gas"] || videos["viper.proj"] || null;
    return videos["viper." + name] || videos["viper.idle"] || null;
  }
  function charVideo(id, anim, skin) {
    if (id === "inferna") return infernaVideo(anim, skin);
    if (id === "shade") return shadeVideo(anim, skin);
    if (id === "lumen") return lumenVideo(anim, skin);
    if (id === "tide") return tideVideo(anim, skin);
    if (id === "crown") return crownVideo(anim, skin);
    if (id === "viper") return viperVideo(anim);
    return null;
  }

  function isPlateBg(r, gch, b, blackOnly) {
    const lum = (r + gch + b) / 3;
    const sat = (r > gch ? r : gch) > b ? ((r > gch ? r : gch) - (r < gch ? (r < b ? r : b) : (gch < b ? gch : b))) : (b - (r < gch ? r : gch));
    if (blackOnly) return lum <= 30 && gch <= 40;
    if (gch > 175 && r < 90 && b < 90 && gch > r + 70) return true;
    if (lum >= 210 && sat <= 28) return true;
    return false;
  }

  function keyPlate(d, w, h, blackOnly) {
    const n = w * h;
    const seen = new Uint8Array(n);
    const stack = [];
    const push = (x, y) => {
      if (x < 0 || y < 0 || x >= w || y >= h) return;
      const idx = y * w + x;
      if (seen[idx]) return;
      const p = idx * 4;
      if (!isPlateBg(d[p], d[p + 1], d[p + 2], blackOnly)) return;
      seen[idx] = 1;
      stack.push(idx);
    };
    for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
    for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
    while (stack.length) {
      const idx = stack.pop();
      const x = idx % w;
      const y = (idx / w) | 0;
      d[idx * 4 + 3] = 0;
      push(x - 1, y); push(x + 1, y); push(x, y - 1); push(x, y + 1);
    }
  }

  function drawKeyedVideo(ctx, video, dx, dy, dw, dh) {
    if (!video || video.readyState < 1) return false;
    vidOff.width = dw;
    vidOff.height = dh;
    const o = vidOff.getContext("2d");
    o.clearRect(0, 0, dw, dh);
    o.drawImage(video, 0, 0, dw, dh);
    if (video.dataset.nokey !== "1") {
      try {
        const img = o.getImageData(0, 0, dw, dh);
        keyPlate(img.data, dw, dh, video.dataset.keyblack === "1");
        if (video.dataset.keyplate === "1") {
          const d = img.data;
          for (let i = 0; i < d.length; i += 4) {
            if (d[i + 3] === 0) continue;
            const r = d[i], gch = d[i + 1], b = d[i + 2];
            const lum = (r + gch + b) / 3;
            const mx = r > gch ? r : gch; const mxx = mx > b ? mx : b;
            const mn = r < gch ? r : gch; const mnn = mn < b ? mn : b;
            const sat = mxx - mnn;
            if (lum >= 200 && sat <= 48) d[i + 3] = 0;
          }
        }
        o.putImageData(img, 0, 0);
      } catch (e) {}
    }
    ctx.drawImage(vidOff, dx, dy);
    return true;
  }

  function clipOf(f, name) {
    const pack = g.DV.SPRITES && g.DV.SPRITES.chars && g.DV.SPRITES.chars[f.id];
    if (!pack) return null;
    return pack[name] || pack[ALIAS[name] || ""] || pack.idle || pack.walk || null;
  }

  function currentFrame(f) {
    const clip = clipOf(f, f.anim);
    if (!clip || !clip.frames.length) return null;
    const i = Math.max(0, Math.min(f.frame | 0, clip.frames.length - 1));
    return clip.frames[i];
  }

  function drawShadow(ctx, f) {
    const floor = (g.DV.engine.floorY && g.DV.engine.floorY(window.DV && window.DV._match)) || g.DV.engine.FLOOR_Y;
    const air = Math.max(0, floor - f.y);
    const s = Math.max(0.28, 1 - air / 260);
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0," + (0.4 * s) + ")";
    ctx.beginPath();
    ctx.ellipse(f.x, floor + 6, 22 * s, 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFighter(ctx, f, t) {
    const fr = currentFrame(f);
    const at = atlases[f.id];
    const body = bodies[f.id];
    const frozen = f.freeze > 0;

    ctx.save();
    ctx.translate(f.x, f.y);
    ctx.scale(f.face, 1);
    if (f.invuln > 0) ctx.globalAlpha = 0.62 + Math.sin(t * 22) * 0.2;
    if (f.lastHurt > 0 && !frozen) ctx.globalAlpha = 0.82;
    const skins = (g.DV.DATA.SKINS && g.DV.DATA.SKINS[f.id]) || [];
    const skin = skins.find((s) => s.id === (f.skin || "default")) || skins[0] || { filter: "none", tint: null };
    if (skin.filter && skin.filter !== "none") ctx.filter = skin.filter;

    let drewVid = false;
    const shadeSkinOn = false;
    const queenOn = f.id === "crown" && f.skin === "queen";
    const crownMetalMove = f.id === "crown" && f.metal > 0 && /^(idle|walk|run|jump|djump|fall|land|punch|crouchpunch|kick|slam|down|knockback)$/.test(f.anim);
    const crownSkinOn = f.id === "crown" && f.metal > 0 && !queenOn && !crownMetalMove && !/^(mode|mode_out|slam|kick)$/.test(f.anim);
    if (shadeSkinOn && modeSkin.complete && modeSkin.naturalWidth) {
      ctx.shadowColor = "#9b5cff";
      ctx.shadowBlur = 18;
      const vw = VID_W, vh = VID_H;
      vidOff.width = vw; vidOff.height = vh;
      const o = vidOff.getContext("2d");
      o.clearRect(0, 0, vw, vh);
      o.drawImage(modeSkin, 0, 0, vw, vh);
      try {
        const img = o.getImageData(0, 0, vw, vh);
        const d = img.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 1] > 175 && d[i] < 90 && d[i + 2] < 90 && d[i + 1] > d[i] + 70) d[i + 3] = 0;
        }
        o.putImageData(img, 0, 0);
      } catch (e) {}
      ctx.drawImage(vidOff, -vw / 2, -vh + 6);
      ctx.shadowBlur = 0;
      drewVid = true;
    } else if (crownSkinOn && crownModeSkin.complete && crownModeSkin.naturalWidth) {
      ctx.shadowColor = "#d4af37";
      ctx.shadowBlur = 16;
      const vw = VID_W, vh = VID_H;
      vidOff.width = vw; vidOff.height = vh;
      const oc = vidOff.getContext("2d");
      oc.clearRect(0, 0, vw, vh);
      oc.drawImage(crownModeSkin, 0, 0, vw, vh);
      try {
        const img = oc.getImageData(0, 0, vw, vh);
        keyPlate(img.data, vw, vh);
        oc.putImageData(img, 0, 0);
      } catch (e) {}
      ctx.drawImage(vidOff, -vw / 2, -vh + 6);
      ctx.shadowBlur = 0;
      drewVid = true;
    } else if (f.id === "inferna" || f.id === "shade" || f.id === "lumen" || f.id === "tide" || f.id === "crown" || f.id === "viper") {
      const gasSkinOn = f.id === "viper" && f.gasMode > 0 && f.anim !== "mode" && f.anim !== "mode_out";
      const shadeShadowOn = f.id === "shade" && (f.shadowMode || 0) > 0 && f.anim !== "mode";
      const shadeShadowName = ({
        idle: "shadow_idle", walk: "shadow_walk", run: "shadow_walk",
        hurt: "shadow_idle", knockback: "shadow_idle",
        jump: "shadow_jump", djump: "shadow_jump",
        fall: "shadow_fall", land: "shadow_fall",
        punch: "shadow_punch", slash: "shadow_punch", kick: "shadow_punch"
      })[f.anim];
      const vv = gasSkinOn ? (videos["viper.mode"] || charVideo(f.id, f.anim))
        : (shadeShadowOn ? (videos["shade." + (shadeShadowName || "shadow_idle")] || charVideo(f.id, f.anim))
        : (crownMetalMove ? crownMetalVideo(f.anim, f.skin) : charVideo(f.id, f.anim, f.skin)));
      if (vv) {
        if (gasSkinOn) {
          try { if (vv.duration) vv.currentTime = Math.max(0, vv.duration - 0.04); } catch (e) {}
          if (!vv.paused) vv.pause();
        } else if (f._vidAnim !== f.anim) {
          f._vidAnim = f.anim;
          try { vv.currentTime = 0; } catch (e) {}
        }
        if (!gasSkinOn && vv.paused) vv.play().catch(() => {});
        if (!vv.dataset.baseRate) vv.dataset.baseRate = String(vv.playbackRate || 1);
        vv.playbackRate = Math.min(3.4, Number(vv.dataset.baseRate || 1) * (f.animBoost || 1));
        ctx.shadowColor = f.data.color;
        ctx.shadowBlur = f.ult > 0 ? 22 : 10;
        const big = /^(idle|walk|run|jump|djump|fall|land|punch|crouchpunch|hurt|knockback|fly|fireball|slam|counter|ult|teleport|teleport_in|slash|kick|proj|dash|dashback|shock|faze|multi|whip|guard|wave|spin|coil|gas|spit|bite|gasjump|mode|mode_out|upper|emote)$/.test(f.anim);
        let vw = (f.id === "lumen" || f.id === "tide" || f.id === "crown" || f.id === "viper") ? VID_W : (big ? VID_W : DRAW_W);
        let vh = (f.id === "lumen" || f.id === "tide" || f.id === "crown" || f.id === "viper") ? VID_H : (big ? VID_H : DRAW_H);
        if (f.id === "tide" && (f.anim === "whip" || f.anim === "wave")) { vw = VID_W; vh = VID_H; }
        if (f.id === "crown" && f.metal > 0) { vw = Math.round(vw * 1.056); vh = Math.round(vh * 1.056); }
        drewVid = drawKeyedVideo(ctx, vv, -vw / 2, -vh + 6, vw, vh);
        ctx.shadowBlur = 0;
      }
    }
    const useAtlas = !drewVid && fr && at && at.complete && at.naturalWidth;
    if (useAtlas) {
      ctx.shadowColor = f.data.color;
      ctx.shadowBlur = f.ult > 0 ? 22 : 10;
      ctx.drawImage(at, fr.x, fr.y, fr.w, fr.h, -DRAW_W / 2, -DRAW_H + 6, DRAW_W, DRAW_H);
      ctx.shadowBlur = 0;
    } else if (!drewVid && body && body.complete && body.naturalWidth) {
      ctx.drawImage(body, -DRAW_W / 2, -DRAW_H + 6, DRAW_W, DRAW_H);
    }

    if (f.shieldHp > 0) {
      ctx.strokeStyle = f.data.color2;
      ctx.globalAlpha = 0.7;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(0, -DRAW_H * 0.45, 48, 88, 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (skin.tint) {
      ctx.filter = "none";
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 1;
      ctx.fillStyle = skin.tint;
      ctx.fillRect(-DRAW_W / 2 - 10, -DRAW_H - 4, DRAW_W + 20, DRAW_H + 16);
      ctx.globalCompositeOperation = "source-over";
    }
    ctx.filter = "none";
    if ((f.biteMark || 0) > 0) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 0.42 + Math.sin(t * 14) * 0.18;
      ctx.fillStyle = "#3dff6a";
      ctx.fillRect(-DRAW_W / 2, -DRAW_H + 6, DRAW_W, DRAW_H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    } else if (f.burnFlash > 0) {
      ctx.globalCompositeOperation = "source-atop";
      ctx.globalAlpha = 0.55 + Math.sin(t * 40) * 0.2;
      ctx.fillStyle = "#ff1a1a";
      ctx.fillRect(-DRAW_W / 2, -DRAW_H + 6, DRAW_W, DRAW_H);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
    } else if (f.hitFlash > 0 || (frozen && f.lastHurt > 0)) {
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.32;
      ctx.fillStyle = "#fff";
      ctx.fillRect(-DRAW_W / 2, -DRAW_H + 6, DRAW_W, DRAW_H);
    }
    ctx.restore();
    if (f.shockMark > 0) {
      const pulse = 1.15 + Math.sin(t * 12) * 0.12;
      ctx.save();
      ctx.translate(f.x, f.y - 262);
      ctx.scale(pulse, pulse);
      ctx.shadowColor = "#ffe24a";
      ctx.shadowBlur = 16;
      ctx.fillStyle = "#ffe24a";
      ctx.strokeStyle = "#fff8c4";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(8, -22);
      ctx.lineTo(-6, 0);
      ctx.lineTo(3, 0);
      ctx.lineTo(-8, 22);
      ctx.lineTo(6, 3);
      ctx.lineTo(-3, 3);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
  }

  function arenaVideoFor(m) {
    const id = m && m.arena && m.arena.id;
    if (id === "studio") return studioVid;
    return arenaVid;
  }
  function drawArena(ctx, m, w, h) {
    const vid = arenaVideoFor(m);
    if (vid && vid.readyState >= 2) {
      try {
        if (vid.paused) vid.play().catch(() => {});
        ctx.drawImage(vid, 0, 0, w, h);
      } catch (e) {
        ctx.fillStyle = "#0b1020"; ctx.fillRect(0, 0, w, h);
      }
    } else {
      ctx.fillStyle = "#0b1020";
      ctx.fillRect(0, 0, w, h);
    }
    // Subtle dim so fighters read clearly on the bright sunset
    ctx.fillStyle = "rgba(6,8,18,0.12)";
    ctx.fillRect(0, 0, w, h);
    // Invisible debug floor line (very subtle) matching platform edges
    const L = g.DV.engine.ARENA_L, R = g.DV.engine.ARENA_R;
    const F = (g.DV.engine.floorY && g.DV.engine.floorY(m)) || g.DV.engine.FLOOR_Y;
    ctx.fillStyle = "rgba(255,210,80,0.06)";
    ctx.fillRect(L, F + 2, R - L, 2);
  }

  function bar(ctx, x, y, w, h, pct, c1, c2) {
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(x, y, w, h);
    const grd = ctx.createLinearGradient(x, y, x + w, y);
    grd.addColorStop(0, c1); grd.addColorStop(1, c2);
    ctx.fillStyle = grd;
    ctx.fillRect(x + 2, y + 2, Math.max(0, (w - 4) * Math.max(0, Math.min(1, pct))), h - 4);
    ctx.strokeStyle = "rgba(255,255,255,0.22)";
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }


  function drawUltraFx(ctx, m, t, w, h) {
    (m.p || []).forEach((f) => {
      if (!f || f.ultraOn <= 0) return;
      if (f.id === "inferna") {
        const a = 0.35 + 0.45 * Math.abs(Math.sin(t * 10));
        ctx.save();
        ctx.strokeStyle = "rgba(255,120,20," + a + ")";
        ctx.lineWidth = 8;
        ctx.strokeRect(f.x - 46, f.y - 168, 92, 168);
        ctx.restore();
      }
      if (f.id === "tide" && Math.floor(t * 2) % 2 === 0) {
        ctx.save();
        ctx.strokeStyle = "rgba(80,190,255,0.9)";
        ctx.lineWidth = 7;
        ctx.strokeRect(f.x - 46, f.y - 168, 92, 168);
        ctx.restore();
      }
    });
    if (m.viperWave) {
      const wv = m.viperWave;
      ctx.save();
      ctx.strokeStyle = "rgba(70,255,110,0.85)";
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    if (m.viperTint > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(40,180,60,0.16)";
      ctx.fillRect(0, 0, w, h);
      ctx.restore();
    }
  }

  function hud(ctx, m) {
    const a = m.p[0], b = m.p[1];
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.fillRect(0, 0, 1280, 96);
    bar(ctx, 36, 28, 430, 20, a.hp / a.maxHp, "#ff3b3b", "#ffb347");
    bar(ctx, 814, 28, 430, 20, b.hp / b.maxHp, "#ffb347", "#ff3b3b");
    const oa = (g.DV.engine.overshieldAmt ? g.DV.engine.overshieldAmt(a) : 0) / 50;
    const ob = (g.DV.engine.overshieldAmt ? g.DV.engine.overshieldAmt(b) : 0) / 50;
    if (oa > 0) bar(ctx, 36, 28, 430 * oa, 20, 1, "#f4f7ff", "#d7dde8");
    if (ob > 0) bar(ctx, 814, 28, 430 * ob, 20, 1, "#d7dde8", "#f4f7ff");
    ctx.fillStyle = "#fff";
    ctx.font = "700 11px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    const names = (g.DV.engine && g.DV.engine.USE_NAME) || {};
    function useLine(f, x) {
      const bits = Object.keys(f.uses || {}).map((k) => (names[k] || k) + " " + f.uses[k]);
      ctx.fillText(bits.join("  "), x, 70);
    }
    useLine(a, 36);
    ctx.textAlign = "right";
    useLine(b, 1244);
    ctx.textAlign = "center";
    ctx.fillStyle = "#ffe24a";
    ctx.font = "800 13px sans-serif";
    const lab = g.DV.engine.comboLabel || ((s) => (s || []).join(" "));
    ctx.fillText("P1 COMBO  " + lab(a.comboSeq), 250, 88);
    ctx.fillText("P2 COMBO  " + lab(b.comboSeq), 1030, 88);
    ctx.fillStyle = "#fff";
    ctx.font = "800 13px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(Math.max(0, Math.ceil(a.hp)) + " / " + a.maxHp, 251, 43);
    ctx.fillText(Math.max(0, Math.ceil(b.hp)) + " / " + b.maxHp, 1029, 43);
    ctx.fillStyle = "#fff";
    ctx.font = "700 14px 'Trebuchet MS', sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(a.data.name, 36, 22);
    ctx.textAlign = "right";
    ctx.fillText(b.data.name, 1244, 22);
    ctx.textAlign = "center";
    function yb(txt, x, y, size) {
      ctx.font = "800 " + size + "px 'Trebuchet MS', sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = "#ffe24a";
      ctx.strokeText(txt, x, y);
      ctx.fillText(txt, x, y);
    }
    const clock = m.matchClock || m.time || 0;
    const remain = m.practice ? "∞" : Math.max(0, Math.ceil(m.matchLimit - clock));
    yb(String(remain), 640, 34, 22);
    ctx.font = "700 13px sans-serif";
    ctx.fillStyle = "#ddd";
    ctx.lineWidth = 1;
    ctx.fillText((m.sudden ? "SUDDEN DEATH  " : "KILLS  ") + m.score[0] + "  —  " + m.score[1], 640, 54);
    const el = Math.max(0, clock);
    const em = Math.floor(el / 60);
    const es = Math.floor(el % 60);
    yb(em + ":" + String(es).padStart(2, "0"), 640, 74, 16);
    if (!m.practice && false && clock >= m.ultUnlock && a.energy >= 10 && a.ult <= 0) {
      ctx.save();
      ctx.globalAlpha = 0.65 + Math.sin(performance.now() / 160) * 0.35;
      ctx.fillStyle = "#ffd24a";
      ctx.font = "800 16px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("ULTIMATE READY", 36, 78);
      ctx.restore();
    }
    if (a.flying > 0) {
      ctx.fillStyle = "#ffb347";
      ctx.font = "800 13px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("FLY " + a.flying.toFixed(1) + "s", 300, 78);
    }
    if (m.practice) {
      const moves = ((a.data && a.data.moves) || []).map((mv) => mv.name).slice(0, 6).join(" · ");
      ctx.fillStyle = "#9ad";
      ctx.font = "700 12px sans-serif";
      ctx.textAlign = "left";
      ctx.fillText("PRACTICE  ·  " + a.data.name + "  ·  " + moves, 36, 640);
    }
    const useInputs = (g.DV.engine && g.DV.engine.USE_INPUT) || {};
    const useNames = (g.DV.engine && g.DV.engine.USE_NAME) || names;
    function abilityRow(f, cx) {
      const keys = Object.keys(f.uses || {});
      const n = Math.max(1, keys.length);
      const wcell = 78;
      const x0 = cx - (n * wcell) / 2;
      keys.forEach((k, i) => {
        const x = x0 + i * wcell + wcell / 2;
        ctx.textAlign = "center";
        ctx.fillStyle = "#ffe24a";
        ctx.font = "800 12px sans-serif";
        ctx.fillText(String(f.uses[k]), x, 648);
        ctx.fillStyle = "#fff";
        ctx.font = "700 10px sans-serif";
        ctx.fillText(useNames[k] || k.split(":")[1], x, 662);
        ctx.fillStyle = "#9ad";
        ctx.font = "600 9px sans-serif";
        ctx.fillText(useInputs[k] || "", x, 674);
      });
    }
    abilityRow(a, 430);
    ctx.fillStyle = "#ffe24a";
    ctx.font = "800 16px sans-serif";
    ctx.textAlign = "right";
    ctx.fillText("ULTRA " + Math.floor(a.ultra || 0) + "%", 1248, 692);
    if (m.timing) {
      const bar = m.timing;
      const pos = Math.max(0, Math.min(1, bar.t / bar.dur));
      const x = 140, y = 600, bw = 1000, bh = 42;
      ctx.fillStyle = "rgba(0,0,0,0.72)";
      ctx.fillRect(x, y, bw, bh);
      function seg(a0, a1, col) {
        ctx.fillStyle = col;
        ctx.fillRect(x + bw * a0, y, bw * (a1 - a0), bh);
      }
      seg(0, 0.22, "#c62828");
      seg(0.22, 0.42, "#f0c040");
      seg(0.42, 0.58, "#2eaf4a");
      seg(0.58, 0.78, "#f0c040");
      seg(0.78, 1, "#c62828");
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x + bw * pos, y - 6);
      ctx.lineTo(x + bw * pos, y + bh + 6);
      ctx.stroke();
      ctx.fillStyle = "#fff";
      ctx.font = "800 14px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("LEFT CLICK", x + bw / 2, y - 10);
    }
  }

  function drawProj(ctx, p) {
    if (p.kind === "gascloud") {
      const vv = videos["viper.gascloud"];
      if (vv) {
        if (vv.paused) vv.play().catch(() => {});
        const face = (p.vx || 1) >= 0 ? 1 : -1;
        const pw = 240, ph = 110;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(face, 1);
        drawKeyedVideo(ctx, vv, -pw * 0.25, -ph / 2, pw, ph);
        ctx.restore();
        return;
      }
    }
    if (p.kind === "venom") {
      const vv = videos["viper.venom"];
      if (vv) {
        if (vv.paused) vv.play().catch(() => {});
        const face = (p.vx || 1) >= 0 ? 1 : -1;
        const pw = 230, ph = 90;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(face, 1);
        drawKeyedVideo(ctx, vv, -pw * 0.2, -ph / 2, pw, ph);
        ctx.restore();
        return;
      }
    }
    if (p.kind === "metalUltra" || p.kind === "metal") {
      const big = p.kind === "metalUltra";
      const vv = videos["crown.metal_bolt"];
      if (vv) {
        if (!p._vidOn) { try { vv.currentTime = 0; } catch (e) {} p._vidOn = 1; }
        if (vv.paused) vv.play().catch(() => {});
        const face = (p.vx || 1) >= 0 ? 1 : -1;
        const pw = big ? 450 : 150, ph = big ? 234 : 78;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(face, 1);
        drawKeyedVideo(ctx, vv, -pw * 0.62, -ph / 2, pw, ph);
        ctx.restore();
        return;
      }
      if (big) {
        ctx.save();
        ctx.fillStyle = "#ffd24a";
        ctx.beginPath(); ctx.arc(p.x, p.y, 54, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        return;
      }
    }
    if (p.kind === "whip") {
      const vv = videos["tide.whip_bolt"];
      if (vv) {
        if (!p._vidOn) { try { vv.currentTime = 0; } catch (e) {} p._vidOn = 1; }
        if (vv.paused) vv.play().catch(() => {});
        const face = (p.vx || 1) >= 0 ? 1 : -1;
        const pw = 280, ph = 120;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(face, 1);
        drawKeyedVideo(ctx, vv, -pw * 0.15, -ph / 2, pw, ph);
        ctx.restore();
        return;
      }
    }
    if (p.kind === "water") {
      const vv = videos["tide.wave_bolt"] || videos["tide.wave"];
      if (vv) {
        if (vv.paused) vv.play().catch(() => {});
        const face = (p.vx || 1) >= 0 ? 1 : -1;
        const pw = 260, ph = 120;
        ctx.save();
        ctx.translate(p.x, p.y + 18);
        ctx.scale(face, 1);
        drawKeyedVideo(ctx, vv, -pw * 0.35, -ph + 8, pw, ph);
        ctx.restore();
        return;
      }
    }
    if (p.kind === "shadow") {
      const vv = videos["shade.shadow_bolt"];
      if (vv) {
        if (vv.paused) vv.play().catch(() => {});
        const face = (p.vx || 1) >= 0 ? 1 : -1;
        const pw = 220, ph = 118;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.scale(face, 1);
        drawKeyedVideo(ctx, vv, -pw * 0.58, -ph / 2, pw, ph);
        ctx.restore();
        return;
      }
    }
    const col = p.kind === "fireball" ? "#ff7a20" : p.kind === "shadow" ? "#b46bff" : p.kind === "metal" ? "#eee8c8" : p.kind === "water" ? "#6ad0ff" : p.kind === "gascloud" ? "#ffe14a" : "#6dff5a";
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    const grd = ctx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.r * 2.2);
    grd.addColorStop(0, "#fff");
    grd.addColorStop(0.35, col);
    grd.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = grd;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function render(ctx, m) {
    const w = 1280, h = 720;
    ctx.save();
    const sh = m.shake || 0;
    const stop = m.hitstop || 0;
    ctx.translate((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh);
    if (stop > 0.08) ctx.translate(0, -Math.min(4, stop * 30));
    drawArena(ctx, m, w, h);
    if (!(m.arena && m.arena.scroll)) {
      ctx.fillStyle = "rgba(180,20,20,0.10)";
      ctx.fillRect(0, g.DV.engine.FLOOR_Y + 20, g.DV.engine.ARENA_L, 200);
      ctx.fillRect(g.DV.engine.ARENA_R, g.DV.engine.FLOOR_Y + 20, w - g.DV.engine.ARENA_R, 200);
    }
    const cam = m.cam || { x: 640, y: 360, z: 1 };
    ctx.save();
    ctx.translate(640, 360);
    ctx.scale(cam.z || 1, cam.z || 1);
    ctx.translate(-cam.x, -360);
    const t = performance.now() / 1000;
    m.p.forEach((f) => drawShadow(ctx, f));
    m.fx.forEach((e) => {
      if (e.kind !== "trail") return;
      const a = 1 - e.t / e.life;
      const face = e.face || 1;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = Math.max(0, a * 0.55);
      ctx.fillStyle = e.c || "#ffe24a";
      ctx.beginPath();
      ctx.ellipse(e.x - face * 10, e.y - 78, 22 + (1 - a) * 36, 52, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = Math.max(0, a * 0.28);
      ctx.fillRect(e.x - face * 70, e.y - 150, face * 90, 150);
      ctx.restore();
    });
    m.pools.forEach((pl) => {
      ctx.save();
      if (pl.gas) {
        const tv = videos["fx.gas_trail" + (pl.slot || 0)] || videos["fx.gas_trail0"];
        if (tv) {
          if (!pl._trailStarted) {
            pl._trailStarted = true;
            try { tv.currentTime = 0; } catch (e) {}
            tv.play().catch(() => {});
          } else if (tv.paused) tv.play().catch(() => {});
          const fade = Math.max(0.28, Math.min(1, pl.t / 1.5));
          ctx.globalAlpha = fade;
          ctx.shadowColor = "#46ff6e";
          ctx.shadowBlur = 14;
          drawKeyedVideo(ctx, tv, pl.x - 120, pl.y - 100, 240, 160);
        } else {
          ctx.fillStyle = "rgba(60,255,80,0.34)";
          ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 4, 48, 22, 0, 0, Math.PI * 2); ctx.fill();
        }
      } else {
        ctx.fillStyle = "rgba(80,220,60,0.28)";
        ctx.shadowColor = "#3adf4a";
        ctx.shadowBlur = 8;
        ctx.beginPath(); ctx.ellipse(pl.x, pl.y + 4, 70, 16, 0, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    });
    m.p.forEach((f) => drawFighter(ctx, f, t));
    (m.p || []).forEach((f) => {
      const label = (m.names && m.names[f.side]) || (f.data && f.data.name) || "";
      if (!label) return;
      ctx.save();
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.font = "800 13px 'Trebuchet MS', sans-serif";
      ctx.lineWidth = 4;
      ctx.strokeStyle = "#000";
      ctx.fillStyle = f.side === 1 ? "#ffe24a" : "#f3e7c8";
      ctx.strokeText(label, f.x, f.y + 10);
      ctx.fillText(label, f.x, f.y + 10);
      ctx.restore();
    });
    m.projectiles.forEach((p) => drawProj(ctx, p));
    m.fx.forEach((e) => {
      if (e.kind === "trail") return;
      const a = 1 - e.t / e.life;
      ctx.save();
      ctx.globalAlpha = Math.max(0, a);
      ctx.globalCompositeOperation = "lighter";
      if (e.kind === "whip") {
        const face = e.face || 1;
        const reach = 340 * Math.min(1, e.t / Math.max(0.12, e.life * 0.45));
        ctx.strokeStyle = e.c || "#4ec8ff";
        ctx.lineWidth = 10;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.quadraticCurveTo(e.x + face * reach * 0.45, e.y - 130, e.x + face * reach, e.y - 20);
        ctx.stroke();
        ctx.lineWidth = 4;
        ctx.strokeStyle = "#d9f6ff";
        ctx.stroke();
        ctx.restore();
        return;
      }
      ctx.fillStyle = e.c || "#fff";
      ctx.beginPath(); ctx.arc(e.x, e.y - 40, 10 + e.t * 90, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    });
    m.floats.forEach((e) => {
      ctx.globalAlpha = 1 - e.t / 0.8;
      ctx.fillStyle = e.crit ? "#ffe14a" : "#fff";
      ctx.font = (e.crit ? "800 22px" : "700 16px") + " sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(String(e.n), e.x, e.y);
      ctx.globalAlpha = 1;
    });
    ctx.restore();
    if (m.rain > 0) {
      ctx.save();
      ctx.fillStyle = "rgba(40,90,160,0.18)";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(170,220,255,0.55)";
      ctx.lineWidth = 2;
      for (let i = 0; i < 160; i++) {
        const rx = (i * 97 + t * 520) % w;
        const ry = (i * 53 + t * 980) % h;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 4, ry + 18); ctx.stroke();
      }
      ctx.strokeStyle = "rgba(210,240,255,0.35)";
      ctx.lineWidth = 1;
      for (let i = 0; i < 90; i++) {
        const rx = (i * 61 + t * 760) % w;
        const ry = (i * 41 + t * 1200) % h;
        ctx.beginPath(); ctx.moveTo(rx, ry); ctx.lineTo(rx + 2, ry + 10); ctx.stroke();
      }
      ctx.restore();
    }
    if (m.hitstop > 0) {
      ctx.globalAlpha = Math.min(0.18, m.hitstop * 1.4);
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, w, h);
      ctx.globalAlpha = 1;
    }
    drawUltraFx(ctx, m, t, w, h);
    hud(ctx, m);
    if (m.overlay) {
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, 280, w, 120);
      ctx.fillStyle = "#ffe08a";
      ctx.font = "800 64px 'Trebuchet MS', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(m.overlay, 640, 360);
    }
    ctx.restore();
    const lumenUlt = (m.lumenTint > 0) || (m.p || []).find((f) => f && f.id === "lumen" && (f.ult > 0 || f.ultraOn > 0));
    if (lumenUlt) {
      const pulse = 0.16 + 0.08 * Math.abs(Math.sin((m.time || 0) * 6));
      ctx.save();
      ctx.fillStyle = "rgba(255, 220, 40," + pulse + ")";
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = "rgba(255, 226, 74, 0.85)";
      ctx.lineWidth = 18;
      ctx.strokeRect(8, 8, w - 16, h - 16);
      ctx.strokeStyle = "rgba(40, 20, 0, 0.45)";
      ctx.lineWidth = 6;
      ctx.strokeRect(18, 18, w - 36, h - 36);
      ctx.restore();
    }
    if (m.blackout[0] > 0 && m.blackout[1] > 0) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
    } else if (m.blackout[0] > 0) {
      ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w / 2, h);
    } else if (m.blackout[1] > 0) {
      ctx.fillStyle = "#000"; ctx.fillRect(w / 2, 0, w / 2, h);
    }
  }

  function studioClock() {
    if (studioVid && studioVid.readyState >= 2) return studioVid.currentTime || 0;
    return 0;
  }
  g.DV = g.DV || {};
  g.DV.render = { preload, render, portraits, studioClock, warmVideos, unlockVideos };
})(window);

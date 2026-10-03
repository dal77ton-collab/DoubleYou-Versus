(function (g) {
  const DB_NAME = "dv_replays_v1";
  const STORE = "replays";

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) { resolve(null); return; }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    });
  }

  function snap(m) {
    return {
      t: Math.round((m.time || 0) * 100) / 100,
      r: m.round || 1,
      s: [m.score[0] || 0, m.score[1] || 0],
      ph: m.phase || "fight",
      p: (m.p || []).map((f) => ({
        id: f.id,
        x: Math.round(f.x),
        y: Math.round(f.y),
        face: f.face,
        anim: f.anim,
        hp: Math.round(f.hp),
        en: Math.round(f.energy),
        dead: !!f.dead,
        fly: f.flying > 0 ? 1 : 0,
        mark: f.shockMark > 0 ? 1 : 0,
      })),
      pr: (m.projectiles || []).slice(0, 8).map((p) => ({
        x: Math.round(p.x), y: Math.round(p.y), k: p.kind || "orb", f: p.face || 1, r: p.r || 10,
      })),
    };
  }

  function begin(m) {
    m._recFrames = [];
    m._recTick = 0;
  }

  function push(m) {
    if (!m || m._replayPlaying) return;
    if (!m._recFrames) m._recFrames = [];
    m._recTick = (m._recTick || 0) + 1;
    if (m._recTick % 2 !== 0) return;
    m._recFrames.push(snap(m));
    if (m._recFrames.length > 18000) m._recFrames.shift();
  }

  async function save(id, frames, meta) {
    if (!id || !frames || !frames.length) return;
    const rec = { id, meta: meta || {}, frames, savedAt: Date.now() };
    const db = await openDb();
    if (db) {
      await new Promise((resolve) => {
        const tx = db.transaction(STORE, "readwrite");
        tx.objectStore(STORE).put(rec, id);
        tx.oncomplete = resolve;
        tx.onerror = resolve;
      });
      const keys = await new Promise((resolve) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      });
      if (keys.length > 12) {
        const extra = keys.slice(0, keys.length - 10);
        await new Promise((resolve) => {
          const tx = db.transaction(STORE, "readwrite");
          extra.forEach((k) => tx.objectStore(STORE).delete(k));
          tx.oncomplete = resolve;
          tx.onerror = resolve;
        });
      }
      return;
    }
    try {
      const slim = { id, meta, frames: frames.filter((_, i) => i % 2 === 0).slice(-4000) };
      localStorage.setItem("dv_replay_" + id, JSON.stringify(slim));
    } catch (e) {}
  }

  async function load(id) {
    const db = await openDb();
    if (db) {
      return new Promise((resolve) => {
        const tx = db.transaction(STORE, "readonly");
        const req = tx.objectStore(STORE).get(id);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror = () => resolve(null);
      });
    }
    try {
      const raw = localStorage.getItem("dv_replay_" + id);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  g.DV = g.DV || {};
  g.DV.replay = { begin, push, save, load, snap };
})(window);

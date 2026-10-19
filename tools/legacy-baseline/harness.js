/* Deterministic driver for the unmodified legacy Phaser 2.0.3 game.
 * The game's own RAF loop is stopped; Game.update(t) is called with a synthetic clock
 * advancing exactly 1000/60 ms per tick, and window.setTimeout is virtualised on that clock. */
(function () {
  var realSetTimeout = window.setTimeout.bind(window);
  var STEP = 1000 / 60;
  var H = (window.H = { virtual: false, vnow: 0, timers: [], created: null, edits: [] });

  window.setTimeout = function (fn, ms) {
    if (!H.virtual) return realSetTimeout(fn, ms);
    var rec = { fn: fn, due: H.vnow + (ms || 0) };
    H.timers.push(rec);
    return rec;
  };

  function sleep(ms) { return new Promise(function (r) { realSetTimeout(r, ms); }); }

  H.waitBoot = async function () {
    for (var i = 0; i < 200; i++) {
      if (window.Game && Game.isBooted && !Game.load.isLoading && Game.cache.checkImageKey('title') && Game.world.children.length > 0 && Game.sound.usingWebAudio === !!Game.sound.context && Game.cache.isSoundDecoded('death')) break;
      await sleep(100);
    }
    Game.raf.stop();
    Game.time.now = Game.time.time = H.vnow = performance.now();
    var names = [0, 1, 2, 3, 4, 5, 6, 7].map(function (n) { return 'Level_0_' + n; });
    names.forEach(function (name) {
      var st = Game.state.states[name];
      var orig = st.create;
      st.create = function () { var r = orig.apply(this, arguments); H.created = name; return r; };
    });
    H.names = names;
    var origUpdate = Game.time.update.bind(Game.time);
    Game.time.update = function (t) { origUpdate(t); Game.time.physicsElapsed = 1 / 60; };
  };

  H.fire = function () {
    var due = H.timers.filter(function (t) { return t.due <= H.vnow + 1e-9; });
    H.timers = H.timers.filter(function (t) { return due.indexOf(t) < 0; });
    due.sort(function (a, b) { return a.due - b.due; });
    due.forEach(function (t) { t.fn(); });
  };

  H.step = function () {
    H.vnow += STEP;
    Game.update(H.vnow);
    H.fire();
  };

  H.startLevel = async function (n) {
    H.virtual = false; H.timers = []; H.created = null;
    var name = 'Level_0_' + n;
    Game.state.start(name);
    H.vnow += STEP; Game.update(H.vnow);
    for (var i = 0; i < 400 && H.created !== name; i++) await sleep(25);
    if (H.created !== name) throw new Error('level did not load ' + name);
    H.virtual = true;
    H.vnow += STEP;
    Game.time.time = Game.time.now = H.vnow;
  };

  H.clickWorld = function (wx, wy) {
    wx = Math.round(wx); wy = Math.round(wy);
    H.lastClick = { wx: wx, wy: wy };
    var c = Game.canvas, r = c.getBoundingClientRect();
    var cx = r.left + (wx - Game.camera.x), cy = r.top + (wy - Game.camera.y);
    ['mousedown', 'mouseup'].forEach(function (t) {
      c.dispatchEvent(new MouseEvent(t, { clientX: cx, clientY: cy, bubbles: true, cancelable: true, button: 0 }));
    });
  };

  H.clickWilly = function () { H.clickWorld(Player.x, Player.y); };

  H.snap = function (t) {
    var L = Levels[0][Setup.currentLevel[1]];
    var b = Player.body;
    var tilesEdited = [];
    var data = L.map.layers[0].data;
    for (var y = 0; y < data.length; y++) for (var x = 0; x < data[y].length; x++) if (data[y][x] && data[y][x].index === 20) tilesEdited.push(x + ',' + y);
    return {
      t: t,
      sx: Player.x, sy: Player.y,
      bx: b.position.x, by: b.position.y, vx: b.velocity.x, vy: b.velocity.y,
      blk: (b.blocked.left ? 1 : 0) | (b.blocked.right ? 2 : 0) | (b.blocked.up ? 4 : 0) | (b.blocked.down ? 8 : 0),
      tch: (b.touching.left ? 1 : 0) | (b.touching.right ? 2 : 0) | (b.touching.up ? 4 : 0) | (b.touching.down ? 8 : 0),
      sc: Player.scale.x,
      alive: Player.alive ? 1 : 0, exists: Player.exists ? 1 : 0,
      cam: [Game.camera.x, Game.camera.y],
      S: { vX: Setup.velocityX, walking: Setup.walking ? 1 : 0, win: Setup.didWin ? 1 : 0, isC: Setup.isClimbing ? 1 : 0, wasC: Setup.wasClimbing ? 1 : 0, lc: Setup.ladderCheck, px: Setup.posX, dir: Setup.direction, end: Setup.endCheck, wait: Setup.wait },
      anim: Player.animations.currentAnim ? Player.animations.currentAnim.name : null,
      frame: Player.frame,
      edits: tilesEdited.join(';')
    };
  };

  H.world = function () {
    var L = Levels[0][Setup.currentLevel[1]];
    return {
      width: Game.world.width, height: Game.world.height,
      bounds: { x: Game.physics.arcade.bounds.x, y: Game.physics.arcade.bounds.y, w: Game.physics.arcade.bounds.width, h: Game.physics.arcade.bounds.height },
      willy: { x: Player.x, y: Player.y, w: Player.body.width, h: Player.body.height, bx: Player.body.position.x, by: Player.body.position.y },
      martha: { x: L.martha.x, y: L.martha.y, sx: L.martha.scale.x, bx: L.martha.body.position.x, by: L.martha.body.position.y, bw: L.martha.body.width, bh: L.martha.body.height },
      ladders: L.ladders.children.map(function (s) { return [s.x, s.y, s.body.position.x, s.body.position.y, s.body.width, s.body.height]; }),
      spikes: L.spikes.children.map(function (s) { return [s.x, s.y, s.body.position.x, s.body.position.y, s.body.width, s.body.height]; }),
      explosion: { x: L.explosion.x, y: L.explosion.y },
      cam: [Game.camera.x, Game.camera.y]
    };
  };

  /* scenario: {level, ticks, actions:[{t, type:'willy'|'tile'|'world', tx,ty,wx,wy}]} */
  H.run = async function (sc) {
    await H.startLevel(sc.level);
    var trace = [], world = H.world(), t = 0, byTick = {};
    (sc.actions || []).forEach(function (a) { (byTick[a.t] = byTick[a.t] || []).push(a); });
    var clicks = [], skipped = 0;
    for (t = 0; t < sc.ticks; t++) {
      (byTick[t] || []).forEach(function (a) {
        var tx = a.type === 'willy' ? Player.x : a.type === 'rel' ? Player.x + a.dx : a.type === 'tile' ? a.tx * 32 + 16 : a.wx;
        var ty = a.type === 'willy' ? Player.y : a.type === 'rel' ? Player.y + a.dy : a.type === 'tile' ? a.ty * 32 + 16 : a.wy;
        var sxv = Math.round(tx) - Game.camera.x, syv = Math.round(ty) - Game.camera.y;
        /* Taps on the end-screen buttons leave the level (legacy bug: the pending death timeouts then hit a destroyed emitter). Keep scenarios inside one attempt. */
        if (Setup.endCheck > 0 && sxv >= 160 && sxv < 288 && syv >= 264 && syv < 402) { skipped++; return; }
        if (a.type === 'willy') H.clickWilly();
        else if (a.type === 'rel') H.clickWorld(Player.x + a.dx, Player.y + a.dy);
        else if (a.type === 'tile') H.clickWorld(a.tx * 32 + 16, a.ty * 32 + 16);
        else H.clickWorld(a.wx, a.wy);
        clicks.push({ t: t, wx: H.lastClick.wx, wy: H.lastClick.wy, cam: [Game.camera.x, Game.camera.y] });
      });
      H.step();
      var s = H.snap(t);
      trace.push(s);
      if (sc.stopOnEnd && (Setup.endCheck > 0) && t > 0) { /* keep going a few ticks for the end screen */ sc.ticks = Math.min(sc.ticks, t + 40); }
    }
    return { scenario: sc, world: world, clicks: clicks, skipped: skipped, trace: trace };
  };
})();

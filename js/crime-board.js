/* ═══════════════════════════════════════════════
   js/crime-board.js  —  Visual Crime Board
   - Draggable media items (photo, video, audio)
   - Click to select (blue glow)
   - Connect Mode: click two items to draw a line
   - Color picker controls line color
   - Lines persist with positions in IDB
═══════════════════════════════════════════════ */

const CrimeBoard = (() => {

  let items        = [];   // { id, type, url, label, x, y }
  let connections  = [];   // { id, fromId, toId, color }
  let selectedId   = null;
  let connectMode  = false;
  let connectFirst = null; // id of first selected item in connect mode
  let canvas, ctx, board;

  // ── Utility ───────────────────────────────────
  function uid() {
    return 'bi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ── Canvas setup ─────────────────────────────
  function resizeCanvas() {
    if (!canvas || !board) return;
    canvas.width  = board.clientWidth;
    canvas.height = board.clientHeight;
    drawLines();
  }

  // ── Draw all connection lines ─────────────────
  function drawLines() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    connections.forEach(conn => {
      const a = document.getElementById('bitem-' + conn.fromId);
      const b = document.getElementById('bitem-' + conn.toId);
      if (!a || !b) return;

      const ax = parseInt(a.style.left) + a.offsetWidth  / 2;
      const ay = parseInt(a.style.top)  + a.offsetHeight / 2;
      const bx = parseInt(b.style.left) + b.offsetWidth  / 2;
      const by = parseInt(b.style.top)  + b.offsetHeight / 2;

      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.strokeStyle = conn.color || '#ff3333';
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.setLineDash([]);

      // Small dot at each end
      [{ x: ax, y: ay }, { x: bx, y: by }].forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = conn.color || '#ff3333';
        ctx.fill();
      });
    });
  }

  // ── Add an item to the board ──────────────────
  function addItem(type, url, label) {
    const item = {
      id:    uid(),
      type,
      url,
      label: label || type,
      x: 20 + Math.random() * Math.max(10, board.clientWidth  - 230),
      y: 20 + Math.random() * Math.max(10, board.clientHeight - 200)
    };
    items.push(item);
    renderItem(item);
    saveState();
    return item.id;
  }

  // ── Render one item DOM element ───────────────
  function renderItem(item) {
    const el = document.createElement('div');
    el.className  = 'board-item';
    el.id         = 'bitem-' + item.id;
    el.dataset.id = item.id;
    el.style.left = item.x + 'px';
    el.style.top  = item.y + 'px';

    // Type badge
    const badge = document.createElement('span');
    badge.className   = 'board-item-type';
    badge.textContent = item.type.toUpperCase();
    el.appendChild(badge);

    // Media content
    if (item.type === 'photo') {
      const img     = document.createElement('img');
      img.src       = item.url;
      img.draggable = false;
      el.appendChild(img);
    } else if (item.type === 'video') {
      const vid     = document.createElement('video');
      vid.src       = item.url;
      vid.controls  = true;
      vid.draggable = false;
      el.appendChild(vid);
    } else if (item.type === 'audio') {
      const ico     = document.createElement('div');
      ico.textContent = '🎤';
      ico.style.cssText = 'font-size:2.5rem;text-align:center;padding:8px 0;';
      const aud     = document.createElement('audio');
      aud.src       = item.url;
      aud.controls  = true;
      el.appendChild(ico);
      el.appendChild(aud);
    }

    // Label
    const lbl      = document.createElement('div');
    lbl.className  = 'board-item-label';
    lbl.textContent = item.label;
    el.appendChild(lbl);

    // ── Dragging ──
    makeDraggable(el, item);

    // ── Click to select / connect ──
    el.addEventListener('click', e => {
      e.stopPropagation();

      if (connectMode) {
        handleConnectClick(item.id, el);
        return;
      }

      // Normal select
      if (selectedId === item.id) {
        // Deselect
        el.classList.remove('selected');
        selectedId = null;
      } else {
        // Deselect old
        if (selectedId) {
          const old = document.getElementById('bitem-' + selectedId);
          if (old) old.classList.remove('selected');
        }
        el.classList.add('selected');
        selectedId = item.id;
      }
    });

    board.appendChild(el);
  }

  // ── Dragging logic ────────────────────────────
  function makeDraggable(el, item) {
    let dragging = false, startX, startY, origX, origY;

    el.addEventListener('mousedown', e => {
      if (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO') return;
      if (e.button !== 0) return;
      dragging = true;
      startX = e.clientX; startY = e.clientY;
      origX  = parseInt(el.style.left); origY = parseInt(el.style.top);
      el.style.zIndex = 10;
      e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const bRect = board.getBoundingClientRect();
      let nx = origX + dx;
      let ny = origY + dy;
      nx = Math.max(0, Math.min(nx, bRect.width  - el.offsetWidth));
      ny = Math.max(0, Math.min(ny, bRect.height - el.offsetHeight));
      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';
      item.x = nx; item.y = ny;
      drawLines();
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      el.style.zIndex = 2;
      saveState();
    });

    // Touch support
    el.addEventListener('touchstart', e => {
      if (e.target.tagName === 'VIDEO' || e.target.tagName === 'AUDIO') return;
      const t = e.touches[0];
      dragging = true;
      startX = t.clientX; startY = t.clientY;
      origX  = parseInt(el.style.left); origY = parseInt(el.style.top);
      el.style.zIndex = 10;
    }, { passive: true });

    document.addEventListener('touchmove', e => {
      if (!dragging) return;
      const t = e.touches[0];
      const dx = t.clientX - startX, dy = t.clientY - startY;
      const bRect = board.getBoundingClientRect();
      let nx = Math.max(0, Math.min(origX + dx, bRect.width  - el.offsetWidth));
      let ny = Math.max(0, Math.min(origY + dy, bRect.height - el.offsetHeight));
      el.style.left = nx + 'px';
      el.style.top  = ny + 'px';
      item.x = nx; item.y = ny;
      drawLines();
    }, { passive: true });

    document.addEventListener('touchend', () => {
      if (dragging) { dragging = false; el.style.zIndex = 2; saveState(); }
    });
  }

  // ── Connect mode ──────────────────────────────
  function toggleConnectMode() {
    connectMode = !connectMode;
    connectFirst = null;
    const btn = document.getElementById('connect-mode-btn');
    if (connectMode) {
      btn.textContent = '🔗 Connect Mode: ON';
      btn.classList.add('active');
    } else {
      btn.textContent = '🔗 Connect Mode: OFF';
      btn.classList.remove('active');
      // Clear any first-selected highlighting
      document.querySelectorAll('.board-item.connect-first').forEach(el => {
        el.classList.remove('connect-first');
      });
    }
  }

  function handleConnectClick(id, el) {
    if (!connectFirst) {
      connectFirst = id;
      el.classList.add('connect-first');
    } else {
      if (connectFirst === id) {
        el.classList.remove('connect-first');
        connectFirst = null;
        return;
      }
      // Create connection
      const color = document.getElementById('yarn-color').value || '#ff3333';
      const conn  = { id: uid(), fromId: connectFirst, toId: id, color };
      connections.push(conn);
      drawLines();
      saveState();

      // Clear first highlight
      const firstEl = document.getElementById('bitem-' + connectFirst);
      if (firstEl) firstEl.classList.remove('connect-first');
      connectFirst = null;
    }
  }

  // ── Clear lines ───────────────────────────────
  function clearConnections() {
    if (!connections.length) return;
    if (!confirm('Clear all connection lines?')) return;
    connections = [];
    drawLines();
    saveState();
  }

  // ── Delete selected item ──────────────────────
  function deleteSelected() {
    if (!selectedId) { alert('Select an item first (click it).'); return; }
    const el = document.getElementById('bitem-' + selectedId);
    if (el) el.remove();
    items       = items.filter(i => i.id !== selectedId);
    connections = connections.filter(c => c.fromId !== selectedId && c.toId !== selectedId);
    selectedId  = null;
    drawLines();
    saveState();
  }

  // ── Click board background = deselect ─────────
  function boardBgClick() {
    if (selectedId) {
      const el = document.getElementById('bitem-' + selectedId);
      if (el) el.classList.remove('selected');
      selectedId = null;
    }
  }

  // ── Persist to IDB ────────────────────────────
  async function saveState() {
    // Save item positions
    const serializable = items.map(i => ({
      id: i.id, type: i.type, url: i.url, label: i.label, x: i.x, y: i.y
    }));
    // Save per-user board state
    const userId = DB.Prefs.get('empId');
    if (userId) {
      let userBoards = {};
      try { userBoards = JSON.parse(localStorage.getItem('userBoards') || '{}'); } catch {}
      userBoards[userId] = { items: serializable, connections };
      localStorage.setItem('userBoards', JSON.stringify(userBoards));
    }
    await DB.put('boardItems', { id: 'state', items: serializable, connections });
  }

  async function loadState() {
    // Load per-user board state
    const userId = DB.Prefs.get('empId');
    let state = null;
    // Clear board arrays before loading
    items = [];
    connections = [];
    // Remove all board-item elements
    if (board) {
      board.querySelectorAll('.board-item').forEach(el => el.remove());
    }
    if (userId) {
      let userBoards = {};
      try { userBoards = JSON.parse(localStorage.getItem('userBoards') || '{}'); } catch {}
      state = userBoards[userId] || null;
    }
    if (!state) {
      state = await DB.get('boardItems', 'state');
    }
    if (!state) return;
    (state.items || []).forEach(item => {
      items.push(item);
      renderItem(item);
    });
    connections = state.connections || [];
    drawLines();
  }

  // ── Public: add image data URL to board ───────
  function addPhoto(dataUrl, label) { addItem('photo', dataUrl, label || 'Photo'); }
  function addVideo(url, label)     { addItem('video', url,    label || 'Video'); }
  function addAudio(url, label)     { addItem('audio', url,    label || 'Audio'); }

  // ── Init ──────────────────────────────────────
  async function init() {
    board  = document.getElementById('crime-board');
    canvas = document.getElementById('yarn-canvas');
    ctx    = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    board.addEventListener('click', boardBgClick);

    document.getElementById('connect-mode-btn').addEventListener('click',   toggleConnectMode);
    document.getElementById('clear-connections-btn').addEventListener('click', clearConnections);
    document.getElementById('delete-selected-btn').addEventListener('click',   deleteSelected);

    // Add media from interrogation to board
    document.getElementById('add-to-board-btn').addEventListener('click', () => {
      const pending = MediaCapture.getPending();
      if (!pending.length) { alert('No captured media to add. Capture a photo, video, or audio first.'); return; }
      pending.forEach(item => addItem(item.type, item.url, item.label));
      MediaCapture.clearPending();
      alert(`${pending.length} item(s) added to the Crime Board.`);
    });

    // Crime scene photo → board
    document.getElementById('add-crime-scene-to-board').addEventListener('click', () => {
      const selected = document.querySelector('#crime-scene-photos .selected-photo');
      if (!selected) { alert('Click a crime scene photo to select it first.'); return; }
      addPhoto(selected.src, 'Crime Scene');
    });

    // Evidence photo → board
    document.getElementById('add-evidence-to-board').addEventListener('click', () => {
      const selected = document.querySelector('#evidence-photos .selected-photo');
      if (!selected) { alert('Click an evidence photo to select it first.'); return; }
      addPhoto(selected.src, 'Evidence');
    });

    // Photo upload sections
    setupPhotoSection('crime-scene-upload',  'crime-scene-photos');
    setupPhotoSection('evidence-upload',     'evidence-photos');

    await loadState();
  }

  // ── Photo upload section ──────────────────────
  function setupPhotoSection(inputId, gridId) {
    const input = document.getElementById(inputId);
    const grid  = document.getElementById(gridId);
    if (!input || !grid) return;

    input.addEventListener('change', () => {
      Array.from(input.files).forEach(file => {
        if (!file.type.startsWith('image/')) return;
        const reader = new FileReader();
        reader.onload = evt => {
          const img = document.createElement('img');
          img.src = evt.target.result;
          img.addEventListener('click', () => {
            grid.querySelectorAll('img').forEach(i => i.classList.remove('selected-photo'));
            img.classList.add('selected-photo');
          });
          grid.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  return { init, addPhoto, addVideo, addAudio, drawLines };
})();

/* ═══════════════════════════════════════════════
   js/crime-board.js  —  Visual Crime Board
   Cards are COMPACT thumbnails when collapsed.
   Click ▼ to expand and see all metadata fields.
   Board is 2400×1600 and scrollable for timelines.
   Board state is keyed per-user.
═══════════════════════════════════════════════ */

const CrimeBoard = (() => {

  var items       = [];
  var connections = [];
  var selectedId   = null;
  var connectMode  = false;
  var connectFirst = null;
  var canvas, ctx, board;

  function uid() {
    return 'bi_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  function boardStateKey() {
    return 'board_state_' + (DB.getCurrentUser() || 'default');
  }
  function defaultMeta() {
    return {
      time: '', description: '', location: '', persons: '',
      evidenceType: '', source: '', reliability: 'unconfirmed', connectionNotes: ''
    };
  }

  function resizeCanvas() {
    if (!canvas || !board) return;
    canvas.width  = board.offsetWidth  || 2400;
    canvas.height = board.offsetHeight || 1600;
    drawLines();
  }

  function drawLines() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    connections.forEach(function(conn) {
      var a = document.getElementById('bitem-' + conn.fromId);
      var b = document.getElementById('bitem-' + conn.toId);
      if (!a || !b) return;
      var ax = parseInt(a.style.left) + a.offsetWidth  / 2;
      var ay = parseInt(a.style.top)  + a.offsetHeight / 2;
      var bx = parseInt(b.style.left) + b.offsetWidth  / 2;
      var by = parseInt(b.style.top)  + b.offsetHeight / 2;
      ctx.beginPath();
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
      ctx.strokeStyle = conn.color || '#ff3333';
      ctx.lineWidth   = 2.5;
      ctx.setLineDash([6, 3]);
      ctx.stroke(); ctx.setLineDash([]);
      [{x:ax,y:ay},{x:bx,y:by}].forEach(function(pt) {
        ctx.beginPath(); ctx.arc(pt.x,pt.y,4,0,Math.PI*2);
        ctx.fillStyle = conn.color || '#ff3333'; ctx.fill();
      });
    });
  }

  function addItem(type, url, label) {
    var item = {
      id: uid(), type: type, url: url, label: label || type,
      x: 20 + Math.random() * Math.max(10, board.clientWidth  - 160),
      y: 20 + Math.random() * Math.max(10, board.clientHeight - 160),
      collapsed: true,
      meta: defaultMeta()
    };
    items.push(item);
    renderItem(item);
    saveState();
    return item.id;
  }

  function renderItem(item) {
    if (!item.meta)                   item.meta = defaultMeta();
    if (item.collapsed === undefined) item.collapsed = true;

    var el = document.createElement('div');
    el.className  = 'board-item' + (item.collapsed ? ' collapsed' : '');
    el.id         = 'bitem-' + item.id;
    el.dataset.id = item.id;
    el.style.left = item.x + 'px';
    el.style.top  = item.y + 'px';

    // ── COLLAPSED VIEW: small thumbnail card ──────
    // Shows: tiny type badge overlay on image, time below
    // Width controlled by CSS (.board-item.collapsed = 130px)

    // ── Header (drag zone + controls) ─────────────
    var hdr = document.createElement('div');
    hdr.className = 'board-item-header';
    hdr.innerHTML =
      '<span class="board-item-type-badge">' + item.type.toUpperCase() + '</span>' +
      '<span class="board-item-title">' + item.label + '</span>' +
      '<button class="board-toggle-btn" title="Expand / collapse">' +
        (item.collapsed ? '▼' : '▲') +
      '</button>';
    el.appendChild(hdr);

    // ── Media thumbnail ────────────────────────────
    var mw = document.createElement('div');
    mw.className = 'board-item-media';
    if (item.type === 'photo') {
      var img = document.createElement('img');
      img.src = item.url; img.draggable = false;
      mw.appendChild(img);
    } else if (item.type === 'video') {
      // Collapsed: show poster frame as image; expanded: full video player
      var vid = document.createElement('video');
      vid.src = item.url; vid.controls = true; vid.draggable = false;
      stopDragOn(vid);
      mw.appendChild(vid);
    } else if (item.type === 'audio') {
      var ico = document.createElement('div');
      ico.className = 'board-audio-icon'; ico.textContent = '🎤';
      var aud = document.createElement('audio');
      aud.src = item.url; aud.controls = true;
      stopDragOn(aud);
      mw.appendChild(ico); mw.appendChild(aud);
    }
    el.appendChild(mw);

    // ── Time (always visible, compact) ────────────
    var timeRow = document.createElement('div');
    timeRow.className = 'meta-row meta-time-row';
    var timeLbl = document.createElement('label');
    timeLbl.className = 'meta-lbl'; timeLbl.textContent = '📅';
    var timeInp = document.createElement('input');
    timeInp.type = 'datetime-local';
    timeInp.className = 'meta-inp';
    timeInp.dataset.key = 'time';
    timeInp.value = item.meta.time || '';
    stopDragOn(timeInp);
    timeInp.addEventListener('input',  function() { item.meta.time = timeInp.value; });
    timeInp.addEventListener('change', function() { item.meta.time = timeInp.value; saveState(); });
    timeRow.appendChild(timeLbl); timeRow.appendChild(timeInp);
    el.appendChild(timeRow);

    // ── Expandable metadata fields ─────────────────
    var metaDiv = document.createElement('div');
    metaDiv.className = 'board-meta';

    var FIELDS = [
      { key:'description',     label:'📝 Event',        type:'textarea' },
      { key:'location',        label:'📍 Location',     type:'text'     },
      { key:'persons',         label:'👤 Person(s)',    type:'text'     },
      { key:'evidenceType',    label:'🔍 Evidence',     type:'text'     },
      { key:'source',          label:'📂 Source',       type:'text'     },
      { key:'reliability',     label:'✅ Status',       type:'select',
        options:['unconfirmed','confirmed','disputed','pending review'] },
      { key:'connectionNotes', label:'🔗 Notes',        type:'textarea' }
    ];

    FIELDS.forEach(function(f) {
      var row = document.createElement('div');
      row.className = 'meta-row';
      var lbl = document.createElement('label');
      lbl.className = 'meta-lbl'; lbl.textContent = f.label;
      row.appendChild(lbl);
      var inp;
      if (f.type === 'textarea') {
        inp = document.createElement('textarea');
        inp.rows = 2; inp.value = item.meta[f.key] || '';
      } else if (f.type === 'select') {
        inp = document.createElement('select');
        f.options.forEach(function(opt) {
          var o = document.createElement('option');
          o.value = opt;
          o.textContent = opt.charAt(0).toUpperCase() + opt.slice(1);
          if ((item.meta[f.key] || 'unconfirmed') === opt) o.selected = true;
          inp.appendChild(o);
        });
      } else {
        inp = document.createElement('input');
        inp.type = f.type; inp.value = item.meta[f.key] || '';
      }
      inp.className = 'meta-inp';
      inp.dataset.key = f.key;
      stopDragOn(inp);
      inp.addEventListener('input',  function() { item.meta[f.key] = inp.value; });
      inp.addEventListener('change', function() { item.meta[f.key] = inp.value; saveState(); });
      inp.addEventListener('blur',   function() { item.meta[f.key] = inp.value; saveState(); });
      row.appendChild(inp);
      metaDiv.appendChild(row);
    });

    el.appendChild(metaDiv);

    // ── Toggle collapse ────────────────────────────
    hdr.querySelector('.board-toggle-btn').addEventListener('click', function(e) {
      e.stopPropagation();
      item.collapsed = !item.collapsed;
      el.classList.toggle('collapsed', item.collapsed);
      this.textContent = item.collapsed ? '▼' : '▲';
      drawLines();
      saveState();
    });

    makeDraggable(el, item);

    el.addEventListener('click', function(e) {
      if (e.target.closest('.board-meta'))       return;
      if (e.target.closest('.meta-time-row'))    return;
      if (e.target.closest('.board-toggle-btn')) return;
      e.stopPropagation();
      if (connectMode) { handleConnectClick(item.id, el); return; }
      if (selectedId === item.id) {
        el.classList.remove('selected'); selectedId = null;
      } else {
        var old = document.getElementById('bitem-' + selectedId);
        if (old) old.classList.remove('selected');
        el.classList.add('selected'); selectedId = item.id;
      }
    });

    board.appendChild(el);
  }

  function stopDragOn(el) {
    el.addEventListener('mousedown',  function(e) { e.stopPropagation(); });
    el.addEventListener('touchstart', function(e) { e.stopPropagation(); }, {passive:true});
    el.addEventListener('click',      function(e) { e.stopPropagation(); });
  }

  function makeDraggable(el, item) {
    var dragging=false, startX, startY, origX, origY;

    el.addEventListener('mousedown', function(e) {
      if (e.target.closest('.board-meta'))       return;
      if (e.target.closest('.meta-time-row'))    return;
      if (e.target.closest('.board-toggle-btn')) return;
      if (e.target.tagName==='VIDEO'||e.target.tagName==='AUDIO') return;
      if (e.button!==0) return;
      e.preventDefault();
      dragging=true; startX=e.clientX; startY=e.clientY;
      origX=parseInt(el.style.left)||0; origY=parseInt(el.style.top)||0;
      el.style.zIndex=10;
    });

    document.addEventListener('mousemove', function(e) {
      if (!dragging) return;
      el.style.left = Math.max(0, origX+e.clientX-startX)+'px';
      el.style.top  = Math.max(0, origY+e.clientY-startY)+'px';
      item.x = parseInt(el.style.left); item.y = parseInt(el.style.top);
      drawLines();
    });

    document.addEventListener('mouseup', function() {
      if (!dragging) return;
      dragging=false; el.style.zIndex=2; saveState();
    });

    el.addEventListener('touchstart', function(e) {
      if (e.target.closest('.board-meta'))       return;
      if (e.target.closest('.meta-time-row'))    return;
      if (e.target.closest('.board-toggle-btn')) return;
      if (e.target.tagName==='VIDEO'||e.target.tagName==='AUDIO') return;
      var t=e.touches[0];
      dragging=true; startX=t.clientX; startY=t.clientY;
      origX=parseInt(el.style.left)||0; origY=parseInt(el.style.top)||0;
      el.style.zIndex=10;
    }, {passive:true});

    document.addEventListener('touchmove', function(e) {
      if (!dragging) return;
      var t=e.touches[0];
      el.style.left = Math.max(0,origX+t.clientX-startX)+'px';
      el.style.top  = Math.max(0,origY+t.clientY-startY)+'px';
      item.x=parseInt(el.style.left); item.y=parseInt(el.style.top);
      drawLines();
    }, {passive:true});

    document.addEventListener('touchend', function() {
      if (dragging) { dragging=false; el.style.zIndex=2; saveState(); }
    });
  }

  function toggleConnectMode() {
    connectMode=!connectMode; connectFirst=null;
    var btn=document.getElementById('connect-mode-btn');
    btn.textContent='🔗 Connect Mode: '+(connectMode?'ON':'OFF');
    btn.classList.toggle('active',connectMode);
    if (!connectMode)
      document.querySelectorAll('.board-item.connect-first')
              .forEach(function(e){e.classList.remove('connect-first');});
  }

  function handleConnectClick(id, el) {
    if (!connectFirst) {
      connectFirst=id; el.classList.add('connect-first');
    } else {
      if (connectFirst===id) { el.classList.remove('connect-first'); connectFirst=null; return; }
      var color=document.getElementById('yarn-color').value||'#ff3333';
      connections.push({id:uid(),fromId:connectFirst,toId:id,color});
      drawLines(); saveState();
      var fe=document.getElementById('bitem-'+connectFirst);
      if (fe) fe.classList.remove('connect-first');
      connectFirst=null;
    }
  }

  function clearConnections() {
    if (!connections.length) return;
    if (!confirm('Clear all connection lines?')) return;
    connections=[]; drawLines(); saveState();
  }

  function deleteSelected() {
    if (!selectedId) { alert('Select an item first (click it).'); return; }
    var el=document.getElementById('bitem-'+selectedId);
    if (el) el.remove();
    items       = items.filter(function(i){return i.id!==selectedId;});
    connections = connections.filter(function(c){return c.fromId!==selectedId&&c.toId!==selectedId;});
    selectedId=null; drawLines(); saveState();
  }

  async function saveState() {
    var serializable = items.map(function(i) {
      return {id:i.id,type:i.type,url:i.url,label:i.label,
              x:i.x,y:i.y,collapsed:i.collapsed,meta:i.meta||defaultMeta()};
    });
    await DB.put('boardItems', {id:boardStateKey(), items:serializable, connections});
  }

  async function loadState() {
    var state = await DB.get('boardItems', boardStateKey());
    if (!state) return;
    // Safety check: only load state that belongs to this user
    var uid = DB.getCurrentUser();
    if (state.userId && uid && state.userId !== uid) return;
    (state.items||[]).forEach(function(item) {
      if (!item.meta)                   item.meta = defaultMeta();
      if (item.collapsed===undefined)   item.collapsed = true;
      items.push(item);
      renderItem(item);
    });
    connections = state.connections || [];
    drawLines();
  }

  // Called by Auth.showApp() after every login - clears stale board and loads correct user's board
  async function reload() {
    // Remove all rendered card elements
    Array.from(board.querySelectorAll('.board-item')).forEach(function(el) { el.remove(); });
    items       = [];
    connections = [];
    selectedId  = null;
    connectMode  = false;
    connectFirst = null;
    drawLines();
    await loadState();
  }

  function addPhoto(url,label) { addItem('photo',url,label||'Photo'); }
  function addVideo(url,label) { addItem('video',url,label||'Video'); }
  function addAudio(url,label) { addItem('audio',url,label||'Audio'); }

  function setupPhotoSection(inputId,gridId) {
    var input=document.getElementById(inputId), grid=document.getElementById(gridId);
    if (!input||!grid) return;
    input.addEventListener('change', function() {
      Array.from(input.files).forEach(function(file) {
        if (!file.type.startsWith('image/')) return;
        var reader=new FileReader();
        reader.onload=function(evt) {
          var img=document.createElement('img'); img.src=evt.target.result;
          img.addEventListener('click',function(){
            grid.querySelectorAll('img').forEach(function(i){i.classList.remove('selected-photo');});
            img.classList.add('selected-photo');
          });
          grid.appendChild(img);
        };
        reader.readAsDataURL(file);
      });
    });
  }

  async function init() {
    var boardOuter = document.getElementById('crime-board');
    canvas         = document.getElementById('yarn-canvas');

    // Build inner scrollable canvas
    var inner = document.createElement('div');
    inner.id = 'board-inner';
    inner.style.cssText = 'position:relative;width:2400px;height:1600px;';
    canvas.parentNode.removeChild(canvas);
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:1;';
    inner.appendChild(canvas);
    boardOuter.appendChild(inner);
    board = inner;
    ctx   = canvas.getContext('2d');

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    boardOuter.addEventListener('click', function(e) {
      if (e.target===boardOuter||e.target===inner||e.target===canvas) {
        if (selectedId) {
          var el=document.getElementById('bitem-'+selectedId);
          if (el) el.classList.remove('selected');
          selectedId=null;
        }
      }
    });
    boardOuter.addEventListener('scroll', drawLines);

    document.getElementById('connect-mode-btn').addEventListener('click',      toggleConnectMode);
    document.getElementById('clear-connections-btn').addEventListener('click', clearConnections);
    document.getElementById('delete-selected-btn').addEventListener('click',   deleteSelected);

    document.getElementById('add-to-board-btn').addEventListener('click', function() {
      var pending=MediaCapture.getPending();
      if (!pending.length) { alert('No captured media to add.'); return; }
      pending.forEach(function(p){addItem(p.type,p.url,p.label);});
      MediaCapture.clearPending();
      alert(pending.length+' item(s) added to the Crime Board.');
    });

    document.getElementById('add-crime-scene-to-board').addEventListener('click', function() {
      var sel=document.querySelector('#crime-scene-photos .selected-photo');
      if (!sel) { alert('Click a crime scene photo to select it first.'); return; }
      addPhoto(sel.src,'Crime Scene');
    });

    document.getElementById('add-evidence-to-board').addEventListener('click', function() {
      var sel=document.querySelector('#evidence-photos .selected-photo');
      if (!sel) { alert('Click an evidence photo to select it first.'); return; }
      addPhoto(sel.src,'Evidence');
    });

    setupPhotoSection('crime-scene-upload','crime-scene-photos');
    setupPhotoSection('evidence-upload','evidence-photos');

    await loadState();
  }

  return { init, reload, addPhoto, addVideo, addAudio, drawLines };
})();

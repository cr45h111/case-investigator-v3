/* ═══════════════════════════════════════════════
   js/suspect-db.js  —  Subject Database
   IndexedDB-backed. Full add/view/delete flow.
═══════════════════════════════════════════════ */

const SuspectDB = (() => {

  // ── Utils ─────────────────────────────────────
  function uid() {
    return 'sus_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
  }
  function fmt(p)  { return p != null && p !== '' ? p : 'N/A'; }
  function fmtPct(p) {
    const v = parseFloat(p);
    if (isNaN(v)) return 'N/A';
    return (v * 100).toFixed(0) + '%';
  }
  function guiltClass(p) {
    const v = parseFloat(p);
    if (v >= 0.70) return 'high';
    if (v >= 0.45) return 'medium';
    return 'low';
  }

  // ── Render mini cards in main page ───────────
  async function renderMiniCards() {
    const suspects = await DB.getAll('suspects');
    const list = document.getElementById('suspect-list');
    if (!list) return;
    list.innerHTML = '';
    if (!suspects.length) {
      list.innerHTML = '<p style="color:#888;font-style:italic;padding:8px;">No subjects added yet.</p>';
      return;
    }
    suspects.forEach(s => {
      const card = document.createElement('div');
      card.className = 'suspect-mini-card';
      card.onclick   = () => openDetail(s.id);

      const gClass = guiltClass(s.guiltProbability);
      card.innerHTML = `
        ${s.photo ? `<img src="${s.photo}" alt="${s.name}">` : `<div style="height:120px;background:#222;border-radius:6px;display:flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:8px;">👤</div>`}
        <h4>${s.name}</h4>
        <span class="guilt-badge guilt-${gClass}">${fmtPct(s.guiltProbability)}</span>
      `;
      list.appendChild(card);
    });
  }

  // ── Open Add Subject modal ────────────────────
  function openAdd() {
    clearForm();
    // Pre-fill case ID
    const caseId = DB.Prefs.get('activeCaseId') || '';
    document.getElementById('ns-case-id').value = caseId;
    document.getElementById('add-suspect-modal').style.display = 'flex';
  }
  function closeAdd() {
    document.getElementById('add-suspect-modal').style.display = 'none';
    clearForm();
  }
  function clearForm() {
    ['ns-name','ns-case-id','ns-sex','ns-age','ns-height',
     'ns-address','ns-phone','ns-email','ns-vehicle',
     'ns-history','ns-crime-history','ns-statement'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    const prev = document.getElementById('ns-photo-preview');
    if (prev) { prev.src = ''; prev.style.display = 'none'; prev.dataset.data = ''; }
  }

  // ── Save new subject ──────────────────────────
  async function save() {
    const name = document.getElementById('ns-name').value.trim();
    const sex  = document.getElementById('ns-sex').value;
    const age  = document.getElementById('ns-age').value;

    if (!name) { alert('Name is required.'); return; }
    if (!sex)  { alert('Sex is required.'); return; }
    if (!age)  { alert('Age is required.'); return; }

    const photo = document.getElementById('ns-photo-preview').dataset.data || '';

    const subject = {
      id:            uid(),
      name,
      caseId:        document.getElementById('ns-case-id').value.trim(),
      sex,
      age:           parseInt(age),
      height:        document.getElementById('ns-height').value.trim(),
      address:       document.getElementById('ns-address').value.trim(),
      phone:         document.getElementById('ns-phone').value.trim(),
      email:         document.getElementById('ns-email').value.trim(),
      vehicle:       document.getElementById('ns-vehicle').value.trim(),
      history:       document.getElementById('ns-history').value.trim(),
      crimeHistory:  document.getElementById('ns-crime-history').value.trim(),
      statement:     document.getElementById('ns-statement').value.trim(),
      photo,
      guiltProbability: 0.5,
      honestyScore:     0.5,
      interviews:       [],
      dateAdded:        new Date().toISOString(),
      status:           'active'
    };

    // Optional: generate AI profile
    if (AI.hasKey()) {
      const caseDesc = document.getElementById('case-desc').value;
      const raw = await AI.generateSubjectProfile(subject, caseDesc);
      // Parse guilt %
      const guiltMatch = raw.match(/GUILT:\s*(\d+)/i);
      if (guiltMatch) subject.guiltProbability = parseInt(guiltMatch[1]) / 100;
      subject.aiProfile = raw;
    }

    await DB.put('suspects', subject);
    alert(`✅ "${name}" saved to database.`);
    closeAdd();
    await renderMiniCards();
  }

  // ── Open Database modal ───────────────────────
  async function openDatabase() {
    document.getElementById('database-modal').style.display = 'flex';
    await loadTab('all');
  }
  function closeDatabase() {
    document.getElementById('database-modal').style.display = 'none';
  }

  async function loadTab(filter) {
    const all     = await DB.getAll('suspects');
    const content = document.getElementById('database-content');
    if (!content) return;

    let subjects;
    if (filter === 'all')    subjects = all;
    else if (filter === 'active') subjects = all.filter(s => s.status !== 'closed');
    else if (filter === 'closed') subjects = all.filter(s => s.status === 'closed');
    else if (filter === 'bycase') {
      // Group by caseId
      const groups = {};
      all.forEach(s => {
        const k = s.caseId || 'Unknown';
        if (!groups[k]) groups[k] = [];
        groups[k].push(s);
      });
      let html = '';
      Object.entries(groups).forEach(([caseId, list]) => {
        html += `<div style="margin-bottom:16px;">
          <h4 style="color:#00aaff;margin-bottom:8px;border-bottom:1px solid #333;padding-bottom:6px;">📁 Case: ${caseId}</h4>
          ${list.map(s => itemHTML(s)).join('')}
        </div>`;
      });
      content.innerHTML = html || emptyMsg();
      attachItemClicks(content);
      return;
    }

    content.innerHTML = subjects.length
      ? subjects.map(itemHTML).join('')
      : emptyMsg();
    attachItemClicks(content);
  }

  function itemHTML(s) {
    const gClass  = guiltClass(s.guiltProbability);
    const status  = s.status === 'closed' ? 'closed' : 'active';
    return `
      <div class="db-item" data-id="${s.id}">
        <div class="db-item-name">${s.name}</div>
        <div class="db-item-meta">
          <span>Age ${fmt(s.age)} · ${fmt(s.sex)}</span>
          <span class="status-badge status-${status}">${status.toUpperCase()}</span>
          <span class="guilt-badge guilt-${gClass}">${fmtPct(s.guiltProbability)}</span>
          <span style="color:#666;">${s.caseId ? 'Case: ' + s.caseId : ''}</span>
        </div>
      </div>`;
  }
  function emptyMsg() {
    return '<p style="color:#888;padding:20px;text-align:center;font-style:italic;">No subjects found.</p>';
  }
  function attachItemClicks(container) {
    container.querySelectorAll('.db-item').forEach(el => {
      el.addEventListener('click', () => {
        openDetail(el.dataset.id);
      });
    });
  }

  // ── Open Subject Detail modal ─────────────────
  async function openDetail(id) {
    const s = await DB.get('suspects', id);
    if (!s) return;

    document.getElementById('detail-name').textContent = s.name;

    const photo = document.getElementById('detail-photo');
    if (s.photo) { photo.src = s.photo; photo.style.display = 'block'; }
    else           { photo.style.display = 'none'; }

    const gClass = guiltClass(s.guiltProbability);
    const fields = document.getElementById('detail-fields');
    fields.innerHTML = [
      ['Case ID',       fmt(s.caseId)],
      ['Sex',           fmt(s.sex)],
      ['Age',           fmt(s.age)],
      ['Height',        fmt(s.height)],
      ['Address',       fmt(s.address)],
      ['Phone',         fmt(s.phone)],
      ['Email',         fmt(s.email)],
      ['Vehicle',       fmt(s.vehicle)],
      ['Status',        `<span class="status-badge status-${s.status === 'closed' ? 'closed' : 'active'}">${(s.status || 'active').toUpperCase()}</span>`],
      ['Guilt Prob.',   `<span class="guilt-badge guilt-${gClass}">${fmtPct(s.guiltProbability)}</span>`],
      ['Honesty Score', (s.honestyScore * 100).toFixed(0) + '%'],
      ['Interviews',    (s.interviews || []).length + ' recorded'],
      ['History',       fmt(s.history)],
      ['Crime History', fmt(s.crimeHistory)],
      ['Statement',     fmt(s.statement)],
      ...(s.aiProfile ? [['AI Profile', s.aiProfile]] : []),
    ].map(([label, val]) => `
      <div class="detail-row">
        <div class="detail-label">${label}</div>
        <div class="detail-value">${val}</div>
      </div>`).join('');

    document.getElementById('delete-subject-btn').onclick = async () => {
      if (!confirm(`Delete "${s.name}" from database?`)) return;
      await DB.del('suspects', id);
      closeDetailModal();
      await renderMiniCards();
      await loadTab('all');
    };

    document.getElementById('subject-detail-modal').style.display = 'flex';
  }

  function closeDetailModal() {
    document.getElementById('subject-detail-modal').style.display = 'none';
  }

  // ── Update guilt probabilities (from AI insights) ─
  async function updateGuiltMeters() {
    const suspects = await DB.getAll('suspects');
    const meter    = document.getElementById('probability-meter');
    if (!meter) return;
    meter.innerHTML = '';

    if (!suspects.length) {
      meter.innerHTML = '<p style="color:#888;">Add suspects to see probability meters.</p>';
      return;
    }

    suspects.forEach(s => {
      const pct    = (parseFloat(s.guiltProbability) || 0.5);
      const gClass = guiltClass(pct);
      const colors = { high: '#ff3333', medium: '#ff9500', low: '#ffd700' };
      const color  = colors[gClass];

      const card = document.createElement('div');
      card.className = 'prob-card';
      card.innerHTML = `
        <div class="prob-name">${s.name}</div>
        <div class="prob-bar-wrap">
          <div class="prob-bar" style="width:${(pct*100).toFixed(0)}%;background:${color};"></div>
        </div>
        <div class="prob-value" style="color:${color};">${(pct*100).toFixed(0)}%</div>
      `;
      meter.appendChild(card);
    });
  }

  // ── Init ──────────────────────────────────────
  function init() {
    document.getElementById('add-subject-btn').addEventListener('click', openAdd);
    document.getElementById('view-database-btn').addEventListener('click', openDatabase);
    document.getElementById('close-add-suspect').addEventListener('click', closeAdd);
    document.getElementById('cancel-add-suspect').addEventListener('click', closeAdd);
    document.getElementById('save-new-suspect').addEventListener('click', save);
    document.getElementById('close-database-modal').addEventListener('click', closeDatabase);
    document.getElementById('close-detail-modal').addEventListener('click', closeDetailModal);
    document.getElementById('close-detail-btn').addEventListener('click', closeDetailModal);

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        await loadTab(btn.dataset.tab);
      });
    });

    // Photo upload for new suspect
    document.getElementById('ns-photo-btn').addEventListener('click', () => {
      document.getElementById('ns-photo-input').click();
    });
    document.getElementById('ns-photo-input').addEventListener('change', function () {
      const file = this.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const prev = document.getElementById('ns-photo-preview');
        prev.src            = e.target.result;
        prev.style.display  = 'block';
        prev.dataset.data   = e.target.result;
      };
      reader.readAsDataURL(file);
    });

    renderMiniCards();
  }

  return { init, renderMiniCards, updateGuiltMeters, openDetail };
})();

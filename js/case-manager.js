/* ═══════════════════════════════════════════════
   js/case-manager.js  —  Case Lifecycle
   Start, save, load, report, solve.
═══════════════════════════════════════════════ */

const CaseManager = (() => {

  function uid() {
    return 'CASE-' + new Date().getFullYear() + '-' +
           Math.random().toString(36).slice(2, 7).toUpperCase();
  }

  // ── Start new investigation ───────────────────
  async function startCase() {
    const desc = document.getElementById('case-desc').value.trim();
    if (!desc) { alert('Please describe the case first.'); return; }

    const id = uid();
    const detectiveId = DB.Prefs.get('empId');
    if (!detectiveId) {
      alert('You must be logged in to start a case.');
      return;
    }
    DB.Prefs.set('activeCaseId', id);

    // Update score card
    const taken  = parseInt(DB.Prefs.get('casesTaken')  || '0') + 1;
    const open   = parseInt(DB.Prefs.get('casesOpen')   || '0') + 1;
    DB.Prefs.set('casesTaken', taken);
    DB.Prefs.set('casesOpen',  open);
    Auth.refreshScores();
    Auth.refreshCard();

    // Update UI
    document.getElementById('active-case-id').textContent  = id;
    document.getElementById('ns-case-id')   && (document.getElementById('ns-case-id').value = id);

    // Progress bar animation
    const fill = document.getElementById('progress-bar-fill');
    fill.style.width = '20%';

    // AI case analysis if key present
    if (AI.hasKey()) {
      Interrogation.addThought('🔎 Starting case analysis…');
      const suspects = await DB.getAll('suspects');
      const raw = await AI.generateCaseInsights({
        caseDesc:         desc,
        notes:            document.getElementById('detective-notes').value,
        suspects,
        evidenceCount:    0,
        boardConnections: 0
      });
      Interrogation.addThought(raw.replace(/\n/g, '<br>'));
    } else {
      Interrogation.addThought('📋 Case started. Add your Anthropic API key above for AI-powered analysis.');
    }

    // Save case to IDB, key by user
    // Save cases per user in localStorage
    let userCases = {};
    try { userCases = JSON.parse(localStorage.getItem('userCases') || '{}'); } catch {}
    if (!userCases[detectiveId]) userCases[detectiveId] = [];
    const caseRecord = {
      id,
      desc,
      notes: document.getElementById('detective-notes').value || '',
      conclusion: document.getElementById('case-conclusion').value || '',
      detectiveName: DB.Prefs.get('empName'),
      detectiveId:   detectiveId,
      startedAt:     new Date().toISOString(),
      status:        'open',
      owner:         detectiveId
    };
    userCases[detectiveId].push(caseRecord);
    localStorage.setItem('userCases', JSON.stringify(userCases));

    alert(`✅ Investigation ${id} started!`);
  }

  // ── Save case file (JSON download) ────────────
  async function saveCase() {
    const suspects  = await DB.getAll('suspects');
    const witnesses = await DB.getAll('witnesses');
    const boardState = await DB.get('boardItems', 'state');

    const data = {
      exportedAt:  new Date().toISOString(),
      caseId:      DB.Prefs.get('activeCaseId')  || 'unknown',
      detective:   DB.Prefs.get('empName')        || 'unknown',
      caseDesc:    document.getElementById('case-desc').value,
      notes:       document.getElementById('detective-notes').value,
      conclusion:  document.getElementById('case-conclusion').value,
      suspects,
      witnesses,
      boardState
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a    = document.createElement('a');
    a.href     = URL.createObjectURL(blob);
    a.download = `case-${data.caseId}-${Date.now()}.json`;
    a.click();
  }

  // ── Load case file ────────────────────────────
  async function loadCase() {
    // Only allow loading cases for the logged-in user
    const detectiveId = DB.Prefs.get('empId');
    if (!detectiveId) {
      alert('You must be logged in to load a case.');
      return;
    }
    // Load cases for this user
    let userCases = {};
    try { userCases = JSON.parse(localStorage.getItem('userCases') || '{}'); } catch {}
    const cases = userCases[detectiveId] || [];
    if (!cases.length) {
      alert('No cases found for your profile.');
      return;
    }
    // Show a simple selector for cases
    const selector = document.createElement('select');
    selector.style.margin = '12px';
    cases.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = `${c.id} - ${c.desc.substring(0, 40)}`;
      selector.appendChild(opt);
    });
    const confirmBtn = document.createElement('button');
    confirmBtn.textContent = 'Load Selected Case';
    confirmBtn.style.margin = '12px';
    confirmBtn.onclick = async () => {
      const selectedId = selector.value;
      let userCases = {};
      try { userCases = JSON.parse(localStorage.getItem('userCases') || '{}'); } catch {}
      const userCasesArr = userCases[detectiveId] || [];
      const data = userCasesArr.find(c => c.id === selectedId);
      if (!data) { alert('Case not found.'); return; }
      document.getElementById('case-desc').value        = data.desc    || '';
      document.getElementById('detective-notes').value  = data.notes       || '';
      document.getElementById('case-conclusion').value  = data.conclusion  || '';
      document.getElementById('active-case-id').textContent = data.id || '--';
      DB.Prefs.set('activeCaseId', data.id || '');
      alert(`✅ Case ${data.id} loaded.`);
      selector.remove();
      confirmBtn.remove();
    };
    document.body.appendChild(selector);
    document.body.appendChild(confirmBtn);
  }

  // ── View Case Report modal ────────────────────
  async function viewReport() {
    const suspects = await DB.getAll('suspects');
    const caseId   = DB.Prefs.get('activeCaseId') || '--';
    const det      = DB.Prefs.get('empName') || '--';
    const detId    = DB.Prefs.get('empId')   || '--';
    const desc     = document.getElementById('case-desc').value;
    const notes    = document.getElementById('detective-notes').value;
    const concl    = document.getElementById('case-conclusion').value;

    const suspHtml = suspects.map(s => `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #333;">${s.name}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #333;">${s.sex}, ${s.age}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #333;">${(parseFloat(s.guiltProbability)*100).toFixed(0)}%</td>
        <td style="padding:6px 10px;border-bottom:1px solid #333;">${s.status || 'active'}</td>
      </tr>`).join('');

    document.getElementById('case-report-content').innerHTML = `
      <div style="font-size:0.9rem;line-height:1.7;">
        <table style="width:100%;margin-bottom:16px;">
          <tr><td style="color:#00aaff;width:140px;">Case ID</td><td>${caseId}</td></tr>
          <tr><td style="color:#00aaff;">Detective</td><td>${det}</td></tr>
          <tr><td style="color:#00aaff;">Badge ID</td><td>${detId}</td></tr>
          <tr><td style="color:#00aaff;">Date</td><td>${new Date().toLocaleDateString()}</td></tr>
          <tr><td style="color:#00aaff;">Status</td><td>${DB.Prefs.get('caseSolved') === '1' ? '✅ SOLVED' : '🔓 Open'}</td></tr>
        </table>
        <b style="color:#00aaff;">Case Description</b>
        <div style="background:#111;border-radius:6px;padding:10px;margin:6px 0 14px;">${desc || '<em>None</em>'}</div>
        <b style="color:#00aaff;">Detective Notes</b>
        <div style="background:#111;border-radius:6px;padding:10px;margin:6px 0 14px;">${notes || '<em>None</em>'}</div>
        <b style="color:#00aaff;">Conclusion</b>
        <div style="background:#111;border-radius:6px;padding:10px;margin:6px 0 14px;">${concl || '<em>None</em>'}</div>
        ${suspects.length ? `
        <b style="color:#00aaff;">Subjects</b>
        <table style="width:100%;border-collapse:collapse;margin-top:8px;">
          <thead><tr style="color:#888;font-size:0.85rem;">
            <th style="text-align:left;padding:4px 10px;">Name</th>
            <th style="text-align:left;padding:4px 10px;">Demographics</th>
            <th style="text-align:left;padding:4px 10px;">Guilt</th>
            <th style="text-align:left;padding:4px 10px;">Status</th>
          </tr></thead>
          <tbody>${suspHtml}</tbody>
        </table>` : ''}
      </div>
    `;
    document.getElementById('case-desc-modal').style.display = 'flex';
  }

  // ── Solve case ────────────────────────────────
  async function solveCase() {
    const desc = document.getElementById('case-desc').value.trim();
    if (!desc) { alert('Start a case first.'); return; }

    DB.Prefs.set('caseSolved', '1');

    const open   = Math.max(0, parseInt(DB.Prefs.get('casesOpen') || '0') - 1);
    const solved = parseInt(DB.Prefs.get('casesSolved') || '0') + 1;
    DB.Prefs.set('casesOpen',   open);
    DB.Prefs.set('casesSolved', solved);

    // Mark active case as solved for this user only
    const caseId = DB.Prefs.get('activeCaseId');
    const detectiveId = DB.Prefs.get('empId');
    if (caseId && detectiveId) {
      let userCases = {};
      try { userCases = JSON.parse(localStorage.getItem('userCases') || '{}'); } catch {}
      const userCasesArr = userCases[detectiveId] || [];
      const rec = userCasesArr.find(c => c.id === caseId);
      if (rec) {
        rec.status   = 'solved';
        rec.solvedAt = new Date().toISOString();
        // Save latest notes/conclusion to the case record
        rec.notes = document.getElementById('detective-notes').value || '';
        rec.conclusion = document.getElementById('case-conclusion').value || '';
        localStorage.setItem('userCases', JSON.stringify(userCases));
      }
      // Mark suspects as closed (handled in suspects-db.js per user)
    }

    Auth.refreshScores();
    Auth.refreshCard();

    const fill = document.getElementById('progress-bar-fill');
    fill.style.width = '100%';

    Interrogation.addThought(`🏆 Case <b>${caseId || ''}</b> marked SOLVED.`);
    await SuspectDB.renderMiniCards();

    alert(`🏆 Case SOLVED! Great work, Detective ${DB.Prefs.get('empName') || ''}!\n\nTotal cases solved: ${solved}`);
  }

  // ── Generate AI insights ──────────────────────
  async function generateInsights() {
    const btn = document.getElementById('ai-insights-btn');
    btn.textContent = '⏳ Generating insights…';
    btn.disabled    = true;

    const suspects = await DB.getAll('suspects');
    const raw = await AI.generateCaseInsights({
      caseDesc:         document.getElementById('case-desc').value,
      notes:            document.getElementById('detective-notes').value,
      suspects,
      evidenceCount:    document.querySelectorAll('#evidence-photos img').length,
      boardConnections: 0
    });

    Interrogation.addThought(raw.replace(/\n/g, '<br>'));
    await SuspectDB.updateGuiltMeters();

    btn.textContent = '🤖 Generate AI Insights';
    btn.disabled    = false;
  }

  // ── Init ──────────────────────────────────────
  function init() {
        // Save notes/conclusion on blur (auto-save)
        document.getElementById('detective-notes').addEventListener('blur', () => {
          const detectiveId = DB.Prefs.get('empId');
          const caseId = DB.Prefs.get('activeCaseId');
          if (!detectiveId || !caseId) return;
          let userCases = {};
          try { userCases = JSON.parse(localStorage.getItem('userCases') || '{}'); } catch {}
          const userCasesArr = userCases[detectiveId] || [];
          const rec = userCasesArr.find(c => c.id === caseId);
          if (rec) {
            rec.notes = document.getElementById('detective-notes').value || '';
            localStorage.setItem('userCases', JSON.stringify(userCases));
          }
        });
        document.getElementById('case-conclusion').addEventListener('blur', () => {
          const detectiveId = DB.Prefs.get('empId');
          const caseId = DB.Prefs.get('activeCaseId');
          if (!detectiveId || !caseId) return;
          let userCases = {};
          try { userCases = JSON.parse(localStorage.getItem('userCases') || '{}'); } catch {}
          const userCasesArr = userCases[detectiveId] || [];
          const rec = userCasesArr.find(c => c.id === caseId);
          if (rec) {
            rec.conclusion = document.getElementById('case-conclusion').value || '';
            localStorage.setItem('userCases', JSON.stringify(userCases));
          }
        });
    document.getElementById('start-case').addEventListener('click', startCase);
    document.getElementById('save-case').addEventListener('click',  saveCase);
    document.getElementById('load-case').addEventListener('click',  loadCase);
    document.getElementById('view-case-desc').addEventListener('click', viewReport);
    document.getElementById('close-case-modal').addEventListener('click', () => {
      document.getElementById('case-desc-modal').style.display = 'none';
    });
    document.getElementById('solve-button').addEventListener('click', solveCase);
    document.getElementById('ai-insights-btn').addEventListener('click', generateInsights);
  }

  return { init };
})();

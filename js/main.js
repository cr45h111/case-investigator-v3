/* ═══════════════════════════════════════════════
   js/main.js  —  App Initialization
   Wires all modules together.
   Load order: storage → auth → ai → media → board → suspects → interrogation → case → main
═══════════════════════════════════════════════ */

document.addEventListener('DOMContentLoaded', async () => {

  // Open IndexedDB first
  await DB.open();

  // Initialize modules in dependency order
  Auth.init();
  AI.initKeyBanner();
  MediaCapture.init();
  await CrimeBoard.init();
  SuspectDB.init();
  Interrogation.init();
  CaseManager.init();

  // Restore active case ID display
  const caseId = DB.Prefs.get('activeCaseId');
  if (caseId) {
    document.getElementById('active-case-id').textContent = caseId;
  }

  // ── Tutorial modal ─────────────────────────
  document.getElementById('tutorial-btn').addEventListener('click', () => {
    document.getElementById('tutorial-modal').style.display = 'flex';
  });
  document.getElementById('close-tutorial').addEventListener('click', () => {
    document.getElementById('tutorial-modal').style.display = 'none';
  });
  document.getElementById('close-tutorial-btn').addEventListener('click', () => {
    document.getElementById('tutorial-modal').style.display = 'none';
  });

  // ── About modal ────────────────────────────
  document.getElementById('about-btn').addEventListener('click', () => {
    document.getElementById('about-modal').style.display = 'flex';
  });
  document.getElementById('close-about').addEventListener('click', () => {
    document.getElementById('about-modal').style.display = 'none';
  });
  document.getElementById('close-about-btn').addEventListener('click', () => {
    document.getElementById('about-modal').style.display = 'none';
  });

  // ── Witness modal ──────────────────────────
  // (Can be triggered from interrogation section if needed)
  document.getElementById('close-witness-modal').addEventListener('click', () => {
    document.getElementById('witness-modal').style.display = 'none';
  });
  document.getElementById('cancel-witness').addEventListener('click', () => {
    document.getElementById('witness-modal').style.display = 'none';
  });
  document.getElementById('save-witness').addEventListener('click', async () => {
    const name      = document.getElementById('witness-name').value.trim();
    const datetime  = document.getElementById('witness-datetime').value;
    const location  = document.getElementById('witness-location').value.trim();
    const statement = document.getElementById('witness-statement').value.trim();

    if (!name || !statement) { alert('Name and statement are required.'); return; }

    const w = {
      id:        'wit_' + Date.now(),
      name, datetime, location, statement,
      caseId:    DB.Prefs.get('activeCaseId') || '',
      createdAt: new Date().toISOString()
    };
    await DB.put('witnesses', w);
    document.getElementById('witness-modal').style.display = 'none';
    ['witness-name','witness-datetime','witness-location','witness-statement']
      .forEach(id => document.getElementById(id).value = '');
    alert(`✅ Witness report for "${name}" saved.`);
  });

  // ── Close overlays on background click ────
  document.querySelectorAll('.overlay-modal').forEach(modal => {
    modal.addEventListener('click', e => {
      if (e.target === modal) modal.style.display = 'none';
    });
  });

  // ── Load existing guilt meters on startup ──
  await SuspectDB.updateGuiltMeters();

  console.log('Case Investigator v3.0 initialized.');
});

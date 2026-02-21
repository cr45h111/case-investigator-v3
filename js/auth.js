/* ═══════════════════════════════════════════════
   js/auth.js  —  Login / Logout / ID Card
   Per-user isolation. Photos persist per-account
   and auto-migrate from legacy un-namespaced keys.
═══════════════════════════════════════════════ */

const Auth = (() => {

  function sanitize(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  function accountKey(uid) { return `__account__${uid}`; }
  function generateId() {
    return 'EMP-' + Date.now().toString().slice(-6) + '-' +
           Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  }
  function getRank(solved) {
    if (solved >= 15) return { label: 'Legend',        color: '#ffaa00' };
    if (solved >= 8)  return { label: 'Master Sleuth', color: '#ffd700' };
    if (solved >= 3)  return { label: 'Inspector',     color: '#00aaff' };
    return                   { label: 'Rookie',        color: '#888'    };
  }

  // ── Photo helpers ─────────────────────────────

  function _savePhoto(data) {
    try { DB.Prefs.set('empPhoto', data); return true; }
    catch (e) { console.warn('Badge photo could not be saved (storage quota full):', e); return false; }
  }

  // OLD code stored photo as plain "empPhoto" (no user prefix).
  // If found there and the namespaced slot is empty, migrate it.
  function _migratePhoto() {
    if (DB.Prefs.get('empPhoto')) return;
    const legacy = localStorage.getItem('empPhoto');
    if (legacy) _savePhoto(legacy);
  }

  // Pull photo from global account record if namespaced pref is still empty.
  function _restorePhotoFromAccount(aKey) {
    if (DB.Prefs.get('empPhoto')) return;
    try {
      const acct = JSON.parse(localStorage.getItem(aKey) || '{}');
      if (acct.photo) _savePhoto(acct.photo);
    } catch {}
  }

  // ── ID card ───────────────────────────────────

  function refreshCard() {
    const name   = DB.Prefs.get('empName')  || 'Not logged in';
    const id     = DB.Prefs.get('empId')    || '--';
    const photo  = DB.Prefs.get('empPhoto') || '';
    const solved = parseInt(DB.Prefs.get('casesSolved') || '0', 10);
    const rank   = getRank(solved);

    document.getElementById('employee-name').textContent = name;
    document.getElementById('employee-id').textContent   = 'ID: ' + id;

    const rankEl = document.getElementById('detective-rank');
    rankEl.textContent       = 'Rank: ' + rank.label;
    rankEl.style.borderColor = rank.color;
    rankEl.style.color       = rank.color;

    const photoEl = document.getElementById('employee-photo');
    photoEl.style.display = 'block';
    if (photo) {
      photoEl.src     = photo;
      photoEl.onerror = () => { photoEl.src = ''; };
    } else {
      photoEl.src = '';
    }

    const caseIdEl = document.getElementById('case-employee-id');
    if (caseIdEl) caseIdEl.textContent = id;
  }

  // ── Score card ────────────────────────────────

  function refreshScores() {
    document.getElementById('cases-taken').textContent  = DB.Prefs.get('casesTaken')  || '0';
    document.getElementById('cases-open').textContent   = DB.Prefs.get('casesOpen')   || '0';
    document.getElementById('cases-solved').textContent = DB.Prefs.get('casesSolved') || '0';
  }

  function showApp() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('app-main').style.display    = '';
    refreshCard();
    refreshScores();
  }

  function hideApp() {
    document.getElementById('app-main').style.display    = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('login-name').value          = '';
    document.getElementById('login-password').value      = '';
    document.getElementById('login-photo-preview').innerHTML = '';
  }

  // ── Session restore on page load ──────────────

  function checkSession() {
    const uid = localStorage.getItem('__currentUser__');
    if (!uid) { hideApp(); return; }

    const aKey    = accountKey(uid);
    const acctRaw = localStorage.getItem(aKey);
    if (!acctRaw) { hideApp(); return; }

    // Set namespace FIRST — every Prefs call after this is scoped to uid
    DB.setCurrentUser(uid);

    try {
      const acct = JSON.parse(acctRaw);
      if (!DB.Prefs.get('empId')   && acct.id)   DB.Prefs.set('empId',   acct.id);
      if (!DB.Prefs.get('empName') && acct.name) DB.Prefs.set('empName', acct.name);
    } catch {}

    _migratePhoto();
    _restorePhotoFromAccount(aKey);
    showApp();
  }

  function logout() {
    localStorage.removeItem('__currentUser__');
    DB.setCurrentUser(null);
    hideApp();
  }

  function _finalizeLogin(uid, displayName, empId, aKey, photoData) {
    DB.Prefs.set('empName', displayName);
    DB.Prefs.set('empId',   empId);
    if (photoData) {
      _savePhoto(photoData);
      try {
        const acct = JSON.parse(localStorage.getItem(aKey) || '{}');
        acct.photo = photoData;
        acct.name  = displayName;
        localStorage.setItem(aKey, JSON.stringify(acct));
      } catch {}
    }
    showApp();
  }

  // ── Init ──────────────────────────────────────

  function init() {

    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const displayName = document.getElementById('login-name').value.trim();
      const password    = document.getElementById('login-password').value;
      const photoInput  = document.getElementById('login-photo');

      if (!displayName || !password) { alert('Please enter your name and password.'); return; }

      const uid     = sanitize(displayName);
      const aKey    = accountKey(uid);
      const acctRaw = localStorage.getItem(aKey);
      let empId;

      if (acctRaw) {
        let acct;
        try { acct = JSON.parse(acctRaw); }
        catch { alert('Account data corrupted.'); return; }

        if (acct.password !== password) { alert('Incorrect password. Please try again.'); return; }

        empId = acct.id;
        DB.setCurrentUser(uid);
        localStorage.setItem('__currentUser__', uid);

        if (!DB.Prefs.get('empId'))   DB.Prefs.set('empId',   empId);
        if (!DB.Prefs.get('empName')) DB.Prefs.set('empName', displayName);

        _migratePhoto();
        _restorePhotoFromAccount(aKey);

      } else {
        empId = generateId();
        localStorage.setItem(aKey, JSON.stringify({ id: empId, password, name: displayName }));
        DB.setCurrentUser(uid);
        localStorage.setItem('__currentUser__', uid);
        DB.Prefs.set('empId',   empId);
        DB.Prefs.set('empName', displayName);
      }

      if (photoInput.files && photoInput.files[0]) {
        const reader = new FileReader();
        reader.onload = evt => _finalizeLogin(uid, displayName, empId, aKey, evt.target.result);
        reader.readAsDataURL(photoInput.files[0]);
      } else {
        _finalizeLogin(uid, displayName, empId, aKey, null);
      }
    });

    document.getElementById('login-photo').addEventListener('change', function () {
      const preview = document.getElementById('login-photo-preview');
      if (this.files && this.files[0]) {
        const reader = new FileReader();
        reader.onload = evt => {
          preview.innerHTML = `<img src="${evt.target.result}"
            style="max-width:80px;border-radius:8px;margin-top:4px;">`;
        };
        reader.readAsDataURL(this.files[0]);
      }
    });

    document.getElementById('employee-id-card').addEventListener('dblclick', logout);
    checkSession();
  }

  return { init, logout, refreshCard, refreshScores, getRank };
})();

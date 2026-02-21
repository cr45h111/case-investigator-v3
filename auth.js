/* ═══════════════════════════════════════════════
   js/auth.js  —  Login / Logout / ID Card
═══════════════════════════════════════════════ */

const Auth = (() => {

  function sanitize(name) {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '_');
  }
  function accountKey(uid) { return '__account__' + uid; }
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

  function _savePhoto(data) {
    try { DB.Prefs.set('empPhoto', data); return true; }
    catch(e) { console.warn('Photo save failed (quota):', e); return false; }
  }

  // Migrate photo from legacy bare key → namespaced key.
  // CRITICAL: always delete the bare key so other users don't inherit this photo.
  function _migratePhoto() {
    var legacy = localStorage.getItem('empPhoto');
    if (legacy) {
      if (!DB.Prefs.get('empPhoto')) {
        _savePhoto(legacy);  // copy to current user's namespace
      }
      localStorage.removeItem('empPhoto'); // ← DELETE the bare key — this was the bug
    }
  }

  // Pull from account record if namespaced pref is still empty
  function _restorePhotoFromAccount(aKey) {
    if (DB.Prefs.get('empPhoto')) return;
    try {
      var acct = JSON.parse(localStorage.getItem(aKey) || '{}');
      if (acct.photo) _savePhoto(acct.photo);
    } catch(e) {}
  }

  function refreshCard() {
    var name   = DB.Prefs.get('empName')  || 'Not logged in';
    var id     = DB.Prefs.get('empId')    || '--';
    var photo  = DB.Prefs.get('empPhoto') || '';
    var solved = parseInt(DB.Prefs.get('casesSolved') || '0', 10);
    var rank   = getRank(solved);

    document.getElementById('employee-name').textContent = name;
    document.getElementById('employee-id').textContent   = 'ID: ' + id;

    var rankEl = document.getElementById('detective-rank');
    rankEl.textContent       = 'Rank: ' + rank.label;
    rankEl.style.borderColor = rank.color;
    rankEl.style.color       = rank.color;

    var photoEl = document.getElementById('employee-photo');
    photoEl.style.display = 'block';
    if (photo) {
      photoEl.src     = photo;
      photoEl.onerror = function() { photoEl.src = ''; };
    } else {
      photoEl.src = '';
    }

    var caseIdEl = document.getElementById('case-employee-id');
    if (caseIdEl) caseIdEl.textContent = id;
  }

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
    // Reload crime board for the newly authenticated user.
    // This ensures the correct per-user board is shown even if CrimeBoard.init()
    // ran before login (when _userId was still null and loaded board_state_default).
    if (typeof CrimeBoard !== 'undefined' && CrimeBoard.reload) {
      CrimeBoard.reload();
    }
  }

  function hideApp() {
    document.getElementById('app-main').style.display    = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    document.getElementById('login-name').value          = '';
    document.getElementById('login-password').value      = '';
    document.getElementById('login-photo-preview').innerHTML = '';
  }

  function checkSession() {
    var uid = localStorage.getItem('__currentUser__');
    if (!uid) { hideApp(); return; }

    var aKey    = accountKey(uid);
    var acctRaw = localStorage.getItem(aKey);
    if (!acctRaw) { hideApp(); return; }

    // Set namespace FIRST — all Prefs calls after this are scoped to uid
    DB.setCurrentUser(uid);

    try {
      var acct = JSON.parse(acctRaw);
      if (!DB.Prefs.get('empId')   && acct.id)   DB.Prefs.set('empId',   acct.id);
      if (!DB.Prefs.get('empName') && acct.name) DB.Prefs.set('empName', acct.name);
    } catch(e) {}

    _migratePhoto();                      // migrate + DELETE legacy bare key
    _restorePhotoFromAccount(aKey);       // fallback: pull from account record
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
      // Also stash in account record so it survives localStorage cleanup
      try {
        var acct   = JSON.parse(localStorage.getItem(aKey) || '{}');
        acct.photo = photoData;
        acct.name  = displayName;
        localStorage.setItem(aKey, JSON.stringify(acct));
      } catch(e) {}
    }
    showApp();
  }

  function init() {

    document.getElementById('login-form').addEventListener('submit', function(e) {
      e.preventDefault();
      var displayName = document.getElementById('login-name').value.trim();
      var password    = document.getElementById('login-password').value;
      var photoInput  = document.getElementById('login-photo');

      if (!displayName || !password) { alert('Please enter your name and password.'); return; }

      var uid     = sanitize(displayName);
      var aKey    = accountKey(uid);
      var acctRaw = localStorage.getItem(aKey);
      var empId;

      if (acctRaw) {
        var acct;
        try { acct = JSON.parse(acctRaw); }
        catch(e) { alert('Account data corrupted.'); return; }

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
        localStorage.setItem(aKey, JSON.stringify({ id: empId, password: password, name: displayName }));
        DB.setCurrentUser(uid);
        localStorage.setItem('__currentUser__', uid);
        DB.Prefs.set('empId',   empId);
        DB.Prefs.set('empName', displayName);
      }

      if (photoInput.files && photoInput.files[0]) {
        var reader = new FileReader();
        reader.onload = function(evt) {
          _finalizeLogin(uid, displayName, empId, aKey, evt.target.result);
        };
        reader.readAsDataURL(photoInput.files[0]);
      } else {
        _finalizeLogin(uid, displayName, empId, aKey, null);
      }
    });

    document.getElementById('login-photo').addEventListener('change', function() {
      var preview = document.getElementById('login-photo-preview');
      if (this.files && this.files[0]) {
        var reader = new FileReader();
        reader.onload = function(evt) {
          preview.innerHTML = '<img src="' + evt.target.result + '" style="max-width:80px;border-radius:8px;margin-top:4px;">';
        };
        reader.readAsDataURL(this.files[0]);
      }
    });

    document.getElementById('employee-id-card').addEventListener('dblclick', logout);
    checkSession();
  }

  return { init, logout, refreshCard, refreshScores, getRank };
})();

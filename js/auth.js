/* ═══════════════════════════════════════════════
   js/auth.js  —  Login / Logout / ID Card
   - Double-click ID card = instant logout (no confirm)
   - Badge photo persists after first upload
═══════════════════════════════════════════════ */

const Auth = (() => {

  // ── Helpers ──────────────────────────────────
  function generateId() {
    return 'EMP-' + Date.now().toString().slice(-6) + '-' +
           Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  }

  function getRank(solved) {
    if (solved >= 15) return { label: 'Legend',           color: '#ffaa00' };
    if (solved >= 8)  return { label: 'Master Sleuth',    color: '#ffd700' };
    if (solved >= 3)  return { label: 'Inspector',        color: '#00aaff' };
    return                   { label: 'Rookie',           color: '#888'    };
  }

  // ── Update visible ID card ────────────────────
  function refreshCard() {
    const name   = DB.Prefs.get('empName')  || 'Not logged in';
    const id     = DB.Prefs.get('empId')    || 'ID: --';
    const photo  = DB.Prefs.get('empPhoto') || '';
    const solved = parseInt(DB.Prefs.get('casesSolved') || '0', 10);
    const rank   = getRank(solved);

    document.getElementById('employee-name').textContent = name;
    document.getElementById('employee-id').textContent   = 'ID: ' + id;

    const rankEl = document.getElementById('detective-rank');
    rankEl.textContent = 'Rank: ' + rank.label;
    rankEl.style.borderColor = rank.color;
    rankEl.style.color        = rank.color;

    const photoEl = document.getElementById('employee-photo');
    if (photo) {
      photoEl.src = photo;
      photoEl.style.display = 'block';
    } else {
      photoEl.src = '';
      photoEl.style.display = 'block';
      photoEl.style.background = '#333';
    }

    // Mirror detective id into case section
    const caseIdEl = document.getElementById('case-employee-id');
    if (caseIdEl) caseIdEl.textContent = id;
  }

  // ── Update score card ─────────────────────────
  function refreshScores() {
    document.getElementById('cases-taken').textContent  = DB.Prefs.get('casesTaken')  || '0';
    document.getElementById('cases-open').textContent   = DB.Prefs.get('casesOpen')   || '0';
    document.getElementById('cases-solved').textContent = DB.Prefs.get('casesSolved') || '0';
  }

  // ── Show / hide main app ──────────────────────
  function showApp() {
    document.getElementById('login-modal').style.display = 'none';
    document.getElementById('app-main').style.display    = '';
    refreshCard();
    refreshScores();
  }

  function hideApp() {
    document.getElementById('app-main').style.display    = 'none';
    document.getElementById('login-modal').style.display = 'flex';
    // Clear form
    document.getElementById('login-name').value     = '';
    document.getElementById('login-password').value = '';
    document.getElementById('login-photo-preview').innerHTML = '';
  }

  // ── Check if already logged in ────────────────
  function checkSession() {
    const name = DB.Prefs.get('empName');
    const id   = DB.Prefs.get('empId');
    if (name && id) {
      showApp();
    } else {
      hideApp();
    }
  }

  // ── Logout ────────────────────────────────────
  function logout() {
    DB.Prefs.del('empName');
    DB.Prefs.del('empId');
    // Note: we deliberately keep empPhoto and empPassword
    // so they don't have to re-upload their photo on next login
    hideApp();
  }

  // ── Init ──────────────────────────────────────
  function init() {
    // Login form submit
    document.getElementById('login-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name     = document.getElementById('login-name').value.trim();
      const password = document.getElementById('login-password').value;
      const photoInput = document.getElementById('login-photo');

      if (!name || !password) {
        alert('Please enter your name and password.');
        return;
      }

      // Check if this user already exists
      const storedName = DB.Prefs.get('empName');
      const storedPassword = DB.Prefs.get('empPassword');
      const storedPhoto = DB.Prefs.get('empPhoto');
      let id = DB.Prefs.get('empId');

      if (storedName && storedPassword) {
        // User exists, check credentials
        if (name !== storedName || password !== storedPassword) {
          alert('Incorrect name or password.');
          return;
        }
        // Credentials match, proceed
        showApp();
      } else {
        // New user registration
        id = generateId();
        DB.Prefs.set('empId', id);
        DB.Prefs.set('empName', name);
        DB.Prefs.set('empPassword', password);
        // Photo: only update if a new file was chosen
        if (photoInput.files && photoInput.files[0]) {
          const reader = new FileReader();
          reader.onload = evt => {
            DB.Prefs.set('empPhoto', evt.target.result);
            showApp();
          };
          reader.readAsDataURL(photoInput.files[0]);
        } else {
          // No photo uploaded
          DB.Prefs.set('empPhoto', '');
          showApp();
        }
      }
    });

    // Login photo preview
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

    // Double-click ID card = instant logout
    document.getElementById('employee-id-card').addEventListener('dblclick', () => {
      logout();
    });

    // Check existing session
    checkSession();
  }

  return { init, logout, refreshCard, refreshScores, getRank };
})();

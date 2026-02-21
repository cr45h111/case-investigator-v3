/* ═══════════════════════════════════════════════
   js/storage.js  —  IndexedDB + localStorage wrapper
   Per-user isolation:
     · IDB records tagged with userId, filtered on read
     · localStorage Prefs keys prefixed per-user
     · GLOBAL_KEYS stay shared across all accounts
═══════════════════════════════════════════════ */

const DB = (() => {
  const DB_NAME = 'CaseInvestigator';
  const DB_VER  = 1;
  let _db     = null;
  let _userId = null;

  function setCurrentUser(uid) { _userId = uid; }
  function getCurrentUser()    { return _userId; }

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        ['suspects','cases','witnesses','boardItems','boardConnections'].forEach(name => {
          if (!db.objectStoreNames.contains(name))
            db.createObjectStore(name, { keyPath: 'id' });
        });
      };
      req.onsuccess = e => { _db = e.target.result; resolve(_db); };
      req.onerror   = e => reject(e.target.error);
    });
  }

  function tx(store, mode = 'readonly') {
    return _db.transaction(store, mode).objectStore(store);
  }

  async function getAll(store) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(store).getAll();
      req.onsuccess = e => resolve(
        (e.target.result || []).filter(r => r.userId === _userId)
      );
      req.onerror = e => reject(e.target.error);
    });
  }

  async function get(store, id) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(store).get(id);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function put(store, record) {
    await open();
    const r = { ...record, userId: _userId };
    return new Promise((resolve, reject) => {
      const req = tx(store, 'readwrite').put(r);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function del(store, id) {
    await open();
    return new Promise((resolve, reject) => {
      const req = tx(store, 'readwrite').delete(id);
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  async function clear(store) {
    await open();
    return new Promise((resolve, reject) => {
      const t   = _db.transaction(store, 'readwrite');
      const s   = t.objectStore(store);
      const req = s.getAll();
      req.onsuccess = e => {
        (e.target.result || [])
          .filter(r => r.userId === _userId)
          .forEach(r => s.delete(r.id));
      };
      t.oncomplete = () => resolve();
      t.onerror    = e  => reject(e.target.error);
    });
  }

  // ── Prefs (localStorage) ──────────────────────
  // GLOBAL_KEYS are stored with NO prefix — shared across all users.
  // Everything else is stored as  userId__keyName
  //
  // IMPORTANT: 'anthropicKey' is the key used by ai-engine.js.
  // The old code had 'apiKey' here which did NOT match, so the API
  // key was accidentally namespaced per-user. Fixed.
  const GLOBAL_KEYS = new Set([
    'anthropicKey',    // shared — enter once per browser
    '__currentUser__'  // session — must be global
  ]);

  const Prefs = {
    _key(k) {
      if (GLOBAL_KEYS.has(k) || k.startsWith('__account__')) return k;
      return _userId ? `${_userId}__${k}` : k;
    },
    get:  k      => { try { return localStorage.getItem(Prefs._key(k));  } catch { return null; } },
    set:  (k, v) => { try { localStorage.setItem(Prefs._key(k), v);      } catch {}              },
    del:  k      => { try { localStorage.removeItem(Prefs._key(k));       } catch {}              }
  };

  return { open, getAll, get, put, del, clear, Prefs, setCurrentUser, getCurrentUser };
})();

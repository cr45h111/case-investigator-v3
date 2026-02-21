/* ═══════════════════════════════════════════════
   js/storage.js  —  IndexedDB + localStorage
   Per-user isolation:
     · IDB records stamped with userId, filtered on read
     · localStorage Prefs prefixed  userId__key
     · GLOBAL_KEYS stored without prefix (shared)
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
        ['suspects','cases','witnesses','boardItems','boardConnections'].forEach(n => {
          if (!db.objectStoreNames.contains(n))
            db.createObjectStore(n, { keyPath: 'id' });
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
      req.onsuccess = e =>
        resolve((e.target.result || []).filter(r => r.userId === _userId));
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

  const GLOBAL_KEYS = new Set([
    'anthropicKey',
    '__currentUser__'
  ]);

  const Prefs = {
    _key(k) {
      if (GLOBAL_KEYS.has(k) || k.startsWith('__account__')) return k;
      return _userId ? (_userId + '__' + k) : k;
    },
    get:  function(k)    { try { return localStorage.getItem(Prefs._key(k));  } catch(e) { return null; } },
    set:  function(k, v) { try { localStorage.setItem(Prefs._key(k), v);      } catch(e) {}              },
    del:  function(k)    { try { localStorage.removeItem(Prefs._key(k));       } catch(e) {}              }
  };

  return { open, getAll, get, put, del, clear, Prefs, setCurrentUser, getCurrentUser };
})();

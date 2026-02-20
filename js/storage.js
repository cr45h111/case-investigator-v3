/* ═══════════════════════════════════════════════
   js/storage.js  —  IndexedDB wrapper
   Replaces all localStorage usage for case data.
   localStorage is used ONLY for tiny prefs (photo, api key).
═══════════════════════════════════════════════ */

const DB = (() => {
  const DB_NAME  = 'CaseInvestigator';
  const DB_VER   = 1;
  let _db = null;

  function open() {
    return new Promise((resolve, reject) => {
      if (_db) { resolve(_db); return; }
      const req = indexedDB.open(DB_NAME, DB_VER);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('suspects')) {
          db.createObjectStore('suspects', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('cases')) {
          db.createObjectStore('cases', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('witnesses')) {
          db.createObjectStore('witnesses', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('boardItems')) {
          db.createObjectStore('boardItems', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('boardConnections')) {
          db.createObjectStore('boardConnections', { keyPath: 'id' });
        }
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
      req.onsuccess = e => resolve(e.target.result || []);
      req.onerror   = e => reject(e.target.error);
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
    return new Promise((resolve, reject) => {
      const req = tx(store, 'readwrite').put(record);
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
      const req = tx(store, 'readwrite').clear();
      req.onsuccess = () => resolve();
      req.onerror   = e => reject(e.target.error);
    });
  }

  // Tiny prefs that don't need IDB (non-sensitive, small)
  const Prefs = {
    get: k      => { try { return localStorage.getItem(k); } catch { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
    del: k      => { try { localStorage.removeItem(k); } catch {} }
  };

  return { open, getAll, get, put, del, clear, Prefs };
})();

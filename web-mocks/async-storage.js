// Mock AsyncStorage cho web: ưu tiên localStorage, fallback memory khi bị chặn.
const memory = new Map();

function ensureString(v) {
  if (v === undefined) return 'undefined';
  if (v === null) return 'null';
  return typeof v === 'string' ? v : (() => { try { return JSON.stringify(v); } catch { return String(v); } })();
}

function hasLocalStorage() {
  try {
    const k = '__probe__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return true;
  } catch { return false; }
}

const useLS = hasLocalStorage();

const get = (k) => (useLS ? window.localStorage.getItem(k) : (memory.has(k) ? memory.get(k) : null));
const set = (k, v) => (useLS ? window.localStorage.setItem(k, ensureString(v)) : memory.set(k, ensureString(v)));
const del = (k) => (useLS ? window.localStorage.removeItem(k) : memory.delete(k));

const AsyncStorageWeb = {
  async getItem(key) { try { return get(key); } catch (e) { console.warn('[AS:web] getItem', e); return null; } },
  async setItem(key, value) { try { set(key, value); } catch (e) { console.warn('[AS:web] setItem', e); throw e; } },
  async removeItem(key) { try { del(key); } catch (e) { console.warn('[AS:web] removeItem', e); } },
  async clear() { try { useLS ? window.localStorage.clear() : memory.clear(); } catch (e) { console.warn('[AS:web] clear', e); } },
  async getAllKeys() {
    try { return useLS ? Object.keys(window.localStorage) : Array.from(memory.keys()); }
    catch (e) { console.warn('[AS:web] getAllKeys', e); return []; }
  },

  // ====== các API multi* mà code của m đang dùng ======
  async multiSet(pairs = []) {
    try { for (const [k, v] of pairs) set(k, v); }
    catch (e) { console.warn('[AS:web] multiSet', e); throw e; }
  },
  async multiGet(keys = []) {
    try { return keys.map(k => [k, get(k)]); }
    catch (e) { console.warn('[AS:web] multiGet', e); return keys.map(k => [k, null]); }
  },
  async multiRemove(keys = []) {
    try { for (const k of keys) del(k); }
    catch (e) { console.warn('[AS:web] multiRemove', e); }
  },
};

export default AsyncStorageWeb;

// utils/sseManager.js
import { AppState, Platform } from 'react-native';
import EventSource from 'react-native-sse';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SSE_URL = 'https://ev-charging.iky.vn/api/sse/events';
// const TAG = '[SSE]'; // không dùng nữa khi tắt log
let DEBUG = false; // ✅ tắt log mặc định

// ✅ no-op logger: không in gì cả
function log() {}
// Nếu muốn log khi debug local, bật lại như sau:
// DEBUG = true; và đổi log thành: function log(...args){ if (DEBUG) console.log('[SSE]', ...args); }

function maskToken(t = '') {
  if (!t) return '';
  if (t.length <= 12) return '[TOKEN]';
  return `${t.slice(0, 6)}...${t.slice(-6)}`;
}

class SSEManager {
  es = null;               // current EventSource
  token = null;            // current access token
  appState = 'active';
  reconnectAttempts = 0;
  maxBackoffMs = 30000;    // 30s
  listeners = new Set();   // subscribers
  messageCount = 0;
  appStateSub = null;

  onAuthInvalid = null;    // callback khi 401/invalid token
  authDead = false;        // chặn reconnect khi auth chết

  // 🔒 chống mở song song & chống reopen liên tục
  _openInFlight = false;
  _lastOpenUrl = null;

  constructor() {
    this._handleAppState = this._handleAppState.bind(this);
    this.appStateSub = AppState.addEventListener('change', this._handleAppState);
    log('constructor → add AppState listener');
  }

  setDebug(enabled) {
    DEBUG = !!enabled;
    // nếu muốn in log khi bật debug, thay log() bằng console.log ở trên
    log('setDebug =', DEBUG);
  }

  setAuthInvalidHandler(fn) {
    this.onAuthInvalid = typeof fn === 'function' ? fn : null;
    log('setAuthInvalidHandler:', !!this.onAuthInvalid);
  }

  _handleAppState(next) {
    const prev = this.appState;
    this.appState = next;
    log('AppState:', prev, '→', next);

    // 🛑 Web: bỏ đóng/mở theo AppState để tránh spam khi tab blur/focus
    if (Platform.OS === 'web') {
      return; // log('AppState changes ignored on web');
    }

    if (/inactive|background/.test(prev) && next === 'active') {
      if (!this.es && !this.authDead) {
        this._open();
      }
    } else if (/inactive|background/.test(next)) {
      this._close();
    }
  }

  on(listener) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  _emit(evt) {
    for (const fn of this.listeners) {
      try { fn(evt); } catch (e) { /* swallow */ }
    }
  }

  // ===== PUBLIC API ===========================================================
  async start(initialToken) {
    let tok = initialToken;
    if (!tok) {
      tok = await AsyncStorage.getItem('access_token');
    }

    // ⛔ nếu đã mở với cùng token → bỏ qua
    if (tok && this.es && this.token === tok) {
      return;
    }

    this.token = tok || null;
    this.reconnectAttempts = 0;
    this.messageCount = 0;
    this.authDead = false;

    this._open();
  }

  stop() {
    this.reconnectAttempts = 0;
    this._close();
  }

  async updateToken(newToken) {
    if (!newToken) return;
    if (newToken === this.token) return;

    this.token = newToken;
    this.authDead = false;
    this._reopenSoon(150);
  }

  destroy() {
    try { this.appStateSub?.remove?.(); } catch {}
    this._close();
    this.listeners.clear();
  }

  // ===== INTERNALS ===========================================================
  _currentUrl() {
    if (!this.token) return null;
    return `${SSE_URL}?token=${encodeURIComponent(this.token)}`;
  }

  _open() {
    if (this._openInFlight) return;
    if (!this.token) return;
    if (this.authDead) return;

    const url = this._currentUrl();
    if (!url) return;

    // ⛔ Nếu ES đã mở và URL không đổi → bỏ
    if (this.es && this._lastOpenUrl === url) {
      return;
    }

    // Nếu đang có ES khác URL → đóng trước
    if (this.es && this._lastOpenUrl !== url) {
      this._close();
    }

    this._openInFlight = true;
    this._lastOpenUrl = url;
    this.messageCount = 0;

    try {
      this.es = new EventSource(url, {
        headers: { Accept: 'text/event-stream' },
      });

      this.es.addEventListener('open', () => {
        this.reconnectAttempts = 0;
        this._emit({ type: 'status', status: 'open' });
      });

      this.es.addEventListener('message', (ev) => {
        this.messageCount += 1;
        // ⛔ Không log preview để tiết kiệm CPU/GC
        let payload = null;
        try { payload = ev?.data ? JSON.parse(ev.data) : null; } catch {}
        this._emit({ type: 'message', event: 'message', data: payload ?? ev?.data ?? null });
      });

      this.es.addEventListener('error', (e) => {
        // Không tạo chuỗi thông báo dài để log
        const msg = (e && e.message) || String(e || '');

        const lower = (msg || '').toLowerCase();
        const isAuthError =
          lower.includes('invalid or expired token') ||
          lower.includes('invalid token') ||
          lower.includes('"message":"invalid') ||
          lower.includes('401');

        this._emit({ type: 'status', status: 'error', error: msg });
        this._close(); // reset ES before decide

        if (isAuthError) {
          this.authDead = true;
          try { this.onAuthInvalid && this.onAuthInvalid(); } catch {}
          return; // ❗ stop reconnect completely
        }

        this._scheduleReconnect();
      });
    } finally {
      // giải lock ngay, vì EventSource callback sẽ xử lý tiếp
      this._openInFlight = false;
    }
  }

  _close() {
    if (this.es) {
      try { this.es.close(); } catch {}
      this.es = null;
    }
  }

  _scheduleReconnect() {
    // Trên web, nếu tab đang hidden thì đợi
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      return;
    }
    if (this.appState !== 'active' && Platform.OS !== 'web') {
      return;
    }
    if (this.authDead) {
      return;
    }
    const backoff = Math.min(this.maxBackoffMs, 500 * Math.pow(2, this.reconnectAttempts));
    this.reconnectAttempts += 1;
    setTimeout(() => this._open(), backoff);
  }

  _reopenSoon(delay = 0) {
    this._close();
    setTimeout(() => this._open(), delay);
  }
}

const sseManager = new SSEManager();
export default sseManager;

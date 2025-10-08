// utils/sseManager.js
import { AppState, Platform } from 'react-native';
import EventSource from 'react-native-sse';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SSE_URL = 'https://ev-charging.iky.vn/api/sse/events';
const TAG = '[SSE]';
let DEBUG = true;

function log(...args) {
  if (DEBUG) console.log(TAG, ...args);
}
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
      log('AppState changes ignored on web');
      return;
    }

    if (/inactive|background/.test(prev) && next === 'active') {
      if (!this.es && !this.authDead) {
        log('Foreground resume → open()');
        this._open();
      } else {
        log('Foreground resume → already open or authDead');
      }
    } else if (/inactive|background/.test(next)) {
      log('Go background → close()');
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
      try { fn(evt); } catch (e) { log('listener error:', e?.message || e); }
    }
  }

  // ===== PUBLIC API ===========================================================
  async start(initialToken) {
    let tok = initialToken;
    if (!tok) {
      tok = await AsyncStorage.getItem('access_token');
      log('start(): token from storage =', tok ? '[HAVE]' : '[MISSING]');
    } else {
      log('start(): token provided = [HAVE]');
    }

    // ⛔ nếu đã mở với cùng token → bỏ qua
    if (tok && this.es && this.token === tok) {
      log('start(): already started with same token → noop');
      return;
    }

    this.token = tok || null;
    this.reconnectAttempts = 0;
    this.messageCount = 0;
    this.authDead = false;

    this._open();
  }

  stop() {
    log('stop() called');
    this.reconnectAttempts = 0;
    this._close();
  }

  async updateToken(newToken) {
    if (!newToken) {
      log('updateToken(): SKIP (empty)');
      return;
    }
    if (newToken === this.token) {
      log('updateToken(): same token → no reopen');
      return;
    }
    log('updateToken(): apply & reopen. old =', maskToken(this.token), 'new =', maskToken(newToken));
    this.token = newToken;
    this.authDead = false;
    this._reopenSoon(150);
  }

  destroy() {
    log('destroy(): remove AppState listener & close ES');
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
    if (this._openInFlight) {
      log('open(): already in-flight → skip');
      return;
    }
    if (!this.token) {
      log('open(): NO TOKEN → abort');
      return;
    }
    if (this.authDead) {
      log('open(): authDead = true → skip');
      return;
    }

    const url = this._currentUrl();
    if (!url) return;

    // ⛔ Nếu ES đã mở và URL không đổi → bỏ
    if (this.es && this._lastOpenUrl === url) {
      log('open(): already open with same url → noop');
      return;
    }

    // Nếu đang có ES khác URL → đóng trước
    if (this.es && this._lastOpenUrl !== url) {
      log('open(): url changed → close() then open');
      this._close();
    }

    this._openInFlight = true;
    this._lastOpenUrl = url;

    log('open():', url.replace(encodeURIComponent(this.token), maskToken(this.token)));
    this.messageCount = 0;

    try {
      this.es = new EventSource(url, {
        headers: { Accept: 'text/event-stream' },
      });

      this.es.addEventListener('open', () => {
        this.reconnectAttempts = 0;
        log('event: open ✓');
        this._emit({ type: 'status', status: 'open' });
      });

      this.es.addEventListener('message', (ev) => {
        this.messageCount += 1;
        const raw = ev?.data ?? '';
        let preview = raw;
        if (typeof preview === 'string' && preview.length > 200) preview = preview.slice(0, 200) + '…';

        let payload = null;
        try { payload = raw ? JSON.parse(raw) : null; } catch {}
        log(`event: message #${this.messageCount}`, '| len =', typeof raw === 'string' ? raw.length : 0, '| preview =', preview);
        this._emit({ type: 'message', event: 'message', data: payload ?? raw });
      });

      this.es.addEventListener('error', (e) => {
        const msg = (e && e.message) || String(e);
        log('event: error ✗ →', msg);

        const lower = (msg || '').toLowerCase();
        const isAuthError =
          lower.includes('invalid or expired token') ||
          lower.includes('invalid token') ||
          lower.includes('"message":"invalid') ||
          lower.includes('401');

        this._emit({ type: 'status', status: 'error', error: msg });
        this._close(); // reset ES before decide

        if (isAuthError) {
          log('auth error detected → authDead=true, stop reconnect, fire onAuthInvalid');
          this.authDead = true;
          try { this.onAuthInvalid && this.onAuthInvalid(); } catch (err) { log('onAuthInvalid cb error:', err?.message || err); }
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
      log('close(): closing current EventSource');
      try { this.es.close(); } catch (e) { log('close() error:', e?.message || e); }
      this.es = null;
    } else {
      log('close(): no active ES');
    }
  }

  _scheduleReconnect() {
    // Trên web, nếu tab đang hidden thì đợi
    if (Platform.OS === 'web' && typeof document !== 'undefined' && document.visibilityState === 'hidden') {
      log('scheduleReconnect(): tab hidden → skip until visible');
      // khi tab visible lại, _open() sẽ tự được gọi từ bên ngoài (start/updateToken) nếu cần
      return;
    }

    if (this.appState !== 'active' && Platform.OS !== 'web') {
      log('scheduleReconnect(): app not active (native) → skip');
      return;
    }
    if (this.authDead) {
      log('scheduleReconnect(): authDead → skip');
      return;
    }
    const backoff = Math.min(this.maxBackoffMs, 500 * Math.pow(2, this.reconnectAttempts));
    log('scheduleReconnect(): attempt =', this.reconnectAttempts, '| backoff =', backoff, 'ms');
    this.reconnectAttempts += 1;
    setTimeout(() => this._open(), backoff);
  }

  _reopenSoon(delay = 0) {
    log('reopenSoon(): delay =', delay, 'ms');
    this._close();
    setTimeout(() => this._open(), delay);
  }
}

const sseManager = new SSEManager();
export default sseManager;
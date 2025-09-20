// hooks/useOrderStatusPolling.js
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getExtendHistory } from '../apis/devices';

/**
 * Poll trạng thái đơn hàng qua lịch sử gia hạn thiết bị.
 *
 * @param {Object} opts
 * @param {string} opts.deviceId             - Bắt buộc
 * @param {string=} opts.orderCode           - Mã đơn (ưu tiên so khớp nếu không có orderId)
 * @param {string=} opts.orderId             - ID đơn (nếu backend có _id/id thì nên dùng)
 * @param {number=} opts.intervalMs          - Chu kỳ poll, mặc định 5000ms
 * @param {number=} opts.timeoutMs           - Hết hạn poll, mặc định 300000ms (5 phút)
 * @param {(order:any)=>void} opts.onSuccess - Gọi khi status===1
 * @param {(order:any)=>void=} opts.onCanceled - Gọi khi status===0 (nếu muốn)
 * @param {()=>void=} opts.onTimeout         - Gọi khi quá timeout
 * @param {(e:any)=>void=} opts.onError      - Gọi khi có lỗi request
 * @param {boolean=} opts.debug              - Bật log debug
 */
export function useOrderStatusPolling(opts) {
  const {
    deviceId,
    orderCode,
    orderId,
    intervalMs = 5000,
    timeoutMs = 5 * 60 * 1000,
    onSuccess,
    onCanceled,
    onTimeout,
    onError,
    debug = true,
  } = opts || {};

  const timerRef = useRef(null);
  const stoppedRef = useRef(false);
  const startAtRef = useRef(0);
  const appStateRef = useRef(AppState.currentState);
  const lastStatusRef = useRef(null); // tránh gọi lặp nếu API trả 1 nhiều lần
  const mountedRef = useRef(false);

  // helpers
  const norm = (x) => String(x ?? '').trim();

  const log = (...args) => {
    if (!debug) return;
    // prefix cho dễ lọc trong logcat
    console.log('[OrderPolling]', ...args);
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    // Guard tham số
    if (!deviceId) { debug && console.warn('[OrderPolling] missing deviceId'); return; }
    if (!orderCode && !orderId) { debug && console.warn('[OrderPolling] missing orderCode/orderId'); return; }
    if (typeof onSuccess !== 'function') { debug && console.warn('[OrderPolling] missing onSuccess'); return; }

    stoppedRef.current = false;
    startAtRef.current = Date.now();
    lastStatusRef.current = null;

    const stop = () => {
      if (stoppedRef.current) return;
      stoppedRef.current = true;
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      log('STOP');
    };

    const checkStatus = async () => {
      try {
        if (!mountedRef.current) return;
        // pause khi app nền
        if (appStateRef.current !== 'active') {
          debug && log('skip (app in background)');
          return;
        }

        // timeout
        const elapsed = Date.now() - startAtRef.current;
        if (elapsed > timeoutMs) {
          stop();
          onTimeout && onTimeout();
          log('TIMEOUT');
          return;
        }

        const token = await AsyncStorage.getItem('access_token').catch(() => null);
        const raw = await getExtendHistory({ accessToken: token || '', deviceId });

        // Chuẩn hóa list
        const list = Array.isArray(raw) ? raw : (raw ? [raw] : []);
        debug && log('HISTORY LEN =', list.length);

        // Tìm đơn khớp
        const found = list.find((r) => {
          const rid = norm(r?.id) || norm(r?._id);
          const rcode = norm(r?.code);
          if (orderId && (rid === norm(orderId))) return true;
          if (orderCode && (rcode === norm(orderCode))) return true;
          return false;
        });

        debug && log('FOUND =', found ? { code: found.code, status: found.status } : null);
        if (!found) return;

        const st = Number(found.status);
        // tránh gọi nhiều lần cùng status
        if (lastStatusRef.current === st) return;
        lastStatusRef.current = st;

        if (st === 1) {
          stop();
          log('SUCCESS status=1 → onSuccess()');
          onSuccess && onSuccess(found);
          return;
        }
        if (st === 0) {
          // optional: coi là kết thúc vòng poll
          if (typeof onCanceled === 'function') {
            stop();
            log('CANCELED status=0 → onCanceled()');
            onCanceled(found);
          } else {
            log('status=0 (canceled) — no handler, continue polling');
          }
          return;
        }

        // st=3 (pending) → continue
      } catch (e) {
        debug && console.error('[OrderPolling] ERROR', e);
        onError && onError(e);
      }
    };

    // AppState: pause/resume
    const sub = AppState.addEventListener('change', (s) => {
      appStateRef.current = s;
      debug && log('AppState =', s);
    });

    // fire ngay lần đầu cho nhanh
    checkStatus();
    timerRef.current = setInterval(checkStatus, intervalMs);
    log('START >>>', { deviceId, orderCode, orderId, intervalMs, timeoutMs });

    return () => {
      sub.remove();
      stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, orderCode, orderId, intervalMs, timeoutMs]);
}

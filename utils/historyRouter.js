// utils/historyRouter.js
import { Platform } from 'react-native';

export function initHistory(navigate) {
  if (Platform.OS !== 'web') return () => {};

  // Sync từ URL hash vào app (F5 hoặc user gõ URL)
  const applyFromURL = () => {
    const hash = (window.location.hash || '').replace(/^#\/?/, '');
    const [screenPart] = hash.split('?');
    if (screenPart) navigate(screenPart);
  };

  const onPop = (e) => {
    const st = e.state;
    if (st?.screen) {
      navigate(st.screen, st.params);
    } else {
      // Không có state (load cũ/đi thẳng URL) thì đọc từ hash
      applyFromURL();
    }
  };

  // Lần đầu vào: nếu URL có hash thì sync vô app
  applyFromURL();

  window.addEventListener('popstate', onPop);
  return () => window.removeEventListener('popstate', onPop);
}

export function push(screen, params) {
  if (Platform.OS !== 'web') return;
  const url = `#/${screen}`; // dùng hash-route để không reload trang
  window.history.pushState({ screen, params }, '', url);
}

export function back() {
  if (Platform.OS !== 'web') return false;
  window.history.back();
  return true;
}

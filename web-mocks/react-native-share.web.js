// web-mocks/react-native-share.web.js

function dataUrlToFile(dataUrl, filename = 'share') {
  const arr = dataUrl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'application/octet-stream';
  const bstr = atob(arr[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) u8arr[n] = bstr.charCodeAt(n);
  return new File([u8arr], filename, { type: mime });
}

async function webShare({ title, message, url, filenames, failOnCancel } = {}) {
  // Chuẩn hóa text
  const text = [message, url].filter(Boolean).join('\n');

  // File hỗ trợ khi url là data: hoặc blob:
  let files;
  try {
    if (url && url.startsWith('data:')) {
      files = [dataUrlToFile(url, (filenames && filenames[0]) || 'share')];
    } else if (url && (url.startsWith('blob:') || url.startsWith('http'))) {
      // Một số trình duyệt hỗ trợ share link trực tiếp, không cần fetch file
      files = undefined;
    }
  } catch (e) {
    // bỏ qua nếu không convert được
  }

  if (navigator.share) {
    const data = { title, text };
    if (files) data.files = files;
    try {
      await navigator.share(data);
      return { success: true, dismissedAction: false };
    } catch (err) {
      // Nếu user cancel và failOnCancel = true thì quăng error giống lib gốc
      if (err && err.name === 'AbortError' && failOnCancel) {
        const e = new Error('User did not share');
        e.code = 'E_USER_CANCELLED';
        throw e;
      }
      // Thử fallback
    }
  }

  // Fallback: mở tab hoặc copy link
  if (url) {
    const a = document.createElement('a');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return { success: true, dismissedAction: false, fallback: true };
  }

  // Fallback text: copy clipboard
  if (text) {
    try {
      await navigator.clipboard.writeText(text);
      return { success: true, dismissedAction: false, copied: true };
    } catch (_) {
      // kệ
    }
  }

  throw new Error('Share not supported on web');
}

export default {
  open: webShare,
  shareSingle: webShare,
};

export const Share = {
  open: webShare,
  shareSingle: webShare,
  Social: {}, // giữ API shape cho code cũ đỡ crash
};

// web-mocks/document-picker.web.js
const openFileDialog = (accept, multiple = false, copyToCacheDirectory = true) =>
  new Promise((resolve, reject) => {
    try {
      const input = document.createElement('input');
      input.type = 'file';
      if (accept && Array.isArray(accept) && accept.length) {
        input.accept = accept.join(',');
      }
      input.multiple = !!multiple;
      input.style.display = 'none';
      document.body.appendChild(input);
      input.addEventListener('change', () => {
        const files = Array.from(input.files || []).map((f) => ({
          uri: URL.createObjectURL(f),
          name: f.name,
          size: f.size,
          type: f.type,
          fileCopyUri: copyToCacheDirectory ? URL.createObjectURL(f) : null,
        }));
        document.body.removeChild(input);
        resolve(multiple ? files : files[0]);
      });
      input.click();
    } catch (e) {
      reject(e);
    }
  });

export const isCancel = () => false;
export const isInProgress = () => false;

export const types = {
  allFiles: '*/*',
  images: 'image/*',
  plainText: 'text/plain',
  pdf: 'application/pdf',
};

export const pick = async (opts = {}) =>
  openFileDialog(
    opts.type ? (Array.isArray(opts.type) ? opts.type : [opts.type]) : [],
    !!opts.allowMultiSelection,
    opts.copyTo || true
  );

export const pickSingle = async (opts = {}) => pick({ ...opts, allowMultiSelection: false });

export default { pick, pickSingle, isCancel, isInProgress, types };

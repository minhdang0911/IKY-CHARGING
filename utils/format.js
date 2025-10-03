export const fmtMoney = (n) => Number(n || 0).toLocaleString('vi-VN') + 'đ';

export const fmtMoneyShort = (n) => {
  const v = Number(n || 0);
  if (v >= 1_000_000_000) return (v / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (v >= 1_000_000)     return (v / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (v >= 1_000)         return (v / 1_000).toFixed(1).replace(/\.0$/, '') + 'k';
  return String(v);
};

export const toLabel = (raw) => String(raw || '');

export const parseMY = (s) => ({ m: Number(s?.slice(0, 2)), y: Number(s?.slice(3, 7)) });

export const YEAR_NOW = new Date().getFullYear();

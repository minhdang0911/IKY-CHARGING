// web-mocks/datetimepicker.web.js
import React from 'react';

function toLocalISOString(d) {
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return (
    d.getFullYear() +
    '-' +
    pad(d.getMonth() + 1) +
    '-' +
    pad(d.getDate()) +
    'T' +
    pad(d.getHours()) +
    ':' +
    pad(d.getMinutes())
  );
}

const DateTimePicker = ({ value, mode = 'date', onChange, minimumDate, maximumDate }) => {
  const type =
    mode === 'time' ? 'time' : mode === 'datetime' || mode === 'datetime-local' ? 'datetime-local' : 'date';

  const handle = (e) => {
    const v = e.target.value;
    if (!onChange) return;
    const date =
      type === 'time'
        ? (() => {
            const [hh, mm] = v.split(':').map((x) => parseInt(x, 10));
            const d = value instanceof Date ? new Date(value) : new Date();
            d.setHours(hh || 0, mm || 0, 0, 0);
            return d;
          })()
        : new Date(v);
    onChange({ type: 'set', nativeEvent: { timestamp: date.getTime() } }, date);
  };

  const inputProps = {};
  if (minimumDate) inputProps.min = toLocalISOString(minimumDate).slice(0, type === 'date' ? 10 : 16);
  if (maximumDate) inputProps.max = toLocalISOString(maximumDate).slice(0, type === 'date' ? 10 : 16);

  const val =
    value instanceof Date
      ? type === 'time'
        ? `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`
        : toLocalISOString(value).slice(0, type === 'date' ? 10 : 16)
      : '';

  return <input type={type} value={val} onChange={handle} {...inputProps} />;
};

export default DateTimePicker;

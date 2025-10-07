import React from 'react';

export default function Icon({ name, size = 24, color = '#000', style }) {
  return (
    <span
      className="material-icons"
      style={{
        fontFamily: 'Material Icons',
        fontSize: size,
        color,
        lineHeight: 1,
        verticalAlign: 'middle',
        ...style,
      }}
    >
      {name}
    </span>
  );
}

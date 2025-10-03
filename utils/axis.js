function niceNumber(range, round) {
  const exp = Math.floor(Math.log10(range || 1));
  const frac = range / Math.pow(10, exp);
  let nice;
  if (round)      nice = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  else            nice = frac <= 1 ? 1 : frac <= 2 ? 2 : frac <= 5 ? 5 : 10;
  return nice * Math.pow(10, exp);
}

export function computeNiceAxis(maxVal, tickCount = 4) {
  const rough = maxVal / tickCount || 1;
  const step  = niceNumber(rough, true);
  const niceMax = Math.max(step, Math.ceil((maxVal || 0) / step) * step);
  const ticks = [];
  for (let v = 0; v <= niceMax + 1e-6; v += step) ticks.push(v);
  return { niceMax, step, ticks };
}

import React, { useState, useMemo, useRef, useCallback } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Rect,
  Text as SvgText,
  Defs,
  LinearGradient,
  Stop,
  Line,
  G,
  Circle,
} from 'react-native-svg';
import { fmtMoney, fmtMoneyShort } from '../../utils/format';
import { computeNiceAxis } from '../../utils/axis';

export default function FancyChart({
  mode = 'bar',
  width = 340,
  height = 280,
  labels = [],
  values = [],
  accent = '#2563EB',
  onBarPress,

  /** Chỉ dùng để ép hiện value text trên đỉnh cột/điểm */
  alwaysShowValue = false,

  /** Chế độ tooltip: 'off' | 'press' | 'hover' | 'always'
   *  => ta sẽ dùng 'press' theo yêu cầu
   */
  tooltipMode = 'press',
}) {
  // padding (tăng top khi alwaysShowValue để không tràn)
  const padL = 52,
    padR = 18,
    padT = alwaysShowValue ? 32 : 24,
    padB = 36;
  const innerW = width - padL - padR;
  const innerH = height - padT - padB;

  const [active, setActive] = useState(null);
  const rootRef = useRef(null);

  const rawMax = Math.max(0, ...values);
  const dataMax = rawMax === 0 ? 1 : rawMax;
  const { niceMax, ticks } = useMemo(
    () => computeNiceAxis(dataMax, 4),
    [dataMax]
  );

  const sum = useMemo(
    () => values.reduce((a, b) => a + (b || 0), 0),
    [values]
  );
  const avg = useMemo(
    () => (values.length ? sum / values.length : 0),
    [sum, values]
  );

  const yScale = (v) => innerH - (v / niceMax) * innerH;
  const band = (idx) => {
    const bw = innerW / Math.max(labels.length, 1);
    return { x: bw * idx + bw * 0.125, bw: bw * 0.75 };
  };
  const xAt = (i) => {
    const { x, bw } = band(i);
    return x + bw / 2;
  };

  /** ========== RULES theo yêu cầu ========== */
  const hasValue = useCallback(
    (i) => (Number(values?.[i]) || 0) > 0,
    [values]
  );

  const setActiveByX = useCallback(
    (pageX /*, pageY */) => {
      const localX = pageX - padL;
      if (localX < 0 || localX > innerW) {
        setActive(null);
        return;
      }
      const bw = innerW / Math.max(labels.length, 1);
      const idx = Math.max(
        0,
        Math.min(labels.length - 1, Math.floor(localX / bw))
      );
      // chỉ chọn nếu có doanh thu > 0
      setActive(hasValue(idx) ? idx : null);
    },
    [innerW, labels.length, hasValue]
  );

  // Pointer handlers: chỉ dùng press, tắt hover
  const pointerHandlers =
    tooltipMode === 'press'
      ? {
          onStartShouldSetResponder: () => true,
          onMoveShouldSetResponder: () => true,
          onResponderGrant: (e) => {
            setActiveByX(e.nativeEvent.locationX, e.nativeEvent.locationY);
          },
          onResponderMove: (e) => {
            setActiveByX(e.nativeEvent.locationX, e.nativeEvent.locationY);
          },
          onResponderRelease: () => {
            /* giữ active đến khi bấm nền/toggle khác */
          },
          // vô hiệu hover (web)
          onMouseMove: () => {},
          onMouseLeave: () => {},
        }
      : tooltipMode === 'hover'
      ? {
          onMouseMove: (e) => {
            setActiveByX(e.nativeEvent.offsetX, e.nativeEvent.offsetY);
          },
          onMouseLeave: () => setActive(null),
        }
      : {};

  const showSingleTooltip = tooltipMode === 'press' || tooltipMode === 'hover';
  const showAllTooltips = tooltipMode === 'always';

  /** ========== RENDER ========== */
  const TOOL_W = 100,
    TOOL_H = 38,
    TOOL_MG = 8;
  const renderTooltip = (xc, y, lbl, val, leftBound = 0, rightBound = innerW) => {
    let ty = y - (TOOL_H + TOOL_MG);
    if (ty < 6) ty = y + TOOL_MG;
    let lx = xc - TOOL_W / 2;
    if (lx < leftBound + 4) lx = leftBound + 4;
    if (lx + TOOL_W > rightBound - 4) lx = rightBound - 4 - TOOL_W;
    return (
      <G>
        <Rect
          x={lx}
          y={ty}
          width={TOOL_W}
          height={TOOL_H}
          rx={8}
          ry={8}
          fill="#111827"
          opacity="0.96"
        />
        <SvgText
          x={lx + TOOL_W / 2}
          y={ty + 14}
          fontSize="10"
          fill="#CBD5E1"
          textAnchor="middle"
          fontWeight="600"
        >
          {lbl}
        </SvgText>
        <SvgText
          x={lx + TOOL_W / 2}
          y={ty + 28}
          fontSize="12"
          fill="#ffffff"
          textAnchor="middle"
          fontWeight="800"
        >
          {fmtMoney(val)}
        </SvgText>
      </G>
    );
  };

  return (
    <View ref={rootRef} style={s.card} {...pointerHandlers}>
      <Svg width={width} height={height}>
        <Defs>
          <LinearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor={accent} stopOpacity="1" />
            <Stop offset="100%" stopColor="#8CC5FF" stopOpacity="1" />
          </LinearGradient>
          <LinearGradient id="barGradDim" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#93C5FD" stopOpacity="0.95" />
            <Stop offset="100%" stopColor="#BFDBFE" stopOpacity="0.95" />
          </LinearGradient>
        </Defs>

        <G x={padL} y={padT}>
          {/* Click nền để clear selection */}
          <Rect
            x={0}
            y={0}
            width={innerW}
            height={innerH}
            fill="transparent"
            onPressIn={() => setActive(null)}
          />

          {/* grid + y labels */}
          {ticks.map((tVal, i) => {
            const y = yScale(tVal);
            return (
              <G key={'tick-' + i}>
                <Line
                  x1={0}
                  x2={innerW}
                  y1={y}
                  y2={y}
                  stroke="#E5E7EB"
                  strokeWidth={1}
                />
                <SvgText
                  x={-10}
                  y={y + 4}
                  fontSize="10"
                  fill="#6B7280"
                  textAnchor="end"
                  fontWeight="600"
                >
                  {fmtMoneyShort(tVal)}
                </SvgText>
              </G>
            );
          })}
          <Line
            x1={0}
            x2={0}
            y1={0}
            y2={innerH}
            stroke="#CBD5E1"
            strokeWidth={1.5}
          />

          {/* avg line */}
          {rawMax > 0 && avg > 0 ? (
            <>
              <Line
                x1={0}
                x2={innerW}
                y1={yScale(avg)}
                y2={yScale(avg)}
                stroke="#0EA5E9"
                strokeDasharray="6 6"
                strokeWidth={2}
              />
              <SvgText
                x={innerW - 4}
                y={yScale(avg) - 6}
                textAnchor="end"
                fontSize="10"
                fill="#0EA5E9"
                fontWeight="700"
              >
                AVG {fmtMoneyShort(avg)}
              </SvgText>
            </>
          ) : null}

          {mode === 'bar' ? (
            // ================= BAR =================
            labels.map((lbl, i) => {
              const v = values[i] || 0;
              const { x, bw } = band(i);
              const y = yScale(v);
              const h = innerH - y;
              const isActive = active === i;
              const isPos = v > 0;
              const fill =
                showSingleTooltip && isActive
                  ? 'url(#barGrad)'
                  : 'url(#barGradDim)';

              const valueY = Math.max(12, y - 6);

              return (
                <G key={'bar-' + i}>
                  {/* shadow */}
                  <Rect
                    x={x + 4}
                    y={y + 6}
                    width={bw}
                    height={h}
                    rx={8}
                    ry={8}
                    fill="rgba(0,0,0,0.06)"
                  />
                  {/* bar */}
                  <Rect
                    x={x}
                    y={y}
                    width={bw}
                    height={h}
                    rx={8}
                    ry={8}
                    fill={fill}
                    onPressIn={() => {
                      if (isPos) {
                        setActive(i);
                        onBarPress?.(i);
                      } else {
                        setActive(null);
                      }
                    }}
                  />
                  {/* label tháng */}
                  <SvgText
                    x={x + bw / 2}
                    y={innerH + 18}
                    fontSize="10"
                    fill="#64748B"
                    textAnchor="middle"
                    fontWeight="600"
                  >
                    {lbl}
                  </SvgText>

                  {/* số trên đỉnh (nếu muốn) */}
                  {alwaysShowValue && isPos ? (
                    <SvgText
                      x={x + bw / 2}
                      y={valueY}
                      fontSize="11"
                      fill="#111827"
                      textAnchor="middle"
                      fontWeight="700"
                    >
                      {fmtMoney(v)}
                    </SvgText>
                  ) : null}

                  {/* tooltip: chỉ khi v > 0 và đang active (hoặc chế độ always) */}
                  {showAllTooltips && isPos
                    ? renderTooltip(x + bw / 2, y, lbl, v)
                    : showSingleTooltip && isActive && isPos
                    ? renderTooltip(x + bw / 2, y, lbl, v)
                    : null}
                </G>
              );
            })
          ) : (
            // ================= LINE =================
            <G>
              {values.map((v, i) => {
                if (i === 0) return null;
                const x1 = xAt(i - 1),
                  y1 = yScale(values[i - 1] || 0);
                const x2 = xAt(i),
                  y2 = yScale(v || 0);
                return (
                  <Line
                    key={'l' + i}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="#2563EB"
                    strokeWidth={3}
                  />
                );
              })}
              {values.map((v, i) => {
                const x = xAt(i),
                  y = yScale(v || 0);
                const isActive = active === i;
                const isPos = v > 0;
                const valueY = Math.max(12, y - 8);
                return (
                  <G key={'p' + i}>
                    <Circle
                      cx={x}
                      cy={y}
                      r={isActive ? 6 : 4}
                      fill={isActive ? '#2563EB' : '#60A5FA'}
                      onPressIn={() => {
                        if (isPos) {
                          setActive(i);
                          onBarPress?.(i);
                        } else {
                          setActive(null);
                        }
                      }}
                    />
                    {/* label tháng */}
                    <SvgText
                      x={x}
                      y={innerH + 18}
                      fontSize="10"
                      fill="#64748B"
                      textAnchor="middle"
                      fontWeight="600"
                    >
                      {labels[i]}
                    </SvgText>

                    {/* value text nếu ép */}
                    {alwaysShowValue && isPos ? (
                      <SvgText
                        x={x}
                        y={valueY}
                        fontSize="11"
                        fill="#111827"
                        textAnchor="middle"
                        fontWeight="700"
                      >
                        {fmtMoney(v)}
                      </SvgText>
                    ) : null}

                    {/* tooltip */}
                    {showAllTooltips && isPos
                      ? renderTooltip(x, y, labels[i], v)
                      : showSingleTooltip && isActive && isPos
                      ? renderTooltip(x, y, labels[i], v)
                      : null}
                  </G>
                );
              })}
            </G>
          )}
        </G>
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 6,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    marginBottom: 12,
    overflow: 'visible',
  },
});

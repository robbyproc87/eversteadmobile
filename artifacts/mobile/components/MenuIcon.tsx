import React from "react";
import Svg, { Line } from "react-native-svg";

interface MenuIconProps {
  size?: number;
  color?: string;
}

export function MenuIcon({ size = 22, color = "#1a1a1a" }: MenuIconProps) {
  const strokeWidth = Math.max(1.5, size / 12);
  const pad = strokeWidth;
  const left = pad;
  const right = size - pad;
  const mid = size / 2;
  const top = size / 2 - size / 4;
  const bottom = size / 2 + size / 4;
  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      fill="none"
      accessible={false}
    >
      <Line
        x1={left}
        y1={top}
        x2={right}
        y2={top}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={left}
        y1={mid}
        x2={right}
        y2={mid}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <Line
        x1={left}
        y1={bottom}
        x2={right}
        y2={bottom}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default MenuIcon;

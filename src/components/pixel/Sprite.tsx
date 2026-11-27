import type { CSSProperties } from "react";
import type { SpriteDef } from "./sprites";

interface Props {
  def: SpriteDef;
  /** Rendered pixel size of one sprite cell. */
  scale?: number;
  className?: string;
  style?: CSSProperties;
  title?: string;
}

/** Renders a text pixel map as crisp SVG rects. */
export function Sprite({ def, scale = 4, className, style, title }: Props) {
  const h = def.rows.length;
  const w = Math.max(...def.rows.map((r) => r.length));
  const rects: React.ReactNode[] = [];
  def.rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === ".") continue;
      const fill = def.palette[ch];
      if (!fill) continue;
      rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={fill} />);
    }
  });
  return (
    <svg
      className={`px ${className ?? ""}`}
      style={style}
      width={w * scale}
      height={h * scale}
      viewBox={`0 0 ${w} ${h}`}
      role={title ? "img" : "presentation"}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      {rects}
    </svg>
  );
}

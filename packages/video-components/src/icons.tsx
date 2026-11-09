import React from "react";
import type { TextElement } from "@motionforge/video-schema";

/**
 * A small, dependency-free SVG icon set.
 *
 * Icons are drawn as paths so they render identically in the browser preview
 * and in the headless renderer, with no font or sprite-sheet loading.
 */

export interface IconDefinition {
  /** SVG path data, drawn inside a 24x24 viewBox. */
  path: string;
  /** Additional paths for multi-part icons. */
  extra?: string[];
}

export const ICONS: Record<string, IconDefinition> = {
  sparkles: {
    path: "M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3zM19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8L19 15zM5 14l.7 1.8L7.5 16l-1.8.7L5 18.5l-.7-1.8L2.5 16l1.8-.2L5 14z",
  },
  play: { path: "M8 5v14l11-7L8 5z" },
  pause: { path: "M7 5h3v14H7zM14 5h3v14h-3z" },
  network: {
    path: "M12 3a3 3 0 100 6 3 3 0 000-6zM4 15a3 3 0 100 6 3 3 0 000-6zM20 15a3 3 0 100 6 3 3 0 000-6zM11 8.5v3.2L5.6 14v1.9l6.4-3.2V8.5zM13 8.5v3.2l5.4 2.3V16L13 12.5z",
  },
  cpu: {
    path: "M8 8h8v8H8zM4 9h2v2H4zM4 13h2v2H4zM18 9h2v2h-2zM18 13h2v2h-2zM9 4h2v2H9zM13 4h2v2h-2zM9 18h2v2H9zM13 18h2v2h-2z",
  },
  chart: { path: "M4 19h16v2H4zM6 10h3v7H6zM11 6h3v11h-3zM16 12h3v5h-3z" },
  layers: {
    path: "M12 3l9 5-9 5-9-5 9-5zm0 8.6l6.8-3.8L12 4.4 5.2 7.8 12 11.6zM3 12.5l9 5 9-5-1.8-1L12 15.5 4.8 11.5 3 12.5z",
  },
  bolt: { path: "M13 2L4 14h6l-1 8 9-12h-6l1-8z" },
  globe: {
    path: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 2c1.5 0 3.3 2.4 3.9 6H8.1C8.7 6.4 10.5 4 12 4zM4.3 11h2.2c.1-2 .5-3.8 1.1-5.2A8 8 0 004.3 11zm0 2a8 8 0 003.3 5.2c-.6-1.4-1-3.2-1.1-5.2H4.3zm3.8 2h7.8c-.6 3.6-2.4 6-3.9 6s-3.3-2.4-3.9-6zm9.8-2c-.1 2-.5 3.8-1.1 5.2a8 8 0 003.3-5.2h-2.2zm2.2-2a8 8 0 00-3.3-5.2c.6 1.4 1 3.2 1.1 5.2h2.2z",
  },
  lock: {
    path: "M12 2a5 5 0 00-5 5v3H5v12h14V10h-2V7a5 5 0 00-5-5zm0 2a3 3 0 013 3v3H9V7a3 3 0 013-3z",
  },
  rocket: {
    path: "M14 3c3 1 6 3 7 7-2 4-5 6-9 7l-3-3 5-11zM8 14l-4 4 2 2 4-4M6 18l-2 2",
  },
  book: {
    path: "M4 4h6a3 3 0 013 3v13a3 3 0 00-3-3H4V4zm16 0h-6a3 3 0 00-3 3v13a3 3 0 013-3h6V4z",
  },
  target: {
    path: "M12 2a10 10 0 100 20 10 10 0 000-20zm0 4a6 6 0 110 12 6 6 0 010-12zm0 4a2 2 0 100 4 2 2 0 000-4z",
  },
  arrowRight: { path: "M4 11h12l-5-5 1.4-1.4L19 11l-6.6 6.4L11 16l5-5H4v0z" },
  wave: { path: "M2 12h3l2-6 3 14 3-18 3 16 2-6h4" },
  clock: {
    path: "M12 2a10 10 0 100 20 10 10 0 000-20zm1 5v5.6l4 2.4-1 1.7-5-3V7h2z",
  },
  check: { path: "M9 16.2L4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2z" },
  shield: {
    path: "M12 2l9 4v6c0 5.5-3.8 9.7-9 11-5.2-1.3-9-5.5-9-11V6l9-4z",
  },
  database: {
    path: "M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3zM4 9.5v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4c-1.4 1.4-4.6 2-8 2s-6.6-.6-8-2zm0 7v4c0 1.7 3.6 3 8 3s8-1.3 8-3v-4c-1.4 1.4-4.6 2-8 2s-6.6-.6-8-2z",
  },
  eye: {
    path: "M12 5C6 5 2 12 2 12s4 7 10 7 10-7 10-7-4-7-10-7zm0 11a4 4 0 110-8 4 4 0 010 8z",
  },
};

export interface IconProps {
  name: string;
  color: string;
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
}

export const Icon: React.FC<IconProps> = ({
  name,
  color,
  size = 48,
  strokeWidth = 1.75,
  filled = false,
}) => {
  const definition = ICONS[name] ?? ICONS.sparkles;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? color : "none"}
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={definition.path} />
      {definition.extra?.map((path, index) => (
        <path key={index} d={path} />
      ))}
    </svg>
  );
};

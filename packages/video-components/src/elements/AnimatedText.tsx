import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { TextElement } from "@motionforge/video-schema";
import type { EntranceState } from "../animations/motion.js";

/**
 * Typography engine.
 *
 * Text is the most visible part of most videos, so it gets real treatment:
 * per-letter and per-word staggering, mask reveals, typewriter typing and
 * mask-up wipes — all driven by the same `EntranceState` contract as every
 * other element.
 */

export interface AnimatedTextProps {
  element: TextElement;
  /** Entrance/exit state for the element as a whole. */
  state: EntranceState;
  /** Colour of the highlighted `**segment**` in the copy. */
  accentColor: string;
  /** Font stack for the chosen role. */
  fontFamily: string;
  /** Base display scale derived from the project typography. */
  displayScale: number;
  /** Base font size derived from the project typography. */
  baseFontSize: number;
}

/**
 * Type scale, as a multiple of the project's base font size.
 *
 * Tuned for a 1920×1080 canvas, where a headline needs to read from across
 * a room and a caption needs to stay out of the way.
 */
const VARIANT_SCALE: Record<TextElement["variant"], number> = {
  display: 1,
  heading: 1.6,
  subheading: 1.1,
  body: 0.8,
  caption: 0.62,
  label: 0.5,
};

/** Splits copy into plain and accent segments based on `**markers**`. */
function splitAccentSegments(text: string): Array<{ text: string; accent: boolean }> {
  const segments: Array<{ text: string; accent: boolean }> = [];
  const pattern = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index), accent: false });
    }
    segments.push({ text: match[1], accent: true });
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex), accent: false });
  }
  return segments.length > 0 ? segments : [{ text, accent: false }];
}

/** A single animated glyph/word, used by the stagger renderers. */
const StaggerUnit: React.FC<{
  /** The glyph or word this unit renders. */
  content: string;
  index: number;
  total: number;
  staggerInFrames: number;
  entranceType: string;
  state: EntranceState;
  style: React.CSSProperties;
  renderUnit: (content: string, unitStyle: React.CSSProperties) => React.ReactNode;
}> = ({
  content,
  index,
  total,
  staggerInFrames,
  entranceType,
  state,
  style,
  renderUnit,
}) => {
  // Each unit reveals in sequence; the last unit finishes at progress = 1.
  const unitStart = index * staggerInFrames;
  const unitProgress = interpolate(
    state.staggerProgress,
    [0, 1],
    [
      Math.min(1, unitStart / Math.max(1, total * staggerInFrames)),
      Math.min(1, (unitStart + 1) / Math.max(1, total * staggerInFrames)),
    ],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const unitStyle: React.CSSProperties = {
    ...style,
    opacity: unitProgress,
    transform:
      entranceType === "wordStagger"
        ? `translateY(${(1 - unitProgress) * 24}px)`
        : `translateY(${(1 - unitProgress) * 18}px) rotateX(${(1 - unitProgress) * -35}deg)`,
  };

  return <>{renderUnit(content, unitStyle)}</>;
};

export const AnimatedText: React.FC<AnimatedTextProps> = ({
  element,
  state,
  accentColor,
  fontFamily,
  displayScale,
  baseFontSize,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const scale = VARIANT_SCALE[element.variant];
  const fontSize =
    element.variant === "display"
      ? baseFontSize * displayScale
      : baseFontSize * scale;

  const segments = splitAccentSegments(element.text);
  const resolvedFont = fontFamily;

  const baseStyle: React.CSSProperties = {
    fontFamily: resolvedFont,
    fontSize,
    fontWeight:
      element.variant === "display" || element.variant === "heading" ? 700 : 500,
    lineHeight: element.lineHeight,
    letterSpacing: `${element.letterSpacing}em`,
    textAlign: element.align,
    textTransform: element.uppercase ? "uppercase" : "none",
    color: element.color,
    textShadow:
      element.shadow > 0
        ? `0 ${Math.round(10 * element.shadow)}px ${Math.round(
            36 * element.shadow,
          )}px rgba(0,0,0,${0.55 * element.shadow})`
        : "none",
    margin: 0,
    // Wrapping is enabled whenever a max width is set; without one the copy
    // stays on a single line.
    whiteSpace: element.maxWidth ? "normal" : "pre-wrap",
  };

  const containerStyle: React.CSSProperties = {
    ...baseStyle,
    // The max width bounds the line length; the text box itself shrinks to
    // its content so it can be centred by its parent.
    maxWidth: element.maxWidth ?? undefined,
  };

  const entranceType = element.animation.entrance.type;

  // --- Typewriter ------------------------------------------------------
  if (entranceType === "typewriter") {
    const totalChars = element.text.length;
    const visibleChars = Math.round(totalChars * state.staggerProgress);
    const visible = element.text.slice(0, visibleChars);
    const cursorVisible = visibleChars < totalChars || frame % 20 < 12;

    return (
      <div style={containerStyle}>
        {splitAccentSegments(visible).map((segment, index) => (
          <span
            key={index}
            style={{ color: segment.accent ? accentColor : element.color }}
          >
            {segment.text}
          </span>
        ))}
        {cursorVisible && (
          <span
            style={{
              display: "inline-block",
              width: Math.max(2, fontSize * 0.06),
              height: fontSize * 0.95,
              marginLeft: fontSize * 0.04,
              backgroundColor: accentColor,
              verticalAlign: "text-bottom",
            }}
          />
        )}
      </div>
    );
  }

  // --- Word stagger ----------------------------------------------------
  if (entranceType === "wordStagger") {
    const words = element.text.split(/(\s+)/);
    let wordIndex = 0;
    return (
      <div style={containerStyle}>
        {words.map((word, index) => {
          if (/^\s+$/.test(word)) return <span key={index}>{word}</span>;
          const current = wordIndex;
          wordIndex += 1;
          return (
            <StaggerUnit
              key={index}
              content={word}
              index={current}
              total={wordIndex}
              staggerInFrames={element.animation.entrance.staggerInFrames}
              entranceType={entranceType}
              state={state}
              style={baseStyle}
              renderUnit={(content, unitStyle) => (
                <span
                  style={{
                    ...unitStyle,
                    display: "inline-block",
                    marginRight: "0.25em",
                  }}
                >
                  {content}
                </span>
              )}
            />
          );
        })}
      </div>
    );
  }

  // --- Letter stagger --------------------------------------------------
  if (entranceType === "letterStagger") {
    const characters = Array.from(element.text);
    return (
      <div style={containerStyle}>
        {characters.map((character, index) => (
          <StaggerUnit
            key={index}
            content={character}
            index={index}
            total={characters.length}
            staggerInFrames={element.animation.entrance.staggerInFrames}
            entranceType={entranceType}
            state={state}
            style={baseStyle}
            renderUnit={(content, unitStyle) => (
              <span
                style={{
                  ...unitStyle,
                  display: "inline-block",
                  whiteSpace: character === " " ? "pre" : undefined,
                }}
              >
                {content === " " ? "\u00A0" : content}
              </span>
            )}
          />
        ))}
      </div>
    );
  }

  // --- Mask reveals ----------------------------------------------------
  // The reveal uses an overflow-hidden window with the copy sliding inside
  // it. Clipping with `clip-path` alone cuts through ascenders and
  // descenders, which looks like a rendering bug rather than a reveal.
  if (entranceType === "maskUp" || entranceType === "maskLeft") {
    const vertical = entranceType === "maskUp";

    return (
      <div
        style={{
          ...containerStyle,
          overflow: "hidden",
          // Room for the glyphs to travel without being sliced.
          paddingBlock: vertical ? "0.22em 0.3em" : "0.28em",
          paddingInline: vertical ? undefined : "0.1em",
        }}
      >
        <span
          style={{
            display: "inline-block",
            transform: vertical
              ? `translateY(${(1 - state.reveal) * 100}%)`
              : `translateX(${-(1 - state.reveal) * 100}%)`,
            willChange: "transform",
          }}
        >
          {segments.map((segment, index) => (
            <span
              key={index}
              style={{ color: segment.accent ? accentColor : element.color }}
            >
              {segment.text}
            </span>
          ))}
        </span>
      </div>
    );
  }

  // --- Wipe reveals ----------------------------------------------------
  if (entranceType === "wipeLeft" || entranceType === "wipeRight") {
    const clip =
      entranceType === "wipeRight"
        ? `inset(0 0 0 ${(1 - state.reveal) * 100}%)`
        : `inset(0 ${(1 - state.reveal) * 100}% 0 0)`;
    return (
      <div style={{ ...containerStyle, overflow: "hidden", paddingBlock: "0.28em", clipPath: clip }}>
        {segments.map((segment, index) => (
          <span
            key={index}
            style={{ color: segment.accent ? accentColor : element.color }}
          >
            {segment.text}
          </span>
        ))}
      </div>
    );
  }

  // --- Default ---------------------------------------------------------
  return (
    <div style={containerStyle}>
      {segments.map((segment, index) => (
        <span
          key={index}
          style={{ color: segment.accent ? accentColor : element.color }}
        >
          {segment.text}
        </span>
      ))}
    </div>
  );
};

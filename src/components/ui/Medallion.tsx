"use client";

import type { IconProps } from "@/components/icons";

/**
 * A struck gold disc with a dark glyph in it.
 *
 * The origin marker used to be a thin gold ring around a hairline icon on a
 * near-black fill, which at 32px read as a disabled button. The reference is
 * a minted token - solid brass, the glyph cut out of it, a darker ring inside
 * the rim - and that is what carries the "issued by an authority" weight the
 * line in front of it is claiming.
 */
export default function Medallion({
  icon: Icon,
  size = 40,
  label,
}: {
  icon: (props: IconProps) => React.ReactElement;
  size?: number;
  /** Optional, for when the disc is the only thing carrying the meaning. */
  label?: string;
}) {
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ width: size, height: size }}
      className="relative flex shrink-0 items-center justify-center rounded-full bg-brass shadow-[0_2px_8px_-2px_rgba(0,0,0,0.7)]"
    >
      {/* The inner ring. A disc with no rim is a dot; the rim is what makes
          it read as struck rather than drawn. */}
      <span
        className="absolute rounded-full border border-hud-black/45"
        style={{ inset: size * 0.11 }}
      />
      <Icon size={Math.round(size * 0.46)} strokeWidth={2} className="text-hud-black" />
    </span>
  );
}

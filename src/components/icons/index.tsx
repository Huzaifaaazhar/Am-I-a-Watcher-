import type { SVGProps } from "react";

/**
 * The icon set.
 *
 * Drawn on a 24px grid with a single stroke weight, square caps and mitred
 * joins, because the rest of the interface is drawn that way: the panels have
 * hard corners and 2px gold rules, and a set with round caps and soft joins
 * reads as borrowed from somewhere else. That is exactly what it was - a
 * general-purpose library mixed with one hand-drawn badge, so the badge never
 * matched its neighbours.
 *
 * Every icon is decorative by default (`aria-hidden`): these sit beside text
 * or inside a button that carries its own accessible name. Pass a `title` for
 * the rare icon that has to stand alone.
 */

export interface IconProps extends Omit<SVGProps<SVGSVGElement>, "children"> {
  /** Edge length in px. The grid is 24, so multiples of 4 stay crisp. */
  size?: number;
  /** Supply only when the icon is the sole content of a control. */
  title?: string;
}

function Icon({
  size = 20,
  title,
  strokeWidth = 1.75,
  children,
  ...rest
}: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="square"
      strokeLinejoin="miter"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      focusable="false"
      {...rest}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/** Dismiss. Two strokes, no circle - the panels already supply the frame. */
export function Close(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 5 19 19M19 5 5 19" />
    </Icon>
  );
}

/** Navigation. Three rules at the same rhythm as the HUD's own dividers. */
export function Menu(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M3.5 6.5h17M3.5 12h17M3.5 17.5h17" />
    </Icon>
  );
}

/**
 * Origin of an event. An hourglass, because the TVA's instrument for time is
 * the one object in this world everybody already recognises.
 */
export function Hourglass(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 3h12M6 21h12" />
      <path d="M7.5 3v3.2L12 12l4.5-5.8V3" />
      <path d="M7.5 21v-3.2L12 12l4.5 5.8V21" />
    </Icon>
  );
}

/** A timeline that forks. The branch leaves the trunk and keeps going. */
export function Branch(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3v18" />
      <path d="M7 10h5.5L18 5" />
      <path d="M14.5 5H18v3.5" />
    </Icon>
  );
}

/** A timeline that was cut. The same trunk, severed. */
export function Prune(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 3v6.5M7 14.5V21" />
      <path d="M3 12h18" />
      <path d="M14 8.5 18 12l-4 3.5" />
    </Icon>
  );
}

/** The ledger of what has happened. A record, not a generic document. */
export function Ledger(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 3.5h12.5L20 6v14.5H5z" />
      <path d="M8.5 8.5h8M8.5 12h8M8.5 15.5h5" />
    </Icon>
  );
}

/** Something is wrong and the person has to know. */
export function Alert(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3.5 22 20.5H2z" />
      <path d="M12 10v4.5" />
      <path d="M12 17.5v.5" strokeLinecap="round" />
    </Icon>
  );
}

/** Work in progress. Rotation is applied by the caller, not baked in. */
export function Spinner({ size = 20, ...rest }: IconProps) {
  return (
    <Icon size={size} {...rest}>
      <path d="M12 3v4" />
      <path d="M12 17v4" opacity={0.3} />
      <path d="M3 12h4" opacity={0.55} />
      <path d="M17 12h4" opacity={0.8} />
      <path d="m5.6 5.6 2.8 2.8" opacity={0.45} />
      <path d="m15.6 15.6 2.8 2.8" opacity={0.9} />
      <path d="m18.4 5.6-2.8 2.8" opacity={0.7} />
      <path d="m8.4 15.6-2.8 2.8" opacity={0.4} />
    </Icon>
  );
}

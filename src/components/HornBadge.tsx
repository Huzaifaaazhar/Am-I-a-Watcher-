"use client";

/**
 * Horned-silhouette identity mark.
 *
 * An original minimalist bust - shoulders, a head, two curved horns rising
 * off it. Not traced from any film asset or logo. It used to be a head and
 * horns with nothing under them, which at any size read as a mushroom rather
 * than as somebody; the shoulders are what make it a person.
 *
 * `bare` draws the silhouette alone, for when the caller is already providing
 * the disc behind it. Without that, a struck medallion ended up with the
 * badge's own ring inside the medallion's ring and the mark read as a target.
 */
export default function HornBadge({
  size = 40,
  ringClassName = "text-brass",
  fillClassName = "text-abyss",
  bare = false,
  className = "",
}: {
  size?: number;
  ringClassName?: string;
  fillClassName?: string;
  /** Skip the enclosing circle; draw only the silhouette. */
  bare?: boolean;
  /** For showing one size and hiding another at a breakpoint. */
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      {!bare && (
        <>
          <circle
            cx="20"
            cy="20"
            r="19"
            className={ringClassName}
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <circle
            cx="20"
            cy="20"
            r="19"
            className={fillClassName}
            fill="currentColor"
            fillOpacity="0.92"
          />
        </>
      )}

      <g className={ringClassName} fill="currentColor">
        {/* Horns - two asymmetric curved sweeps rising off the head. */}
        <path d="M14.6 16.4 C 10.4 11.4, 9.4 5.6, 12.6 2.4 C 12.2 7.4, 13.8 12, 16.8 15.2 Z" />
        <path d="M25.4 16.4 C 29.6 11.4, 30.6 5.6, 27.4 2.4 C 27.8 7.4, 26.2 12, 23.2 15.2 Z" />
        {/* Head. */}
        <ellipse cx="20" cy="19.4" rx="5.3" ry="6.4" />
        {/* Shoulders. The mark was a head on nothing before these. */}
        <path d="M20 25.4 C 26.2 25.4, 31.4 29.6, 32.6 35.8 C 28.8 37.6, 24.5 38.4, 20 38.4 C 15.5 38.4, 11.2 37.6, 7.4 35.8 C 8.6 29.6, 13.8 25.4, 20 25.4 Z" />
      </g>
    </svg>
  );
}

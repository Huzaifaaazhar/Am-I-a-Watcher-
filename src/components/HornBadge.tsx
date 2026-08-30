"use client";

/**
 * Horned-silhouette avatar glyph.
 *
 * An original minimalist mark - a head silhouette topped by two curved horns
 * inside a ring - not traced from any film asset or logo. Used everywhere the
 * UI needs a "custodian" identity mark: the sidebar badge, the profile pip.
 */
export default function HornBadge({
  size = 40,
  ringClassName = "text-brass",
  fillClassName = "text-abyss",
}: {
  size?: number;
  ringClassName?: string;
  fillClassName?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <circle cx="20" cy="20" r="19" className={ringClassName} stroke="currentColor" strokeWidth="1.5" />
      <circle cx="20" cy="20" r="19" className={fillClassName} fill="currentColor" fillOpacity="0.92" />
      {/* Horns - two asymmetric curved sweeps rising off a rounded head. */}
      <path
        d="M14 17 C 10 11, 9 5, 12.5 2 C 12 7, 13.5 12, 16.5 15.5 Z"
        className={ringClassName}
        fill="currentColor"
      />
      <path
        d="M26 17 C 30 11, 31 5, 27.5 2 C 28 7, 26.5 12, 23.5 15.5 Z"
        className={ringClassName}
        fill="currentColor"
      />
      {/* Head silhouette. */}
      <path
        d="M20 14 C 24.5 14, 27 17.2, 27 21.3 C 27 25.5, 24 29.5, 20 31.5 C 16 29.5, 13 25.5, 13 21.3 C 13 17.2, 15.5 14, 20 14 Z"
        className={ringClassName}
        fill="currentColor"
      />
    </svg>
  );
}

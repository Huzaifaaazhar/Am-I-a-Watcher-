"use client";

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

import { Spinner } from "@/components/icons";

/**
 * The one button.
 *
 * Every action in the interface was previously a bespoke string of utility
 * classes, which meant the disabled treatment differed between panels and
 * there was no loading state anywhere - a branch request simply froze its
 * button for two seconds with no indication it had been heard.
 *
 * Variants carry meaning rather than colour: `commit` is the irreversible
 * one, `danger` destroys a timeline, `quiet` is the way out. The gold pill
 * is reserved for confirmation so it keeps that association.
 */

export type ButtonVariant = "commit" | "danger" | "quiet" | "ghost";
export type ButtonSize = "sm" | "md";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Shows a spinner and blocks input, without collapsing the layout. */
  loading?: boolean;
  /** Announced to assistive tech while loading. */
  loadingLabel?: string;
  block?: boolean;
  children: ReactNode;
}

const BASE =
  "relative inline-flex items-center justify-center gap-2 rounded-full border font-sans font-extrabold uppercase tracking-[0.05em] transition-colors " +
  "disabled:cursor-not-allowed disabled:opacity-45";

const VARIANTS: Record<ButtonVariant, string> = {
  commit: "border-brass/40 bg-pill-blue text-white hover:bg-pill-blueDark",
  danger: "border-brass/40 bg-pill-red text-white hover:bg-pill-redDark",
  quiet:
    "border-2 border-brass bg-transparent text-brass hover:bg-brass hover:text-hud-black " +
    "disabled:hover:bg-transparent disabled:hover:text-brass",
  ghost: "border-transparent bg-transparent text-brass/75 hover:text-brass",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "px-4 py-1 text-meta",
  md: "w-full px-5 py-2.5 text-[13px]",
};

const Button = forwardRef<HTMLButtonElement, Props>(function Button(
  {
    variant = "quiet",
    size = "md",
    loading = false,
    loadingLabel,
    block = false,
    disabled,
    className = "",
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      // A loading button is not disabled in the HTML sense - a disabled
      // control drops out of the tab order, so focus would be lost from under
      // whoever just pressed it. aria-busy says what is happening instead.
      disabled={disabled}
      aria-busy={loading || undefined}
      aria-live={loading ? "polite" : undefined}
      className={`${BASE} ${VARIANTS[variant]} ${SIZES[size]} ${block ? "w-full" : ""} ${className}`}
      {...rest}
    >
      {loading && (
        <Spinner size={14} className="shrink-0 animate-spin motion-reduce:animate-none" />
      )}
      <span>{loading && loadingLabel ? loadingLabel : children}</span>
    </button>
  );
});

export default Button;

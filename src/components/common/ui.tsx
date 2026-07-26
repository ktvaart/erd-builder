"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */

type ButtonVariant = "default" | "primary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  default:
    "bg-surface border border-line text-ink hover:bg-surface-muted hover:border-line-strong",
  primary: "bg-accent border border-accent text-white hover:brightness-105",
  ghost: "border border-transparent text-ink-muted hover:bg-surface-muted hover:text-ink",
  danger: "border border-transparent text-danger hover:bg-danger/10",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

export function Button({ className, variant = "default", type = "button", ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium",
        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        "disabled:pointer-events-none disabled:opacity-40",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* IconButton                                                          */
/* ------------------------------------------------------------------ */

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  label: string;
}

export function IconButton({ className, variant = "ghost", label, ...props }: IconButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex size-7 shrink-0 items-center justify-center rounded-md",
        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        "disabled:pointer-events-none disabled:opacity-30",
        buttonVariants[variant],
        className,
      )}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Input                                                               */
/* ------------------------------------------------------------------ */

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-8 w-full min-w-0 rounded-md border border-line bg-surface px-2 text-xs text-ink",
          "placeholder:text-ink-faint",
          "outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20",
          "disabled:bg-surface-muted disabled:text-ink-faint",
          className,
        )}
        {...props}
      />
    );
  },
);

/* ------------------------------------------------------------------ */
/* Select                                                              */
/* ------------------------------------------------------------------ */

export function Select({
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-8 w-full min-w-0 cursor-pointer appearance-none rounded-md border border-line bg-surface",
        "bg-[length:14px] bg-[right_0.4rem_center] bg-no-repeat py-0 pr-6 pl-2 text-xs text-ink",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2398a1b0%22 stroke-width=%222%22 stroke-linecap=%22round%22><path d=%22M6 9l6 6 6-6%22/></svg>')]",
        "outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle chip — PK / NN / UQ 처럼 짧은 on-off 배지                     */
/* ------------------------------------------------------------------ */

export interface ToggleChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active: boolean;
  /** 활성 상태 색 (CSS 색상값). 미지정 시 accent */
  activeColor?: string;
}

export function ToggleChip({
  className,
  active,
  activeColor,
  style,
  disabled,
  ...props
}: ToggleChipProps) {
  return (
    <button
      type="button"
      aria-pressed={active}
      disabled={disabled}
      className={cn(
        "inline-flex h-6 items-center rounded border px-1.5 text-[10px] font-bold tracking-wide",
        "transition-colors outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "border-transparent text-white"
          : "border-line bg-surface text-ink-faint hover:border-line-strong hover:text-ink-muted",
        disabled && "pointer-events-none opacity-60",
        className,
      )}
      style={{
        ...(active ? { backgroundColor: activeColor ?? "var(--accent)" } : null),
        ...style,
      }}
      {...props}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Checkbox                                                            */
/* ------------------------------------------------------------------ */

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
}

export function Checkbox({ className, label, ...props }: CheckboxProps) {
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-1.5 text-[11px] text-ink-muted select-none",
        props.disabled && "cursor-not-allowed opacity-40",
        className,
      )}
    >
      <input
        type="checkbox"
        className="size-3.5 cursor-pointer accent-[var(--accent)] disabled:cursor-not-allowed"
        {...props}
      />
      {label}
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Field — 라벨 + 컨트롤                                                */
/* ------------------------------------------------------------------ */

export function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={cn("flex flex-col gap-1", className)}>
      <span className="text-[10px] font-semibold tracking-wide text-ink-faint uppercase">{label}</span>
      {children}
    </label>
  );
}

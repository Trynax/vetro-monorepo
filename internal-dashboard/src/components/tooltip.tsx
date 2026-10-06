import { type ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: ReactNode;
  multiline?: boolean;
};

// Multiline labels grow upward from the line's bottom and stay out of the layout
// until hover, so they don't overflow the table's scroll container. They are
// narrower below sm to fit left of the line on the 400px two-column card.
const labelClasses = {
  multiline: "bottom-0 hidden w-48 whitespace-normal sm:w-64 group-hover:block",
  singleLine:
    "top-1/2 -translate-y-1/2 whitespace-nowrap opacity-0 transition-opacity group-hover:opacity-100",
};

export const Tooltip = ({ children, label, multiline = false }: Props) => (
  <span className="group relative flex">
    {children}
    <span
      className={`pointer-events-none absolute right-full z-10 mr-2 rounded-md bg-neutral-900 px-1.5 py-1 text-xs font-medium text-white ${labelClasses[multiline ? "multiline" : "singleLine"]}`}
      role="tooltip"
    >
      {label}
    </span>
  </span>
);

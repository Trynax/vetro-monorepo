import { type ReactNode } from "react";

type Props = {
  children: ReactNode;
  label: ReactNode;
};

export const Tooltip = ({ children, label }: Props) => (
  <span className="group relative flex">
    {children}
    <span
      className="pointer-events-none absolute top-1/2 right-full z-10 mr-2 w-max max-w-44 -translate-y-1/2 rounded-md bg-neutral-900 px-1.5 py-1 text-xs font-medium whitespace-normal text-white opacity-0 transition-opacity group-hover:opacity-100"
      role="tooltip"
    >
      {label}
    </span>
  </span>
);

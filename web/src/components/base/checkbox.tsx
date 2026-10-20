import type { ComponentProps } from "react";

type Props = Omit<ComponentProps<"input">, "className" | "type">;

export const Checkbox = (props: Props) => (
  <span className="relative inline-flex size-4 shrink-0">
    <input
      className="peer size-4 cursor-pointer appearance-none rounded bg-white shadow-sm transition-colors checked:bg-blue-500 checked:shadow-none not-disabled:hover:bg-gray-50 checked:not-disabled:hover:bg-blue-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
      type="checkbox"
      {...props}
    />
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 peer-checked:opacity-100 peer-checked:peer-disabled:opacity-50"
      fill="none"
      height="9"
      viewBox="0 0 10 9"
      width="10"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        clipRule="evenodd"
        d="M9.16603 0.126042C9.51067 0.355806 9.6038 0.821458 9.37404 1.1661L4.37404 8.66611C4.2494 8.85306 4.0475 8.97429 3.8239 8.99643C3.6003 9.01857 3.37855 8.93929 3.21967 8.78041L0.21967 5.78041C-0.0732233 5.48752 -0.0732233 5.01264 0.21967 4.71975C0.512563 4.42686 0.987437 4.42686 1.28033 4.71975L3.63343 7.07285L8.12596 0.334055C8.35573 -0.010592 8.82138 -0.103722 9.16603 0.126042Z"
        fill="#EAF4FF"
        fillRule="evenodd"
      />
    </svg>
  </span>
);

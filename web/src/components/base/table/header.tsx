import type { ReactNode } from "react";

const alignClasses = {
  center: "text-center",
  left: "text-left",
};

type Props = {
  align?: "center" | "left";
} & (
  | { children: ReactNode; text?: never }
  | { children?: never; text: string }
);

export const Header = ({ align = "left", children, text }: Props) => (
  <span
    className={`text-b-medium block py-3 ${alignClasses[align]} text-gray-500`}
  >
    {text ?? children}
  </span>
);

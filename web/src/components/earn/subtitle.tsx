import type { ReactNode } from "react";

export const Subtitle = ({ children }: { children: ReactNode }) => (
  <span className="text-caption text-gray-500">{children}</span>
);

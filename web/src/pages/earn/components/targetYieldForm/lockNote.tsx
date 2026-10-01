import type { ReactNode } from "react";

export const LockNote = ({ children }: { children: ReactNode }) => (
  <p className="text-caption border-b border-gray-200 px-3 py-3 text-center whitespace-pre-line text-gray-500">
    {children}
  </p>
);

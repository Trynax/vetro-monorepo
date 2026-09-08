import type { ReactNode } from "react";

type Props = {
  left: ReactNode;
  right: ReactNode;
};

export const CardRow = ({ left, right }: Props) => (
  <div className="grid xl:grid-cols-2 xl:gap-x-14 xl:not-last:border-b xl:not-last:border-gray-200">
    <div className="xl:pl-14 xl:*:border-0">{left}</div>
    <div className="xl:pr-14 xl:*:border-0">{right}</div>
  </div>
);

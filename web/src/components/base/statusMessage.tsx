import type { ReactNode } from "react";

type Props = {
  action?: ReactNode;
  description: ReactNode;
  icon: ReactNode;
  title: string;
};

export const StatusMessage = ({ action, description, icon, title }: Props) => (
  <div className="flex w-60 flex-col items-center gap-3 text-center">
    <div className="size-7">{icon}</div>
    <div className="flex flex-col gap-1">
      <h5 className="text-gray-900">{title}</h5>
      <p className="text-b-regular text-gray-500">{description}</p>
    </div>
    {action}
  </div>
);

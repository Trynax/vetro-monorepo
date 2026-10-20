import type { ReactNode } from "react";

type Props = {
  action?: ReactNode;
  className?: string;
  description: ReactNode;
  icon: ReactNode;
  title: string;
};

export const StatusMessage = ({
  action,
  className = "w-60",
  description,
  icon,
  title,
}: Props) => (
  <div className={`flex flex-col items-center gap-3 text-center ${className}`}>
    <div className="size-7">{icon}</div>
    <div className="flex flex-col gap-1">
      <h5 className="text-gray-900">{title}</h5>
      <p className="text-b-regular text-gray-500">{description}</p>
    </div>
    {action}
  </div>
);

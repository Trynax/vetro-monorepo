import type { ReactNode } from "react";
import Skeleton from "react-loading-skeleton";

type Props<T> = {
  data: T | null | undefined;
  icon: ReactNode;
  isLoading?: boolean;
  label: ReactNode;
  render: (data: T) => ReactNode;
  subtitle?: ReactNode;
};

export function InfoCard<T>({
  data,
  icon,
  isLoading,
  label,
  render,
  subtitle,
}: Props<T>) {
  const renderData = function () {
    if (data === null) {
      return "-";
    }
    if (data !== undefined) {
      return render(data);
    }
    if (isLoading) {
      return <Skeleton height={24} width={100} />;
    }
    return "-";
  };

  return (
    <div className="border-b border-gray-200 px-3 max-md:first:border-t lg:px-0">
      <div className="relative flex -translate-y-px flex-col items-start gap-y-3 border-t border-blue-500 px-1 py-6 *:flex md:px-3">
        <div className="flex w-full items-center justify-between">
          <span className="text-b-medium text-gray-900">{label}</span>
          {icon}
        </div>
        <span className="text-h3 text-gray-900">{renderData()}</span>
        {subtitle ? (
          <div className="w-full empty:hidden">{subtitle}</div>
        ) : null}
      </div>
    </div>
  );
}

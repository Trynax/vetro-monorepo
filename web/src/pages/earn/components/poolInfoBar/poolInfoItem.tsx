import type { ReactNode } from "react";
import Skeleton from "react-loading-skeleton";

type Props<T> = {
  data: T | null | undefined;
  isError?: boolean;
  isPending?: boolean;
  label: string;
  render?: (data: T) => ReactNode;
};

const valueClassName = "text-xsm font-semibold text-gray-900";

export function PoolInfoItem<T>({
  data,
  isError,
  isPending,
  label,
  render = (value: T) => (
    <span className={valueClassName}>{value as ReactNode}</span>
  ),
}: Props<T>) {
  function renderData() {
    if (data === null) {
      return <span className={valueClassName}>-</span>;
    }
    if (data !== undefined) {
      return render(data);
    }
    if (!isError && isPending) {
      return <Skeleton height={20} width={80} />;
    }
    return <span className={valueClassName}>-</span>;
  }

  return (
    <div className="relative flex flex-col sm:shrink-0 sm:whitespace-nowrap">
      <span className="text-b-regular text-gray-500">{label}</span>
      {renderData()}
    </div>
  );
}

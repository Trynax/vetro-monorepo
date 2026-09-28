import { type ReactNode, useState } from "react";
import Skeleton from "react-loading-skeleton";
import { formatUsd } from "utils/currency";

import { AllocationChart } from "./allocationChart";
import { AllocationLegend } from "./allocationLegend";
import type { AllocationItem } from "./types";

type Props = {
  formatAmount?: (value: number) => string;
  icon: ReactNode;
  isError: boolean;
  isLoading: boolean;
  items?: AllocationItem[];
  label: ReactNode;
  value: string;
};

export const AllocationCard = function ({
  formatAmount = formatUsd,
  icon,
  isError,
  isLoading,
  items,
  label,
  value,
}: Props) {
  const [hoveredLabel, setHoveredLabel] = useState<string | null>(null);

  const renderValue = function () {
    if (value) return value;
    if (isError) return "-";
    if (isLoading) return <Skeleton height={28} width={120} />;
    return "-";
  };

  return (
    <div className="flex flex-1 flex-col">
      <div className="px-6 md:px-14">
        <div className="flex -translate-y-px flex-col gap-3 border-t border-blue-500 py-6">
          <div className="flex items-center justify-between">
            <span className="text-b-medium text-gray-900">{label}</span>
            <div className="size-4">{icon}</div>
          </div>
          <h3 className="text-gray-900">{renderValue()}</h3>
        </div>
      </div>
      {items !== undefined && (
        <>
          <AllocationChart
            hoveredLabel={hoveredLabel}
            isError={isError}
            isLoading={isLoading}
            items={items}
            onHover={setHoveredLabel}
          />
          <AllocationLegend
            formatAmount={formatAmount}
            hoveredLabel={hoveredLabel}
            isError={isError}
            isLoading={isLoading}
            items={items}
            onHover={setHoveredLabel}
          />
        </>
      )}
    </div>
  );
};

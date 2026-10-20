import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useEthPrice } from "hooks/useEthPrice";
import { mainnet } from "networks/mainnet";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { splitDecimalParts } from "utils/currency";
import { formatEvmAddress } from "utils/format";
import { useAccount, useDisconnect } from "wagmi";

import { useActivities } from "../../stores/activityStore";
import { ActivityList } from "../base/activityList";
import { FilterMenu } from "../base/filterMenu";
import profileIcon from "../icons/profile.svg";
import tableCellsIcon from "../icons/tableCells.svg";

const PowerIcon = () => (
  <svg
    aria-hidden="true"
    fill="none"
    height="21"
    viewBox="0 0 21 21"
    width="21"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      clipRule="evenodd"
      d="M10.5 0C11.1213 0 11.625 0.50368 11.625 1.125V10.875C11.625 11.4963 11.1213 12 10.5 12C9.87868 12 9.375 11.4963 9.375 10.875V1.125C9.375 0.50368 9.87868 0 10.5 0ZM4.66637 3.07538C5.10571 3.51472 5.10571 4.22703 4.66637 4.66637C1.44454 7.88819 1.44454 13.1118 4.66637 16.3336C7.88819 19.5555 13.1118 19.5555 16.3336 16.3336C19.5555 13.1118 19.5555 7.88819 16.3336 4.66637C15.8943 4.22703 15.8943 3.51472 16.3336 3.07538C16.773 2.63604 17.4853 2.63604 17.9246 3.07538C22.0251 7.17588 22.0251 13.8241 17.9246 17.9246C13.8241 22.0251 7.17588 22.0251 3.07538 17.9246C-1.02513 13.8241 -1.02513 7.17588 3.07538 3.07538C3.51472 2.63604 4.22703 2.63604 4.66637 3.07538Z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);

function useBalanceInUsd() {
  const { data: balanceData, isError: isNativeBalanceError } = useNativeBalance(
    mainnet.id,
  );
  const { data: ethPrice, isError: isEthPriceError } = useEthPrice();

  if (balanceData !== undefined && ethPrice !== undefined) {
    const balance = balanceData ? parseFloat(balanceData.formatted) : 0;
    const usd = ethPrice ? balance * ethPrice : 0;

    return { usd };
  }

  if (isNativeBalanceError || isEthPriceError) {
    return { isError: true };
  }
  return { isLoading: true };
}

const allFilters = ["borrow", "bridge", "completed", "earn", "failed", "swap"];

export function WalletDrawerContent() {
  const { address } = useAccount();
  const { isError, usd } = useBalanceInUsd();
  const { disconnect } = useDisconnect();
  const { t } = useTranslation();
  const [selectedFilters, setSelectedFilters] = useState(allFilters);

  const activities = useActivities(address);
  const explorerBaseUrl = mainnet.blockExplorers!.default.url;

  const filteredActivities = activities.filter(
    (a) =>
      selectedFilters.includes(a.page) &&
      (a.status === "pending" || selectedFilters.includes(a.status)),
  );

  const itemsWithHref = filteredActivities.map((a) => ({
    ...a,
    href:
      a.page === "bridge"
        ? `https://layerzeroscan.com/tx/${a.txHash}`
        : `${explorerBaseUrl}/tx/${a.txHash}`,
  }));

  const balanceParts = usd !== undefined ? splitDecimalParts(usd) : undefined;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 p-6">
        <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-blue-50">
          <img alt="" src={profileIcon} />
        </div>
        <h4>{address ? formatEvmAddress(address) : ""}</h4>
        <button
          aria-label={t("pages.wallet.disconnect-wallet")}
          className="ml-auto flex cursor-pointer items-center justify-center text-gray-500 hover:text-gray-600"
          onClick={() => disconnect()}
          type="button"
        >
          {/* Using a component instead of raw SVG so I can add hover effects */}
          <PowerIcon />
        </button>
      </div>
      <div className="px-6 pt-4 pb-6">
        <h1>
          {balanceParts ? (
            <>
              {balanceParts.integer}
              <span className="text-gray-400">{balanceParts.decimal}</span>
            </>
          ) : isError ? (
            "-"
          ) : (
            "..."
          )}
        </h1>
      </div>
      <div className="flex flex-1 flex-col bg-gray-50">
        <div className="flex items-center justify-between border-y border-gray-200 px-6 py-4">
          <h5>{t("pages.wallet.recent-activity")}</h5>
          <FilterMenu
            icon={<img alt="" height={16} src={tableCellsIcon} width={16} />}
            label={t("pages.wallet.view-settings")}
            onChange={setSelectedFilters}
            sections={[
              {
                label: t("pages.wallet.view-operations-from"),
                options: [
                  { label: t("nav.borrow"), value: "borrow" },
                  { label: t("nav.bridge"), value: "bridge" },
                  { label: t("nav.earn"), value: "earn" },
                  { label: t("nav.swap"), value: "swap" },
                ],
              },
              {
                label: t("pages.wallet.view-status-from"),
                options: [
                  {
                    label: t("pages.wallet.filter-success"),
                    value: "completed",
                  },
                  { label: t("pages.wallet.filter-error"), value: "failed" },
                ],
              },
            ]}
            selectedValues={selectedFilters}
          />
        </div>
        <div className="relative min-h-0 flex-1 overflow-hidden">
          <ActivityList
            hasTransactions={activities.length > 0}
            items={itemsWithHref}
            onResetFilters={() => setSelectedFilters(allFilters)}
          />
        </div>
      </div>
    </div>
  );
}

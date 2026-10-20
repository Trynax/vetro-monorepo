import { gatewayAddresses } from "@vetro-protocol/gateway";
import { ApyHistoryCard } from "components/apyHistoryCard";
import { PageTitle } from "components/base/pageTitle";
import { ExitCooldownCard } from "components/exitCooldownCard";
import { ShareRatioCard } from "components/shareRatioCard";
import { StakedCard } from "components/stakedCard";
import { StripedDivider } from "components/stripedDivider";
import { TvlHistoryCard } from "components/tvlHistoryCard";
import { YieldCard } from "components/yieldCard";
import { usePeggedTokensByGateway } from "hooks/usePeggedTokensByGateway";
import { parseAsStringLiteral, useQueryState } from "nuqs";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";

import { CollateralizationCard } from "./components/collateralizationCard";
import { TokenFilter } from "./components/tokenFilter";
import { TvlCard } from "./components/tvlCard";

const AllocationRow = ({
  children,
  className = "",
  isLast = false,
}: {
  children: ReactNode;
  className?: string;
  isLast?: boolean;
}) => (
  <>
    <div
      className={`flex flex-col border-y border-gray-200 bg-gray-100 md:flex-row ${className}`}
    >
      {children}
    </div>
    {!isLast && (
      <div className="bg-gray-100">
        <StripedDivider variant="small" />
      </div>
    )}
  </>
);

const TokenFilterSkeleton = () => (
  <div className="flex gap-2">
    {gatewayAddresses.map((gatewayAddress) => (
      <Skeleton
        borderRadius={9999}
        height={32}
        key={gatewayAddress}
        width={88}
      />
    ))}
  </div>
);

export const Analytics = function () {
  const { t } = useTranslation();
  const { data: peggedTokensByGateway, isError: isPeggedTokensError } =
    usePeggedTokensByGateway();
  const [selectedGatewayAddress, setSelectedGatewayAddress] = useQueryState(
    "gateway",
    parseAsStringLiteral(gatewayAddresses).withDefault(gatewayAddresses[0]),
  );

  const tokens = peggedTokensByGateway
    ? gatewayAddresses
        .map((gatewayAddress) => peggedTokensByGateway[gatewayAddress])
        .filter(Boolean)
    : undefined;

  const selectedToken = tokens?.find(
    (token) => token.gatewayAddress === selectedGatewayAddress,
  );

  // only show the filter if there are 2 or more tokens to filter from
  const showTokenFilter = gatewayAddresses.length > 1 && !isPeggedTokensError;

  return (
    <div className="flex flex-col">
      <div className={showTokenFilter ? "border-b border-gray-200" : undefined}>
        <PageTitle value={t("pages.analytics.title")} />
      </div>
      {showTokenFilter && (
        <div className="sticky top-0 z-10 border-b border-gray-200 bg-white px-3 py-4 md:px-6">
          <div className="mx-auto w-fit">
            {tokens && selectedToken ? (
              <TokenFilter
                onChange={(token) =>
                  setSelectedGatewayAddress(token.gatewayAddress)
                }
                tokens={tokens}
                value={selectedToken}
              />
            ) : (
              <TokenFilterSkeleton />
            )}
          </div>
        </div>
      )}
      <AllocationRow className="md:divide-x md:divide-gray-200">
        <TvlCard
          peggedToken={selectedToken}
          peggedTokenError={isPeggedTokensError}
        />
        <CollateralizationCard
          peggedToken={selectedToken}
          peggedTokenError={isPeggedTokensError}
        />
      </AllocationRow>
      <AllocationRow>
        <div className="flex-1 px-3 md:px-14">
          <TvlHistoryCard
            peggedToken={selectedToken}
            peggedTokenError={isPeggedTokensError}
          />
        </div>
      </AllocationRow>
      <AllocationRow className="md:divide-x md:divide-gray-200">
        <div className="flex-1 px-3 *:border-0 md:px-11 lg:px-14">
          <StakedCard
            peggedToken={selectedToken}
            peggedTokenError={isPeggedTokensError}
          />
        </div>
        <div className="flex-1 px-3 *:border-0 md:px-11 lg:px-14">
          <ExitCooldownCard
            peggedToken={selectedToken}
            peggedTokenError={isPeggedTokensError}
          />
        </div>
      </AllocationRow>
      <AllocationRow>
        <div className="flex-1 px-3 md:px-14">
          <ShareRatioCard
            peggedToken={selectedToken}
            peggedTokenError={isPeggedTokensError}
          />
        </div>
      </AllocationRow>
      <AllocationRow>
        <div className="flex-1 px-3 md:px-14">
          <ApyHistoryCard
            peggedToken={selectedToken}
            peggedTokenError={isPeggedTokensError}
          />
        </div>
      </AllocationRow>
      <AllocationRow className="md:justify-center" isLast>
        <div className="border-x border-gray-200 md:w-1/2">
          <YieldCard
            peggedToken={selectedToken}
            peggedTokenError={isPeggedTokensError}
          />
        </div>
      </AllocationRow>
    </div>
  );
};

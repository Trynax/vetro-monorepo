import type { Token } from "@vetro-protocol/core";
import { Badge } from "components/base/badge";
import { Button } from "components/base/button";
import { RenderFiatValue } from "components/base/fiatValue";
import { InfoCard } from "components/base/infoCard";
import { TokenAmountCaption } from "components/earn/tokenAmountCaption";
import { BoltIcon } from "components/icons/boltIcon";
import { InfoIcon } from "components/icons/infoIcon";
import { Tooltip } from "components/tooltip";
import { useDepositRequest } from "pages/earn/hooks/targetYieldPool/useDepositRequest";
import { useTranslation } from "react-i18next";
import { formatUsd } from "utils/currency";
import type { Address } from "viem";

const stateConfig = {
  claimable: {
    badge: { key: "pages.earn.fixed-term.claimable", variant: "blue" },
    info: "pages.earn.fixed-term.deposit-claim-info-claimable",
  },
  claimableShutdown: {
    badge: { key: "pages.earn.fixed-term.claimable", variant: "blue" },
    info: "pages.earn.fixed-term.deposit-claim-info-claimable-shutdown",
  },
  none: {
    badge: undefined,
    info: "pages.earn.fixed-term.deposit-claim-info-empty",
  },
  pending: {
    badge: { key: "pages.earn.fixed-term.pending", variant: "gray" },
    info: "pages.earn.fixed-term.deposit-claim-info-pending",
  },
  pendingNotCancelable: {
    badge: { key: "pages.earn.fixed-term.pending", variant: "gray" },
    info: "pages.earn.fixed-term.deposit-claim-info-pending-not-cancelable",
  },
} as const;

type Props = {
  peggedToken: Token;
  shareToken: Token;
  stakingVaultAddress: Address;
};

export const DepositClaimCard = function ({
  peggedToken,
  shareToken,
  stakingVaultAddress,
}: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useDepositRequest(stakingVaultAddress);

  const getStateConfigKey = function () {
    if (!data) {
      return "none";
    }
    if (data.state === "claimable" && !data.canClaim) {
      return "claimableShutdown";
    }
    if (data.state === "pending" && !data.canCancel) {
      return "pendingNotCancelable";
    }
    return data.state;
  };

  const { badge, info } = stateConfig[getStateConfigKey()];

  const handleClaim = function () {
    // TODO: claim with `claimDeposit` from `@vetro-protocol/target-yield-earn`
    // once VUSDx is deployed.
    // See https://github.com/vetro-protocol/vetro-monorepo/issues/646
  };

  const handleCancel = function () {
    // TODO: cancel with `cancelDepositRequest` from
    // `@vetro-protocol/target-yield-earn` once VUSDx is deployed.
    // See https://github.com/vetro-protocol/vetro-monorepo/issues/646
  };

  return (
    <InfoCard
      data={data}
      icon={<BoltIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={
        <span className="flex items-center gap-x-2">
          <span className="flex items-center gap-x-1">
            {t("pages.earn.fixed-term.deposit")}
            <Tooltip
              content={t(info, {
                peggedSymbol: peggedToken.symbol,
                shareSymbol: shareToken.symbol,
              })}
              visible={data ? undefined : false}
            >
              <div className="*:size-3">
                <InfoIcon />
              </div>
            </Tooltip>
          </span>
          {badge ? <Badge variant={badge.variant}>{t(badge.key)}</Badge> : null}
        </span>
      }
      render={({ amount, shares, state }) => (
        <span className="flex items-center gap-x-3">
          <RenderFiatValue
            customFormatter={(value) => formatUsd(Number(value))}
            token={peggedToken}
            value={amount}
          />
          {shares > 0n ? (
            <TokenAmountCaption amount={shares} token={shareToken} />
          ) : null}
          {state === "pending" || (state === "claimable" && shares === 0n) ? (
            <TokenAmountCaption amount={amount} token={peggedToken} />
          ) : null}
        </span>
      )}
      subtitle={
        <div className="flex w-full gap-x-2 *:flex-1">
          <Button
            disabled={!data?.canClaim}
            onClick={handleClaim}
            type="button"
          >
            {t("pages.earn.fixed-term.claim-shares", {
              symbol: shareToken.symbol,
            })}
          </Button>
          <Button
            disabled={!data?.canCancel}
            onClick={handleCancel}
            type="button"
            variant="secondary"
          >
            {t("pages.earn.fixed-term.cancel")}
          </Button>
        </div>
      }
    />
  );
};

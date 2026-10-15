import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import type { Token } from "@vetro-protocol/core";
import { DisplayAmount } from "components/base/displayAmount";
import { RenderFiatValue } from "components/base/fiatValue";
import { InfoCard } from "components/base/infoCard";
import { BoltIcon } from "components/icons/boltIcon";
import { TokenLogo } from "components/tokenLogo";
import { useStakedAmount } from "hooks/useStakedAmount";
import { mainnet } from "networks/mainnet";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { formatUsd } from "utils/currency";
import type { Address } from "viem";

const SymbolContainer = ({ children }: { children?: ReactNode }) => (
  <span className="text-gray-500">{children}</span>
);

const ShareBalance = function ({ shareToken }: { shareToken: Token }) {
  const { data: shareBalance } = useTokenBalance({
    address: shareToken.address,
    chainId: mainnet.id,
  });

  if (shareBalance === undefined) {
    return null;
  }

  return (
    <span className="text-caption flex items-center gap-x-1 text-gray-900">
      <TokenLogo {...shareToken} size="xSmall" />
      <DisplayAmount
        amount={shareBalance}
        symbolContainer={SymbolContainer}
        token={shareToken}
      />
    </span>
  );
};

type Props = {
  shareToken: Token;
  stakingVaultAddress: Address;
};

export const PositionCard = function ({
  shareToken,
  stakingVaultAddress,
}: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useStakedAmount(stakingVaultAddress);

  return (
    <InfoCard
      data={data}
      icon={<BoltIcon className="text-blue-500" />}
      isLoading={isLoading}
      label={t("pages.earn.stats.your-position")}
      render={({ peggedToken, stakedBalance }) => (
        <span className="flex items-center gap-x-3">
          <RenderFiatValue
            customFormatter={(value) => formatUsd(Number(value))}
            token={peggedToken}
            value={stakedBalance}
          />
          <ShareBalance shareToken={shareToken} />
        </span>
      )}
    />
  );
};

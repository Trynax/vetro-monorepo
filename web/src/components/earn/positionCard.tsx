import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import type { Token } from "@vetro-protocol/core";
import { RenderFiatValue } from "components/base/fiatValue";
import { InfoCard } from "components/base/infoCard";
import { TokenAmountCaption } from "components/earn/tokenAmountCaption";
import { BoltIcon } from "components/icons/boltIcon";
import { useStakedAmount } from "hooks/useStakedAmount";
import { mainnet } from "networks/mainnet";
import { useTranslation } from "react-i18next";
import { formatUsd } from "utils/currency";
import type { Address } from "viem";

const ShareBalance = function ({ shareToken }: { shareToken: Token }) {
  const { data: shareBalance } = useTokenBalance({
    address: shareToken.address,
    chainId: mainnet.id,
  });

  if (shareBalance === undefined) {
    return null;
  }

  return <TokenAmountCaption amount={shareBalance} token={shareToken} />;
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

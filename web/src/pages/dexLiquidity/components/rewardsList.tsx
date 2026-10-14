import type { DexPool, DexPoolReward } from "@vetro-protocol/core";
import { ExternalLink } from "components/base/externalLink";
import { ExternalLinkIcon } from "components/icons/externalLinkIcon";
import { Tooltip } from "components/tooltip";
import { useTranslation } from "react-i18next";
import { formatPercentage } from "utils/format";

import { StakeDaoIcon } from "../icons/stakeDaoIcon";
import { getRewardUrl } from "../utils";

import { CoinSymbols } from "./coinSymbols";
import { VenueLogo } from "./venueLogo";

const sourceIcons = {
  curveGauge: <VenueLogo dex="curve" />,
  merkl: <img alt="Merkl" src="/rewards/merkl.png" />,
  stakeDao: <StakeDaoIcon className="text-gray-900" />,
};

const formatRewardApr = function ({ apr, aprMax }: DexPoolReward) {
  const formattedApr = formatPercentage(apr);
  if (aprMax === undefined) {
    return formattedApr;
  }
  const formattedAprMax = formatPercentage(aprMax);
  return formattedAprMax === formattedApr
    ? formattedApr
    : `${formattedApr} → ${formattedAprMax}`;
};

type Props = {
  pool: DexPool;
};

export function RewardsList({ pool }: Props) {
  const { t } = useTranslation();

  if (pool.rewards.length === 0) {
    return <span className="text-b-medium text-gray-400">-</span>;
  }

  const titles = {
    curveGauge: t("pages.dex-liquidity.reward-sources.curve-gauge"),
    merkl: t("pages.dex-liquidity.reward-sources.merkl"),
    stakeDao: t("pages.dex-liquidity.reward-sources.stake-dao"),
  };

  return (
    <div className="flex flex-col items-start gap-0.5">
      {pool.rewards.map((reward) => (
        <Tooltip
          content={titles[reward.source]}
          key={`${reward.source}-${Object.values(reward.sourceMetadata).join("-")}`}
        >
          <ExternalLink
            className="group text-b-medium flex min-h-6 items-center gap-1 text-gray-900 md:min-h-0"
            href={getRewardUrl({ pool, reward })}
          >
            <span className="flex *:size-4">{sourceIcons[reward.source]}</span>
            <span className="font-semibold text-gray-600 tabular-nums transition-colors group-hover:text-gray-900">
              {formatRewardApr(reward)}
            </span>
            <span className="text-gray-500">
              <CoinSymbols coins={reward.tokens} separator=", " />
            </span>
            <ExternalLinkIcon className="ml-0.5 text-gray-400 transition-colors group-hover:text-gray-900" />
          </ExternalLink>
        </Tooltip>
      ))}
    </div>
  );
}

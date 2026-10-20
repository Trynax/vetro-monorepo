import { InfoIcon } from "components/icons/infoIcon";
import { Tooltip } from "components/tooltip";
import { useTranslation } from "react-i18next";

export function RewardsAprLabel() {
  const { t } = useTranslation();

  const sources = [
    {
      description: t("pages.liquidity.rewards-apr-info.curve-gauge"),
      name: "Curve Gauge",
    },
    {
      description: t("pages.liquidity.rewards-apr-info.stake-dao"),
      name: "Stake DAO",
    },
    {
      description: t("pages.liquidity.rewards-apr-info.merkl"),
      name: "Merkl",
    },
  ];

  return (
    <span className="flex items-center gap-1">
      {t("pages.liquidity.rewards-apr")}
      <Tooltip
        content={
          <div className="flex flex-col gap-1.5 py-0.5">
            {sources.map(({ description, name }) => (
              <p key={name}>
                <span className="font-semibold">{name}:</span> {description}
              </p>
            ))}
          </div>
        }
      >
        <div className="*:size-3">
          <InfoIcon />
        </div>
      </Tooltip>
    </span>
  );
}

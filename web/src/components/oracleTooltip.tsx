import { ExternalLink } from "components/base/externalLink";
import { ExternalLinkIcon } from "components/icons/externalLinkIcon";
import { InfoIcon } from "components/icons/infoIcon";
import { Tooltip } from "components/tooltip";
import { mainnet } from "networks/mainnet";
import { useTranslation } from "react-i18next";
import { formatEvmAddress } from "utils/format";
import type { Address } from "viem";

const ChainlinkLogo = () => (
  <svg
    aria-hidden="true"
    fill="#0847F7"
    height="16"
    viewBox="0 0 13.92 16"
    width="14"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M6.96 0L0 4v8l6.96 4 6.96-4V4L6.96 0zm4.01 10.3L6.96 12.61 2.95 10.3V5.7L6.96 3.39l4.01 2.3v4.61z" />
  </svg>
);

const OracleLogo = () => (
  <svg
    aria-hidden="true"
    fill="#2040FF"
    height="16"
    viewBox="0 0 16 16"
    width="16"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      clipRule="evenodd"
      d="M7.628 1.349a.75.75 0 0 1 .744 0l1.247.712a.75.75 0 1 1-.744 1.303L8 2.864l-.875.5a.75.75 0 1 1-.744-1.303l1.247-.712ZM4.65 3.914a.75.75 0 0 1-.279 1.023l-.11.063.11.063a.75.75 0 1 1-.743 1.302l-.13-.073a.75.75 0 0 1-1.498-.042V5a.75.75 0 0 1 .378-.651l1.25-.714a.75.75 0 0 1 1.022.279Zm6.698 0a.75.75 0 0 1 1.023-.28l1.25.715A.75.75 0 0 1 14 5v1.25a.75.75 0 0 1-1.499.042l-.129.073a.75.75 0 1 1-.744-1.302l.11-.063-.11-.063a.75.75 0 0 1-.28-1.023ZM6.102 6.915a.75.75 0 0 1 1.023-.279L8 7.136l.875-.5a.75.75 0 1 1 .744 1.303L8.75 8.435V9.25a.75.75 0 0 1-1.5 0V8.435l-.869-.496a.75.75 0 0 1-.279-1.024ZM2.75 9a.75.75 0 0 1 .75.75v.815l.872.498a.75.75 0 1 1-.744 1.303l-1.25-.715A.75.75 0 0 1 2 11V9.75A.75.75 0 0 1 2.75 9Zm10.5 0a.75.75 0 0 1 .75.75V11a.75.75 0 0 1-.378.651l-1.25.715a.75.75 0 1 1-.744-1.303l.872-.498V9.75a.75.75 0 0 1 .75-.75Zm-4.501 3.708.126-.072a.75.75 0 1 1 .744 1.303l-1.247.712a.75.75 0 0 1-.744 0l-1.248-.711a.75.75 0 1 1 .744-1.303l.126.072a.75.75 0 0 1 1.499 0Z"
      fillRule="evenodd"
    />
  </svg>
);

type Variant = "chainlink" | "oracle";

type Props = {
  oracle: Address;
  useParentContainer?: boolean;
  variant?: Variant;
};

export function OracleTooltip({
  oracle,
  useParentContainer = false,
  variant = "chainlink",
}: Props) {
  const { t } = useTranslation();
  const explorerBaseUrl = mainnet.blockExplorers!.default.url;

  const variantConfig = {
    chainlink: { label: "Chainlink", logo: <ChainlinkLogo /> },
    oracle: { label: t("common.oracle"), logo: <OracleLogo /> },
  };

  const { label, logo } = variantConfig[variant];

  return (
    <Tooltip
      content={
        <ExternalLink
          className="group flex items-center gap-x-1 text-white"
          href={`${explorerBaseUrl}/address/${oracle}`}
          onClick={(e) => e.stopPropagation()}
        >
          {logo}
          <span className="font-semibold">{label}</span>
          <span className="ml-5 text-gray-400 transition-colors group-hover:text-gray-500">
            {formatEvmAddress(oracle)}
          </span>
          <ExternalLinkIcon />
        </ExternalLink>
      }
      useParentContainer={useParentContainer}
    >
      <InfoIcon />
    </Tooltip>
  );
}

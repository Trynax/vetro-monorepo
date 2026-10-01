import { ExternalLink } from "components/base/externalLink";
import { mainnet } from "networks/mainnet";
import { useTranslation } from "react-i18next";
import { formatEvmAddress } from "utils/format";
import type { Address } from "viem";

import { PoolInfoItem } from "./poolInfoItem";

type Props = {
  address: Address;
};

export function PoolContract({ address }: Props) {
  const { t } = useTranslation();

  const explorerBaseUrl = mainnet.blockExplorers!.default.url;

  return (
    <div className="contents md:*:w-32">
      <PoolInfoItem
        data={address}
        label={t("pages.earn.pool-info.pool-contract")}
        render={(poolAddress) => (
          <ExternalLink
            className="text-xsm font-semibold text-gray-600 transition-colors hover:text-gray-900"
            href={`${explorerBaseUrl}/address/${poolAddress}`}
          >
            {formatEvmAddress(poolAddress)}
          </ExternalLink>
        )}
      />
    </div>
  );
}

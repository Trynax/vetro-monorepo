import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import type { Token } from "@vetro-protocol/core";
import { useTranslation } from "react-i18next";
import { formatAmount } from "utils/token";

import { Balance } from "./balance";

type Props = {
  label?: string;
  token: Token;
};

export const TokenBalance = function ({ label, token }: Props) {
  const { t } = useTranslation();

  const { data: balance, isError } = useTokenBalance({
    address: token.address,
    chainId: token.chainId,
  });

  return (
    <Balance
      label={label ?? t("common.balance")}
      value={formatAmount({
        amount: balance,
        decimals: token.decimals,
        isError,
      })}
    />
  );
};

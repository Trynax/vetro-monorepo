import type { Token } from "@vetro-protocol/core";
import { DisplayAmount } from "components/base/displayAmount";
import { TokenLogo } from "components/tokenLogo";
import type { ReactNode } from "react";

const SymbolContainer = ({ children }: { children?: ReactNode }) => (
  <span className="text-gray-500">{children}</span>
);

type Props = {
  amount: bigint;
  token: Token;
};

export const TokenAmountCaption = ({ amount, token }: Props) => (
  <span className="text-caption flex items-center gap-x-1 text-gray-900">
    <TokenLogo {...token} size="xSmall" />
    <DisplayAmount
      amount={amount}
      symbolContainer={SymbolContainer}
      token={token}
    />
  </span>
);

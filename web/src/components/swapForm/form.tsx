import type { Token } from "@vetro-protocol/core";
import { RenderFiatValue } from "components/base/fiatValue";
import { TokenInput } from "components/tokenInput";
import { TokenBalance } from "components/tokenInput/tokenBalance";
import type { FormEvent, ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { SwapToggleButton } from "./swapToggleButton";

type Props = {
  amountBigInt: bigint;
  children: ReactNode;
  errorKey?: string;
  fromInputValue: string;
  fromToken: Token;
  fromTokenSelector: ReactNode;
  maxButton?: ReactNode;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
  onToggle: VoidFunction;
  slippageControl?: ReactNode;
  toSection: ReactNode;
};

export function Form({
  amountBigInt,
  children,
  errorKey,
  fromInputValue,
  fromToken,
  fromTokenSelector,
  maxButton,
  onInputChange,
  onSubmit,
  onToggle,
  slippageControl,
  toSection,
}: Props) {
  const { t } = useTranslation();

  return (
    <div className="flex w-full justify-center border-y border-gray-200 bg-gray-100">
      <form
        className="xs:border-x flex w-full max-w-md flex-col gap-0.5 border-gray-200 bg-white pt-2"
        onSubmit={onSubmit}
      >
        <div className="px-2">
          <TokenInput
            balance={<TokenBalance token={fromToken} />}
            errorKey={errorKey}
            fiatValue={
              <RenderFiatValue token={fromToken} value={amountBigInt} />
            }
            headerAction={slippageControl}
            label={t("pages.swap.form.you-are-swapping")}
            maxButton={maxButton}
            onChange={onInputChange}
            tokenSelector={fromTokenSelector}
            value={fromInputValue}
          />
        </div>

        <div className="relative flex h-0 items-center justify-center">
          <SwapToggleButton onClick={onToggle} />
        </div>
        <div className="px-2">{toSection}</div>
        {children}
      </form>
    </div>
  );
}

import { Button } from "components/base/button";
import { StripedDivider } from "components/stripedDivider";
import { TokenInput } from "components/tokenInput";
import { Balance } from "components/tokenInput/balance";
import { TokenSelectorSkeleton } from "components/tokenSelectorSkeleton";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";

import { SwapToggleButton } from "./swapToggleButton";

export function SwapFormSkeleton() {
  const { t } = useTranslation();

  return (
    <>
      <div className="flex w-full justify-center border-y border-gray-200 bg-gray-100">
        <div className="xs:border-x flex w-full max-w-md flex-col gap-0.5 border-gray-200 bg-white pt-2">
          <div className="px-2">
            <TokenInput
              balance={<Balance label={t("common.balance")} value="-" />}
              disabled
              fiatValue={
                <Skeleton className="h-full" containerClassName="w-8" />
              }
              label={t("pages.swap.form.you-are-swapping")}
              tokenSelector={<TokenSelectorSkeleton />}
              value="0"
            />
          </div>

          <div className="relative flex h-0 items-center justify-center">
            <SwapToggleButton />
          </div>

          <div className="px-2">
            <TokenInput
              balance={<Balance label={t("common.balance")} value="-" />}
              disabled
              fiatValue={
                <Skeleton className="h-full" containerClassName="w-8" />
              }
              label={t("pages.swap.form.you-will-receive-estimated")}
              tokenSelector={<TokenSelectorSkeleton />}
              value="0"
            />
          </div>

          <div className="mt-2 flex w-full flex-col border-t border-gray-200 px-2 py-3">
            <Button disabled size="xLarge" type="button">
              {t("common.connect-wallet")}
            </Button>
          </div>
        </div>
      </div>
      <div className="w-full border-y border-gray-200 bg-gray-100">
        <StripedDivider />
      </div>
    </>
  );
}

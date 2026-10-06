import { useDebounce } from "@hemilabs/react-hooks/useDebounce";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import type { Token } from "@vetro-protocol/core";
import { RenderCryptoValue } from "components/base/cryptoValue";
import { RenderFiatValue } from "components/base/fiatValue";
import { CollapsibleSection } from "components/collapsibleSection";
import { NetworkFees } from "components/networkFees";
import { SetMaxErc20Balance } from "components/setMaxErc20Balance";
import { TokenInput } from "components/tokenInput";
import { TokenBalance } from "components/tokenInput/tokenBalance";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import { useConvertToAssets } from "hooks/useConvertToAssets";
import { mainnet } from "networks/mainnet";
import { getEpochState } from "pages/earn/components/fixedTermEarn/getEpochState";
import { StakeSubmitButton } from "pages/earn/components/stakeForm/stakeSubmitButton";
import { useEpochEndDate } from "pages/earn/hooks/targetYieldPool/useEpochEndDate";
import { useEpochPeriod } from "pages/earn/hooks/targetYieldPool/useEpochPeriod";
import { useMaxRequestRedeem } from "pages/earn/hooks/targetYieldPool/useMaxRequestRedeem";
import { useRequestExitFees } from "pages/earn/hooks/targetYieldPool/useRequestExitFees";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import type { TokenWithGateway } from "types";
import { unixNowTimestamp } from "utils/date";
import { parseTokenUnits } from "utils/token";
import type { Address } from "viem";

import { getInputError } from "./getInputError";
import { isFormLoading } from "./isFormLoading";
import { LockNote } from "./lockNote";
import { Review, ReviewRow } from "./review";

type Props = {
  inputValue: string;
  onInputChange: (value: string) => void;
  peggedToken: TokenWithGateway;
  shareToken: Token;
  stakingVaultAddress: Address;
};

export function ExitForm({
  inputValue,
  onInputChange,
  peggedToken,
  shareToken,
  stakingVaultAddress,
}: Props) {
  const { t } = useTranslation();

  const { data: shareTokenBalance } = useTokenBalance({
    address: shareToken.address,
    chainId: mainnet.id,
  });

  const { data: nativeBalanceData } = useNativeBalance(mainnet.id);
  const nativeBalance = nativeBalanceData?.value;

  const shares = parseTokenUnits(inputValue, shareToken);
  const debouncedShares = parseTokenUnits(useDebounce(inputValue), shareToken);

  const { data: assets, status: assetsStatus } = useConvertToAssets({
    shares: debouncedShares,
    stakingVaultAddress,
  });
  const epochPeriod = useEpochPeriod(stakingVaultAddress);
  const epochEndDate = useEpochEndDate(stakingVaultAddress);
  const { data: maxRequestRedeem, isError: isMaxRequestRedeemError } =
    useMaxRequestRedeem(stakingVaultAddress);
  const requestFeesQuery = useRequestExitFees({
    amount: shares,
    token: shareToken,
  });

  const inputError = getInputError({
    amount: shares,
    balance: shareTokenBalance,
    maxRequest: maxRequestRedeem,
    nativeBalance,
  });

  const balancesLoaded =
    nativeBalance !== undefined &&
    shareTokenBalance !== undefined &&
    maxRequestRedeem !== undefined;

  const isExitWindowOpen =
    epochPeriod.data !== undefined &&
    getEpochState({
      ...epochPeriod.data,
      now: BigInt(unixNowTimestamp()),
    }) === "open-to-exit";

  const isLoading =
    isFormLoading({
      balance: shareTokenBalance,
      isMaxRequestError: isMaxRequestRedeemError,
      maxRequest: maxRequestRedeem,
      nativeBalance,
    }) || epochPeriod.isPending;

  function getBlockingText() {
    if (isMaxRequestRedeemError) {
      return t("pages.earn.fixed-term.max-exit-error");
    }
    if (epochPeriod.isError) {
      return t("pages.earn.fixed-term.exit-window-error");
    }
    if (!isExitWindowOpen) {
      return t("pages.earn.fixed-term.exit-window-closed");
    }
    return undefined;
  }

  const renderEpochEndDate = () =>
    epochEndDate.data ??
    (epochEndDate.isError ? "-" : <Skeleton inline width={80} />);

  function renderFiatValue() {
    if (shares === 0n) {
      return <RenderFiatValue token={peggedToken} value={0n} />;
    }
    return (
      <RenderFiatValue
        queryStatus={assetsStatus}
        token={peggedToken}
        value={assets}
      />
    );
  }

  function renderYouWillReceive() {
    if (shares === 0n) {
      return "-";
    }
    return (
      <RenderCryptoValue
        showSymbol
        status={assetsStatus}
        token={peggedToken}
        value={assets}
      />
    );
  }

  function handleSubmit(e: FormEvent) {
    // TODO implement form submission
    // https://github.com/vetro-protocol/vetro-monorepo/issues/646
    e.preventDefault();
  }

  return (
    <form className="flex flex-col bg-white" onSubmit={handleSubmit}>
      <div className="p-2">
        <TokenInput
          balance={
            <TokenBalance
              label={t("pages.earn.stake.available-to-withdraw")}
              token={shareToken}
            />
          }
          errorKey={balancesLoaded ? inputError : undefined}
          fiatValue={renderFiatValue()}
          label={t("pages.earn.stake.you-will-withdraw")}
          maxButton={
            <SetMaxErc20Balance onClick={onInputChange} token={shareToken} />
          }
          onChange={onInputChange}
          tokenSelector={<TokenSelectorReadOnly {...shareToken} />}
          value={inputValue}
        />
      </div>
      <div className="flex border-y border-gray-200 p-3 *:flex-1">
        <StakeSubmitButton
          actionText={t("pages.earn.fixed-term.request-exit")}
          blockingText={getBlockingText()}
          inputError={inputError}
          isLoading={isLoading}
          isPending={false}
          pendingText={t("pages.earn.fixed-term.request-exit")}
        />
      </div>
      <CollapsibleSection show={shares !== 0n}>
        <div className="border-b border-gray-200">
          <NetworkFees
            label={t("pages.earn.fixed-term.request-exit-fees-label", {
              amount: inputValue,
              token: shareToken.symbol,
            })}
            networkFee={requestFeesQuery}
            sectionClassName="px-2"
          />
        </div>
      </CollapsibleSection>
      {!epochEndDate.isError && (
        <LockNote>
          {epochEndDate.data ? (
            t("pages.earn.fixed-term.exit-note", {
              date: epochEndDate.data,
              symbol: peggedToken.symbol,
            })
          ) : (
            <Skeleton width={200} />
          )}
        </LockNote>
      )}
      <Review title={t("pages.earn.fixed-term.exit-review")}>
        <ReviewRow
          info={t("pages.earn.fixed-term.you-will-receive-info")}
          label={t("pages.earn.stake.you-will-receive")}
          value={renderYouWillReceive()}
        />
        <ReviewRow
          info={t("pages.earn.fixed-term.available-after-info", {
            symbol: peggedToken.symbol,
          })}
          label={t("pages.earn.fixed-term.available-after")}
          value={renderEpochEndDate()}
        />
      </Review>
    </form>
  );
}

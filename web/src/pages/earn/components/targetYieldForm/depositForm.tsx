import { useDebounce } from "@hemilabs/react-hooks/useDebounce";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import type { Token } from "@vetro-protocol/core";
import { ApproveSection } from "components/approveSection";
import { RenderCryptoValue } from "components/base/cryptoValue";
import { RenderFiatValue } from "components/base/fiatValue";
import { CollapsibleSection } from "components/collapsibleSection";
import { NetworkFees } from "components/networkFees";
import { SetMaxErc20Balance } from "components/setMaxErc20Balance";
import { TokenInput } from "components/tokenInput";
import { TokenBalance } from "components/tokenInput/tokenBalance";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import { useConvertToShares } from "hooks/useConvertToShares";
import { mainnet } from "networks/mainnet";
import { StakeSubmitButton } from "pages/earn/components/stakeForm/stakeSubmitButton";
import { useAccrualInterval } from "pages/earn/hooks/targetYieldPool/useAccrualInterval";
import { useEpochEndDate } from "pages/earn/hooks/targetYieldPool/useEpochEndDate";
import { useMaxRequestDeposit } from "pages/earn/hooks/targetYieldPool/useMaxRequestDeposit";
import { useRequestDepositFees } from "pages/earn/hooks/targetYieldPool/useRequestDepositFees";
import { useTargetApr } from "pages/earn/hooks/targetYieldPool/useTargetApr";
import { useTargetRate } from "pages/earn/hooks/targetYieldPool/useTargetRate";
import { type FormEvent, type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import Skeleton from "react-loading-skeleton";
import type { TokenWithGateway } from "types";
import { unixNowTimestamp } from "utils/date";
import { formatFiatNumber, formatPercentage } from "utils/format";
import { getEstimatedYield } from "utils/targetYield";
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

const valueOrDash = ({
  amount,
  value,
}: {
  amount: bigint;
  value: ReactNode;
}) => (amount === 0n ? "-" : value);

export function DepositForm({
  inputValue,
  onInputChange,
  peggedToken,
  shareToken,
  stakingVaultAddress,
}: Props) {
  const { t } = useTranslation();
  const [approve10x, setApprove10x] = useState(false);

  const { data: peggedTokenBalance } = useTokenBalance({
    address: peggedToken.address,
    chainId: mainnet.id,
  });

  const { data: nativeBalanceData } = useNativeBalance(mainnet.id);
  const nativeBalance = nativeBalanceData?.value;

  const amount = parseTokenUnits(inputValue, peggedToken);
  const debouncedAmount = parseTokenUnits(useDebounce(inputValue), peggedToken);

  const { data: shares, status: sharesStatus } = useConvertToShares({
    assets: debouncedAmount,
    stakingVaultAddress,
  });
  const targetApr = useTargetApr(stakingVaultAddress);
  const targetRate = useTargetRate(stakingVaultAddress);
  const accrualInterval = useAccrualInterval(stakingVaultAddress);
  const epochEndDate = useEpochEndDate(stakingVaultAddress);
  const { data: maxRequestDeposit, isError: isMaxRequestDepositError } =
    useMaxRequestDeposit(stakingVaultAddress);
  const requestFeesQuery = useRequestDepositFees({
    amount: debouncedAmount,
    approveAmount: approve10x ? debouncedAmount * 10n : undefined,
    stakingVaultAddress,
    token: peggedToken,
  });

  const inputError = getInputError({
    amount,
    balance: peggedTokenBalance,
    maxRequest: maxRequestDeposit,
    nativeBalance,
  });

  const balancesLoaded =
    nativeBalance !== undefined &&
    peggedTokenBalance !== undefined &&
    maxRequestDeposit !== undefined;

  const estimatedYield =
    targetRate.data !== undefined && accrualInterval.data !== undefined
      ? getEstimatedYield({
          accrualEnd: accrualInterval.data.end,
          accrualStart: accrualInterval.data.start,
          amount,
          now: BigInt(unixNowTimestamp()),
          rate: targetRate.data,
        })
      : undefined;

  const renderEpochEndDate = () =>
    epochEndDate.data ??
    (epochEndDate.isError ? "-" : <Skeleton inline width={80} />);

  function renderLockNote() {
    if (epochEndDate.data === undefined && !epochEndDate.isError) {
      return <Skeleton count={2} width={200} />;
    }
    return t("pages.earn.fixed-term.locked-note", {
      date: epochEndDate.data ?? "-",
      symbol: peggedToken.symbol,
    });
  }

  function renderTargetApr() {
    if (targetApr.data !== undefined) {
      return formatPercentage(targetApr.data);
    }
    return targetApr.isError ? "-" : <Skeleton inline width={50} />;
  }

  const renderEstimatedYield = () => (
    <RenderFiatValue
      customFormatter={(value) => `~$${formatFiatNumber(value)}`}
      queryStatus={
        targetRate.isError || accrualInterval.isError ? "error" : "pending"
      }
      token={peggedToken}
      value={estimatedYield}
    />
  );

  function handleToggleApprove10x() {
    setApprove10x((prev) => !prev);
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
              label={t("pages.earn.stake.available-to-deposit")}
              token={peggedToken}
            />
          }
          errorKey={balancesLoaded ? inputError : undefined}
          fiatValue={<RenderFiatValue token={peggedToken} value={amount} />}
          label={t("pages.earn.stake.you-will-stake")}
          maxButton={
            <SetMaxErc20Balance onClick={onInputChange} token={peggedToken} />
          }
          onChange={onInputChange}
          tokenSelector={<TokenSelectorReadOnly {...peggedToken} />}
          value={inputValue}
        />
      </div>
      <div className="flex border-y border-gray-200 p-3 *:flex-1">
        <StakeSubmitButton
          actionText={t("pages.earn.fixed-term.request-deposit")}
          blockingText={
            isMaxRequestDepositError
              ? t("pages.earn.fixed-term.max-deposit-error")
              : undefined
          }
          inputError={inputError}
          isLoading={isFormLoading({
            balance: peggedTokenBalance,
            isMaxRequestError: isMaxRequestDepositError,
            maxRequest: maxRequestDeposit,
            nativeBalance,
          })}
          isPending={false}
          pendingText={t("pages.earn.fixed-term.request-deposit")}
        />
      </div>
      <CollapsibleSection show={debouncedAmount !== 0n}>
        <div className="w-full border-b border-gray-200 px-2">
          <ApproveSection
            active={approve10x}
            onToggle={handleToggleApprove10x}
          />
        </div>
        <div className="border-b border-gray-200">
          <NetworkFees
            label={t("pages.earn.stake.fees-label", {
              amount: inputValue,
              token: peggedToken.symbol,
            })}
            networkFee={requestFeesQuery}
            sectionClassName="px-2"
          />
        </div>
      </CollapsibleSection>
      <LockNote>{renderLockNote()}</LockNote>
      <Review title={t("pages.earn.fixed-term.deposit-review")}>
        <ReviewRow
          info={t("pages.earn.fixed-term.you-will-receive-info")}
          label={t("pages.earn.stake.you-will-receive")}
          value={valueOrDash({
            amount,
            value: (
              <RenderCryptoValue
                showSymbol
                status={sharesStatus}
                token={shareToken}
                value={shares}
              />
            ),
          })}
        />
        <ReviewRow
          info={t("pages.earn.fixed-term.entry-apr-info")}
          label={t("pages.earn.fixed-term.entry-apr")}
          value={renderTargetApr()}
        />
        <ReviewRow
          info={t("pages.earn.fixed-term.estimated-yield-info")}
          label={t("pages.earn.fixed-term.estimated-yield")}
          value={valueOrDash({
            amount,
            value: renderEstimatedYield(),
          })}
        />
        <ReviewRow
          info={t("pages.earn.fixed-term.locked-until-info")}
          label={t("pages.earn.fixed-term.locked-until")}
          value={renderEpochEndDate()}
        />
        <ReviewRow
          info={t("pages.earn.fixed-term.at-term-end-info")}
          label={t("pages.earn.fixed-term.at-term-end")}
          value={t("pages.earn.fixed-term.rolls-into-next-term")}
        />
      </Review>
    </form>
  );
}

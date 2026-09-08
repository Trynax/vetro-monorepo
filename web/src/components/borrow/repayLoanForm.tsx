import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useNeedsApproval } from "@hemilabs/react-hooks/useNeedsApproval";
import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import { getChainAddresses } from "@morpho-org/blue-sdk";
import { Button } from "components/base/button";
import { RenderCryptoValue } from "components/base/cryptoValue";
import { RenderFiatValue } from "components/base/fiatValue";
import { Toast } from "components/base/toast";
import {
  type Step,
  VerticalStepper,
  stepStatus,
} from "components/base/verticalStepper";
import { OracleLabel } from "components/borrow/oracleLabel";
import { hasSufficientGas } from "components/borrow/utils";
import { CollapsibleSection } from "components/collapsibleSection";
import { DrawerFeesContainer } from "components/feesContainer";
import { ExclamationTriangleIcon } from "components/icons/exclamationTriangleIcon";
import { NetworkFees } from "components/networkFees";
import { TokenInput } from "components/tokenInput";
import { Balance } from "components/tokenInput/balance";
import type { InputError } from "components/tokenInput/utils";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import type { MarketData } from "hooks/borrow/useMarketData";
import { useMorphoMarket } from "hooks/borrow/useMorphoMarket";
import { usePositionInfo } from "hooks/borrow/usePositionInfo";
import { useRepayAssets } from "hooks/borrow/useRepayAssets";
import { useTotalRepayFees } from "hooks/borrow/useRepayFees";
import { useRepayReview } from "hooks/borrow/useRepayReview";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useAmount } from "hooks/useAmount";
import { useAnimatedVisibility } from "hooks/useAnimatedVisibility";
import { useCloseOnSuccess } from "hooks/useCloseOnSuccess";
import { useMainnet } from "hooks/useMainnet";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { formatLtvAsPercentage } from "utils/borrowReview";
import { formatNumber } from "utils/format";
import { isGeoRestricted } from "utils/geoRestriction";
import { parseTokenUnits } from "utils/token";
import { useAccount } from "wagmi";

import { PositionReview } from "./positionReview";

type RepayFlowStatus =
  | "approve-error"
  | "approved"
  | "approving"
  | "idle"
  | "repay-error"
  | "repay-ready"
  | "repaid"
  | "repaying";

const getApproveStepStatus = function (
  status: Exclude<RepayFlowStatus, "idle">,
): Step["status"] {
  const exceptions: Partial<
    Record<Exclude<RepayFlowStatus, "idle">, Step["status"]>
  > = {
    "approve-error": stepStatus.failed,
    approving: stepStatus.progress,
  };
  return exceptions[status] ?? stepStatus.completed;
};

const getRepayStepStatus = function (
  status: Exclude<RepayFlowStatus, "idle">,
): Step["status"] {
  const exceptions: Partial<
    Record<Exclude<RepayFlowStatus, "idle">, Step["status"]>
  > = {
    "approve-error": stepStatus.notReady,
    approved: stepStatus.notReady,
    approving: stepStatus.notReady,
    "repay-error": stepStatus.failed,
    "repay-ready": stepStatus.ready,
    repaying: stepStatus.progress,
  };
  return exceptions[status] ?? stepStatus.completed;
};

type SubmitButtonProps = {
  address: string | undefined;
  balancesLoaded: boolean;
  inputError: InputError | undefined;
  sufficientGas: boolean;
};

function SubmitButton({
  address,
  balancesLoaded,
  inputError,
  sufficientGas,
}: SubmitButtonProps) {
  const { t } = useTranslation();

  if (isGeoRestricted()) {
    return (
      <Button disabled size="small" type="submit" variant="primary">
        <ExclamationTriangleIcon />
        {t("common.geo-restriction-title")}
      </Button>
    );
  }

  if (!address) {
    return (
      <Button disabled size="small" type="button" variant="primary">
        {t("common.connect-wallet")}
      </Button>
    );
  }
  if (balancesLoaded && !sufficientGas) {
    return (
      <Button disabled size="small" type="button" variant="primary">
        {t("common.insufficient-gas")}
      </Button>
    );
  }
  if (balancesLoaded && inputError) {
    return (
      <Button disabled size="small" type="button" variant="primary">
        {t(`common.${inputError}`)}
      </Button>
    );
  }
  return (
    <Button size="small" type="submit" variant="primary">
      {t("pages.borrow.repay-loan-progress.submit")}
    </Button>
  );
}

function getInputError({
  currentBorrowAssets,
  loanBalance,
  repayAmount,
}: {
  currentBorrowAssets: bigint | undefined;
  loanBalance: bigint | undefined;
  repayAmount: bigint;
}) {
  if (repayAmount === 0n) {
    return "enter-amount" as const;
  }
  if (currentBorrowAssets !== undefined && repayAmount > currentBorrowAssets) {
    return "exceeds-debt" as const;
  }
  if (loanBalance !== undefined && repayAmount > loanBalance) {
    return "insufficient-balance" as const;
  }
  return undefined;
}

type StepperOverlayProps = {
  isError: boolean;
  onDismiss: VoidFunction;
  onRetry: VoidFunction;
  showStepper: boolean;
  steps: Step[];
};

function StepperOverlay({
  isError,
  onDismiss,
  onRetry,
  showStepper,
  steps,
}: StepperOverlayProps) {
  const { t } = useTranslation();
  const { render: renderRetry, show: showRetry } =
    useAnimatedVisibility(isError);

  return (
    <>
      <div
        className={`fixed inset-0 z-20 bg-gray-900/10 transition-opacity duration-300 ${
          showStepper ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={isError ? onDismiss : undefined}
        role="presentation"
      />
      <div
        className={`fixed right-0 bottom-0 z-30 w-full rounded-t-lg rounded-bl-lg bg-white shadow-md transition-transform duration-300 ease-out md:w-md ${
          showStepper ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="flex flex-col gap-2 px-6 pt-4 pb-6">
          <p className="text-caption text-gray-500">
            {t("pages.borrow.repay-loan-progress.repay-progress")}
          </p>
          <div className="border-t border-gray-200">
            <VerticalStepper steps={steps} />
          </div>
        </div>
        {renderRetry && (
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${
              showRetry ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 *:w-full">
                <Button onClick={onRetry} size="small" variant="primary">
                  {t("pages.borrow.repay-loan-progress.retry")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

type Props = {
  market: MarketData;
  onClose: VoidFunction;
};

export function RepayLoanForm({ market, onClose }: Props) {
  const { t } = useTranslation();
  const ethereumChain = useMainnet();
  const { address } = useAccount();

  const [repayInput, onRepayChange] = useAmount();
  const [flowStatus, setFlowStatus] = useState<RepayFlowStatus>("idle");
  const [showToast, setShowToast] = useState(false);
  const [startedWithApproval, setStartedWithApproval] = useState(false);

  const isActive = flowStatus !== "idle";
  const isError =
    flowStatus === "approve-error" || flowStatus === "repay-error";
  const { show: showStepper } = useAnimatedVisibility(isActive);

  useCloseOnSuccess({
    onClose,
    success: flowStatus === "repaid",
  });

  const { collateralToken, loanToken, marketId } = market;

  const repayAmountBigInt = parseTokenUnits(repayInput, loanToken);

  const { data: loanBalance, status: loanTokenBalanceStatus } = useTokenBalance(
    {
      address: loanToken.address,
      chainId: loanToken.chainId,
    },
  );

  const { data: nativeBalanceData } = useNativeBalance(ethereumChain.id);

  const { data: needsApproval } = useNeedsApproval({
    amount: repayAmountBigInt,
    spender: getChainAddresses(ethereumChain.id).morpho,
    token: loanToken,
  });

  const { data: positionInfo } = usePositionInfo(marketId);

  const { data: morphoMarket } = useMorphoMarket(marketId);

  const currentBorrowAssets =
    positionInfo && morphoMarket
      ? morphoMarket.toBorrowAssets(positionInfo.borrowShares)
      : undefined;

  const networkFee = useTotalRepayFees({
    amount: repayAmountBigInt,
    approveAmount: undefined,
    marketId,
    token: loanToken,
  });

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "borrow",
      text: t("pages.borrow.activity.repay-text", {
        amount: repayInput,
        symbol: loanToken.symbol,
      }),
      title: `${t("nav.borrow")} · ${t("pages.borrow.activity.repay-title", { symbol: loanToken.symbol })}`,
    });

  const repayMutation = useRepayAssets({
    marketId,
    onEmitter(emitter) {
      emitter.on("user-signed-approval", () => setFlowStatus("approving"));
      emitter.on("approve-transaction-succeeded", () =>
        setFlowStatus("approved"),
      );
      emitter.on("approve-transaction-reverted", () =>
        setFlowStatus("approve-error"),
      );
      emitter.on("user-signing-approval-error", () =>
        setFlowStatus("approve-error"),
      );
      emitter.on("pre-repay-assets", () => setFlowStatus("repay-ready"));
      emitter.on("user-signed-repay-assets", function (hash) {
        onTransactionHash(hash);
        onPending();
        setFlowStatus("repaying");
      });
      emitter.on("repay-assets-transaction-succeeded", function () {
        onCompleted();
        setFlowStatus("repaid");
        setShowToast(true);
      });
      emitter.on("repay-assets-transaction-reverted", function () {
        onFailed();
        setFlowStatus("repay-error");
      });
      emitter.on("repay-assets-failed", function () {
        onFailed();
        setFlowStatus("repay-error");
      });
      emitter.on("repay-assets-failed-validation", function () {
        onFailed();
        setFlowStatus("repay-error");
      });
      emitter.on("user-signing-repay-assets-error", function () {
        onFailed();
        setFlowStatus("repay-error");
      });
      emitter.on("unexpected-error", function () {
        onFailed();
        setFlowStatus("repay-error");
      });
    },
    repayAmount: repayAmountBigInt,
  });

  const nativeBalance = nativeBalanceData?.value;

  const sufficientGas = hasSufficientGas(nativeBalance);

  const inputError = getInputError({
    currentBorrowAssets,
    loanBalance,
    repayAmount: repayAmountBigInt,
  });

  const { current, updated } = useRepayReview({
    borrowApy: market.borrowApy,
    collateralToken,
    frozen: isActive,
    loanToken,
    position: positionInfo,
    repayInput,
  });

  const handleRetry = function () {
    setFlowStatus(startedWithApproval ? "approving" : "repay-ready");
    repayMutation.mutate();
  };

  const steps: Step[] = [];
  if (flowStatus !== "idle") {
    if (startedWithApproval) {
      steps.push({
        description: t("pages.borrow.repay-loan-progress.approve-description"),
        status: getApproveStepStatus(flowStatus),
        title: t("pages.borrow.repay-loan-progress.approve-title"),
      });
    }
    steps.push({
      description: t("pages.borrow.repay-loan-progress.repay-description"),
      status: getRepayStepStatus(flowStatus),
      title: t("pages.borrow.repay-loan-progress.repay-title"),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inputError && sufficientGas) {
      setStartedWithApproval(!!needsApproval);
      setFlowStatus(needsApproval ? "approving" : "repay-ready");
      repayMutation.mutate();
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <form className="flex flex-col bg-white" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1 border-t border-gray-200 p-6">
          <TokenInput
            balance={
              <Balance
                label={t("pages.swap.form.balance")}
                value={
                  <RenderCryptoValue
                    status={loanTokenBalanceStatus}
                    token={loanToken}
                    value={loanBalance}
                  />
                }
              />
            }
            fiatValue={
              <RenderFiatValue token={loanToken} value={repayAmountBigInt} />
            }
            label={t("pages.borrow.repay-loan-progress.you-will-repay")}
            onChange={onRepayChange}
            tokenSelector={<TokenSelectorReadOnly {...loanToken} />}
            value={repayInput}
          />
        </div>
        <div className="border-y border-gray-200 bg-gray-50 px-6 py-3 *:w-full">
          <SubmitButton
            address={address}
            balancesLoaded={
              nativeBalance !== undefined && loanBalance !== undefined
            }
            inputError={inputError}
            sufficientGas={sufficientGas}
          />
        </div>
        <CollapsibleSection show={repayAmountBigInt !== 0n}>
          <DrawerFeesContainer>
            <NetworkFees
              label={<OracleLabel oracle={market.oracle} />}
              networkFee={networkFee}
            />
          </DrawerFeesContainer>
        </CollapsibleSection>
        <DrawerFeesContainer>
          <PositionReview
            borrowApy={market.borrowApy}
            collateralToken={collateralToken}
            current={current}
            lltv={formatLtvAsPercentage(market.lltv)}
            loanToken={loanToken}
            updated={inputError ? null : updated}
          />
        </DrawerFeesContainer>
      </form>
      <StepperOverlay
        isError={isError}
        onDismiss={() => setFlowStatus("idle")}
        onRetry={handleRetry}
        showStepper={showStepper}
        steps={steps}
      />
      {showToast && (
        <Toast
          closable
          description={t("pages.borrow.repay-loan-progress.toast-description", {
            amount: formatNumber(repayInput),
            symbol: loanToken.symbol,
          })}
          onClose={() => setShowToast(false)}
          title={t("pages.borrow.repay-loan-progress.toast-title")}
        />
      )}
    </div>
  );
}

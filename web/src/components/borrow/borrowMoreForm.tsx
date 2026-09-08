import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { Button } from "components/base/button";
import { RenderCryptoValue } from "components/base/cryptoValue";
import { RenderFiatValue } from "components/base/fiatValue";
import { MaxButton } from "components/base/maxButton";
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
import { useBorrowMoreAssets } from "hooks/borrow/useBorrowMoreAssets";
import { useTotalBorrowMoreFees } from "hooks/borrow/useBorrowMoreFees";
import { useBorrowMoreReview } from "hooks/borrow/useBorrowMoreReview";
import type { MarketData } from "hooks/borrow/useMarketData";
import { useMorphoMarket } from "hooks/borrow/useMorphoMarket";
import { usePositionInfo } from "hooks/borrow/usePositionInfo";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useAmount } from "hooks/useAmount";
import { useAnimatedVisibility } from "hooks/useAnimatedVisibility";
import { useCloseOnSuccess } from "hooks/useCloseOnSuccess";
import { useMainnet } from "hooks/useMainnet";
import { type FormEvent, useState } from "react";
import { useTranslation } from "react-i18next";
import { maxBigInt, minBigInt } from "utils/bigint";
import { formatLtvAsPercentage } from "utils/borrowReview";
import { formatNumber } from "utils/format";
import { isGeoRestricted } from "utils/geoRestriction";
import { parseTokenUnits } from "utils/token";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import { PositionReview } from "./positionReview";

type BorrowMoreFlowStatus =
  | "borrow-error"
  | "borrow-ready"
  | "borrowed"
  | "borrowing"
  | "idle";

const getBorrowStepStatus = function (
  status: Exclude<BorrowMoreFlowStatus, "idle">,
): Step["status"] {
  const exceptions: Partial<
    Record<Exclude<BorrowMoreFlowStatus, "idle">, Step["status"]>
  > = {
    "borrow-error": stepStatus.failed,
    "borrow-ready": stepStatus.ready,
    borrowing: stepStatus.progress,
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
      {t("pages.borrow.borrow-more-progress.submit")}
    </Button>
  );
}

function getInputError({
  borrowAmount,
  liquidity,
  maxBorrowable,
}: {
  borrowAmount: bigint;
  liquidity: bigint;
  maxBorrowable: bigint | undefined;
}) {
  if (borrowAmount === 0n) {
    return "enter-amount" as const;
  }
  if (borrowAmount > liquidity) {
    return "insufficient-liquidity" as const;
  }
  if (maxBorrowable !== undefined && borrowAmount > maxBorrowable) {
    return "insufficient-collateral" as const;
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
            {t("pages.borrow.borrow-more-progress.borrow-progress")}
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
                  {t("pages.borrow.borrow-more-progress.retry")}
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

export function BorrowMoreForm({ market, onClose }: Props) {
  const { t } = useTranslation();
  const ethereumChain = useMainnet();
  const { address } = useAccount();

  const [borrowInput, onBorrowChange] = useAmount();
  const [flowStatus, setFlowStatus] = useState<BorrowMoreFlowStatus>("idle");
  const [showToast, setShowToast] = useState(false);

  const isActive = flowStatus !== "idle";
  const isError = flowStatus === "borrow-error";
  const { show: showStepper } = useAnimatedVisibility(isActive);

  useCloseOnSuccess({
    onClose,
    success: flowStatus === "borrowed",
  });

  const { collateralToken, loanToken, marketId } = market;

  const borrowAmountBigInt = parseTokenUnits(borrowInput, loanToken);

  const { data: nativeBalanceData } = useNativeBalance(ethereumChain.id);

  const { data: positionInfo } = usePositionInfo(marketId);

  const { data: morphoMarket, status: morphoMarketStatus } =
    useMorphoMarket(marketId);

  const currentBorrowAssets =
    positionInfo && morphoMarket
      ? morphoMarket.toBorrowAssets(positionInfo.borrowShares)
      : undefined;

  const maxBorrowFromCollateral =
    positionInfo && morphoMarket
      ? morphoMarket.getMaxBorrowAssets(positionInfo.collateral)
      : undefined;

  const getMaxBorrowable = function () {
    if (maxBorrowFromCollateral === undefined) {
      return undefined;
    }
    const remaining = maxBigInt(
      maxBorrowFromCollateral - (currentBorrowAssets ?? 0n),
      0n,
    );
    return minBigInt(remaining, market.liquidity);
  };

  const maxBorrowable = getMaxBorrowable();

  const networkFee = useTotalBorrowMoreFees({
    amount: borrowAmountBigInt,
    marketId,
  });

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "borrow",
      text: t("pages.borrow.activity.borrow-more-text", {
        amount: borrowInput,
        symbol: loanToken.symbol,
      }),
      title: `${t("nav.borrow")} · ${t("pages.borrow.activity.borrow-more-title", { symbol: loanToken.symbol })}`,
    });

  const borrowMutation = useBorrowMoreAssets({
    borrowAmount: borrowAmountBigInt,
    marketId,
    onEmitter(emitter) {
      emitter.on("pre-borrow-assets", () => setFlowStatus("borrow-ready"));
      emitter.on("user-signed-borrow-assets", function (hash) {
        onTransactionHash(hash);
        onPending();
        setFlowStatus("borrowing");
      });
      emitter.on("borrow-assets-transaction-succeeded", function () {
        onCompleted();
        setFlowStatus("borrowed");
        setShowToast(true);
      });
      emitter.on("borrow-assets-transaction-reverted", function () {
        onFailed();
        setFlowStatus("borrow-error");
      });
      emitter.on("borrow-assets-failed", function () {
        onFailed();
        setFlowStatus("borrow-error");
      });
      emitter.on("borrow-assets-failed-validation", function () {
        onFailed();
        setFlowStatus("borrow-error");
      });
      emitter.on("user-signing-borrow-assets-error", function () {
        onFailed();
        setFlowStatus("borrow-error");
      });
      emitter.on("unexpected-error", function () {
        onFailed();
        setFlowStatus("borrow-error");
      });
    },
  });

  const nativeBalance = nativeBalanceData?.value;

  const sufficientGas = hasSufficientGas(nativeBalance);

  const inputError = getInputError({
    borrowAmount: borrowAmountBigInt,
    liquidity: market.liquidity,
    maxBorrowable,
  });

  const { current, updated } = useBorrowMoreReview({
    borrowApy: market.borrowApy,
    borrowInput,
    collateralToken,
    frozen: isActive,
    loanToken,
    position: positionInfo,
  });

  const handleRetry = function () {
    setFlowStatus("borrow-ready");
    borrowMutation.mutate();
  };

  const steps: Step[] = [];
  if (flowStatus !== "idle") {
    steps.push({
      description: t("pages.borrow.borrow-more-progress.borrow-description"),
      status: getBorrowStepStatus(flowStatus),
      title: t("pages.borrow.borrow-more-progress.borrow-title"),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inputError && sufficientGas) {
      setFlowStatus("borrow-ready");
      borrowMutation.mutate();
    }
  }

  return (
    <div className="flex flex-1 flex-col overflow-y-auto">
      <form className="flex flex-col bg-white" onSubmit={handleSubmit}>
        <div className="flex flex-col gap-1 border-t border-gray-200 p-6">
          <TokenInput
            balance={
              <Balance
                label={t("pages.borrow.max-available")}
                value={
                  <RenderCryptoValue
                    status={morphoMarketStatus}
                    token={loanToken}
                    value={maxBorrowable}
                  />
                }
              />
            }
            fiatValue={
              <RenderFiatValue token={loanToken} value={borrowAmountBigInt} />
            }
            label={t("pages.borrow.borrow-more-progress.you-will-borrow")}
            maxButton={
              <MaxButton
                disabled={maxBorrowable === undefined}
                onClick={() =>
                  onBorrowChange(
                    formatUnits(maxBorrowable!, loanToken.decimals),
                  )
                }
              />
            }
            onChange={onBorrowChange}
            tokenSelector={<TokenSelectorReadOnly {...loanToken} />}
            value={borrowInput}
          />
        </div>
        <div className="border-y border-gray-200 bg-gray-50 px-6 py-3 *:w-full">
          <SubmitButton
            address={address}
            balancesLoaded={nativeBalance !== undefined}
            inputError={inputError}
            sufficientGas={sufficientGas}
          />
        </div>
        <CollapsibleSection show={borrowAmountBigInt !== 0n}>
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
          description={t("pages.borrow.toast.description", {
            amount: formatNumber(borrowInput),
            symbol: loanToken.symbol,
          })}
          onClose={() => setShowToast(false)}
          title={t("pages.borrow.toast.title")}
        />
      )}
    </div>
  );
}

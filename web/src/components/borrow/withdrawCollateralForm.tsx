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
import type { MarketData } from "hooks/borrow/useMarketData";
import { usePositionInfo } from "hooks/borrow/usePositionInfo";
import { useWithdrawCollateral } from "hooks/borrow/useWithdrawCollateral";
import { useTotalWithdrawCollateralFees } from "hooks/borrow/useWithdrawCollateralFees";
import { useWithdrawCollateralReview } from "hooks/borrow/useWithdrawCollateralReview";
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
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import { PositionReview } from "./positionReview";

type WithdrawCollateralFlowStatus =
  | "idle"
  | "withdraw-error"
  | "withdraw-ready"
  | "withdrawing"
  | "withdrawn";

const getWithdrawStepStatus = function (
  status: Exclude<WithdrawCollateralFlowStatus, "idle">,
): Step["status"] {
  const exceptions: Partial<
    Record<Exclude<WithdrawCollateralFlowStatus, "idle">, Step["status"]>
  > = {
    "withdraw-error": stepStatus.failed,
    "withdraw-ready": stepStatus.ready,
    withdrawing: stepStatus.progress,
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
      {t("pages.borrow.withdraw-collateral-progress.submit")}
    </Button>
  );
}

function getInputError({
  collateralAmount,
  maxWithdrawable,
}: {
  collateralAmount: bigint;
  maxWithdrawable: bigint | undefined;
}) {
  if (collateralAmount === 0n) {
    return "enter-amount" as const;
  }
  if (maxWithdrawable !== undefined && collateralAmount > maxWithdrawable) {
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
            {t("pages.borrow.withdraw-collateral-progress.withdraw-progress")}
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
                  {t("pages.borrow.withdraw-collateral-progress.retry")}
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

export function WithdrawCollateralForm({ market, onClose }: Props) {
  const { t } = useTranslation();
  const ethereumChain = useMainnet();
  const { address } = useAccount();

  const [collateralInput, onCollateralChange] = useAmount();
  const [flowStatus, setFlowStatus] =
    useState<WithdrawCollateralFlowStatus>("idle");
  const [showToast, setShowToast] = useState(false);

  const isActive = flowStatus !== "idle";
  const isError = flowStatus === "withdraw-error";
  const { show: showStepper } = useAnimatedVisibility(isActive);

  useCloseOnSuccess({
    onClose,
    success: flowStatus === "withdrawn",
  });

  const { collateralToken, loanToken, marketId } = market;

  const collateralAmountBigInt = parseTokenUnits(
    collateralInput,
    collateralToken,
  );

  const { data: nativeBalanceData } = useNativeBalance(ethereumChain.id);

  const { data: positionInfo, status: positionInfoStatus } =
    usePositionInfo(marketId);

  const maxWithdrawable = positionInfo?.withdrawableCollateral;

  const networkFee = useTotalWithdrawCollateralFees({
    amount: collateralAmountBigInt,
    marketId,
  });

  const withdrawMutation = useWithdrawCollateral({
    collateralAmount: collateralAmountBigInt,
    marketId,
    onEmitter(emitter) {
      emitter.on("pre-withdraw-collateral", () =>
        setFlowStatus("withdraw-ready"),
      );
      emitter.on("user-signed-withdraw-collateral", () =>
        setFlowStatus("withdrawing"),
      );
      emitter.on("withdraw-collateral-transaction-succeeded", function () {
        setFlowStatus("withdrawn");
        setShowToast(true);
      });
      emitter.on("withdraw-collateral-transaction-reverted", () =>
        setFlowStatus("withdraw-error"),
      );
      emitter.on("withdraw-collateral-failed", () =>
        setFlowStatus("withdraw-error"),
      );
      emitter.on("withdraw-collateral-failed-validation", () =>
        setFlowStatus("withdraw-error"),
      );
      emitter.on("user-signing-withdraw-collateral-error", () =>
        setFlowStatus("withdraw-error"),
      );
      emitter.on("unexpected-error", () => setFlowStatus("withdraw-error"));
    },
  });

  const nativeBalance = nativeBalanceData?.value;

  const sufficientGas = hasSufficientGas(nativeBalance);

  const inputError = getInputError({
    collateralAmount: collateralAmountBigInt,
    maxWithdrawable,
  });

  const { current, updated } = useWithdrawCollateralReview({
    borrowApy: market.borrowApy,
    collateralInput,
    collateralToken,
    frozen: isActive,
    loanToken,
    position: positionInfo,
  });

  const handleRetry = function () {
    setFlowStatus("withdraw-ready");
    withdrawMutation.mutate();
  };

  const steps: Step[] = [];
  if (flowStatus !== "idle") {
    steps.push({
      description: t(
        "pages.borrow.withdraw-collateral-progress.withdraw-description",
      ),
      status: getWithdrawStepStatus(flowStatus),
      title: t("pages.borrow.withdraw-collateral-progress.withdraw-title"),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inputError && sufficientGas) {
      setFlowStatus("withdraw-ready");
      withdrawMutation.mutate();
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
                    status={positionInfoStatus}
                    token={collateralToken}
                    value={maxWithdrawable}
                  />
                }
              />
            }
            fiatValue={
              <RenderFiatValue
                token={collateralToken}
                value={collateralAmountBigInt}
              />
            }
            label={t(
              "pages.borrow.withdraw-collateral-progress.you-will-withdraw",
            )}
            maxButton={
              <MaxButton
                disabled={maxWithdrawable === undefined}
                onClick={() =>
                  onCollateralChange(
                    formatUnits(maxWithdrawable!, collateralToken.decimals),
                  )
                }
              />
            }
            onChange={onCollateralChange}
            tokenSelector={<TokenSelectorReadOnly {...collateralToken} />}
            value={collateralInput}
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
        <CollapsibleSection show={collateralAmountBigInt !== 0n}>
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
          description={t(
            "pages.borrow.withdraw-collateral-progress.toast-description",
            {
              amount: formatNumber(collateralInput),
              symbol: collateralToken.symbol,
            },
          )}
          onClose={() => setShowToast(false)}
          title={t("pages.borrow.withdraw-collateral-progress.toast-title")}
        />
      )}
    </div>
  );
}

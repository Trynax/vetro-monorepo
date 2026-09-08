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
import { SetMaxErc20Balance } from "components/setMaxErc20Balance";
import { TokenInput } from "components/tokenInput";
import { Balance } from "components/tokenInput/balance";
import type { InputError } from "components/tokenInput/utils";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import type { MarketData } from "hooks/borrow/useMarketData";
import { usePositionInfo } from "hooks/borrow/usePositionInfo";
import { useSupplyCollateral } from "hooks/borrow/useSupplyCollateral";
import { useTotalSupplyCollateralFees } from "hooks/borrow/useSupplyCollateralFees";
import { useSupplyCollateralReview } from "hooks/borrow/useSupplyCollateralReview";
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

type SupplyCollateralFlowStatus =
  | "approve-error"
  | "approved"
  | "approving"
  | "idle"
  | "supply-collateral-error"
  | "supply-collateral-ready"
  | "supplied-collateral"
  | "supplying-collateral";

const getApproveStepStatus = function (
  status: Exclude<SupplyCollateralFlowStatus, "idle">,
): Step["status"] {
  const exceptions: Partial<
    Record<Exclude<SupplyCollateralFlowStatus, "idle">, Step["status"]>
  > = {
    "approve-error": stepStatus.failed,
    approving: stepStatus.progress,
  };
  return exceptions[status] ?? stepStatus.completed;
};

const getSupplyStepStatus = function (
  status: Exclude<SupplyCollateralFlowStatus, "idle">,
): Step["status"] {
  const exceptions: Partial<
    Record<Exclude<SupplyCollateralFlowStatus, "idle">, Step["status"]>
  > = {
    "approve-error": stepStatus.notReady,
    approved: stepStatus.notReady,
    approving: stepStatus.notReady,
    "supply-collateral-error": stepStatus.failed,
    "supply-collateral-ready": stepStatus.ready,
    "supplying-collateral": stepStatus.progress,
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
      {t("pages.borrow.supply-collateral-progress.submit")}
    </Button>
  );
}

function getInputError({
  collateralAmount,
  collateralBalance,
}: {
  collateralAmount: bigint;
  collateralBalance: bigint | undefined;
}) {
  if (collateralAmount === 0n) {
    return "enter-amount" as const;
  }
  if (collateralBalance !== undefined && collateralAmount > collateralBalance) {
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
            {t("pages.borrow.supply-collateral-progress.supply-progress")}
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
                  {t("pages.borrow.supply-collateral-progress.retry")}
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

export function SupplyCollateralForm({ market, onClose }: Props) {
  const { t } = useTranslation();
  const ethereumChain = useMainnet();
  const { address } = useAccount();

  const [collateralInput, onCollateralChange] = useAmount();
  const [flowStatus, setFlowStatus] =
    useState<SupplyCollateralFlowStatus>("idle");
  const [showToast, setShowToast] = useState(false);
  const [startedWithApproval, setStartedWithApproval] = useState(false);

  const isActive = flowStatus !== "idle";
  const isError =
    flowStatus === "approve-error" || flowStatus === "supply-collateral-error";
  const { show: showStepper } = useAnimatedVisibility(isActive);

  useCloseOnSuccess({
    onClose,
    success: flowStatus === "supplied-collateral",
  });

  const { collateralToken, loanToken, marketId } = market;

  const collateralAmountBigInt = parseTokenUnits(
    collateralInput,
    collateralToken,
  );

  const { data: collateralBalance, status: balanceStatus } = useTokenBalance({
    address: collateralToken.address,
    chainId: collateralToken.chainId,
  });

  const { data: nativeBalanceData } = useNativeBalance(ethereumChain.id);

  const { data: needsApproval } = useNeedsApproval({
    amount: collateralAmountBigInt,
    spender: getChainAddresses(ethereumChain.id).morpho,
    token: collateralToken,
  });

  const { data: positionInfo } = usePositionInfo(marketId);

  const networkFee = useTotalSupplyCollateralFees({
    amount: collateralAmountBigInt,
    approveAmount: undefined,
    marketId,
    token: collateralToken,
  });

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "borrow",
      text: t("pages.borrow.activity.supply-text", {
        amount: collateralInput,
        symbol: collateralToken.symbol,
      }),
      title: `${t("nav.borrow")} · ${t("pages.borrow.activity.supply-title", { collateralSymbol: collateralToken.symbol, loanSymbol: loanToken.symbol })}`,
    });

  const supplyMutation = useSupplyCollateral({
    collateralAmount: collateralAmountBigInt,
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
      emitter.on("pre-supply-collateral", () =>
        setFlowStatus("supply-collateral-ready"),
      );
      emitter.on("user-signed-supply-collateral", function (hash) {
        onTransactionHash(hash);
        onPending();
        setFlowStatus("supplying-collateral");
      });
      emitter.on("supply-collateral-transaction-succeeded", function () {
        onCompleted();
        setFlowStatus("supplied-collateral");
        setShowToast(true);
      });
      emitter.on("supply-collateral-transaction-reverted", function () {
        onFailed();
        setFlowStatus("supply-collateral-error");
      });
      emitter.on("supply-collateral-failed", function () {
        onFailed();
        setFlowStatus("supply-collateral-error");
      });
      emitter.on("supply-collateral-failed-validation", function () {
        onFailed();
        setFlowStatus("supply-collateral-error");
      });
      emitter.on("user-signing-supply-collateral-error", function () {
        onFailed();
        setFlowStatus("supply-collateral-error");
      });
      emitter.on("unexpected-error", function () {
        onFailed();
        setFlowStatus("supply-collateral-error");
      });
    },
  });

  const nativeBalance = nativeBalanceData?.value;

  const sufficientGas = hasSufficientGas(nativeBalance);

  const inputError = getInputError({
    collateralAmount: collateralAmountBigInt,
    collateralBalance,
  });

  const { current, updated } = useSupplyCollateralReview({
    borrowApy: market.borrowApy,
    collateralInput,
    collateralToken,
    frozen: isActive,
    loanToken,
    position: positionInfo,
  });

  const handleRetry = function () {
    setFlowStatus(
      startedWithApproval ? "approving" : "supply-collateral-ready",
    );
    supplyMutation.mutate();
  };

  const steps: Step[] = [];
  if (flowStatus !== "idle") {
    if (startedWithApproval) {
      steps.push({
        description: t(
          "pages.borrow.supply-collateral-progress.approve-description",
        ),
        status: getApproveStepStatus(flowStatus),
        title: t("pages.borrow.supply-collateral-progress.approve-title"),
      });
    }
    steps.push({
      description: t(
        "pages.borrow.supply-collateral-progress.supply-description",
      ),
      status: getSupplyStepStatus(flowStatus),
      title: t("pages.borrow.supply-collateral-progress.supply-title"),
    });
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inputError && sufficientGas) {
      setStartedWithApproval(!!needsApproval);
      setFlowStatus(needsApproval ? "approving" : "supply-collateral-ready");
      supplyMutation.mutate();
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
                    status={balanceStatus}
                    token={collateralToken}
                    value={collateralBalance}
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
            label={t("pages.borrow.supply-collateral-progress.you-will-supply")}
            maxButton={
              <SetMaxErc20Balance
                onClick={onCollateralChange}
                token={collateralToken}
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
            balancesLoaded={
              nativeBalance !== undefined && collateralBalance !== undefined
            }
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
            "pages.borrow.supply-collateral-progress.toast-description",
            {
              amount: formatNumber(collateralInput),
              symbol: collateralToken.symbol,
            },
          )}
          onClose={() => setShowToast(false)}
          title={t("pages.borrow.supply-collateral-progress.toast-title")}
        />
      )}
    </div>
  );
}

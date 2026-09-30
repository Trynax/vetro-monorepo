import { Button } from "components/base/button";
import { DrawerTitle } from "components/base/drawer/drawerTitle";
import { RenderFiatValue } from "components/base/fiatValue";
import { MaxButton } from "components/base/maxButton";
import { Spinner } from "components/base/spinner";
import { type Step, VerticalStepper } from "components/base/verticalStepper";
import { DrawerFeesContainer } from "components/feesContainer";
import { ExclamationTriangleIcon } from "components/icons/exclamationTriangleIcon";
import { TokenDropdown } from "components/tokenDropdown";
import { TokenInput } from "components/tokenInput";
import { Balance } from "components/tokenInput/balance";
import { TokenBalance } from "components/tokenInput/tokenBalance";
import type { InputError } from "components/tokenInput/utils";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import { useTokenConfig } from "hooks/useTokenConfig";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { isGeoRestricted } from "utils/geoRestriction";
import { formatAmount } from "utils/token";
import type { Address } from "viem";

import { OutputLabel, type UnitPreview } from "./outputLabel";
import { SwapFees } from "./swapFees";
import type { ClaimRedeemFlowStatus } from "./types";

type Props = {
  amountBigInt: bigint;
  amountLocked: bigint;
  flowStatus: ClaimRedeemFlowStatus;
  fromAmount: string;
  fromToken: TokenWithGateway;
  inputError: InputError | undefined;
  isLoading: boolean;
  isPreviewError: boolean;
  onInputChange: (value: string) => void;
  onMaxClick: VoidFunction;
  onRetry?: VoidFunction;
  onSubmit: VoidFunction;
  onTokenChange: (token: TokenWithGateway) => void;
  oracleToken: Address;
  outputBigInt: bigint | undefined;
  outputValue: string;
  slippageControl: ReactNode;
  steps: Step[];
  toToken: TokenWithGateway;
  unitPreview: UnitPreview;
  whitelistedTokens: TokenWithGateway[];
} & Pick<
  ComponentProps<typeof SwapFees>,
  "networkFee" | "protocolFee" | "totalFees"
>;

const isFlowInProgress = (flowStatus: ClaimRedeemFlowStatus) =>
  flowStatus !== "idle" &&
  flowStatus !== "redeem-ready" &&
  flowStatus !== "redeem-error";

function SubmitLabel({
  geoRestricted,
  inputError,
  isActiveError,
  isLoading,
  isPaused,
  isPreviewError,
  renderRetry,
}: {
  geoRestricted: boolean;
  inputError: InputError | undefined;
  isActiveError: boolean;
  isLoading: boolean;
  isPaused: boolean;
  isPreviewError: boolean;
  renderRetry: boolean;
}) {
  const { t } = useTranslation();

  if (geoRestricted) {
    return (
      <>
        <ExclamationTriangleIcon />
        {t("common.geo-restriction-title")}
      </>
    );
  }
  if (isPaused) {
    return t("pages.swap.redeem-queue.redeems-paused-for-token");
  }
  if (inputError) {
    return t(`common.${inputError}`);
  }
  if (isActiveError) {
    return t("pages.swap.form.token-status-error");
  }
  if (isPreviewError) {
    return t("pages.swap.form.preview-error");
  }
  if (isLoading) {
    return <Spinner />;
  }
  if (renderRetry) {
    return t("pages.swap.progress.retry");
  }
  return t("pages.swap.redeem-queue.redeem");
}

export function ClaimRedeemProgressDrawer({
  amountBigInt,
  amountLocked,
  flowStatus,
  fromAmount,
  fromToken,
  inputError,
  isLoading,
  isPreviewError,
  networkFee,
  onInputChange,
  onMaxClick,
  onRetry,
  onSubmit,
  onTokenChange,
  oracleToken,
  outputBigInt,
  outputValue,
  protocolFee,
  slippageControl,
  steps,
  totalFees,
  toToken,
  unitPreview,
  whitelistedTokens,
}: Props) {
  const { t } = useTranslation();

  const { data: tokenConfig, isError: isTokenConfigError } = useTokenConfig({
    gatewayAddress: fromToken.gatewayAddress,
    token: toToken.address,
  });

  const geoRestricted = isGeoRestricted();
  const isPaused = tokenConfig?.withdrawActive === false;
  const renderRetry = flowStatus === "redeem-error";
  const isDataLoaded =
    !isLoading && tokenConfig !== undefined && outputBigInt !== undefined;
  const isDisabled =
    geoRestricted ||
    isPaused ||
    !isDataLoaded ||
    !!inputError ||
    isPreviewError ||
    isFlowInProgress(flowStatus);

  return (
    <div className="flex h-full flex-col">
      <DrawerTitle>
        {t("pages.swap.redeem-queue.drawer-title", {
          symbol: fromToken.symbol,
        })}
      </DrawerTitle>
      <div className="flex flex-col gap-1 border-t border-gray-200 p-6">
        <TokenInput
          balance={
            <Balance
              label={t("pages.swap.redeem-queue.available-to-redeem")}
              value={formatAmount({
                amount: amountLocked,
                decimals: fromToken.decimals,
                isError: false,
              })}
            />
          }
          fiatValue={<RenderFiatValue token={fromToken} value={amountBigInt} />}
          headerAction={slippageControl}
          label={t("pages.swap.redeem-queue.enter-amount-to-redeem")}
          maxButton={<MaxButton onClick={onMaxClick} />}
          onChange={onInputChange}
          tokenSelector={<TokenSelectorReadOnly {...fromToken} />}
          value={fromAmount}
        />
        <TokenInput
          balance={<TokenBalance token={toToken} />}
          disabled
          fiatValue={<RenderFiatValue token={toToken} value={outputBigInt} />}
          label={t("pages.swap.form.you-will-receive-estimated")}
          tokenSelector={
            <TokenDropdown
              onChange={onTokenChange}
              tokens={whitelistedTokens}
              value={toToken}
            />
          }
          value={outputValue}
        />
      </div>
      <div className="border-y border-gray-200 bg-gray-50 px-6 py-3 *:w-full">
        <Button
          disabled={isDisabled}
          onClick={renderRetry ? onRetry : onSubmit}
          size="small"
          variant="primary"
        >
          <SubmitLabel
            geoRestricted={geoRestricted}
            inputError={inputError}
            isActiveError={isTokenConfigError}
            isLoading={!isDataLoaded}
            isPaused={isPaused}
            isPreviewError={isPreviewError}
            renderRetry={renderRetry}
          />
        </Button>
      </div>
      <DrawerFeesContainer>
        <SwapFees
          fromToken={fromToken}
          networkFee={networkFee}
          outputLabel={
            <OutputLabel
              fromToken={fromToken}
              oracleToken={oracleToken}
              toToken={toToken}
              unitPreview={unitPreview}
            />
          }
          protocolFee={protocolFee}
          totalFees={totalFees}
        />
      </DrawerFeesContainer>
      {steps.length > 0 && (
        <div className="mt-auto flex flex-col gap-2 px-6 pb-6">
          <p className="text-[11px] leading-4 font-medium tracking-wide text-gray-500">
            {t("pages.swap.progress.swap-progress")}
          </p>
          <div className="border-t border-gray-200">
            <VerticalStepper steps={steps} />
          </div>
        </div>
      )}
    </div>
  );
}

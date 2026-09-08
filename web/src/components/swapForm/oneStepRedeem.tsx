import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useNeedsApproval } from "@hemilabs/react-hooks/useNeedsApproval";
import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import type { FetchStatus, QueryStatus } from "@tanstack/react-query";
import { ApproveSection } from "components/approveSection";
import { RenderFiatValue } from "components/base/fiatValue";
import { Toast } from "components/base/toast";
import { FormSection, FormSectionItem } from "components/feesContainer";
import { SetMaxErc20Balance } from "components/setMaxErc20Balance";
import { TokenDropdown } from "components/tokenDropdown";
import { TokenInput } from "components/tokenInput";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useMainnet } from "hooks/useMainnet";
import { useMaxWithdraw } from "hooks/useMaxWithdraw";
import { usePreviewRedeem } from "hooks/usePreviewRedeem";
import { useRedeem } from "hooks/useRedeem";
import { useRedeemFee } from "hooks/useRedeemFee";
import { useSwapRedeemFees } from "hooks/useSwapRedeemFees";
import { useTokenConfig } from "hooks/useTokenConfig";
import { useTotalRedeemFees } from "hooks/useTotalRedeemFees";
import { type FormEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { applyBps } from "utils/bigint";
import { formatNumber } from "utils/format";
import { getInputError } from "utils/inputError";
import { applySlippage } from "utils/slippage";
import { formatAmount } from "utils/token";
import { isAddressEqual, parseUnits } from "viem";

import { Form } from "./form";
import { OutputLabel } from "./outputLabel";
import { RedeemQueueSection } from "./redeemQueueSection";
import { SlippageSettings } from "./slippageSettings";
import { SubmitButton } from "./submitButton";
import { SwapFees } from "./swapFees";
import { type RedeemFlowStatus, SwapRedeemDrawer } from "./swapRedeemDrawer";
import { ToTokenBalance } from "./toTokenBalance";
import { TreasuryReserves } from "./treasuryReserves";

type Props = {
  amountBigInt: bigint;
  approve10x: boolean;
  approveAmount: bigint | undefined;
  fromInputValue: string;
  fromToken: TokenWithGateway;
  onFromTokenChange: (token: TokenWithGateway) => void;
  onInputChange: (value: string) => void;
  onMaxClick: (maxValue: string) => void;
  onReset: VoidFunction;
  onSlippageChange: (slippage: number) => void;
  onToggle: VoidFunction;
  onTokenChange: (token: TokenWithGateway) => void;
  onToggleApprove10x: VoidFunction;
  peggedTokens: TokenWithGateway[];
  slippage: number;
  toToken: TokenWithGateway;
  whitelistedTokens: TokenWithGateway[];
};

export function OneStepRedeem({
  amountBigInt,
  approve10x,
  approveAmount,
  fromInputValue,
  fromToken,
  onFromTokenChange,
  onInputChange,
  onMaxClick,
  onReset,
  onSlippageChange,
  onToggle,
  onToggleApprove10x,
  onTokenChange,
  peggedTokens,
  slippage,
  toToken,
  whitelistedTokens,
}: Props) {
  const ethereumChain = useMainnet();
  const { t } = useTranslation();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [flowStatus, setFlowStatus] = useState<RedeemFlowStatus>("idle");
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState({
    fromAmount: "",
    fromSymbol: "",
    toAmount: "",
    toSymbol: "",
  });
  const [startedWithApproval, setStartedWithApproval] = useState(false);

  const handleDrawerClose = useCallback(
    function handleDrawerClose() {
      setIsDrawerOpen(false);
      if (flowStatus === "redeemed") {
        onReset();
      }
    },
    [flowStatus, onReset],
  );

  const { data: fromTokenBalance } = useTokenBalance({
    address: fromToken.address,
    chainId: ethereumChain.id,
  });

  const { data: nativeBalanceData } = useNativeBalance(ethereumChain.id);
  const nativeBalance = nativeBalanceData?.value;

  const { data: needsApproval, isError: isNeedsApprovalError } =
    useNeedsApproval({
      amount: amountBigInt,
      spender: fromToken.gatewayAddress,
      token: fromToken,
    });

  const { data: maxWithdraw, isError: isMaxWithdrawError } = useMaxWithdraw({
    gatewayAddress: fromToken.gatewayAddress,
    tokenOut: toToken.address,
  });

  const { data: tokenConfig, isError: isTokenConfigError } = useTokenConfig({
    gatewayAddress: fromToken.gatewayAddress,
    token: toToken.address,
  });

  const { data: redeemPreview, isError: isPreviewError } = usePreviewRedeem({
    gatewayAddress: fromToken.gatewayAddress,
    peggedTokenIn: amountBigInt,
    tokenOut: toToken.address,
  });

  const unitRedeemPreview = usePreviewRedeem({
    gatewayAddress: fromToken.gatewayAddress,
    peggedTokenIn: parseUnits("1", fromToken.decimals),
    tokenOut: toToken.address,
  });

  const outputValue = formatAmount({
    amount: redeemPreview,
    decimals: toToken.decimals,
    isError: isPreviewError,
  });

  const minAmountOut =
    redeemPreview === undefined
      ? undefined
      : applySlippage({ preview: redeemPreview, slippage });

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "swap",
      text: t("pages.swap.activity.swap-text", {
        fromAmount: fromInputValue,
        fromSymbol: fromToken.symbol,
        toAmount: outputValue,
        toSymbol: toToken.symbol,
      }),
      title: t("nav.swap"),
    });

  const redeemMutation = useRedeem({
    approveAmount,
    onEmitter(emitter) {
      const handleFailure = function () {
        onFailed();
        setFlowStatus("redeem-error");
      };

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
      emitter.on("pre-redeem", () => setFlowStatus("redeem-ready"));
      emitter.on("user-signed-redeem", function (hash) {
        onTransactionHash(hash);
        onPending();
        setFlowStatus("redeeming");
      });
      emitter.on("redeem-transaction-succeeded", function () {
        onCompleted();
        setFlowStatus("redeemed");
        setToastData({
          fromAmount: formatNumber(fromInputValue),
          fromSymbol: fromToken.symbol,
          toAmount: formatNumber(outputValue),
          toSymbol: toToken.symbol,
        });
        setShowToast(true);
      });
      emitter.on("redeem-transaction-reverted", handleFailure);
      emitter.on("redeem-failed", handleFailure);
      emitter.on("user-signing-redeem-error", handleFailure);
      emitter.on("redeem-failed-validation", handleFailure);
      emitter.on("unexpected-error", handleFailure);
    },
    peggedToken: fromToken,
    peggedTokenIn: amountBigInt,
    slippage,
    tokenOut: toToken.address,
  });

  const inputError = getInputError({
    amount: amountBigInt,
    maxWithdraw,
    nativeBalance,
    redeemPreview,
    tokenBalance: fromTokenBalance,
  });

  const networkFeeQueryData = useSwapRedeemFees({
    amount: amountBigInt,
    approveAmount,
    fromToken,
    minAmountOut,
    tokenOut: toToken.address,
  });

  const protocolFeeQueryData = useRedeemFee({
    gatewayAddress: fromToken.gatewayAddress,
    select: (fee) => applyBps(amountBigInt, fee),
    token: toToken.address,
  });

  const totalRedeemFeesQueryData = useTotalRedeemFees({
    amount: amountBigInt,
    approveAmount,
    fromToken,
    minAmountOut,
    tokenOut: toToken.address,
  });

  const networkFee = {
    data: networkFeeQueryData.fees,
    fetchStatus: (amountBigInt > 0n ? "fetching" : "idle") as FetchStatus,
    status: (networkFeeQueryData.isError ? "error" : "pending") as QueryStatus,
  };

  const balancesLoaded =
    nativeBalance !== undefined && fromTokenBalance !== undefined;

  const isLoading = () =>
    redeemPreview === undefined ||
    needsApproval === undefined ||
    tokenConfig === undefined ||
    (maxWithdraw === undefined && !isMaxWithdrawError);

  const handleRetry = function () {
    setFlowStatus(startedWithApproval ? "approving" : "redeem-ready");
    redeemMutation.mutate();
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !inputError &&
      needsApproval !== undefined &&
      tokenConfig?.withdrawActive &&
      redeemPreview !== undefined
    ) {
      setStartedWithApproval(!!needsApproval);
      setFlowStatus(needsApproval ? "approving" : "redeem-ready");
      redeemMutation.mutate();
      setIsDrawerOpen(true);
    }
  }

  return (
    <>
      <Form
        amountBigInt={amountBigInt}
        errorKey={balancesLoaded ? inputError : undefined}
        fromInputValue={fromInputValue}
        fromToken={fromToken}
        fromTokenSelector={
          peggedTokens.length > 1 ? (
            <TokenDropdown
              onChange={onFromTokenChange}
              tokens={peggedTokens}
              value={fromToken}
            />
          ) : (
            <TokenSelectorReadOnly
              logoURI={fromToken.logoURI}
              symbol={fromToken.symbol}
            />
          )
        }
        maxButton={
          <SetMaxErc20Balance onClick={onMaxClick} token={fromToken} />
        }
        onInputChange={onInputChange}
        onSubmit={handleSubmit}
        onToggle={onToggle}
        slippageControl={
          <SlippageSettings onChange={onSlippageChange} slippage={slippage} />
        }
        toSection={
          <TokenInput
            balance={<ToTokenBalance token={toToken} />}
            disabled
            fiatValue={
              <RenderFiatValue token={toToken} value={redeemPreview} />
            }
            label={t("pages.swap.form.you-will-receive-estimated")}
            tokenSelector={
              <TokenDropdown
                onChange={onTokenChange}
                tokens={whitelistedTokens.filter((whitelistedToken) =>
                  isAddressEqual(
                    whitelistedToken.gatewayAddress,
                    fromToken.gatewayAddress,
                  ),
                )}
                value={toToken}
              />
            }
            value={outputValue}
          />
        }
      >
        <SubmitButton
          actionText={t("pages.swap.form.redeem")}
          inputError={inputError}
          isActive={tokenConfig?.withdrawActive}
          isActiveError={isTokenConfigError}
          isAllowanceError={isNeedsApprovalError}
          isLoading={isLoading()}
          isPreviewError={isPreviewError}
        />
      </Form>
      <FormSection show={amountBigInt !== 0n}>
        <FormSectionItem>
          <ApproveSection active={approve10x} onToggle={onToggleApprove10x} />
        </FormSectionItem>
        <FormSectionItem>
          <TreasuryReserves gatewayAddress={fromToken.gatewayAddress} />
        </FormSectionItem>
        <SwapFees
          fromToken={fromToken}
          networkFee={networkFee}
          outputLabel={
            <OutputLabel
              fromToken={fromToken}
              oracleToken={toToken.address}
              toToken={toToken}
              unitPreview={unitRedeemPreview}
            />
          }
          protocolFee={protocolFeeQueryData}
          sectionClassName="max-md:px-4 md:px-2"
          totalFees={totalRedeemFeesQueryData}
        />
      </FormSection>
      <RedeemQueueSection
        peggedToken={fromToken}
        showTopBorder={amountBigInt !== 0n}
        whitelistedTokens={whitelistedTokens}
      />
      {isDrawerOpen && flowStatus !== "idle" && (
        <SwapRedeemDrawer
          flowStatus={flowStatus}
          fromAmount={fromInputValue}
          fromToken={fromToken}
          isOutputError={isPreviewError}
          networkFee={networkFee}
          onClose={handleDrawerClose}
          onRetry={handleRetry}
          oracleToken={toToken.address}
          outputAmount={redeemPreview}
          outputValue={outputValue}
          protocolFee={protocolFeeQueryData}
          showApproveStep={startedWithApproval}
          toToken={toToken}
          totalFees={totalRedeemFeesQueryData}
          unitPreview={unitRedeemPreview}
        />
      )}
      {showToast && (
        <Toast
          closable
          description={t(
            "pages.swap.toast.swap-success-description",
            toastData,
          )}
          onClose={() => setShowToast(false)}
          title={t("pages.swap.toast.swap-success-title")}
        />
      )}
    </>
  );
}

import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useNeedsApproval } from "@hemilabs/react-hooks/useNeedsApproval";
import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import type { FetchStatus, QueryStatus } from "@tanstack/react-query";
import { ApproveSection } from "components/approveSection";
import { Button } from "components/base/button";
import { Toast } from "components/base/toast";
import { FormSection, FormSectionItem } from "components/feesContainer";
import { SetMaxErc20Balance } from "components/setMaxErc20Balance";
import { TokenDropdown } from "components/tokenDropdown";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useMainnet } from "hooks/useMainnet";
import { usePreviewRedeem } from "hooks/usePreviewRedeem";
import { useRequestRedeem } from "hooks/useRequestRedeem";
import { useSwapRequestRedeemFees } from "hooks/useSwapRequestRedeemFees";
import { useTotalRequestRedeemFees } from "hooks/useTotalRequestRedeemFees";
import { useWithdrawalDelay } from "hooks/useWithdrawalDelay";
import { type FormEvent, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { formatNumber } from "utils/format";
import { getInputError } from "utils/inputError";
import { getTokenListParams } from "utils/tokenList";
import { isAddressEqual } from "viem";

import { Form } from "./form";
import { RedeemQueueSection } from "./redeemQueueSection";
import { RedeemTutorialModal } from "./redeemTutorialModal";
import { SubmitButton } from "./submitButton";
import { SwapFees } from "./swapFees";
import {
  type RequestRedeemFlowStatus,
  SwapRequestRedeemDrawer,
} from "./swapRequestRedeemDrawer";
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
  onToggle: VoidFunction;
  onTokenChange: (token: TokenWithGateway) => void;
  onToggleApprove10x: VoidFunction;
  peggedTokens: TokenWithGateway[];
  toToken: TokenWithGateway;
  whitelistedTokens: TokenWithGateway[];
};

export function TwoStepRedeem({
  amountBigInt,
  approve10x,
  approveAmount,
  fromInputValue,
  fromToken,
  onFromTokenChange,
  onInputChange,
  onMaxClick,
  onReset,
  onToggle,
  onToggleApprove10x,
  peggedTokens,
  toToken,
  whitelistedTokens,
}: Props) {
  const ethereumChain = useMainnet();
  const { t } = useTranslation();

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);
  const [flowStatus, setFlowStatus] = useState<RequestRedeemFlowStatus>("idle");
  const [showToast, setShowToast] = useState(false);
  const [toastData, setToastData] = useState({ amount: "", symbol: "" });
  const [startedWithApproval, setStartedWithApproval] = useState(false);

  const handleDrawerClose = useCallback(
    function handleDrawerClose() {
      setIsDrawerOpen(false);
      if (flowStatus === "request-redeemed") {
        onReset();
      }
    },
    [flowStatus, onReset],
  );

  const { data: seconds } = useWithdrawalDelay({
    gatewayAddress: fromToken.gatewayAddress,
    select: (data) => Number(data),
  });
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

  const { data: redeemPreview, isError: isPreviewError } = usePreviewRedeem({
    gatewayAddress: fromToken.gatewayAddress,
    peggedTokenIn: amountBigInt,
    tokenOut: toToken.address,
  });

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "swap",
      text: t("pages.swap.activity.request-redeem-text", {
        amount: fromInputValue,
        symbol: fromToken.symbol,
      }),
      title: t("nav.swap"),
    });

  const requestRedeemMutation = useRequestRedeem({
    approveAmount,
    gatewayAddress: fromToken.gatewayAddress,
    onEmitter(emitter) {
      const handleFailure = function () {
        onFailed();
        setFlowStatus("request-redeem-error");
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
      emitter.on("pre-request-redeem", () =>
        setFlowStatus("request-redeem-ready"),
      );
      emitter.on("user-signed-request-redeem", function (hash) {
        onTransactionHash(hash);
        onPending();
        setFlowStatus("request-redeeming");
      });
      emitter.on("request-redeem-transaction-succeeded", function () {
        onCompleted();
        setFlowStatus("request-redeemed");
        setToastData({
          amount: formatNumber(fromInputValue),
          symbol: fromToken.symbol,
        });
        setShowToast(true);
        document
          .getElementById("redeem-queue")
          ?.scrollIntoView({ behavior: "smooth" });
      });
      emitter.on("request-redeem-transaction-reverted", handleFailure);
      emitter.on("request-redeem-failed", handleFailure);
      emitter.on("user-signing-request-redeem-error", handleFailure);
      emitter.on("request-redeem-failed-validation", handleFailure);
      emitter.on("unexpected-error", handleFailure);
    },
    peggedToken: fromToken,
    peggedTokenAmount: amountBigInt,
  });

  const inputError = getInputError({
    amount: amountBigInt,
    nativeBalance,
    tokenBalance: fromTokenBalance,
  });

  const isLoading = () =>
    redeemPreview === undefined || needsApproval === undefined;

  const networkFeeQueryData = useSwapRequestRedeemFees({
    amount: amountBigInt,
    approveAmount,
    fromToken,
  });

  const totalFeesQueryData = useTotalRequestRedeemFees({
    amount: amountBigInt,
    approveAmount,
    fromToken,
  });

  const networkFee = {
    data: networkFeeQueryData.fees,
    fetchStatus: (amountBigInt > 0n ? "fetching" : "idle") as FetchStatus,
    status: (networkFeeQueryData.isError ? "error" : "pending") as QueryStatus,
  };

  const balancesLoaded =
    nativeBalance !== undefined && fromTokenBalance !== undefined;

  const whitelistedTokensForPeggedToken = whitelistedTokens.filter((wt) =>
    isAddressEqual(wt.gatewayAddress, fromToken.gatewayAddress),
  );

  const tokenListParams = getTokenListParams(whitelistedTokensForPeggedToken);

  const redeemableForText = t(
    "pages.swap.form.redeemable-for",
    tokenListParams,
  );

  const queueInfoText = t("pages.swap.form.queue-info", {
    ...tokenListParams,
    peggedToken: fromToken.symbol,
    seconds,
  });

  const handleRetry = function () {
    setFlowStatus(startedWithApproval ? "approving" : "request-redeem-ready");
    requestRedeemMutation.mutate();
  };

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (
      !inputError &&
      needsApproval !== undefined &&
      redeemPreview !== undefined
    ) {
      setStartedWithApproval(!!needsApproval);
      setFlowStatus(needsApproval ? "approving" : "request-redeem-ready");
      requestRedeemMutation.mutate();
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
        toSection={
          <div className="flex h-32 items-center justify-center rounded-lg bg-gray-50 px-12">
            <p className="text-b-medium text-center text-gray-600">
              {queueInfoText}
            </p>
          </div>
        }
      >
        <SubmitButton
          actionText={t("pages.swap.form.send-to-queue")}
          inputError={inputError}
          // First step of the two-step redeeming is always active
          isActive
          isAllowanceError={isNeedsApprovalError}
          isLoading={isLoading()}
          isPreviewError={isPreviewError}
        />
        <div className="border-t border-gray-200 px-2 py-3 *:w-full">
          <Button
            onClick={() => setIsTutorialOpen(true)}
            type="button"
            variant="tertiary"
          >
            {t("pages.swap.tutorial.learn-button", {
              symbol: fromToken.symbol,
            })}
          </Button>
        </div>
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
          sectionClassName="max-md:px-4 md:px-2"
          totalFees={totalFeesQueryData}
        />
      </FormSection>
      <RedeemQueueSection
        peggedToken={fromToken}
        showTopBorder={amountBigInt !== 0n}
        whitelistedTokens={whitelistedTokens}
      />
      {isTutorialOpen && (
        <RedeemTutorialModal
          onClose={() => setIsTutorialOpen(false)}
          peggedToken={fromToken}
          whitelistedTokens={whitelistedTokensForPeggedToken}
        />
      )}
      {isDrawerOpen && flowStatus !== "idle" && (
        <SwapRequestRedeemDrawer
          flowStatus={flowStatus}
          fromAmount={fromInputValue}
          fromToken={fromToken}
          networkFee={networkFee}
          onClose={handleDrawerClose}
          onRetry={handleRetry}
          showApproveStep={startedWithApproval}
          subtitle={redeemableForText}
          totalFees={totalFeesQueryData}
        />
      )}
      {showToast && (
        <Toast
          closable
          description={t("pages.swap.toast.redeem-queued-description")}
          onClose={() => setShowToast(false)}
          title={t("pages.swap.toast.redeem-queued-title", toastData)}
        />
      )}
    </>
  );
}

import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import type { FetchStatus, QueryStatus } from "@tanstack/react-query";
import { SectionHeader } from "components/base/sectionHeader";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useAmount } from "hooks/useAmount";
import {
  type RedeemRequest,
  useGetRedeemRequests,
} from "hooks/useGetRedeemRequests";
import { useMainnet } from "hooks/useMainnet";
import { useMaxWithdraw } from "hooks/useMaxWithdraw";
import { usePreviewRedeem } from "hooks/usePreviewRedeem";
import { useRedeem } from "hooks/useRedeem";
import { useRedeemFee } from "hooks/useRedeemFee";
import { useSwapRedeemFees } from "hooks/useSwapRedeemFees";
import { useTotalRedeemFees } from "hooks/useTotalRedeemFees";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { applyBps } from "utils/bigint";
import { getInputError } from "utils/inputError";
import { applySlippage, DEFAULT_SLIPPAGE } from "utils/slippage";
import { formatAmount, parseTokenUnits } from "utils/token";
import { formatUnits, isAddressEqual, parseUnits } from "viem";

import { CancelRedeemModal } from "./cancelRedeemModal";
import { ClaimRedeemDrawer } from "./claimRedeemDrawer";
import { RedeemQueueEmptyState } from "./redeemQueueEmptyState";
import { RedeemQueueTable } from "./redeemQueueTable";
import { RedeemQueueToasts } from "./redeemQueueToasts";
import { SlippageSettings } from "./slippageSettings";
import { type ClaimRedeemFlowStatus } from "./types";

type Props = {
  peggedToken: TokenWithGateway;
  whitelistedTokens: TokenWithGateway[];
};

type ToastState =
  | { peggedToken: TokenWithGateway; type: "cancel" }
  | {
      peggedToken: TokenWithGateway;
      toToken: TokenWithGateway;
      type: "redeem";
    };

type ActiveRedeemDrawerProps = {
  amountLocked: bigint;
  onClose: VoidFunction;
  onRedeemSuccess: (toToken: TokenWithGateway) => void;
  peggedToken: TokenWithGateway;
  whitelistedTokens: TokenWithGateway[];
};

function ActiveRedeemDrawer({
  amountLocked,
  onClose,
  onRedeemSuccess,
  peggedToken,
  whitelistedTokens,
}: ActiveRedeemDrawerProps) {
  const { t } = useTranslation();
  const ethereumChain = useMainnet();

  const { data: nativeBalanceData } = useNativeBalance(ethereumChain.id);
  const nativeBalance = nativeBalanceData?.value;

  const drawerWhitelistedTokens = whitelistedTokens.filter((wl) =>
    isAddressEqual(wl.gatewayAddress, peggedToken.gatewayAddress),
  );
  const [toToken, setToToken] = useState<TokenWithGateway>(
    () => drawerWhitelistedTokens[0],
  );
  const [flowStatus, setFlowStatus] = useState<ClaimRedeemFlowStatus>("idle");
  const [fromInputValue, onFromInputChange] = useAmount();
  const [slippage, setSlippage] = useState(DEFAULT_SLIPPAGE);

  const amountBigInt = parseTokenUnits(fromInputValue, peggedToken);

  const { data: maxWithdraw, isError: isMaxWithdrawError } = useMaxWithdraw({
    gatewayAddress: peggedToken.gatewayAddress,
    tokenOut: toToken.address,
  });

  const { data: redeemPreview, isError: isPreviewError } = usePreviewRedeem({
    gatewayAddress: peggedToken.gatewayAddress,
    peggedTokenIn: amountBigInt,
    tokenOut: toToken.address,
  });

  const unitRedeemPreview = usePreviewRedeem({
    gatewayAddress: peggedToken.gatewayAddress,
    peggedTokenIn: parseUnits("1", peggedToken.decimals),
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

  const inputError = getInputError({
    amount: amountBigInt,
    maxWithdraw,
    nativeBalance,
    redeemPreview,
    tokenBalance: amountLocked,
  });

  const isLoading = () => maxWithdraw === undefined && !isMaxWithdrawError;

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "swap",
      text: t("pages.swap.activity.claim-redeem-text", {
        fromAmount: fromInputValue,
        fromSymbol: peggedToken.symbol,
        toAmount: outputValue,
        toSymbol: toToken.symbol,
      }),
      title: `${t("nav.swap")} · ${t("pages.swap.redeem-queue.redeem")}`,
    });

  const networkFeeQueryData = useSwapRedeemFees({
    amount: amountBigInt,
    approveAmount: undefined,
    fromToken: peggedToken,
    minAmountOut,
    tokenOut: toToken.address,
  });

  const networkFee = {
    data: networkFeeQueryData.fees,
    fetchStatus: (amountBigInt > 0n ? "fetching" : "idle") as FetchStatus,
    status: (networkFeeQueryData.isError ? "error" : "pending") as QueryStatus,
  };

  const protocolFeeQueryData = useRedeemFee({
    gatewayAddress: peggedToken.gatewayAddress,
    select: (fee) => applyBps(amountBigInt, fee),
    token: toToken.address,
  });

  const totalRedeemFeesQueryData = useTotalRedeemFees({
    amount: amountBigInt,
    // no approval is needed when redeeming from the queue
    approveAmount: undefined,
    fromToken: peggedToken,
    minAmountOut,
    tokenOut: toToken.address,
  });

  const redeemMutation = useRedeem({
    onEmitter(emitter) {
      const handleFailure = function () {
        onFailed();
        setFlowStatus("redeem-error");
      };

      emitter.on("pre-redeem", () => setFlowStatus("redeem-ready"));
      emitter.on("user-signed-redeem", function (hash) {
        onTransactionHash(hash);
        onPending();
        setFlowStatus("redeeming");
      });
      emitter.on("redeem-transaction-succeeded", function () {
        onCompleted();
        setFlowStatus("redeemed");
        onRedeemSuccess(toToken);
      });
      emitter.on("redeem-transaction-reverted", handleFailure);
      emitter.on("redeem-failed", handleFailure);
      emitter.on("user-signing-redeem-error", handleFailure);
      emitter.on("redeem-failed-validation", handleFailure);
      emitter.on("unexpected-error", handleFailure);
    },
    peggedToken,
    peggedTokenIn: amountBigInt,
    slippage,
    tokenOut: toToken.address,
  });

  const handleMaxClick = () =>
    onFromInputChange(formatUnits(amountLocked, peggedToken.decimals));

  const handleSubmit = function () {
    setFlowStatus("redeem-ready");
    redeemMutation.mutate();
  };

  function handleClose() {
    onClose();
    setFlowStatus("idle");
  }

  return (
    <ClaimRedeemDrawer
      amountBigInt={amountBigInt}
      amountLocked={amountLocked}
      flowStatus={flowStatus}
      fromAmount={fromInputValue}
      fromToken={peggedToken}
      inputError={inputError}
      isLoading={isLoading()}
      isPreviewError={isPreviewError}
      networkFee={networkFee}
      onClose={handleClose}
      onInputChange={onFromInputChange}
      onMaxClick={handleMaxClick}
      onSubmit={handleSubmit}
      onTokenChange={setToToken}
      oracleToken={toToken.address}
      outputBigInt={redeemPreview}
      outputValue={outputValue}
      protocolFee={protocolFeeQueryData}
      slippageControl={
        <SlippageSettings onChange={setSlippage} slippage={slippage} />
      }
      toToken={toToken}
      totalFees={totalRedeemFeesQueryData}
      unitPreview={unitRedeemPreview}
      whitelistedTokens={drawerWhitelistedTokens}
    />
  );
}

export function RedeemQueue({ peggedToken, whitelistedTokens }: Props) {
  const { t } = useTranslation();

  const { data: requests, isLoading } = useGetRedeemRequests();

  const [activeRow, setActiveRow] = useState<RedeemRequest>();
  const [cancelRow, setCancelRow] = useState<RedeemRequest>();
  const [toast, setToast] = useState<ToastState>();

  const rows = requests ?? [];

  return (
    <>
      <SectionHeader title={t("pages.swap.redeem-queue.title")} />
      <RedeemQueueTable
        data={rows}
        loading={isLoading}
        onCancelRedeem={setCancelRow}
        onRedeem={setActiveRow}
        placeholder={<RedeemQueueEmptyState peggedToken={peggedToken} />}
      />
      {activeRow && (
        <ActiveRedeemDrawer
          amountLocked={activeRow.amountLocked}
          onClose={() => setActiveRow(undefined)}
          onRedeemSuccess={(toToken) =>
            setToast({
              peggedToken: activeRow.peggedToken,
              toToken,
              type: "redeem",
            })
          }
          peggedToken={activeRow.peggedToken}
          whitelistedTokens={whitelistedTokens}
        />
      )}
      {cancelRow && (
        <CancelRedeemModal
          onClose={() => setCancelRow(undefined)}
          onSuccess={() =>
            setToast({ peggedToken: cancelRow.peggedToken, type: "cancel" })
          }
          peggedToken={cancelRow.peggedToken}
          redeemableAmount={cancelRow.amountLocked}
        />
      )}
      {toast && (
        <RedeemQueueToasts onClose={() => setToast(undefined)} {...toast} />
      )}
    </>
  );
}

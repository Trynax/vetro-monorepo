import { useDebounce } from "@hemilabs/react-hooks/useDebounce";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useNeedsApproval } from "@hemilabs/react-hooks/useNeedsApproval";
import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import { ApproveSection } from "components/approveSection";
import { Toast } from "components/base/toast";
import { FormSection, FormSectionItem } from "components/feesContainer";
import { SetMaxErc20Balance } from "components/setMaxErc20Balance";
import { ToTokenBalance } from "components/swapForm/toTokenBalance";
import { TokenInput } from "components/tokenInput";
import { TokenSelectorModal } from "components/tokenSelectorModal";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useBridge } from "hooks/useBridge";
import { useBridgeableTokens } from "hooks/useBridgeableTokens";
import { useBridgeLayerZeroFee } from "hooks/useBridgeLayerZeroFee";
import { useBridgeNetworkFee } from "hooks/useBridgeNetworkFee";
import { useTotalBridgeSendFees } from "hooks/useTotalBridgeSendFees";
import { getChainById } from "networks";
import { type FormEvent, useReducer, useState } from "react";
import { useTranslation } from "react-i18next";
import type { BridgeableToken } from "types";
import { pickCounterpartToken } from "utils/bridge";
import { getInputError } from "utils/inputError";
import { getNativeToken } from "utils/nativeToken";
import { parseTokenUnits, removeOftDust } from "utils/token";
import { formatUnits } from "viem";
import { useAccount } from "wagmi";

import { BridgeFees } from "./bridgeFees";
import { BridgeSubmitButton } from "./bridgeSubmitButton";
import {
  type BridgeFlowStatus,
  BridgeSubmitDrawer,
} from "./bridgeSubmitDrawer";
import { BridgeTokenFiatValue } from "./bridgeTokenFiatValue";
import { Form } from "./form";
import { bridgeFormReducer, type BridgeFormState } from "./reducer";

function getInitialState(tokens: BridgeableToken[]): BridgeFormState {
  const fromToken = tokens[0];
  return {
    approve10x: false,
    fromInputValue: "0",
    fromToken,
    toToken: pickCounterpartToken({ token: fromToken, tokens }),
  };
}

function getBridgeInputError({
  amountBigInt,
  fromTokenBalance,
  nativeBalance,
  parsedAmount,
}: {
  amountBigInt: bigint;
  fromTokenBalance: bigint | undefined;
  nativeBalance: bigint | undefined;
  parsedAmount: bigint;
}) {
  if (parsedAmount > 0n && amountBigInt === 0n) {
    return "amount-too-small-to-bridge" as const;
  }
  return getInputError({
    amount: amountBigInt,
    nativeBalance,
    tokenBalance: fromTokenBalance,
  });
}

type ContentProps = {
  tokens: BridgeableToken[];
};

function BridgeFormContent({ tokens }: ContentProps) {
  const { t } = useTranslation();
  const { address: account } = useAccount();
  const [state, dispatch] = useReducer(
    bridgeFormReducer,
    tokens,
    getInitialState,
  );
  const { approve10x, fromInputValue, fromToken, toToken } = state;

  const [flowStatus, setFlowStatus] = useState<BridgeFlowStatus>("idle");
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [startedWithApproval, setStartedWithApproval] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const debouncedInputValue = useDebounce(fromInputValue);
  const parsedAmount = parseTokenUnits(debouncedInputValue, fromToken);
  const amountBigInt = removeOftDust({
    amount: parsedAmount,
    token: fromToken,
  });
  const toAmountDisplay = formatUnits(amountBigInt, fromToken.decimals);

  const oftAddress = fromToken.oftAdapterAddress ?? fromToken.address;
  const approveAmount = approve10x ? amountBigInt * 10n : undefined;

  const { data: fromTokenBalance } = useTokenBalance({
    address: fromToken.address,
    chainId: fromToken.chainId,
  });
  const { data: nativeBalanceData } = useNativeBalance(fromToken.chainId);
  const nativeBalance = nativeBalanceData?.value;

  const { data: needsApproval } = useNeedsApproval({
    amount: amountBigInt,
    spender: oftAddress,
    token: { address: fromToken.address, chainId: fromToken.chainId },
  });

  const { data: nativeFeeUsd, isError: isLayerZeroFeeError } =
    useBridgeLayerZeroFee({
      amount: amountBigInt,
      destinationChainId: toToken.chainId,
      oftAddress,
      sourceChainId: fromToken.chainId,
    });

  const { data: networkFeeUsd, isError: isNetworkFeeError } =
    useBridgeNetworkFee({
      amount: amountBigInt,
      approveAmount,
      destinationChainId: toToken.chainId,
      sourceToken: fromToken,
    });

  const { data: totalFeeUsd, isError: isTotalFeeError } =
    useTotalBridgeSendFees({
      amount: amountBigInt,
      approveAmount,
      destinationChainId: toToken.chainId,
      sourceToken: fromToken,
    });

  const layerZeroFee = {
    data: nativeFeeUsd,
    isError: isLayerZeroFeeError,
  };

  const networkFee = {
    data: networkFeeUsd,
    isError: isNetworkFeeError,
  };

  const total = {
    data: totalFeeUsd,
    isError: isTotalFeeError,
  };

  const balancesLoaded =
    nativeBalance !== undefined && fromTokenBalance !== undefined;
  const dataReady = balancesLoaded && needsApproval !== undefined;

  const inputError = getBridgeInputError({
    amountBigInt,
    fromTokenBalance,
    nativeBalance,
    parsedAmount,
  });

  const fromChain = getChainById(fromToken.chainId);
  const toChain = getChainById(toToken.chainId);

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "bridge",
      text: t("pages.bridge.activity.bridge-text", {
        amount: toAmountDisplay,
        count: Number(toAmountDisplay),
        symbol: fromToken.symbol,
      }),
      title: `${t("nav.bridge")} · ${t("pages.bridge.activity.bridge-title", {
        fromChain: fromChain.name,
        toChain: toChain.name,
      })}`,
    });

  const bridgeMutation = useBridge({
    amount: amountBigInt,
    approveAmount,
    destinationChainId: toToken.chainId,
    oftAddress,
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
      emitter.on("pre-send", () => setFlowStatus("send-ready"));
      emitter.on("user-signed-send", function (hash) {
        onTransactionHash(hash);
        onPending();
        setFlowStatus("sending");
      });
      emitter.on("send-transaction-succeeded", function () {
        onCompleted();
        setFlowStatus("sent");
        setShowToast(true);
      });
      emitter.on("send-transaction-reverted", function () {
        onFailed();
        setFlowStatus("send-error");
      });
      emitter.on("user-signing-send-error", function () {
        onFailed();
        setFlowStatus("send-error");
      });
      emitter.on("send-failed", function () {
        onFailed();
        setFlowStatus("send-error");
      });
      emitter.on("send-failed-validation", function () {
        onFailed();
        setFlowStatus("send-error");
      });
      emitter.on("unexpected-error", function () {
        onFailed();
        setFlowStatus("send-error");
      });
    },
    sourceChainId: fromToken.chainId,
    sourceTokenAddress: fromToken.address,
  });

  const fromTokens = tokens.filter(
    (token) =>
      token.chainId !== fromToken.chainId || token.symbol !== fromToken.symbol,
  );

  const toTokens = tokens.filter(
    (token) =>
      token.symbol === fromToken.symbol && token.chainId !== toToken.chainId,
  );

  function handleFromTokenChange(token: BridgeableToken) {
    dispatch({ payload: { token, tokens }, type: "SET_FROM_TOKEN" });
  }

  function handleToTokenChange(token: BridgeableToken) {
    dispatch({ payload: { token, tokens }, type: "SET_TO_TOKEN" });
  }

  function handleInputChange(value: string) {
    dispatch({ payload: value, type: "SET_FROM_INPUT_VALUE" });
  }

  function handleMaxClick(maxValue: string) {
    dispatch({ payload: maxValue, type: "SET_FROM_INPUT_VALUE" });
  }

  function handleToggle() {
    dispatch({ type: "TOGGLE_TOKENS" });
  }

  function handleToggleApprove10x() {
    dispatch({ type: "TOGGLE_APPROVE_10X" });
  }

  function handleRetry() {
    setFlowStatus(startedWithApproval ? "approving" : "send-ready");
    bridgeMutation.mutate();
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inputError && account && dataReady) {
      setStartedWithApproval(!!needsApproval);
      setFlowStatus(needsApproval ? "approving" : "send-ready");
      bridgeMutation.mutate();
      setIsDrawerOpen(true);
    }
  }

  function handleDrawerClose() {
    setIsDrawerOpen(false);
    if (flowStatus === "sent") {
      dispatch({ payload: "0", type: "SET_FROM_INPUT_VALUE" });
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
          <TokenSelectorModal
            onChange={handleFromTokenChange}
            showChainLogo
            tokens={fromTokens}
            triggerLabel={t("pages.bridge.select-from-chain")}
            value={fromToken}
          />
        }
        maxButton={
          <SetMaxErc20Balance onClick={handleMaxClick} token={fromToken} />
        }
        onInputChange={handleInputChange}
        onSubmit={handleSubmit}
        onToggle={handleToggle}
        toSection={
          <TokenInput
            balance={<ToTokenBalance token={toToken} />}
            disabled
            fiatValue={
              <BridgeTokenFiatValue token={toToken} value={amountBigInt} />
            }
            label={t("pages.bridge.form.you-will-receive")}
            tokenSelector={
              <TokenSelectorModal
                onChange={handleToTokenChange}
                showChainLogo
                tokens={toTokens}
                triggerLabel={t("pages.bridge.select-to-chain")}
                value={toToken}
              />
            }
            value={toAmountDisplay}
          />
        }
      >
        <BridgeSubmitButton
          inputError={inputError}
          isLoadingData={!!account && !dataReady}
          isPending={bridgeMutation.isPending}
          isPreviewError={isTotalFeeError}
        />
      </Form>
      <FormSection show={amountBigInt !== 0n}>
        <FormSectionItem>
          <ApproveSection
            active={approve10x}
            onToggle={handleToggleApprove10x}
          />
        </FormSectionItem>
        <BridgeFees
          layerZeroFee={layerZeroFee}
          nativeToken={getNativeToken(fromChain)}
          networkFee={networkFee}
          sectionClassName="max-md:px-4 md:px-2"
          total={total}
        />
      </FormSection>
      {isDrawerOpen && flowStatus !== "idle" && (
        <BridgeSubmitDrawer
          flowStatus={flowStatus}
          fromAmount={fromInputValue}
          fromToken={fromToken}
          layerZeroFee={layerZeroFee}
          networkFee={networkFee}
          onClose={handleDrawerClose}
          onRetry={handleRetry}
          showApproveStep={startedWithApproval}
          toAmount={toAmountDisplay}
          toToken={toToken}
          total={total}
        />
      )}
      {showToast && (
        <Toast
          autoCloseMs={5000}
          closable
          description={t("pages.bridge.toast.bridge-description")}
          onClose={() => setShowToast(false)}
          title={t("pages.bridge.toast.bridge-title")}
        />
      )}
    </>
  );
}

export function BridgeForm() {
  const tokens = useBridgeableTokens();
  return <BridgeFormContent tokens={tokens} />;
}

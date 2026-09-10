import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Token } from "@vetro-protocol/core";
import { RenderCryptoValue } from "components/base/cryptoValue";
import { Drawer } from "components/base/drawer";
import { DrawerLoader } from "components/base/drawer/drawerLoader";
import { RenderFiatValue } from "components/base/fiatValue";
import { CollapsibleSection } from "components/collapsibleSection";
import { NetworkFees } from "components/networkFees";
import { SetMaxStakedBalance } from "components/setMaxStakedBalance";
import { TokenInput } from "components/tokenInput";
import { Balance } from "components/tokenInput/balance";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useCloseOnSuccess } from "hooks/useCloseOnSuccess";
import { useInstantWithdraw } from "hooks/useInstantWithdraw";
import { useMainnet } from "hooks/useMainnet";
import { useStakedBalance } from "hooks/useStakedBalance";
import { useStakeWithdraw } from "hooks/useStakeWithdraw";
import { useCanInstantWithdraw } from "pages/earn/hooks/useCanInstantWithdraw";
import { useCooldownDuration } from "pages/earn/hooks/useCooldownDuration";
import { useTotalWithdrawFees } from "pages/earn/hooks/useTotalWithdrawFees";
import { type FormEvent, Suspense, lazy, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { type Address, parseUnits } from "viem";
import { useAccount } from "wagmi";

import type { WithdrawStep } from "./stakeFormReducer";
import { StakeSubmitButton } from "./stakeSubmitButton";

const StakeWithdrawProgressDrawer = lazy(() =>
  import("./stakeWithdrawProgressDrawer").then((m) => ({
    default: m.StakeWithdrawProgressDrawer,
  })),
);

const retryWithdrawSteps = {
  failed: "withdrawing",
  "request-failed": "requesting",
} as const;

const getRetryHandler = (step: WithdrawStep, onRetry: VoidFunction) =>
  step === "failed" || step === "request-failed" ? onRetry : undefined;

type Props = {
  inputValue: string;
  isDrawerOpen: boolean;
  onDrawerOpenChange: (open: boolean) => void;
  onInputChange: (value: string) => void;
  onResetSteps: VoidFunction;
  onSuccess: (toast: { description: string; title: string }) => void;
  onWithdrawStepChange: (step: WithdrawStep) => void;
  peggedToken: TokenWithGateway;
  shareToken: Token;
  stakingVaultAddress: Address;
  withdrawStep: WithdrawStep;
};

function getWithdrawErrors({
  amount,
  nativeBalance,
  stakedBalance,
}: {
  amount: bigint;
  nativeBalance: bigint | undefined;
  stakedBalance: bigint | undefined;
}) {
  if (amount === 0n) {
    return "enter-amount";
  }
  if (stakedBalance !== undefined && amount > stakedBalance) {
    return "insufficient-balance";
  }
  if (nativeBalance !== undefined && nativeBalance === 0n) {
    return "insufficient-gas";
  }
  return undefined;
}

const getSubmitTexts = ({
  canInstantWithdraw,
  t,
}: {
  canInstantWithdraw: boolean | undefined;
  t: ReturnType<typeof useTranslation>["t"];
}) => ({
  actionText: canInstantWithdraw
    ? t("pages.earn.stake.instant-withdraw")
    : t("pages.earn.stake.request-withdrawal"),
  pendingText: canInstantWithdraw
    ? t("pages.earn.stake.instant-withdrawing")
    : t("pages.earn.stake.requesting"),
});

export function StakeWithdrawForm({
  inputValue,
  isDrawerOpen,
  onDrawerOpenChange,
  onInputChange,
  onResetSteps,
  onSuccess,
  onWithdrawStepChange,
  peggedToken,
  shareToken,
  stakingVaultAddress,
  withdrawStep,
}: Props) {
  const { isConnected } = useAccount();
  const { data: canInstantWithdraw } = useCanInstantWithdraw({
    stakingVaultAddress,
  });
  const chain = useMainnet();
  const { data: cooldownDays } = useCooldownDuration(stakingVaultAddress);
  const { openConnectModal } = useConnectModal();
  const { t } = useTranslation();
  const [requestCloseDrawer, setRequestCloseDrawer] = useState(false);
  const [submitted, setSubmitted] = useState<{
    amount: string;
    assets: bigint;
  } | null>(null);

  const instantTracking = useActivityTracking({
    page: "earn",
    text: t("pages.earn.activity.instant-withdraw-text", {
      amount: inputValue,
      symbol: peggedToken.symbol,
    }),
    title: `${t("nav.earn")} · ${t("pages.earn.stake.instant-withdraw")}`,
  });

  const requestTracking = useActivityTracking({
    page: "earn",
    text: t("pages.earn.activity.request-withdraw-text", {
      amount: inputValue,
      symbol: peggedToken.symbol,
    }),
    title: `${t("nav.earn")} · ${t("pages.earn.stake.withdraw")}`,
  });

  const tracking = canInstantWithdraw ? instantTracking : requestTracking;

  const { data: stakedBalance, status: stakedBalanceStatus } =
    useStakedBalance(stakingVaultAddress);

  const { data: nativeBalanceData } = useNativeBalance(chain.id);
  const nativeBalance = nativeBalanceData?.value;

  const amountBigInt = parseUnits(inputValue, peggedToken.decimals);

  const handleRequestWithdrawSuccess = function () {
    onSuccess({
      description: t("pages.earn.stake.withdraw-toast-description", {
        count: cooldownDays,
      }),
      title: t("pages.earn.stake.withdraw-toast-title"),
    });
  };

  const handleInstantWithdrawSuccess = function () {
    onSuccess({
      description: t("pages.earn.stake.instant-withdraw-toast-description"),
      title: t("pages.earn.stake.instant-withdraw-toast-title"),
    });
  };

  const handleWithdrawStepChange = useCallback(
    function handleWithdrawStepChange(step: WithdrawStep) {
      onWithdrawStepChange(step);
      const handlers: Partial<Record<WithdrawStep, () => void>> = {
        completed: tracking.onCompleted,
        failed: tracking.onFailed,
        "request-failed": tracking.onFailed,
        requesting: tracking.onPending,
        withdrawing: tracking.onPending,
      };
      handlers[step]?.();
    },
    [onWithdrawStepChange, tracking],
  );

  const requestWithdrawMutation = useStakeWithdraw({
    assets: amountBigInt,
    onStatusChange: handleWithdrawStepChange,
    onSuccess: handleRequestWithdrawSuccess,
    onTransactionHash: tracking.onTransactionHash,
    stakingVaultAddress,
  });

  const instantWithdrawMutation = useInstantWithdraw({
    assets: amountBigInt,
    onStatusChange: handleWithdrawStepChange,
    onSuccess: handleInstantWithdrawSuccess,
    onTransactionHash: tracking.onTransactionHash,
    peggedToken,
    stakingVaultAddress,
  });

  const withdrawMutation = canInstantWithdraw
    ? instantWithdrawMutation
    : requestWithdrawMutation;

  function handleRetry() {
    onWithdrawStepChange(
      retryWithdrawSteps[withdrawStep as keyof typeof retryWithdrawSteps],
    );
    withdrawMutation.mutate();
  }

  const withdrawFeesQuery = useTotalWithdrawFees({
    amount: amountBigInt,
    stakingVaultAddress,
  });

  const inputError = getWithdrawErrors({
    amount: amountBigInt,
    nativeBalance,
    stakedBalance,
  });

  const balancesLoaded =
    nativeBalance !== undefined && stakedBalance !== undefined;

  const isWithdrawPathLoading = canInstantWithdraw === undefined;

  const { actionText, pendingText } = getSubmitTexts({ canInstantWithdraw, t });

  const startCloseDrawer = useCallback(() => setRequestCloseDrawer(true), []);

  useCloseOnSuccess({
    onClose: startCloseDrawer,
    success: isDrawerOpen && withdrawStep === "completed",
  });

  function handleCloseDrawer() {
    setRequestCloseDrawer(false);
    onDrawerOpenChange(false);
  }

  function handleMaxClick(maxValue: string) {
    onInputChange(maxValue);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!inputError) {
      setSubmitted({ amount: inputValue, assets: amountBigInt });
      onResetSteps();
      onDrawerOpenChange(true);
      withdrawMutation.mutate();
    }
  }

  return (
    <>
      <form className="flex flex-col bg-white" onSubmit={handleSubmit}>
        <div className="p-2">
          <TokenInput
            balance={
              <Balance
                label={t("pages.earn.stake.available-to-withdraw")}
                value={
                  <RenderCryptoValue
                    status={stakedBalanceStatus}
                    token={peggedToken}
                    value={stakedBalance}
                  />
                }
              />
            }
            disabled={isWithdrawPathLoading}
            errorKey={balancesLoaded ? inputError : undefined}
            fiatValue={
              <RenderFiatValue token={peggedToken} value={amountBigInt} />
            }
            label={t("pages.earn.stake.you-will-withdraw")}
            maxButton={
              <SetMaxStakedBalance
                decimals={peggedToken.decimals}
                disabled={isWithdrawPathLoading}
                onClick={handleMaxClick}
                stakingVaultAddress={stakingVaultAddress}
              />
            }
            onChange={onInputChange}
            tokenSelector={<TokenSelectorReadOnly {...peggedToken} />}
            value={inputValue}
          />
        </div>
        <div className="flex border-y border-gray-200 p-3 *:flex-1">
          <StakeSubmitButton
            actionText={actionText}
            balancesLoaded={balancesLoaded && !isWithdrawPathLoading}
            inputError={inputError}
            isConnected={isConnected}
            isPending={withdrawMutation.isPending}
            onConnectWallet={openConnectModal}
            pendingText={pendingText}
          />
        </div>
        <CollapsibleSection show={amountBigInt !== 0n}>
          <div className="border-b border-gray-200">
            <NetworkFees
              label={t("pages.earn.stake.withdrawing-fees-label", {
                amount: inputValue,
                token: peggedToken.symbol,
              })}
              networkFee={withdrawFeesQuery}
              sectionClassName="px-2"
            />
          </div>
        </CollapsibleSection>
      </form>
      {isDrawerOpen && submitted && canInstantWithdraw !== undefined && (
        <Drawer onClose={handleCloseDrawer} requestClose={requestCloseDrawer}>
          <Suspense fallback={<DrawerLoader />}>
            <StakeWithdrawProgressDrawer
              amount={submitted.amount}
              assets={submitted.assets}
              canInstantWithdraw={canInstantWithdraw}
              cooldownDays={cooldownDays}
              networkFee={withdrawFeesQuery}
              onRetry={getRetryHandler(withdrawStep, handleRetry)}
              peggedToken={peggedToken}
              shareToken={shareToken}
              stakingVaultAddress={stakingVaultAddress}
              withdrawStep={withdrawStep}
            />
          </Suspense>
        </Drawer>
      )}
    </>
  );
}

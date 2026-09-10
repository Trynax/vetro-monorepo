import { useAddTokenToWallet } from "@hemilabs/react-hooks/useAddTokenToWallet";
import { useAllowance } from "@hemilabs/react-hooks/useAllowance";
import { useNativeBalance } from "@hemilabs/react-hooks/useNativeBalance";
import { useTokenBalance } from "@hemilabs/react-hooks/useTokenBalance";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import type { Token } from "@vetro-protocol/core";
import { ApproveSection } from "components/approveSection";
import { Drawer } from "components/base/drawer";
import { DrawerLoader } from "components/base/drawer/drawerLoader";
import { RenderFiatValue } from "components/base/fiatValue";
import { CollapsibleSection } from "components/collapsibleSection";
import { NetworkFees } from "components/networkFees";
import { SetMaxErc20Balance } from "components/setMaxErc20Balance";
import { TokenInput } from "components/tokenInput";
import { Balance } from "components/tokenInput/balance";
import { TokenSelectorReadOnly } from "components/tokenSelectorReadOnly";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useCloseOnSuccess } from "hooks/useCloseOnSuccess";
import { useMainnet } from "hooks/useMainnet";
import { useStakeDeposit } from "hooks/useStakeDeposit";
import { useTotalDepositFees } from "pages/earn/hooks/useTotalDepositFees";
import { type FormEvent, Suspense, lazy, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { formatAmount } from "utils/token";
import { type Address, parseUnits } from "viem";
import { useAccount } from "wagmi";

import type { DepositStep } from "./stakeFormReducer";
import { StakeSubmitButton } from "./stakeSubmitButton";

const StakeDepositProgressDrawer = lazy(() =>
  import("./stakeDepositProgressDrawer").then((m) => ({
    default: m.StakeDepositProgressDrawer,
  })),
);

type Props = {
  approve10x: boolean;
  approvalCompleted: boolean;
  depositStep: DepositStep;
  inputValue: string;
  isDrawerOpen: boolean;
  onApprove10xToggle: VoidFunction;
  onDepositStepChange: (step: DepositStep) => void;
  onDrawerOpenChange: (open: boolean) => void;
  onInputChange: (value: string) => void;
  onResetSteps: VoidFunction;
  onSuccess: (toast: { description: string; title: string }) => void;
  peggedToken: TokenWithGateway;
  shareToken: Token;
  stakingVaultAddress: Address;
};

function getStakeErrors({
  amount,
  nativeBalance,
  tokenBalance,
}: {
  amount: bigint;
  nativeBalance: bigint | undefined;
  tokenBalance: bigint | undefined;
}) {
  if (amount === 0n) {
    return "enter-amount";
  }
  if (tokenBalance !== undefined && amount > tokenBalance) {
    return "insufficient-balance";
  }
  if (nativeBalance !== undefined && nativeBalance === 0n) {
    return "insufficient-gas";
  }
  return undefined;
}

const getSubmitTexts = ({
  depositStep,
  needsApproval,
  t,
}: {
  depositStep: DepositStep;
  needsApproval: boolean;
  t: ReturnType<typeof useTranslation>["t"];
}) => ({
  actionText: needsApproval
    ? t("pages.earn.stake.approve-and-deposit")
    : t("pages.earn.stake.deposit"),
  pendingText:
    depositStep === "approving"
      ? t("pages.earn.stake.approving")
      : t("pages.earn.stake.depositing"),
});

export function StakeDepositForm({
  approvalCompleted,
  approve10x,
  depositStep,
  inputValue,
  isDrawerOpen,
  onApprove10xToggle,
  onDepositStepChange,
  onDrawerOpenChange,
  onInputChange,
  onResetSteps,
  onSuccess,
  peggedToken,
  shareToken,
  stakingVaultAddress,
}: Props) {
  const { address: account, isConnected } = useAccount();
  const chain = useMainnet();
  const { openConnectModal } = useConnectModal();
  const { t } = useTranslation();
  const [requestCloseDrawer, setRequestCloseDrawer] = useState(false);
  const [submitted, setSubmitted] = useState<{
    amount: string;
    assets: bigint;
  } | null>(null);

  const { mutate: watchToken } = useAddTokenToWallet({
    token: {
      address: shareToken.address,
      chainId: chain.id,
      extensions: { logoURI: shareToken.logoURI },
    },
  });

  const { data: peggedTokenBalance, isError: isPeggedTokenBalanceError } =
    useTokenBalance({
      address: peggedToken.address,
      chainId: chain.id,
    });

  const { data: nativeBalanceData } = useNativeBalance(chain.id);
  const nativeBalance = nativeBalanceData?.value;

  const { data: currentAllowance } = useAllowance({
    owner: account,
    spender: stakingVaultAddress,
    token: peggedToken,
  });

  const amountBigInt = parseUnits(inputValue, peggedToken.decimals);

  const needsApproval =
    currentAllowance !== undefined && currentAllowance < amountBigInt;

  const approveAmount = approve10x ? amountBigInt * 10n : undefined;

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "earn",
      text: t("pages.earn.activity.deposit-text", {
        amount: inputValue,
        symbol: peggedToken.symbol,
      }),
      title: `${t("nav.earn")} · ${t("pages.earn.stake.deposit")}`,
    });

  const handleDepositStepChange = useCallback(
    function handleDepositStepChange(step: DepositStep) {
      onDepositStepChange(step);
      const handlers: Partial<Record<DepositStep, () => void>> = {
        "approve-failed": onFailed,
        completed: onCompleted,
        "deposit-failed": onFailed,
        depositing: onPending,
      };
      handlers[step]?.();
    },
    [onCompleted, onDepositStepChange, onFailed, onPending],
  );

  const handleDepositSuccess = useCallback(
    function handleDepositSuccess() {
      onSuccess({
        description: t("pages.earn.stake.deposit-toast-description"),
        title: t("pages.earn.stake.deposit-toast-title"),
      });
      watchToken();
    },
    [onSuccess, t, watchToken],
  );

  const depositMutation = useStakeDeposit({
    approveAmount,
    assets: amountBigInt,
    needsApproval,
    onStatusChange: handleDepositStepChange,
    onSuccess: handleDepositSuccess,
    onTransactionHash,
    peggedToken,
    stakingVaultAddress,
  });

  const depositFeesQuery = useTotalDepositFees({
    amount: amountBigInt,
    approveAmount,
    stakingVaultAddress,
    token: peggedToken,
  });

  const inputError = getStakeErrors({
    amount: amountBigInt,
    nativeBalance,
    tokenBalance: peggedTokenBalance,
  });

  const formattedBalance = formatAmount({
    amount: peggedTokenBalance,
    decimals: peggedToken.decimals,
    isError: isPeggedTokenBalanceError,
  });

  const balancesLoaded =
    nativeBalance !== undefined && peggedTokenBalance !== undefined;

  const { actionText, pendingText } = getSubmitTexts({
    depositStep,
    needsApproval,
    t,
  });

  const startCloseDrawer = useCallback(() => setRequestCloseDrawer(true), []);

  useCloseOnSuccess({
    onClose: startCloseDrawer,
    success: isDrawerOpen && depositStep === "completed",
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
      depositMutation.mutate();
    }
  }

  return (
    <>
      <form className="flex flex-col bg-white" onSubmit={handleSubmit}>
        <div className="p-2">
          <TokenInput
            balance={
              <Balance
                label={t("pages.earn.stake.available-to-deposit")}
                value={formattedBalance}
              />
            }
            errorKey={balancesLoaded ? inputError : undefined}
            fiatValue={
              <RenderFiatValue token={peggedToken} value={amountBigInt} />
            }
            label={t("pages.earn.stake.you-will-stake")}
            maxButton={
              <SetMaxErc20Balance
                onClick={handleMaxClick}
                token={peggedToken}
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
            balancesLoaded={balancesLoaded}
            inputError={inputError}
            isConnected={isConnected}
            isPending={depositMutation.isPending}
            onConnectWallet={openConnectModal}
            pendingText={pendingText}
          />
        </div>
        <CollapsibleSection show={amountBigInt !== 0n}>
          <div className="w-full border-b border-gray-200 px-2">
            <ApproveSection active={approve10x} onToggle={onApprove10xToggle} />
          </div>
          <div className="border-b border-gray-200">
            <NetworkFees
              label={t("pages.earn.stake.fees-label", {
                amount: inputValue,
                token: peggedToken.symbol,
              })}
              networkFee={depositFeesQuery}
              sectionClassName="px-2"
            />
          </div>
        </CollapsibleSection>
      </form>
      {isDrawerOpen && submitted && (
        <Drawer onClose={handleCloseDrawer} requestClose={requestCloseDrawer}>
          <Suspense fallback={<DrawerLoader />}>
            <StakeDepositProgressDrawer
              amount={submitted.amount}
              approvalCompleted={approvalCompleted}
              assets={submitted.assets}
              depositStep={depositStep}
              needsApproval={needsApproval}
              networkFee={depositFeesQuery}
              peggedToken={peggedToken}
              shareToken={shareToken}
              stakingVaultAddress={stakingVaultAddress}
            />
          </Suspense>
        </Drawer>
      )}
    </>
  );
}

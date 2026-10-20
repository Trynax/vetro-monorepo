import type { CancelWithdrawEvents } from "@vetro-protocol/earn";
import { cancelWithdraw } from "@vetro-protocol/earn/actions";
import { EventEmitter } from "events";
import type { Address, WalletClient } from "viem";
import { describe, expect, it, vi } from "vitest";

import { useCancelWithdraw } from "../../src/hooks/useCancelWithdraw";

const mocks = vi.hoisted(() => ({
  account: "0x0000000000000000000000000000000000000001" as Address,
  ensureConnectedTo: vi.fn().mockResolvedValue(undefined),
  queryClient: {
    invalidateQueries: vi.fn(),
    refetchQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
  updateNativeBalanceAfterReceipt: vi.fn(),
  walletClient: {} as WalletClient,
}));

vi.mock("@hemilabs/react-hooks/useEnsureConnectedTo", () => ({
  useEnsureConnectedTo: () => mocks.ensureConnectedTo,
}));

vi.mock("@hemilabs/react-hooks/useNativeBalance", () => ({
  useNativeBalance: () => ({ queryKey: ["native-balance"] }),
}));

vi.mock("@hemilabs/react-hooks/useTokenBalance", () => ({
  tokenBalanceQueryKey: () => ["token-balance"],
}));

vi.mock("@hemilabs/react-hooks/useUpdateNativeBalanceAfterReceipt", () => ({
  useUpdateNativeBalanceAfterReceipt: () =>
    mocks.updateNativeBalanceAfterReceipt,
}));

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options: unknown) => options,
  useQueryClient: () => mocks.queryClient,
}));

vi.mock("@vetro-protocol/earn/actions", () => ({
  cancelWithdraw: vi.fn(),
}));

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: mocks.account }),
}));

vi.mock("pages/earn/hooks/useExitTickets", () => ({
  exitTicketsQueryKey: () => ["exit-tickets"],
}));

vi.mock("../../src/hooks/useCostBasis", () => ({
  costBasisQueryKey: () => ["cost-basis"],
}));

vi.mock("../../src/hooks/useEarnedAmountUsd", () => ({
  earnedAmountUsdQueryKey: () => ["earned-amount-usd"],
}));

vi.mock("../../src/hooks/useEthereumWalletClient", () => ({
  useEthereumWalletClient: () => ({ data: mocks.walletClient }),
}));

vi.mock("../../src/hooks/usePoolDeposits", () => ({
  poolDepositsQueryKey: () => ["pool-deposits"],
}));

vi.mock("../../src/hooks/useStakedBalance", () => ({
  stakedBalanceQueryKey: () => ["staked-balance"],
}));

vi.mock("../../src/hooks/useStakedUsd", () => ({
  stakedUsdQueryKey: () => ["staked-usd"],
}));

type Mutation = {
  mutationFn: () => Promise<void>;
};

const stakingVaultAddress =
  "0x0000000000000000000000000000000000000002" as Address;

function createPendingAction<Events extends Record<keyof Events, unknown[]>>() {
  const emitter = new EventEmitter<Events>();
  let settle!: () => void;
  const promise = new Promise<void>((resolve) => (settle = resolve));
  return { emitter, promise, resolve: settle };
}

describe("useCancelWithdraw", function () {
  const failureEvents: {
    emit: (emitter: EventEmitter<CancelWithdrawEvents>) => void;
    name: string;
  }[] = [
    {
      emit: (emitter) =>
        emitter.emit("cancel-withdraw-failed", new Error("RPC failure")),
      name: "cancel-withdraw-failed",
    },
    {
      emit: (emitter) =>
        emitter.emit("cancel-withdraw-failed-validation", "Invalid request"),
      name: "cancel-withdraw-failed-validation",
    },
    {
      emit: (emitter) =>
        emitter.emit("unexpected-error", new Error("Unexpected failure")),
      name: "unexpected-error",
    },
  ];

  it.each(failureEvents)("maps $name to failed", async function ({ emit }) {
    const action = createPendingAction<CancelWithdrawEvents>();
    vi.mocked(cancelWithdraw).mockReturnValue(action);
    const onStatusChange = vi.fn();
    const mutation = useCancelWithdraw({
      assets: 1n,
      onStatusChange,
      requestId: 1n,
      stakingVaultAddress,
    }) as unknown as Mutation;

    const pendingMutation = mutation.mutationFn();
    await vi.waitFor(() => expect(cancelWithdraw).toHaveBeenCalledOnce());

    emit(action.emitter);
    action.resolve();
    await pendingMutation;

    expect(onStatusChange).toHaveBeenCalledExactlyOnceWith("failed");
  });
});

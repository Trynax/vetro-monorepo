import { tokenBalanceQueryKey } from "@hemilabs/react-hooks/useTokenBalance";
import type { Token } from "@vetro-protocol/core";
import { encodeRepayAssets } from "@vetro-protocol/morpho-blue-market/actions";
import { type Client, zeroAddress, zeroHash } from "viem";
import { estimateGas } from "viem/actions";
import { describe, expect, it, vi } from "vitest";

import { estimateApprovalGasUnits } from "../../src/fetchers/estimateApprovalGasUnits";
import { fetchRepayGasUnits } from "../../src/fetchers/fetchRepayGasUnits";
import { morphoMarketQueryKey } from "../../src/hooks/borrow/useMorphoMarket";
import { positionInfoQueryKey } from "../../src/hooks/borrow/usePositionInfo";
import { createTestQueryClient } from "../utils";

vi.mock("../../src/fetchers/estimateApprovalGasUnits", () => ({
  estimateApprovalGasUnits: vi.fn(),
}));

vi.mock("@morpho-org/blue-sdk", () => ({
  getChainAddresses: vi.fn().mockReturnValue({ morpho: zeroAddress }),
}));

vi.mock("@vetro-protocol/morpho-blue-market/actions", () => ({
  encodeRepayAssets: vi.fn().mockReturnValue("0x"),
}));

vi.mock("viem/actions", () => ({
  estimateGas: vi.fn(),
}));

vi.mock("utils/erc20StateOverride", () => ({
  createErc20AllowanceStateOverride: vi.fn(),
}));

const mockMorphoMarket = {
  params: {},
  toBorrowAssets: vi.fn().mockReturnValue(1000n),
};

const mockPosition = { borrowShares: 500n };

describe("fetchRepayGasUnits", function () {
  const mockClient = { chain: { id: 1 } } as unknown as Client;
  const mockOwner = zeroAddress;
  // @ts-expect-error - Only address is needed for these tests
  const mockToken = {
    address: zeroAddress,
  } as Token;

  function createPrepopulatedQueryClient({
    loanBalance = 1000n,
    morphoMarket = mockMorphoMarket,
    position = mockPosition,
  } = {}) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      morphoMarketQueryKey({ chainId: 1, marketId: zeroHash }),
      morphoMarket,
    );
    queryClient.setQueryData(
      positionInfoQueryKey({
        account: mockOwner,
        chainId: 1,
        marketId: zeroHash,
      }),
      position,
    );
    queryClient.setQueryData(
      tokenBalanceQueryKey({ address: zeroAddress, chainId: 1 }, mockOwner),
      loanBalance,
    );
    return queryClient;
  }

  it("returns sum of approval and repay gas", async function () {
    const approvalGas = 46000n;
    const repayGas = 120000n;
    const queryClient = createPrepopulatedQueryClient();

    vi.mocked(estimateApprovalGasUnits).mockResolvedValue(approvalGas);
    vi.mocked(estimateGas).mockResolvedValue(repayGas);

    const result = await fetchRepayGasUnits({
      amount: 100n,
      approveAmount: 100n,
      client: mockClient,
      marketId: zeroHash,
      owner: mockOwner,
      queryClient,
      token: mockToken,
    });

    expect(result).toBe(approvalGas + repayGas);
  });

  it("returns only repay gas when no approval needed", async function () {
    const repayGas = 120000n;
    const queryClient = createPrepopulatedQueryClient();

    vi.mocked(estimateApprovalGasUnits).mockResolvedValue(0n);
    vi.mocked(estimateGas).mockResolvedValue(repayGas);

    const result = await fetchRepayGasUnits({
      amount: 100n,
      approveAmount: 100n,
      client: mockClient,
      marketId: zeroHash,
      owner: mockOwner,
      queryClient,
      token: mockToken,
    });

    expect(result).toBe(repayGas);
  });

  it("estimates a share-based full repayment", async function () {
    const approvalGas = 46000n;
    const repayGas = 120000n;
    const queryClient = createPrepopulatedQueryClient();

    vi.mocked(estimateApprovalGasUnits).mockResolvedValue(approvalGas);
    vi.mocked(estimateGas).mockResolvedValue(repayGas);

    const result = await fetchRepayGasUnits({
      amount: 990n,
      approveAmount: 1000n,
      client: mockClient,
      marketId: zeroHash,
      owner: mockOwner,
      queryClient,
      shares: 500n,
      token: mockToken,
    });

    expect(result).toBe(approvalGas + repayGas);
    expect(vi.mocked(estimateApprovalGasUnits)).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1000n,
      }),
    );
    expect(vi.mocked(encodeRepayAssets)).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 0n,
        shares: 500n,
      }),
    );
  });

  it("throws when amount exceeds current debt", async function () {
    const queryClient = createPrepopulatedQueryClient({
      morphoMarket: {
        ...mockMorphoMarket,
        toBorrowAssets: vi.fn().mockReturnValue(50n),
      },
    });

    await expect(
      fetchRepayGasUnits({
        amount: 100n,
        approveAmount: 100n,
        client: mockClient,
        marketId: zeroHash,
        owner: mockOwner,
        queryClient,
        token: mockToken,
      }),
    ).rejects.toThrow("Amount exceeds current debt");

    expect(estimateGas).not.toHaveBeenCalled();
  });

  it("throws when amount exceeds loan token balance", async function () {
    const queryClient = createPrepopulatedQueryClient({ loanBalance: 50n });

    await expect(
      fetchRepayGasUnits({
        amount: 100n,
        approveAmount: 100n,
        client: mockClient,
        marketId: zeroHash,
        owner: mockOwner,
        queryClient,
        token: mockToken,
      }),
    ).rejects.toThrow("Insufficient loan token balance");

    expect(estimateGas).not.toHaveBeenCalled();
  });
});

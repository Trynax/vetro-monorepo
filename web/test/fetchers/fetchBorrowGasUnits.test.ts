import { type Client, zeroAddress, zeroHash } from "viem";
import { estimateGas } from "viem/actions";
import { describe, expect, it, vi } from "vitest";

import { fetchBorrowGasUnits } from "../../src/fetchers/fetchBorrowGasUnits";
import { morphoMarketQueryKey } from "../../src/hooks/borrow/useMorphoMarket";
import { positionInfoQueryKey } from "../../src/hooks/borrow/usePositionInfo";
import { createTestQueryClient } from "../utils";

vi.mock("@morpho-org/blue-sdk", () => ({
  getChainAddresses: vi.fn().mockReturnValue({ blue: zeroAddress }),
}));

vi.mock("@vetro-protocol/morpho-blue-market/actions", () => ({
  encodeBorrowAssets: vi.fn().mockReturnValue("0x"),
}));

vi.mock("viem/actions", () => ({
  estimateGas: vi.fn(),
}));

const chainId = 1;

const createMockMorphoMarket = ({
  maxBorrow = 500n,
  toBorrowResult = 0n,
} = {}) => ({
  getMaxBorrowAssets: vi.fn().mockReturnValue(maxBorrow),
  liquidity: 1000n,
  params: {},
  toBorrowAssets: vi.fn().mockReturnValue(toBorrowResult),
});

const mockPosition = {
  borrowShares: 0n,
  collateral: 1000000n,
};

describe("fetchBorrowGasUnits", function () {
  const mockClient = { chain: { id: chainId } } as unknown as Client;
  const mockOwner = zeroAddress;

  function createPrepopulatedQueryClient({
    morphoMarket = createMockMorphoMarket(),
    position = mockPosition,
  } = {}) {
    const queryClient = createTestQueryClient();
    queryClient.setQueryData(
      morphoMarketQueryKey({ chainId, marketId: zeroHash }),
      morphoMarket,
    );
    queryClient.setQueryData(
      positionInfoQueryKey({ account: mockOwner, chainId, marketId: zeroHash }),
      position,
    );
    return queryClient;
  }

  it("returns gas estimate when within borrow limit", async function () {
    const borrowGas = 150000n;
    const queryClient = createPrepopulatedQueryClient();

    vi.mocked(estimateGas).mockResolvedValue(borrowGas);

    const result = await fetchBorrowGasUnits({
      amount: 100n,
      client: mockClient,
      marketId: zeroHash,
      owner: mockOwner,
      queryClient,
    });

    expect(result).toBe(borrowGas);
  });

  it("includes collateralInput in borrow limit check", async function () {
    const borrowGas = 150000n;
    const queryClient = createPrepopulatedQueryClient({
      position: { borrowShares: 0n, collateral: 0n },
    });

    vi.mocked(estimateGas).mockResolvedValue(borrowGas);

    const result = await fetchBorrowGasUnits({
      amount: 100n,
      client: mockClient,
      collateralInput: 1000000n,
      marketId: zeroHash,
      owner: mockOwner,
      queryClient,
    });

    expect(result).toBe(borrowGas);
  });

  it("throws when amount exceeds borrow limit", async function () {
    const queryClient = createPrepopulatedQueryClient({
      morphoMarket: createMockMorphoMarket({ maxBorrow: 50n }),
    });

    await expect(
      fetchBorrowGasUnits({
        amount: 100n,
        client: mockClient,
        marketId: zeroHash,
        owner: mockOwner,
        queryClient,
      }),
    ).rejects.toThrow("Amount exceeds borrow limit");

    expect(estimateGas).not.toHaveBeenCalled();
  });
});

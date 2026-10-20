import { type Client, zeroAddress, zeroHash } from "viem";
import { estimateGas } from "viem/actions";
import { describe, expect, it, vi } from "vitest";

import { fetchWithdrawCollateralGasUnits } from "../../src/fetchers/fetchWithdrawCollateralGasUnits";
import { morphoMarketQueryKey } from "../../src/hooks/borrow/useMorphoMarket";
import { positionInfoQueryKey } from "../../src/hooks/borrow/usePositionInfo";
import { createTestQueryClient } from "../utils";

vi.mock("@morpho-org/blue-sdk", () => ({
  getChainAddresses: vi.fn().mockReturnValue({ blue: zeroAddress }),
}));

vi.mock("@vetro-protocol/morpho-blue-market/actions", () => ({
  encodeWithdrawCollateral: vi.fn().mockReturnValue("0x"),
}));

vi.mock("viem/actions", () => ({
  estimateGas: vi.fn(),
}));

const chainId = 1;

describe("fetchWithdrawCollateralGasUnits", function () {
  const mockClient = { chain: { id: 1 } } as unknown as Client;
  const mockOwner = zeroAddress;

  it("returns gas estimate when amount is within withdrawable limit", async function () {
    const withdrawGas = 110000n;
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(
      morphoMarketQueryKey({ chainId, marketId: zeroHash }),
      { params: {} },
    );
    queryClient.setQueryData(
      positionInfoQueryKey({
        account: mockOwner,
        chainId,
        marketId: zeroHash,
      }),
      { withdrawableCollateral: 200n },
    );

    vi.mocked(estimateGas).mockResolvedValue(withdrawGas);

    const result = await fetchWithdrawCollateralGasUnits({
      amount: 100n,
      client: mockClient,
      marketId: zeroHash,
      owner: mockOwner,
      queryClient,
    });

    expect(result).toBe(withdrawGas);
  });

  it("throws when amount exceeds withdrawable collateral", async function () {
    const queryClient = createTestQueryClient();

    queryClient.setQueryData(
      morphoMarketQueryKey({ chainId, marketId: zeroHash }),
      { params: {} },
    );
    queryClient.setQueryData(
      positionInfoQueryKey({
        account: mockOwner,
        chainId,
        marketId: zeroHash,
      }),
      { withdrawableCollateral: 50n },
    );

    await expect(
      fetchWithdrawCollateralGasUnits({
        amount: 100n,
        client: mockClient,
        marketId: zeroHash,
        owner: mockOwner,
        queryClient,
      }),
    ).rejects.toThrow("Amount exceeds withdrawable collateral");

    expect(estimateGas).not.toHaveBeenCalled();
  });
});

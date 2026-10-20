import type { QueryClient } from "@tanstack/react-query";
import type { Token } from "@vetro-protocol/core";
import { type Client, zeroAddress, zeroHash } from "viem";
import { describe, expect, it, vi } from "vitest";

import { fetchBorrowGasUnits } from "../../src/fetchers/fetchBorrowGasUnits";
import { fetchSupplyAndBorrowGasUnits } from "../../src/fetchers/fetchSupplyAndBorrowGasUnits";
import { fetchSupplyCollateralGasUnits } from "../../src/fetchers/fetchSupplyCollateralGasUnits";

vi.mock("../../src/fetchers/fetchSupplyCollateralGasUnits", () => ({
  fetchSupplyCollateralGasUnits: vi.fn(),
}));

vi.mock("../../src/fetchers/fetchBorrowGasUnits", () => ({
  fetchBorrowGasUnits: vi.fn(),
}));

vi.mock("@morpho-org/blue-sdk", () => ({
  getChainAddresses: vi.fn().mockReturnValue({ blue: zeroAddress }),
}));

vi.mock("utils/morphoStateOverride", () => ({
  createMorphoCollateralStateOverride: vi.fn(),
}));

describe("fetchSupplyAndBorrowGasUnits", function () {
  const mockClient = { chain: { id: 1 } } as unknown as Client;
  const mockOwner = zeroAddress;
  const mockQueryClient = {} as unknown as QueryClient;
  // @ts-expect-error - Only address is needed for these tests
  const mockToken = {
    address: zeroAddress,
  } as Token;

  it("returns sum of supply collateral and borrow gas", async function () {
    const supplyGas = 176000n;
    const borrowGas = 150000n;

    vi.mocked(fetchSupplyCollateralGasUnits).mockResolvedValue(supplyGas);
    vi.mocked(fetchBorrowGasUnits).mockResolvedValue(borrowGas);

    const result = await fetchSupplyAndBorrowGasUnits({
      approveAmount: 100n,
      borrowAmount: 50n,
      client: mockClient,
      collateralAmount: 100n,
      collateralToken: mockToken,
      marketId: zeroHash,
      owner: mockOwner,
      queryClient: mockQueryClient,
    });

    expect(result).toBe(supplyGas + borrowGas);
    expect(fetchBorrowGasUnits).toHaveBeenCalledWith(
      expect.objectContaining({ collateralInput: 100n }),
    );
  });

  it("handles zero supply gas", async function () {
    const borrowGas = 150000n;

    vi.mocked(fetchSupplyCollateralGasUnits).mockResolvedValue(0n);
    vi.mocked(fetchBorrowGasUnits).mockResolvedValue(borrowGas);

    const result = await fetchSupplyAndBorrowGasUnits({
      approveAmount: undefined,
      borrowAmount: 50n,
      client: mockClient,
      collateralAmount: 0n,
      collateralToken: mockToken,
      marketId: zeroHash,
      owner: mockOwner,
      queryClient: mockQueryClient,
    });

    expect(result).toBe(borrowGas);
  });
});

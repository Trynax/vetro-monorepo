import { QueryClient } from "@tanstack/react-query";
import type { Address, Client } from "viem";
import { mainnet } from "viem/chains";
import { describe, expect, it, vi } from "vitest";

import { canInstantWithdrawOptions } from "../../src/pages/earn/hooks/useCanInstantWithdraw";

const mocks = vi.hoisted(() => ({
  fetchCanInstantWithdraw: vi.fn(),
}));

vi.mock("fetchers/fetchCanInstantWithdraw", () => ({
  fetchCanInstantWithdraw: mocks.fetchCanInstantWithdraw,
}));

const account = "0x0000000000000000000000000000000000000001" as Address;
const client = {} as Client;
const stakingVaultAddress =
  "0x0000000000000000000000000000000000000002" as Address;

describe("canInstantWithdrawOptions", function () {
  it("does not refetch eligibility after it has loaded", async function () {
    mocks.fetchCanInstantWithdraw.mockResolvedValueOnce(false);
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const options = canInstantWithdrawOptions({
      account,
      chainId: mainnet.id,
      client,
      stakingVaultAddress,
    });

    await expect(queryClient.fetchQuery(options)).resolves.toBe(false);
    await expect(queryClient.fetchQuery(options)).resolves.toBe(false);

    expect(mocks.fetchCanInstantWithdraw).toHaveBeenCalledOnce();
  });
});

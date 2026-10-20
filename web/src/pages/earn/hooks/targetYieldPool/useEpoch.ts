import { queryOptions } from "@tanstack/react-query";
import { SECONDS_PER_DAY, unixNowTimestamp } from "utils/date";
import { type Address, parseUnits } from "viem";

export type Epoch = {
  deposits: bigint;
  entryWindow: { end: bigint; start: bigint };
  maxDeposits: bigint;
};

export const epochOptions = ({
  epochId,
  stakingVaultAddress,
}: {
  epochId: bigint | undefined;
  stakingVaultAddress: Address;
}) =>
  queryOptions({
    enabled: epochId !== undefined,
    // TODO: read the epoch with `getEpoch` from `@vetro-protocol/target-yield-earn`
    // once VUSDx is deployed.
    // See https://github.com/vetro-protocol/vetro-monorepo/issues/646
    queryFn() {
      const now = unixNowTimestamp();

      return Promise.resolve<Epoch>({
        deposits: parseUnits("4200000", 18),
        entryWindow: {
          end: BigInt(now + 6 * SECONDS_PER_DAY),
          start: BigInt(now - SECONDS_PER_DAY),
        },
        maxDeposits: parseUnits("5000000", 18),
      });
    },
    queryKey: [
      "target-yield-pool-epoch",
      stakingVaultAddress,
      epochId?.toString(),
    ],
  });

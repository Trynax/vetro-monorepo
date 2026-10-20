import { parseUnits } from "viem";

// TODO: read the epoch's fixed rate with `rate(epochId)` from
// `@vetro-protocol/target-yield-earn` once the vault is deployed. Like the
// contract, this returns the rate as a WAD fraction, where 1e18 is 100%.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const fetchTargetRate = async (_: bigint) => parseUnits("0.085", 18);

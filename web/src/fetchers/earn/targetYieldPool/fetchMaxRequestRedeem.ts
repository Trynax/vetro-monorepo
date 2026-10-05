import { maxUint256 } from "viem";

// TODO read `getMaxRequestRedeem` from VUSDx contract
// https://github.com/vetro-protocol/vetro-monorepo/issues/646
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const fetchMaxRequestRedeem = async (_: bigint) => maxUint256;

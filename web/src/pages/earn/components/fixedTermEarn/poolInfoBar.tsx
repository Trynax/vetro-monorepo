import { useVaultPeggedToken } from "hooks/useVaultPeggedToken";
import type { Address } from "viem";

import { PoolContract } from "../poolInfoBar/poolContract";
import { PoolDetailsLink } from "../poolInfoBar/poolDetailsLink";
import { PoolInfoStakedAmount } from "../poolInfoBar/poolInfoStakedAmount";
import { PoolToken } from "../poolInfoBar/poolToken";

import { PoolDeposits } from "./poolDeposits";
import { PoolTargetApr } from "./poolTargetApr";
import { PoolTermState } from "./poolTermState";

type Props = {
  stakingVaultAddress: Address;
};

export function PoolInfoBar({ stakingVaultAddress }: Props) {
  const { data: peggedToken } = useVaultPeggedToken(stakingVaultAddress);

  return (
    <div className="flex flex-col gap-6 border-b border-gray-200 bg-white p-4 sm:gap-4 md:flex-row md:items-center md:justify-between md:px-16 md:py-6">
      <div className="grid min-w-0 grid-cols-2 gap-4 sm:flex sm:items-center sm:justify-center-safe sm:gap-6 sm:overflow-x-auto md:justify-start md:gap-8">
        <PoolToken peggedToken={peggedToken} />
        <PoolContract address={stakingVaultAddress} />
        <PoolDeposits stakingVaultAddress={stakingVaultAddress} />
        <PoolTargetApr stakingVaultAddress={stakingVaultAddress} />
        <PoolTermState stakingVaultAddress={stakingVaultAddress} />
        <PoolInfoStakedAmount stakingVaultAddress={stakingVaultAddress} />
      </div>
      <PoolDetailsLink to={`/earn/fixed-term/${stakingVaultAddress}`} />
    </div>
  );
}

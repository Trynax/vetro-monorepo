import { gateways } from "@vetro-protocol/core";
import { type Address, isAddressEqual } from "viem";

export const trackedTokenAddresses = gateways.flatMap((gateway) =>
  [gateway.peggedToken, gateway.stakingVault].filter(
    (address) => address !== undefined,
  ),
);

export const isTrackedToken = (address: Address) =>
  trackedTokenAddresses.some((tracked) => isAddressEqual(tracked, address));

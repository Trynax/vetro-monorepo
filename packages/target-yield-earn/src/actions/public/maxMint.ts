import { type Address, type Client } from "viem";
import { maxMint as erc4626MaxMint } from "viem-erc4626/actions";

export const maxMint = (
  client: Client,
  parameters: {
    address: Address;
    controller: Address;
  },
) =>
  erc4626MaxMint(client, {
    address: parameters?.address,
    receiver: parameters?.controller,
  });

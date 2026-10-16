import { type Address, type Client } from "viem";
import { claimableDepositRequest as erc7540ClaimableDepositRequest } from "viem-erc7540/actions";

export const claimableDepositRequest = (
  client: Client,
  parameters: {
    address: Address;
    controller: Address;
  },
) =>
  erc7540ClaimableDepositRequest(client, {
    address: parameters?.address,
    controller: parameters?.controller,
    // Contract requires this parameter to be always 0n
    requestId: 0n,
  });

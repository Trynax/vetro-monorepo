import { type Address, type Client } from "viem";
import { pendingDepositRequest as erc7540PendingDepositRequest } from "viem-erc7540/actions";

export const pendingDepositRequest = (
  client: Client,
  parameters: {
    address: Address;
    controller: Address;
  },
) =>
  erc7540PendingDepositRequest(client, {
    address: parameters?.address,
    controller: parameters?.controller,
    // Contract requires this parameter to be always 0n
    requestId: 0n,
  });

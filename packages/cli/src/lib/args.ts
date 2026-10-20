import { gatewayAddresses } from "@vetro-protocol/gateway";
import { InvalidArgumentError } from "commander";
import { getAddress, isAddressEqual, parseUnits } from "viem";

import { MAX_SLIPPAGE } from "./slippage.ts";

export function parseAddress(value: string) {
  try {
    return getAddress(value);
  } catch {
    throw new InvalidArgumentError(`Invalid address: "${value}"`);
  }
}

export function parseNonNegativeAmount(value: string) {
  if (!/^\d+(\.\d+)?$/.test(value)) {
    throw new InvalidArgumentError(`Invalid amount: "${value}"`);
  }
  return value;
}

export function parseAmount(value: string) {
  parseNonNegativeAmount(value);
  if (Number(value) === 0) {
    throw new InvalidArgumentError(`Amount must be greater than 0: "${value}"`);
  }
  return value;
}

export function parseTokenAmount({
  amount,
  decimals,
  token,
}: {
  amount: string;
  decimals: number;
  token: string;
}) {
  const fraction = amount.split(".")[1]?.replace(/0+$/, "") ?? "";
  if (fraction.length > decimals) {
    throw new Error(
      `Amount has more decimals than "${token}" supports: ${decimals}`,
    );
  }
  return parseUnits(amount, decimals);
}

export function parseGateway(value: string) {
  const address = parseAddress(value);
  if (!gatewayAddresses.some((gateway) => isAddressEqual(gateway, address))) {
    throw new InvalidArgumentError(`Not an enabled gateway: "${value}"`);
  }
  return address;
}

export function parseRpcUrl(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidArgumentError(`Invalid RPC URL: "${value}"`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new InvalidArgumentError(
      `RPC URL must use http or https: "${value}"`,
    );
  }
  return value;
}

export function parseSlippage(value: string) {
  const normalized = value.replace(",", ".");
  if (normalized !== "" && !/^\d+(\.\d?)?$/.test(normalized)) {
    throw new InvalidArgumentError(`Invalid slippage: "${value}"`);
  }
  const slippage = Number(normalized);
  if (slippage > MAX_SLIPPAGE) {
    throw new InvalidArgumentError(
      `Slippage cannot exceed ${MAX_SLIPPAGE}%: "${value}"`,
    );
  }
  return slippage;
}

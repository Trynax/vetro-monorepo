import { stakingVaultAddresses } from "@vetro-protocol/earn";
import { gatewayAddresses } from "@vetro-protocol/gateway";
import type { Context, Next } from "hono";
import { type Address, checksumAddress, isAddress } from "viem";

declare module "hono" {
  interface ContextVariableMap {
    gatewayAddress: Address;
    stakingVaultAddress: Address;
  }
}

// validateAddress is intentionally not built on top of validateWhitelistedAddress
// below: it validates arbitrary user wallets (e.g. /variable-stake/exit-tickets/
// :address) where there is no known list, so a malformed input is functionally
// indistinguishable from "address has no record" and 404 captures both. The
// whitelisted variants distinguish 400 (malformed) from 404 (well-formed but
// unknown) because that asymmetry carries useful information for known-list
// endpoints.
/**
 * Middleware to validate that the "address" route parameter is a valid
 * Ethereum address. If invalid, returns a 404 response.
 */
export async function validateAddress(c: Context, next: Next) {
  const address = c.req.param("address");
  const isValid =
    typeof address === "string" && /^0x[a-f0-9]{40}$/i.test(address);
  if (!isValid) {
    return c.json({ error: "Not Found" }, 404);
  }
  return next();
}

const validateWhitelistedAddress = ({
  errorMalformed,
  errorNotFound,
  paramName,
  whitelist,
}: {
  errorMalformed: string;
  errorNotFound: string;
  paramName: "gatewayAddress" | "stakingVaultAddress";
  whitelist: readonly Address[];
}) =>
  async function (c: Context, next: Next) {
    const raw = c.req.param(paramName);
    if (!raw || !isAddress(raw, { strict: false })) {
      return c.json({ error: errorMalformed }, 400);
    }
    const address = checksumAddress(raw);
    if (!whitelist.includes(address)) {
      return c.json({ error: errorNotFound }, 404);
    }
    c.set(paramName, address);
    return next();
  };

/**
 * Middleware to validate the "gatewayAddress" route parameter. Returns 400 if
 * the address is malformed and 404 if it is not a known gateway. On success,
 * stores the checksummed address on the context as `gatewayAddress`.
 */
export const validateGatewayAddress = validateWhitelistedAddress({
  errorMalformed: "Malformed Gateway Address",
  errorNotFound: "Gateway not found",
  paramName: "gatewayAddress",
  whitelist: gatewayAddresses,
});

/**
 * Middleware to validate the "stakingVaultAddress" route parameter. Returns 400
 * if the address is malformed and 404 if it is not a known staking vault. On
 * success, stores the checksummed address on the context as
 * `stakingVaultAddress`.
 */
export const validateStakingVaultAddress = validateWhitelistedAddress({
  errorMalformed: "Malformed Staking Vault Address",
  errorNotFound: "Staking vault not found",
  paramName: "stakingVaultAddress",
  whitelist: stakingVaultAddresses,
});

/**
 * Validates a given parameter against a list of valid options. If the parameter
 * is not valid, returns a 400 response with a message indicating the valid
 * options.
 *
 * @param paramName The name of the parameter to validate (for error messages)
 * @param validOptions An array of valid string options for the parameter
 */
export const validateParam = (paramName: string, validOptions: string[]) =>
  function (c: Context, next: Next) {
    const paramValue = c.req.param(paramName);
    if (!paramValue || !validOptions.includes(paramValue)) {
      return c.json(
        { error: `Invalid ${paramName}. Use: ${validOptions.join(", ")}` },
        400,
      );
    }
    return next();
  };

/**
 * Validates optional query string parameters against their lists of valid
 * options. A missing parameter is valid. If a parameter is not valid, returns a
 * 400 response with a message indicating its valid options.
 *
 * @param validOptions The valid string options of each query string parameter
 */
export const validateQueryParams = (validOptions: Record<string, string[]>) =>
  function (c: Context, next: Next) {
    for (const [paramName, options] of Object.entries(validOptions)) {
      const paramValue = c.req.query(paramName);
      if (paramValue !== undefined && !options.includes(paramValue)) {
        return c.json(
          { error: `Invalid ${paramName}. Use: ${options.join(", ")}` },
          400,
        );
      }
    }
    return next();
  };

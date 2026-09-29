import { describe, expect, it } from "vitest";

import {
  parseAddress,
  parseAmount,
  parseGateway,
  parseNonNegativeAmount,
  parseRpcUrl,
  parseSlippage,
  parseTokenAmount,
} from "../src/lib/args.ts";

describe("parseAddress", function () {
  it("returns the checksummed address for valid lowercase input", function () {
    expect(parseAddress("0xdad503f8b9d42bb7af3afc588358d30163e4416f")).toBe(
      "0xDaD503f8B9d42bb7af3AfC588358D30163e4416F",
    );
  });

  it("throws a clean error for an invalid address", function () {
    expect(() => parseAddress("not-an-address")).toThrow(
      'Invalid address: "not-an-address"',
    );
  });
});

describe("parseAmount", function () {
  it("returns the value unchanged for integers", function () {
    expect(parseAmount("1")).toBe("1");
    expect(parseAmount("1000")).toBe("1000");
  });

  it("returns the value unchanged for decimals", function () {
    expect(parseAmount("0.5")).toBe("0.5");
    expect(parseAmount("12.000000000000000001")).toBe("12.000000000000000001");
  });

  it("throws for zero", function () {
    expect(() => parseAmount("0")).toThrow(
      'Amount must be greater than 0: "0"',
    );
    expect(() => parseAmount("0.0")).toThrow(
      'Amount must be greater than 0: "0.0"',
    );
    expect(() => parseAmount("00.000")).toThrow(
      'Amount must be greater than 0: "00.000"',
    );
  });

  it("throws for malformed values", function () {
    expect(() => parseAmount("abc")).toThrow('Invalid amount: "abc"');
    expect(() => parseAmount("-1")).toThrow('Invalid amount: "-1"');
    expect(() => parseAmount(".5")).toThrow('Invalid amount: ".5"');
    expect(() => parseAmount("1.")).toThrow('Invalid amount: "1."');
    expect(() => parseAmount("1.2.3")).toThrow('Invalid amount: "1.2.3"');
    expect(() => parseAmount("1e18")).toThrow('Invalid amount: "1e18"');
    expect(() => parseAmount("")).toThrow('Invalid amount: ""');
  });
});

describe("parseNonNegativeAmount", function () {
  it("accepts zero", function () {
    expect(parseNonNegativeAmount("0")).toBe("0");
    expect(parseNonNegativeAmount("0.0")).toBe("0.0");
  });

  it("throws for malformed values", function () {
    expect(() => parseNonNegativeAmount("-1")).toThrow('Invalid amount: "-1"');
    expect(() => parseNonNegativeAmount("")).toThrow('Invalid amount: ""');
  });
});

describe("parseTokenAmount", function () {
  it("returns the amount in the token's decimals", function () {
    expect(
      parseTokenAmount({ amount: "1.5", decimals: 6, token: "USDC" }),
    ).toBe(1_500_000n);
    expect(
      parseTokenAmount({ amount: "0.000001", decimals: 6, token: "USDC" }),
    ).toBe(1n);
  });

  it("ignores trailing zeros past the token's decimals", function () {
    expect(
      parseTokenAmount({ amount: "1.5000000", decimals: 6, token: "USDC" }),
    ).toBe(1_500_000n);
    expect(parseTokenAmount({ amount: "3.00", decimals: 0, token: "T" })).toBe(
      3n,
    );
  });

  it("returns 0 for a zero amount", function () {
    expect(parseTokenAmount({ amount: "0", decimals: 6, token: "USDC" })).toBe(
      0n,
    );
  });

  it("throws for an amount below one unit of the token", function () {
    expect(() =>
      parseTokenAmount({ amount: "0.0000001", decimals: 6, token: "USDC" }),
    ).toThrow('Amount has more decimals than "USDC" supports: 6');
  });

  it("throws instead of rounding up an amount of half a unit or more", function () {
    expect(() =>
      parseTokenAmount({ amount: "0.0000005", decimals: 6, token: "USDC" }),
    ).toThrow('Amount has more decimals than "USDC" supports: 6');
    expect(() =>
      parseTokenAmount({ amount: "1.9999999", decimals: 6, token: "USDC" }),
    ).toThrow('Amount has more decimals than "USDC" supports: 6');
  });

  it("throws for a fraction on a token with 0 decimals", function () {
    expect(() =>
      parseTokenAmount({ amount: "0.5", decimals: 0, token: "T" }),
    ).toThrow('Amount has more decimals than "T" supports: 0');
  });
});

describe("parseGateway", function () {
  it("returns the checksummed address for an enabled gateway", function () {
    expect(parseGateway("0xdad503f8b9d42bb7af3afc588358d30163e4416f")).toBe(
      "0xDaD503f8B9d42bb7af3AfC588358D30163e4416F",
    );
  });

  it("throws for a valid address that is not an enabled gateway", function () {
    expect(() =>
      parseGateway("0x0000000000000000000000000000000000000001"),
    ).toThrow(
      'Not an enabled gateway: "0x0000000000000000000000000000000000000001"',
    );
  });

  it("throws for a malformed address", function () {
    expect(() => parseGateway("nope")).toThrow('Invalid address: "nope"');
  });
});

describe("parseRpcUrl", function () {
  it("returns the URL unchanged so it still matches for redaction", function () {
    expect(parseRpcUrl("https://eth-mainnet.example/v2/KEY")).toBe(
      "https://eth-mainnet.example/v2/KEY",
    );
    expect(parseRpcUrl("http://127.0.0.1:8545")).toBe("http://127.0.0.1:8545");
  });

  it("throws for a malformed URL", function () {
    expect(() => parseRpcUrl("not-a-url")).toThrow(
      'Invalid RPC URL: "not-a-url"',
    );
  });

  it("throws for an empty value rather than treating it as unset", function () {
    expect(() => parseRpcUrl("")).toThrow('Invalid RPC URL: ""');
  });

  it("throws for a transport the client cannot use", function () {
    expect(() => parseRpcUrl("ws://127.0.0.1:8545")).toThrow(
      'RPC URL must use http or https: "ws://127.0.0.1:8545"',
    );
  });
});

describe("parseSlippage", function () {
  it("returns the percent for integers within range", function () {
    expect(parseSlippage("0")).toBe(0);
    expect(parseSlippage("5")).toBe(5);
    expect(parseSlippage("100")).toBe(100);
  });

  it("accepts a single decimal digit", function () {
    expect(parseSlippage("0.2")).toBe(0.2);
    expect(parseSlippage("12.5")).toBe(12.5);
  });

  it("accepts an empty value", function () {
    expect(parseSlippage("")).toBe(0);
  });

  it("accepts a trailing dot", function () {
    expect(parseSlippage("0.")).toBe(0);
  });

  it("normalizes a comma separator to a dot", function () {
    expect(parseSlippage("0,2")).toBe(0.2);
    expect(parseSlippage("12,")).toBe(12);
  });

  it("throws for a comma with more than one decimal digit", function () {
    expect(() => parseSlippage("0,25")).toThrow('Invalid slippage: "0,25"');
  });

  it("throws for more than one decimal digit", function () {
    expect(() => parseSlippage("0.25")).toThrow('Invalid slippage: "0.25"');
  });

  it("throws for non-numeric values", function () {
    expect(() => parseSlippage("abc")).toThrow('Invalid slippage: "abc"');
    expect(() => parseSlippage("-1")).toThrow('Invalid slippage: "-1"');
    expect(() => parseSlippage(".5")).toThrow('Invalid slippage: ".5"');
    expect(() => parseSlippage("1.2.3")).toThrow('Invalid slippage: "1.2.3"');
  });

  it("throws for values above the maximum", function () {
    expect(() => parseSlippage("101")).toThrow(
      'Slippage cannot exceed 100%: "101"',
    );
    expect(() => parseSlippage("100.1")).toThrow(
      'Slippage cannot exceed 100%: "100.1"',
    );
  });
});

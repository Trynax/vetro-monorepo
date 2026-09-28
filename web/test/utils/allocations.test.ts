import { knownTokens } from "@vetro-protocol/core";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";

import type { TreasuryToken, TvlHistoryEntry } from "../../src/types";
import {
  assignColor,
  getHistoryOnlyTokenAddresses,
  toCollateralizationItems,
  toReserveBufferAmount,
  toTvlHistorySeries,
  toTvlItems,
  toYieldItems,
} from "../../src/utils/allocations";

const findToken = (symbol: string) =>
  knownTokens.find((token) => token.symbol === symbol)!;

const usdtToken = findToken("USDT");
const usdcToken = findToken("USDC");
const frxUsdToken = findToken("frxUSD");

// $1.00 expressed with 8 decimals
const ONE_USD_PRICE = "100000000";

const baseTreasuryToken: TreasuryToken = {
  activeStrategies: [],
  latestPrice: ONE_USD_PRICE,
  priceDecimals: 8,
  tokenAddress: usdtToken.address,
  totalDebt: "0",
  withdrawable: "0",
};

// USD prices keyed by uppercase symbol (shape returned by `usePrices`).
const prices = { USDC: "1", USDT: "1" };

const tvlHistoryEntry = (overrides: Partial<TvlHistoryEntry>) => ({
  pegBaseUsdPrice: 1,
  peggedTokenAddress:
    "0xCa83DDE9c22254f58e771bE5E157773212AcBAc3" as `0x${string}`,
  timestamp: 1_789_084_800_000,
  tokens: [],
  totalSupply: "443736408129313428461563",
  ...overrides,
});

describe("pages/analytics/utils", function () {
  describe("assignColor", function () {
    it("returns the color at the given index", function () {
      expect(assignColor(0)).toBe("bg-emerald-400");
      expect(assignColor(1)).toBe("bg-blue-400");
    });

    it("wraps around when index exceeds palette length", function () {
      expect(assignColor(8)).toBe("bg-emerald-400");
    });
  });

  describe("toReserveBufferAmount", function () {
    it("returns 0 when treasuryTokens is empty", function () {
      expect(
        toReserveBufferAmount({
          prices,
          treasuryTokens: [],
          whitelistedTokens: [],
        }),
      ).toBe(0);
    });

    it("returns 0 when withdrawable equals totalDebt", function () {
      const result = toReserveBufferAmount({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            totalDebt: "1000000000",
            withdrawable: "1000000000",
          },
        ],
        whitelistedTokens: [usdtToken],
      });

      expect(result).toBe(0);
    });

    it("returns 0 when buffer is negative", function () {
      const result = toReserveBufferAmount({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            totalDebt: "1100000000",
            withdrawable: "1000000000",
          },
        ],
        whitelistedTokens: [usdtToken],
      });

      expect(result).toBe(0);
    });

    it("computes correct amount for a single token", function () {
      // withdrawable: 1000 USDT, totalDebt: 900 USDT → buffer: 100 USDT @ $1 = $100
      const result = toReserveBufferAmount({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            totalDebt: "900000000",
            withdrawable: "1000000000",
          },
        ],
        whitelistedTokens: [usdtToken],
      });

      expect(result).toBeCloseTo(100);
    });

    it("sums buffer across multiple tokens", function () {
      // USDT buffer: $100, USDC buffer: $50 → total: $150
      const result = toReserveBufferAmount({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            totalDebt: "900000000",
            withdrawable: "1000000000",
          },
          {
            ...baseTreasuryToken,
            tokenAddress: usdcToken.address,
            totalDebt: "50000000",
            withdrawable: "100000000",
          },
        ],
        whitelistedTokens: [usdtToken, usdcToken],
      });

      expect(result).toBeCloseTo(150);
    });

    it("uses decimals from whitelistedTokens", function () {
      // 1 token with 18 decimals @ $1 → buffer: $1
      const result = toReserveBufferAmount({
        prices,
        treasuryTokens: [
          { ...baseTreasuryToken, withdrawable: "1000000000000000000" },
        ],
        whitelistedTokens: [{ ...usdtToken, decimals: 18 as const }],
      });

      expect(result).toBeCloseTo(1);
    });

    it("skips treasury tokens missing from the whitelist", function () {
      // USDT contributes $100; the unknown USDC entry is ignored.
      const result = toReserveBufferAmount({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            totalDebt: "900000000",
            withdrawable: "1000000000",
          },
          {
            ...baseTreasuryToken,
            tokenAddress: usdcToken.address,
            totalDebt: "0",
            withdrawable: "1000000000",
          },
        ],
        whitelistedTokens: [usdtToken],
      });

      expect(result).toBeCloseTo(100);
    });
  });

  describe("toTvlItems", function () {
    it("returns empty array when no treasury tokens", function () {
      expect(
        toTvlItems({ prices, treasuryTokens: [], whitelistedTokens: [] }),
      ).toEqual([]);
    });

    it("computes correct USD amount per token", function () {
      // 1000 USDT (6 decimals) @ $1 = $1000
      const items = toTvlItems({
        prices,
        treasuryTokens: [{ ...baseTreasuryToken, withdrawable: "1000000000" }],
        whitelistedTokens: [usdtToken],
      });

      expect(items).toHaveLength(1);
      expect(items[0]?.amount).toBeCloseTo(1000);
      expect(items[0]?.label).toBe("USDT");
    });

    it("skips treasury tokens missing from the whitelist", function () {
      // USDT yields one item; the unknown USDC entry is omitted from the output.
      const items = toTvlItems({
        prices,
        treasuryTokens: [
          { ...baseTreasuryToken, withdrawable: "1000000000" },
          {
            ...baseTreasuryToken,
            tokenAddress: usdcToken.address,
            withdrawable: "1000000000",
          },
        ],
        whitelistedTokens: [usdtToken],
      });

      expect(items).toHaveLength(1);
      expect(items[0]?.label).toBe("USDT");
    });
  });

  describe("getHistoryOnlyTokenAddresses", function () {
    it("returns each token absent from the whitelist once", function () {
      const holding = {
        price: ONE_USD_PRICE,
        unitPrice: ONE_USD_PRICE,
        withdrawable: "1000000",
      };
      const addresses = getHistoryOnlyTokenAddresses({
        history: [
          tvlHistoryEntry({
            tokens: [
              { ...holding, tokenAddress: usdcToken.address },
              { ...holding, tokenAddress: usdtToken.address },
            ],
          }),
          tvlHistoryEntry({
            tokens: [
              {
                ...holding,
                tokenAddress: usdtToken.address.toLowerCase() as Address,
              },
            ],
          }),
        ],
        whitelistedTokens: [usdcToken],
      });

      expect(addresses).toEqual([usdtToken.address]);
    });
  });

  describe("toTvlHistorySeries", function () {
    const tokens = [usdcToken, frxUsdToken];

    it("scales each holding by its decimals and oracle rate", function () {
      const series = toTvlHistorySeries({
        history: [
          tvlHistoryEntry({
            tokens: [
              {
                price: "99983477",
                tokenAddress: usdcToken.address,
                unitPrice: ONE_USD_PRICE,
                withdrawable: "258609609875",
              },
              {
                price: "99974071",
                tokenAddress: frxUsdToken.address,
                unitPrice: ONE_USD_PRICE,
                withdrawable: "81443872117929824822074",
              },
            ],
          }),
        ],
        tokens,
      });

      expect(series[0]?.data[0]?.y).toBeCloseTo(258_566.87, 1);
      expect(series[1]?.data[0]?.y).toBeCloseTo(81_422.75, 1);
    });

    it("multiplies by the peg base USD price", function () {
      const series = toTvlHistorySeries({
        history: [
          tvlHistoryEntry({
            pegBaseUsdPrice: 77_000,
            tokens: [
              {
                price: ONE_USD_PRICE,
                tokenAddress: usdcToken.address,
                unitPrice: ONE_USD_PRICE,
                withdrawable: "2000000",
              },
            ],
          }),
        ],
        tokens,
      });

      expect(series[0]?.data[0]?.y).toBeCloseTo(154_000);
    });

    it("returns zero when the peg base USD price is unknown", function () {
      const series = toTvlHistorySeries({
        history: [
          tvlHistoryEntry({
            pegBaseUsdPrice: null,
            tokens: [
              {
                price: ONE_USD_PRICE,
                tokenAddress: usdcToken.address,
                unitPrice: ONE_USD_PRICE,
                withdrawable: "2000000",
              },
            ],
          }),
        ],
        tokens,
      });

      expect(series[0]?.data[0]?.y).toBe(0);
    });

    it("orders and colors the series by the token order", function () {
      const series = toTvlHistorySeries({ history: [], tokens });

      expect(series.map((s) => s.symbol)).toEqual(["USDC", "frxUSD"]);
      expect(series[0]?.color).toBe("var(--color-emerald-400)");
      expect(series[1]?.color).toBe("var(--color-blue-400)");
    });

    it("returns zero for a day the oracle could not price", function () {
      const series = toTvlHistorySeries({
        history: [
          tvlHistoryEntry({
            tokens: [
              {
                price: null,
                tokenAddress: usdcToken.address,
                unitPrice: null,
                withdrawable: "258609609875",
              },
            ],
          }),
        ],
        tokens,
      });

      expect(series[0]?.data[0]?.y).toBe(0);
    });

    it("returns zero for a token absent from that day", function () {
      const series = toTvlHistorySeries({
        history: [
          tvlHistoryEntry({
            tokens: [
              {
                price: ONE_USD_PRICE,
                tokenAddress: usdcToken.address,
                unitPrice: ONE_USD_PRICE,
                withdrawable: "258609609875",
              },
            ],
          }),
        ],
        tokens,
      });

      expect(series[1]?.data[0]).toEqual({ x: 1_789_084_800_000, y: 0 });
    });
  });

  describe("toYieldItems", function () {
    it("returns empty array when no treasury tokens", function () {
      expect(
        toYieldItems({ prices, treasuryTokens: [], whitelistedTokens: [] }),
      ).toEqual([]);
    });

    it("excludes strategies with zero amount", function () {
      const items = toYieldItems({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            activeStrategies: [
              { name: "Zero Strategy", totalDebt: "0" },
              { name: "Active Strategy", totalDebt: "500000000" },
            ],
            totalDebt: "500000000",
            withdrawable: "500000000",
          },
        ],
        whitelistedTokens: [usdtToken],
      });

      expect(items).toHaveLength(1);
      expect(items[0]?.label).toBe("Active Strategy");
    });

    it("flattens strategies across multiple tokens", function () {
      const items = toYieldItems({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            activeStrategies: [
              { name: "USDT Strategy", totalDebt: "500000000" },
            ],
            totalDebt: "500000000",
            withdrawable: "500000000",
          },
          {
            ...baseTreasuryToken,
            activeStrategies: [
              { name: "USDC Strategy", totalDebt: "200000000" },
            ],
            tokenAddress: usdcToken.address,
            totalDebt: "200000000",
            withdrawable: "200000000",
          },
        ],
        whitelistedTokens: [usdtToken, usdcToken],
      });

      expect(items).toHaveLength(2);
      expect(items[0]?.label).toBe("USDT Strategy");
      expect(items[1]?.label).toBe("USDC Strategy");
    });

    it("computes correct USD amount per strategy", function () {
      // 500 USDT (6 decimals) @ $1 = $500
      const items = toYieldItems({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            activeStrategies: [{ name: "Strategy", totalDebt: "500000000" }],
            totalDebt: "500000000",
            withdrawable: "500000000",
          },
        ],
        whitelistedTokens: [usdtToken],
      });

      expect(items[0]?.amount).toBeCloseTo(500);
    });

    it("skips treasury tokens missing from the whitelist", function () {
      // USDT yields one strategy; the unknown USDC entry's strategies are skipped.
      const items = toYieldItems({
        prices,
        treasuryTokens: [
          {
            ...baseTreasuryToken,
            activeStrategies: [
              { name: "USDT Strategy", totalDebt: "500000000" },
            ],
            totalDebt: "500000000",
            withdrawable: "500000000",
          },
          {
            ...baseTreasuryToken,
            activeStrategies: [
              { name: "USDC Strategy", totalDebt: "200000000" },
            ],
            tokenAddress: usdcToken.address,
            totalDebt: "200000000",
            withdrawable: "200000000",
          },
        ],
        whitelistedTokens: [usdtToken],
      });

      expect(items).toHaveLength(1);
      expect(items[0]?.label).toBe("USDT Strategy");
    });
  });

  describe("toCollateralizationItems", function () {
    const labels = {
      liquidReserves: "Liquid Reserves",
      strategicReserves: "Strategic Reserves",
      surplus: "Surplus",
    };

    it("returns undefined when data is undefined", function () {
      expect(toCollateralizationItems(undefined, labels)).toBeUndefined();
    });

    it("returns undefined when total is 0", function () {
      const data = {
        strategicReserves: "0",
        surplus: "0",
        total: "0",
        treasuryTotal: "0",
      };
      expect(toCollateralizationItems(data, labels)).toBeUndefined();
    });

    it("computes correct percentages", function () {
      // 100/200 = 50%, 80/200 = 40%, 20/200 = 10%
      const data = {
        strategicReserves: "100",
        surplus: "20",
        total: "200",
        treasuryTotal: "80",
      };
      const items = toCollateralizationItems(data, labels)!;

      expect(items).toHaveLength(3);
      expect(items[0]?.amount).toBe(50);
      expect(items[1]?.amount).toBe(40);
      expect(items[2]?.amount).toBe(10);
    });

    it("sorts items by percentage descending", function () {
      const data = {
        strategicReserves: "10",
        surplus: "50",
        total: "100",
        treasuryTotal: "40",
      };
      const items = toCollateralizationItems(data, labels)!;

      expect(items[0]?.label).toBe("Surplus");
      expect(items[1]?.label).toBe("Liquid Reserves");
      expect(items[2]?.label).toBe("Strategic Reserves");
    });

    it("adjusts largest item so percentages sum to exactly 100", function () {
      // 200/300 = 66.67%, 70/300 = 23.33%, 30/300 = 10% → sum = 100%
      // rounding remainder (0.01) is added to the largest item (66.67 → 66.67)
      const data = {
        strategicReserves: "30",
        surplus: "70",
        total: "300",
        treasuryTotal: "200",
      };
      const items = toCollateralizationItems(data, labels)!;
      const sum = items.reduce((acc, item) => acc + item.amount, 0);

      expect(sum).toBe(100);
      // largest item (Liquid Reserves) absorbs the rounding remainder
      expect(items[0]?.label).toBe("Liquid Reserves");
      expect(items[0]?.amount).toBe(66.67);
      expect(items[1]?.label).toBe("Surplus");
      expect(items[1]?.amount).toBe(23.33);
      expect(items[2]?.label).toBe("Strategic Reserves");
      expect(items[2]?.amount).toBe(10);
    });

    it("handles case where one component is 0", function () {
      const data = {
        strategicReserves: "80",
        surplus: "0",
        total: "100",
        treasuryTotal: "20",
      };
      const items = toCollateralizationItems(data, labels)!;

      expect(items).toHaveLength(3);
      expect(items.find((i) => i.label === "Surplus")?.amount).toBe(0);
      const sum = items.reduce((acc, item) => acc + item.amount, 0);
      expect(sum).toBe(100);
    });
  });
});

import type { Token } from "@vetro-protocol/core";
import type { TreasuryToken, TvlHistoryEntry } from "types";
import { tokenAmountToUsd } from "utils/currency";
import { formatNumber } from "utils/format";
import { formatUnits, isAddressEqual, type Address } from "viem";

type Prices = Record<string, string>;

const colorPalette = [
  "bg-emerald-400",
  "bg-blue-400",
  "bg-amber-400",
  "bg-rose-400",
  "bg-purple-400",
  "bg-cyan-400",
  "bg-orange-400",
  "bg-pink-400",
];

export const assignColor = (index: number) =>
  colorPalette[index % colorPalette.length] ?? "bg-gray-400";

const assignChartColor = (index: number) =>
  assignColor(index).replace(/^bg-(.+)$/, "var(--color-$1)");

const findToken = (tokenAddress: Address, whitelistedTokens: Token[]) =>
  whitelistedTokens.find((t) => isAddressEqual(t.address, tokenAddress));

// Transforms /analytics/treasury response into TVL allocation items.
// withdrawable includes idle funds + deployed strategies (vs totalDebt = strategies only).
export const toTvlItems = ({
  prices,
  treasuryTokens,
  whitelistedTokens,
}: {
  prices: Prices;
  treasuryTokens: TreasuryToken[];
  whitelistedTokens: Token[];
}) =>
  treasuryTokens.flatMap(function ({ tokenAddress, withdrawable }, index) {
    const token = findToken(tokenAddress, whitelistedTokens);
    if (!token) {
      return [];
    }
    const { decimals, symbol } = token;

    return [
      {
        amount: tokenAmountToUsd({
          amount: BigInt(withdrawable),
          prices,
          token,
        }),
        color: assignColor(index),
        label: symbol,
        logoURI: token.logoURI,
        tooltip: `${formatNumber(formatUnits(BigInt(withdrawable), decimals))} ${symbol}`,
      },
    ];
  });

export const getHistoryOnlyTokenAddresses = ({
  history,
  whitelistedTokens,
}: {
  history: TvlHistoryEntry[];
  whitelistedTokens: Token[];
}) =>
  history
    .flatMap((entry) => entry.tokens.map((token) => token.tokenAddress))
    .filter(
      (address, index, addresses) =>
        !findToken(address, whitelistedTokens) &&
        addresses.findIndex((candidate) =>
          isAddressEqual(candidate, address),
        ) === index,
    );

export const toTvlHistorySeries = ({
  history,
  tokens,
}: {
  history: TvlHistoryEntry[];
  tokens: Token[];
}) =>
  tokens.map((token, index) => ({
    address: token.address,
    color: assignChartColor(index),
    data: history.map(function (entry) {
      const holding = entry.tokens.find((candidate) =>
        isAddressEqual(candidate.tokenAddress, token.address),
      );
      const rate =
        holding?.price && holding.unitPrice
          ? Number(holding.price) / Number(holding.unitPrice)
          : 0;
      return {
        x: entry.timestamp,
        y:
          Number(
            formatUnits(BigInt(holding?.withdrawable ?? 0), token.decimals),
          ) *
          rate *
          (entry.pegBaseUsdPrice ?? 0),
      };
    }),
    symbol: token.symbol,
  }));

// Transforms /analytics/treasury response into yield allocation items,
// one item per active strategy across all tokens.
export const toYieldItems = function ({
  prices,
  treasuryTokens,
  whitelistedTokens,
}: {
  prices: Prices;
  treasuryTokens: TreasuryToken[];
  whitelistedTokens: Token[];
}) {
  const items: { amount: number; color: string; label: string }[] = [];

  for (const { activeStrategies, tokenAddress } of treasuryTokens) {
    const token = findToken(tokenAddress, whitelistedTokens);
    if (!token) {
      continue;
    }

    for (const { name, totalDebt } of activeStrategies) {
      const amount = tokenAmountToUsd({
        amount: BigInt(totalDebt),
        prices,
        token,
      });
      if (amount > 0) {
        items.push({ amount, color: assignColor(items.length), label: name });
      }
    }
  }

  return items;
};

// Converts collateralization data into percentage-based allocation items.
// Rounds to 2 decimal places and adjusts the largest item so they sum to exactly 100.
export const toCollateralizationItems = function (
  data:
    | {
        strategicReserves: string;
        surplus: string;
        total: string;
        treasuryTotal: string;
      }
    | undefined,
  labels: {
    liquidReserves: string;
    strategicReserves: string;
    surplus: string;
  },
) {
  if (!data || BigInt(data.total) <= 0n) {
    return undefined;
  }
  const total = BigInt(data.total);
  const toPercentage = (value: string) =>
    Number((BigInt(value) * 10000n + total / 2n) / total) / 100;
  const round = (n: number) => Number(n.toFixed(2));
  const items = [
    {
      amount: toPercentage(data.strategicReserves),
      label: labels.strategicReserves,
    },
    {
      amount: toPercentage(data.treasuryTotal),
      label: labels.liquidReserves,
    },
    {
      amount: toPercentage(data.surplus),
      label: labels.surplus,
    },
  ].sort((a, b) => b.amount - a.amount);

  // Adjust the largest so percentages sum to exactly 100
  const sum = items.reduce((acc, item) => acc + item.amount, 0);
  items[0].amount = round(items[0].amount + (100 - sum));

  return items;
};

// Returns the reserve buffer amount in USD (idle funds not deployed to any strategy).
// Returns 0 when there is no buffer. Color is intentionally omitted — callers assign it.
export const toReserveBufferAmount = function ({
  prices,
  treasuryTokens,
  whitelistedTokens,
}: {
  prices: Prices;
  treasuryTokens: TreasuryToken[];
  whitelistedTokens: Token[];
}) {
  let amount = 0;

  for (const { tokenAddress, totalDebt, withdrawable } of treasuryTokens) {
    const token = findToken(tokenAddress, whitelistedTokens);
    if (!token) continue;

    amount += tokenAmountToUsd({
      amount: BigInt(withdrawable) - BigInt(totalDebt),
      prices,
      token,
    });
  }

  return Math.max(0, amount);
};

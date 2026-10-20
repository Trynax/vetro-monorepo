import { gateways } from "@vetro-protocol/core";
import type { Context } from "hono";
import { type Address, checksumAddress, isAddressEqual } from "viem";

import { appendLivePoint } from "./append-live-point.ts";
import { paginateSubgraphQuery } from "./paginate-subgraph-query.ts";
import {
  getPegBaseUsdRates,
  oldestPricedDay,
  utcDayStart,
} from "./portal-prices.ts";
import { getPeriodStart } from "./vault-history-period.ts";
import { readWarmedTask } from "./warm-cache.ts";
import { treasuryTask, tvlTask } from "./warm-tasks.ts";

type TokenRow = {
  price: string | null;
  tokenAddress: string;
  unitPrice: string | null;
  withdrawable: string;
};

type Row = {
  timestamp: string;
  tokens: TokenRow[];
  totalSupply: string;
};

async function getLiveTvl({
  c,
  gatewayAddress,
}: {
  c: Context<{ Bindings: Env }>;
  gatewayAddress: Address;
}) {
  try {
    const [tvl, treasury] = await Promise.all([
      readWarmedTask({ c, item: gatewayAddress, task: tvlTask }),
      readWarmedTask({ c, item: gatewayAddress, task: treasuryTask }),
    ]);
    return { minted: tvl.minted, treasury };
  } catch (error) {
    console.warn(
      `Failed to read the live TVL for ${gatewayAddress}: ${error.message}`,
    );
    return null;
  }
}

export async function getTvlHistory({
  c,
  gatewayAddress,
  period,
  portalApiUrl,
  url,
}: {
  c: Context<{ Bindings: Env }>;
  gatewayAddress: Address;
  period: string;
  portalApiUrl: string;
  url: string;
}) {
  const gatewayConfig = gateways.find((candidate) =>
    isAddressEqual(candidate.address, gatewayAddress),
  );
  const pegBaseSymbol = gatewayConfig?.pegBaseSymbol ?? "USD";
  // Fixed per gateway: set on the Gateway's initialize() with no setter.
  const peggedTokenAddress = gatewayConfig?.peggedToken ?? null;
  const gateway = gatewayAddress.toLowerCase();
  // A day with no peg-base rate charts as zero, so never ask past the rates.
  const start = Math.max(
    Number(getPeriodStart(period)),
    oldestPricedDay(pegBaseSymbol),
  ).toString();
  const query = `
    query ($first: Int!, $skip: Int!, $gateway: Bytes!, $start: BigInt!) {
      tvlHistories(
        first: $first
        orderBy: timestamp
        orderDirection: asc
        skip: $skip
        where: {
          gatewayAddress: $gateway
          timestamp_gte: $start
        }
      ) {
        timestamp
        totalSupply
        tokens(orderBy: tokenAddress, orderDirection: asc) {
          price
          tokenAddress
          unitPrice
          withdrawable
        }
      }
    }`;

  const [all, rates, live] = await Promise.all([
    paginateSubgraphQuery<Row>({
      cursor: {
        getValue: (row) => row.timestamp,
        variable: "start",
      },
      field: "tvlHistories",
      // A year of days fits in one page, the most graph-node serves.
      pageSize: 1000,
      query,
      url,
      variables: { gateway, start },
    }),
    getPegBaseUsdRates({ pegBaseSymbol, period, portalApiUrl }),
    getLiveTvl({ c, gatewayAddress }),
  ]);

  const toTokens = (tokens: TokenRow[]) =>
    tokens.map((token) => ({
      price: token.price,
      tokenAddress: checksumAddress(token.tokenAddress as Address),
      unitPrice: token.unitPrice,
      withdrawable: token.withdrawable,
    }));

  const history = all.map(function (row) {
    const timestamp = Number.parseInt(row.timestamp, 10) * 1000;
    return {
      pegBaseUsdPrice: rates.at(timestamp),
      peggedTokenAddress,
      timestamp,
      tokens: toTokens(row.tokens),
      totalSupply: row.totalSupply,
    };
  });

  const liveTimestamp = utcDayStart(Date.now());
  const livePoint =
    live === null
      ? null
      : {
          pegBaseUsdPrice: rates.live,
          peggedTokenAddress,
          timestamp: liveTimestamp,
          tokens: toTokens(
            live.treasury.map((token) => ({
              price: token.latestPrice,
              tokenAddress: token.tokenAddress,
              unitPrice: (10n ** BigInt(token.priceDecimals)).toString(),
              withdrawable: token.withdrawable,
            })),
          ),
          totalSupply: live.minted,
        };

  return appendLivePoint({
    getValue: (point) => point.totalSupply,
    history,
    livePoint,
  });
}

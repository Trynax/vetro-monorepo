import fetch from "fetch-plus-plus";
import { type Address } from "viem";

// See public subgraph https://thegraph.com/explorer/subgraphs/2tGWMrDha4164KkFAfkU3rDCtuxGb4q1emXmFdLLzJ8x?view=Query&chain=arbitrum-one
const SUSHI_SUBGRAPH_URL = "/api/sushi-subgraph";

// No pagination: a pool with more than 1000 swaps in the window is measured on
// its first 1000 only. Tracked pools are far below that today.
const swapsQuery = `
  query PoolSwaps($pool: String!, $since: BigInt!) {
    before: swaps(
      first: 1
      orderBy: timestamp
      orderDirection: desc
      where: { pool: $pool, timestamp_lte: $since }
    ) {
      tick
    }
    window: swaps(
      first: 1000
      orderBy: timestamp
      orderDirection: asc
      where: { pool: $pool, timestamp_gt: $since }
    ) {
      amountInUSD
      blockNumber
      logIndex
      tick
      timestamp
    }
  }
`;

type RawSwap = {
  amountInUSD: string;
  blockNumber: string;
  logIndex: number;
  tick: string | null;
  timestamp: string;
};

type PoolSwapsResponse = {
  data?: { before: { tick: string | null }[]; window: RawSwap[] };
  errors?: { message: string }[];
};

export const fetchPoolSwaps = async function ({
  poolAddress,
  sinceSeconds,
}: {
  poolAddress: Address;
  sinceSeconds: number;
}) {
  const body: PoolSwapsResponse = await fetch(SUSHI_SUBGRAPH_URL, {
    body: JSON.stringify({
      query: swapsQuery,
      variables: {
        pool: poolAddress.toLowerCase(),
        since: String(Math.floor(sinceSeconds)),
      },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  if (body.errors?.length) {
    const reason = body.errors.map((error) => error.message).join("; ");
    throw new Error(`Sushi subgraph error for pool ${poolAddress}: ${reason}`);
  }
  if (!body.data) {
    throw new Error(`Sushi subgraph returned no data for pool ${poolAddress}`);
  }
  // `before` is the last swap ahead of the window: its tick is where the first
  // swap starts, to split its volume and fees between in and out of the band.
  const startTick = body.data.before[0]?.tick;
  return {
    startTick: startTick ? Number(startTick) : undefined,
    // Swaps in one block share a timestamp, so sort them by execution order.
    swaps: body.data.window
      .filter((swap) => swap.tick !== null)
      .sort(
        (a, b) =>
          Number(a.blockNumber) - Number(b.blockNumber) ||
          a.logIndex - b.logIndex,
      )
      .map((swap) => ({
        tick: Number(swap.tick),
        timestamp: Number(swap.timestamp),
        volumeUsd: Number(swap.amountInUSD),
      })),
  };
};

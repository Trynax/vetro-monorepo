import fetch from "fetch-plus-plus";
import { type Address, getAddress } from "viem";

// Sushi's own data API — the backend of sushi.com's pool pages
// (https://www.sushi.com/ethereum/pool/v3/<address>). Direct browser calls fail
// in the deployed environment (they work from localhost), so requests go through
// the worker's /api/sushi proxy (src/index.ts), which forwards them server-side
// and sidesteps the browser's cross-origin restrictions. Sushi is the source for
// everything the dashboard renders about a whole pool; the per-tick liquidity a
// price band needs isn't published here and is read on-chain (lib/v3PoolState).
const SUSHI_API_URL = "/api/sushi";

// Ethereum mainnet — everything the dashboard tracks lives here.
const CHAIN_ID = 1;

// Everything the full-pool entry renders, in one query. APRs come back as
// fractions (0.01 = 1%); reserves are raw on-chain balances as decimal strings.
const query = `
  query V3Pool($address: Bytes!, $chainId: SushiSwapV3ChainId!) {
    v3Pool(address: $address, chainId: $chainId) {
      feeApr1d
      feeUSD1d
      liquidityUSD
      name
      reserve0
      reserve1
      swapFee
      token0 {
        address
        decimals
        symbol
      }
      token0Price
      token1 {
        address
        decimals
        symbol
      }
      token1Price
      volumeUSD1d
    }
  }
`;

export type SushiToken = { address: Address; decimals: number; symbol: string };

type RawV3Pool = {
  feeApr1d: number;
  feeUSD1d: number;
  liquidityUSD: number;
  name: string;
  reserve0: string;
  reserve1: string;
  swapFee: number;
  token0: SushiToken;
  token0Price: number;
  token1: SushiToken;
  token1Price: number;
  volumeUSD1d: number;
};

type SushiPoolData = {
  baseApy: number; // % from trading fees
  feesUsd24h: number;
  liquidityUsd: number; // whole-pool TVL, as Sushi values it
  name: string;
  reserve0: bigint; // raw balance of token0 held by the pool
  reserve1: bigint;
  swapFee: number; // fee tier as a fraction (0.0005 = 0.05%)
  token0: SushiToken;
  token0Price: number; // token0 per token1
  token1: SushiToken;
  token1Price: number; // token1 per token0
  volumeUsd24h: number;
};

// Everything the dashboard renders about a Sushi v3 pool, in one request. Throws
// when the pool isn't found so the caller drops it rather than list it empty.
export const fetchSushiPoolData = async function (
  address: Address,
): Promise<SushiPoolData> {
  const body: {
    data?: { v3Pool: RawV3Pool | null };
    errors?: { message: string }[];
  } = await fetch(SUSHI_API_URL, {
    body: JSON.stringify({
      query,
      variables: { address, chainId: CHAIN_ID },
    }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  // GraphQL reports failures as a 200 with an `errors` array; surface the real
  // message rather than letting it fall through to a misleading "not found".
  if (body.errors?.length) {
    const reason = body.errors.map((error) => error.message).join("; ");
    throw new Error(`Sushi API error for pool ${address}: ${reason}`);
  }
  const pool = body.data?.v3Pool;
  if (!pool) {
    throw new Error(`Sushi pool ${address} not found`);
  }
  return {
    baseApy: pool.feeApr1d * 100,
    feesUsd24h: pool.feeUSD1d,
    liquidityUsd: pool.liquidityUSD,
    name: pool.name,
    reserve0: BigInt(pool.reserve0),
    reserve1: BigInt(pool.reserve1),
    swapFee: pool.swapFee,
    token0: { ...pool.token0, address: getAddress(pool.token0.address) },
    token0Price: pool.token0Price,
    token1: { ...pool.token1, address: getAddress(pool.token1.address) },
    token1Price: pool.token1Price,
    volumeUsd24h: pool.volumeUSD1d,
  };
};

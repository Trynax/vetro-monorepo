type PricedCoin = {
  amount: number;
  usdPrice: number | undefined;
};

export const poolTvlUsd = function (coins: PricedCoin[]) {
  let total = 0;
  for (const coin of coins) {
    if (coin.usdPrice === undefined) {
      return null;
    }
    total += coin.amount * coin.usdPrice;
  }
  return total;
};

export function feeApr({
  feesUsd24h,
  tvlUsd,
}: {
  feesUsd24h: number;
  tvlUsd: number | null;
}) {
  if (tvlUsd === null) {
    return null;
  }
  return tvlUsd > 0 ? ((feesUsd24h * 365) / tvlUsd) * 100 : 0;
}

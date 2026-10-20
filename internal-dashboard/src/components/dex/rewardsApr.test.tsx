import { renderToStaticMarkup } from "react-dom/server";
import { type Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { usePoolCampaigns } from "../../hooks/usePoolCampaigns";
import { useStakeDaoStrategy } from "../../hooks/useStakeDaoStrategy";
import { type StakeDaoStrategy } from "../../lib/stakeDaoApi";
import {
  type MerklPoolCampaign,
  type PoolCampaign,
  type TrackedPool,
} from "../../lib/types";

import { RewardsApr } from "./rewardsApr";

vi.mock("../../hooks/usePoolCampaigns", () => ({
  usePoolCampaigns: vi.fn(),
}));

vi.mock("../../hooks/useStakeDaoStrategy", () => ({
  useStakeDaoStrategy: vi.fn(),
}));

type QueryState<T> = {
  data: T | undefined;
  dataUpdatedAt: number;
  error: Error | null;
};

const nowSeconds = 1_000_000;
const day = 24 * 60 * 60;

const pending = <T,>(): QueryState<T> => ({
  data: undefined,
  dataUpdatedAt: 0,
  error: null,
});

const settled = <T,>(data: T): QueryState<T> => ({
  data,
  dataUpdatedAt: nowSeconds * 1000,
  error: null,
});

const failed = <T,>(message: string): QueryState<T> => ({
  data: undefined,
  dataUpdatedAt: 0,
  error: new Error(message),
});

const gauge: Address = "0x737e7700e03A8c451C9B72103554a40760F1B57A";

const pool = ({
  dex,
  emissionApr = 0,
  emissionAprMax = 0,
  gaugeAddress,
}: {
  dex: TrackedPool["dex"];
  emissionApr?: number;
  emissionAprMax?: number;
  gaugeAddress: Address | undefined;
}): TrackedPool => ({
  address: `0x${"2".repeat(40)}`,
  baseApy: undefined,
  chainId: 1,
  coins: [],
  dex,
  emissionApr,
  emissionAprMax,
  gaugeAddress,
  id: "pool-1",
  lpTokenAddress: undefined,
  name: "pool-1",
  poolType: "factory-stable-ng",
  tvlUsd: undefined,
  url: "https://example.com",
  virtualPrice: 1,
  volumeUsd24h: 0,
});

const gaugedCurvePool = pool({
  dex: "curve",
  emissionApr: 3,
  emissionAprMax: 7.5,
  gaugeAddress: gauge,
});
const gaugedCurvePoolWithoutEmission = pool({
  dex: "curve",
  gaugeAddress: gauge,
});
const gaugelessCurvePool = pool({ dex: "curve", gaugeAddress: undefined });
const sushiPool = pool({ dex: "sushi", gaugeAddress: undefined });

const merklCampaign = (
  overrides: Partial<MerklPoolCampaign> & { aprPercent: number; id: string },
): MerklPoolCampaign => ({
  dailyRewardsUsd: 100,
  endTimestamp: nowSeconds + 3 * day,
  name: "VUSD pool",
  rewardTokenSymbol: "VUSD",
  source: "merkl",
  tvlUsd: 1000,
  url: "https://merkl.xyz",
  ...overrides,
});

const stakeDaoCampaign: PoolCampaign = {
  campaignNumber: 7,
  endTimestamp: nowSeconds + 5 * day,
  id: "stake-dao-1",
  rewardTokenSymbol: "VUSD",
  source: "stakeDao",
  totalRewardUsd: 1000,
  usdPerVote: 0.1,
  weeklyRewardUsd: 500,
};

const strategy: StakeDaoStrategy = {
  apr: { current: { total: 12.25 } },
  gaugeAddress: gauge,
  key: "1-0x102a475c8d660fde678d108dcc6d4a2227661af2",
  rewards: [{ apr: 0, end: 0, token: { symbol: "CRV" } }],
  tradingApy: 0.25,
};

// Formatted independently of formatAprRange: 3 → 7.5 unboosted/max boost.
const crvLine = "3.00% → 7.50%";
// 12.25 total minus 0.25 trading APY.
const stakeDaoLine = "12.00%";
const merklHighLine = "8.00%";
const merklLowLine = "5.00%";

const placeholder = "animate-pulse";

const mockQueries = function ({
  campaigns,
  strategy: strategyState,
}: {
  campaigns: QueryState<PoolCampaign[]>;
  strategy: QueryState<StakeDaoStrategy | null>;
}) {
  // @ts-expect-error only the fields the component reads are mocked
  vi.mocked(usePoolCampaigns).mockReturnValue(campaigns);
  // @ts-expect-error only the fields the component reads are mocked
  vi.mocked(useStakeDaoStrategy).mockReturnValue(strategyState);
};

const render = (rewardsPool: TrackedPool) =>
  renderToStaticMarkup(<RewardsApr align="end" pool={rewardsPool} />);

const tooltipLabels = (markup: string) =>
  [...markup.matchAll(/role="tooltip">([^<]*)</g)].map((match) => match[1]);

const allCampaigns = [
  merklCampaign({ aprPercent: 5, id: "merkl-low" }),
  stakeDaoCampaign,
  merklCampaign({ aprPercent: 8, id: "merkl-high", rewardTokenSymbol: "OP" }),
];

describe("RewardsApr", function () {
  beforeEach(function () {
    vi.resetAllMocks();
  });

  describe("pools that can't have a StakeDAO strategy", function () {
    it("renders Merkl rows for a non-Curve pool while the strategy query is pending", function () {
      mockQueries({
        campaigns: settled([merklCampaign({ aprPercent: 5, id: "merkl-low" })]),
        strategy: pending(),
      });

      const markup = render(sushiPool);

      expect(markup).not.toContain(placeholder);
      expect(markup).toContain(merklLowLine);
      expect(markup).toContain("VUSD");
    });

    it("renders Merkl rows for a gaugeless Curve pool while the strategy query is pending", function () {
      mockQueries({
        campaigns: settled([merklCampaign({ aprPercent: 5, id: "merkl-low" })]),
        strategy: pending(),
      });

      const markup = render(gaugelessCurvePool);

      expect(markup).not.toContain(placeholder);
      expect(markup).toContain(merklLowLine);
    });

    it("still waits on the campaigns query", function () {
      mockQueries({ campaigns: pending(), strategy: settled(null) });

      const markup = render(sushiPool);

      expect(markup).toContain(placeholder);
      expect(markup).not.toContain("%");
    });

    it("shows a plain dash, ignoring a strategy error, when there are no rows", function () {
      mockQueries({
        campaigns: settled([]),
        strategy: failed("StakeDAO is down"),
      });

      const markup = render(sushiPool);

      expect(markup).toContain("—");
      expect(markup).not.toContain(placeholder);
      expect(markup).not.toContain("StakeDAO is down");
      expect(tooltipLabels(markup)).toEqual([]);
    });

    it("ignores a strategy error for a gaugeless Curve pool too", function () {
      mockQueries({
        campaigns: settled([]),
        strategy: failed("StakeDAO is down"),
      });

      const markup = render(gaugelessCurvePool);

      expect(markup).toContain("—");
      expect(tooltipLabels(markup)).toEqual([]);
    });

    it("shows the campaigns error on the dash", function () {
      mockQueries({
        campaigns: failed("Merkl is down"),
        strategy: failed("StakeDAO is down"),
      });

      const markup = render(sushiPool);

      expect(markup).toContain("—");
      expect(tooltipLabels(markup)).toEqual(["Merkl is down"]);
    });
  });

  describe("Curve pools with a gauge", function () {
    it("renders the CRV line above the placeholder while the strategy query is pending", function () {
      mockQueries({ campaigns: settled(allCampaigns), strategy: pending() });

      const markup = render(gaugedCurvePool);

      expect(markup).toContain(crvLine);
      expect(markup).toContain(placeholder);
      expect(markup.indexOf(crvLine)).toBeLessThan(markup.indexOf(placeholder));
      // No partial Merkl/StakeDAO rows while a source is pending.
      expect(markup).not.toContain(merklHighLine);
      expect(markup).not.toContain(merklLowLine);
      expect(markup).not.toContain(stakeDaoLine);
    });

    it("renders the CRV line above the placeholder while the campaigns query is pending", function () {
      mockQueries({ campaigns: pending(), strategy: settled(strategy) });

      const markup = render(gaugedCurvePool);

      expect(markup).toContain(crvLine);
      expect(markup.indexOf(crvLine)).toBeLessThan(markup.indexOf(placeholder));
      expect(markup).not.toContain(stakeDaoLine);
    });

    it("renders only the placeholder while pending when the pool has no gauge emission", function () {
      mockQueries({ campaigns: settled(allCampaigns), strategy: pending() });

      const markup = render(gaugedCurvePoolWithoutEmission);

      expect(markup).toContain(placeholder);
      expect(markup).not.toContain("%");
    });

    it("renders CRV, StakeDAO, then Merkl by APR once both queries settle", function () {
      mockQueries({
        campaigns: settled(allCampaigns),
        strategy: settled(strategy),
      });

      const markup = render(gaugedCurvePool);

      expect(markup).not.toContain(placeholder);
      const positions = [
        crvLine,
        stakeDaoLine,
        merklHighLine,
        merklLowLine,
      ].map((line) => markup.indexOf(line));
      expect(positions.every((position) => position >= 0)).toBe(true);
      expect(positions).toEqual([...positions].sort((a, b) => a - b));
    });

    it("treats a failed strategy query as empty once settled", function () {
      mockQueries({
        campaigns: settled(allCampaigns),
        strategy: failed("StakeDAO is down"),
      });

      const markup = render(gaugedCurvePool);

      expect(markup).not.toContain(placeholder);
      expect(markup).toContain(crvLine);
      expect(markup).toContain(merklHighLine);
      expect(markup).toContain(merklLowLine);
      expect(markup).not.toContain(stakeDaoLine);
      expect(markup).not.toContain("StakeDAO is down");
    });

    it("treats a failed campaigns query as empty once settled", function () {
      mockQueries({
        campaigns: failed("Merkl is down"),
        strategy: settled(strategy),
      });

      const markup = render(gaugedCurvePool);

      expect(markup).not.toContain(placeholder);
      expect(markup).toContain(crvLine);
      // The strategy row needs an active StakeDAO campaign.
      expect(markup).not.toContain(stakeDaoLine);
      expect(markup).not.toContain("Merkl is down");
    });

    it("renders settled rows without waiting on the strategy when there's no StakeDAO campaign", function () {
      mockQueries({
        campaigns: settled([merklCampaign({ aprPercent: 5, id: "merkl-low" })]),
        strategy: pending(),
      });

      const markup = render(gaugedCurvePool);

      expect(markup).not.toContain(placeholder);
      expect(markup).toContain(crvLine);
      expect(markup).toContain(merklLowLine);
    });

    it("shows the strategy error on the dash when there are no rows", function () {
      mockQueries({
        campaigns: settled([stakeDaoCampaign]),
        strategy: failed("StakeDAO is down"),
      });

      const markup = render(gaugedCurvePoolWithoutEmission);

      expect(markup).toContain("—");
      expect(tooltipLabels(markup)).toEqual(["StakeDAO is down"]);
    });

    it("ignores a strategy error on the dash when there's no StakeDAO campaign", function () {
      mockQueries({
        campaigns: settled([]),
        strategy: failed("StakeDAO is down"),
      });

      const markup = render(gaugedCurvePoolWithoutEmission);

      expect(markup).toContain("—");
      expect(tooltipLabels(markup)).toEqual([]);
    });

    it("prefers the campaigns error on the dash when both fail", function () {
      mockQueries({
        campaigns: failed("Merkl is down"),
        strategy: failed("StakeDAO is down"),
      });

      const markup = render(gaugedCurvePoolWithoutEmission);

      expect(tooltipLabels(markup)).toEqual(["Merkl is down"]);
    });
  });
});

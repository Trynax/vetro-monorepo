import { type Client, type Hash, TransactionReceiptNotFoundError } from "viem";
import { getTransactionReceipt } from "viem/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Activity } from "../../src/components/base/activityList/types";
import {
  createPendingActivityStatus,
  getPendingActivitiesToReconcile,
  shouldStopPendingActivityPolling,
} from "../../src/utils/reconcilePendingActivity";

vi.mock("viem/actions", () => ({
  getTransactionReceipt: vi.fn(),
}));

const transactionHash =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as Hash;
const publicClient = { chain: { id: 1 } } as unknown as Client;
const getPendingActivityStatus = createPendingActivityStatus(publicClient);

const createActivity = (overrides: Partial<Activity> = {}): Activity => ({
  date: 0,
  page: "borrow",
  status: "pending",
  text: "Borrow more VUSD",
  title: "Borrow",
  txHash: transactionHash,
  ...overrides,
});

describe("getPendingActivitiesToReconcile", function () {
  it("includes pending non-bridge activities", function () {
    const activity = createActivity();
    const completedActivity = createActivity({ status: "completed" });
    const bridgeActivity = createActivity({ page: "bridge" });

    expect(
      getPendingActivitiesToReconcile({
        activities: [activity, completedActivity, bridgeActivity],
      }),
    ).toEqual([activity]);
  });
});

describe("getPendingActivityStatus", function () {
  beforeEach(function resetMocks() {
    vi.clearAllMocks();
  });

  it("maps a successful receipt to a completed activity", async function () {
    vi.mocked(getTransactionReceipt).mockResolvedValue({
      status: "success",
    } as never);

    await expect(getPendingActivityStatus(createActivity())).resolves.toBe(
      "completed",
    );
    expect(getTransactionReceipt).toHaveBeenCalledExactlyOnceWith(
      publicClient,
      { hash: transactionHash },
    );
  });

  it("maps a reverted receipt to a failed activity", async function () {
    vi.mocked(getTransactionReceipt).mockResolvedValue({
      status: "reverted",
    } as never);

    await expect(getPendingActivityStatus(createActivity())).resolves.toBe(
      "failed",
    );
  });

  it("keeps an activity pending when no receipt is available", async function () {
    vi.mocked(getTransactionReceipt).mockRejectedValue(
      new TransactionReceiptNotFoundError({ hash: transactionHash }),
    );

    await expect(
      getPendingActivityStatus(createActivity()),
    ).resolves.toBeNull();
  });

  it("rethrows errors when the receipt lookup fails", async function () {
    vi.mocked(getTransactionReceipt).mockRejectedValue(
      new Error("RPC unavailable"),
    );

    await expect(getPendingActivityStatus(createActivity())).rejects.toThrow(
      "RPC unavailable",
    );
  });

  it("does not reconcile bridge activities", async function () {
    await expect(
      getPendingActivityStatus(createActivity({ page: "bridge" })),
    ).resolves.toBeUndefined();
    expect(getTransactionReceipt).not.toHaveBeenCalled();
  });

  it("does not reconcile activities that are no longer pending", async function () {
    await expect(
      getPendingActivityStatus(createActivity({ status: "completed" })),
    ).resolves.toBeUndefined();
    expect(getTransactionReceipt).not.toHaveBeenCalled();
  });
});

describe("shouldStopPendingActivityPolling", function () {
  const now = 1_000;
  const maxAge = 100;

  it("stops stale activities after a missing receipt", function () {
    expect(
      shouldStopPendingActivityPolling({
        activity: createActivity({ date: now - maxAge - 1 }),
        data: null,
        error: null,
        maxAge,
        now,
      }),
    ).toBe(true);
  });

  it("stops stale activities after an RPC error", function () {
    expect(
      shouldStopPendingActivityPolling({
        activity: createActivity({ date: now - maxAge - 1 }),
        data: undefined,
        error: new Error("RPC unavailable"),
        maxAge,
        now,
      }),
    ).toBe(true);
  });

  it("keeps fresh activities polling after an RPC error", function () {
    expect(
      shouldStopPendingActivityPolling({
        activity: createActivity({ date: now - maxAge + 1 }),
        data: undefined,
        error: new Error("RPC unavailable"),
        maxAge,
        now,
      }),
    ).toBe(false);
  });
});

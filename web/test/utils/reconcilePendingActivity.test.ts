import { TransactionReceiptNotFoundError, type Client, type Hash } from "viem";
import { getTransactionReceipt } from "viem/actions";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Activity } from "../../src/components/base/activityList/types";
import {
  createPendingActivityStatus,
  getPendingActivitiesToReconcile,
  shouldMarkPendingActivityAsChecked,
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
  const now = 1_000;
  const maxAge = 100;

  it("includes fresh pending activities", function () {
    const activity = createActivity({ date: now - maxAge + 1 });

    expect(
      getPendingActivitiesToReconcile({
        activities: [activity],
        checkedHashes: new Set([activity.txHash]),
        maxAge,
        now,
      }),
    ).toEqual([activity]);
  });

  it("includes a stale activity until it has been checked", function () {
    const activity = createActivity({ date: now - maxAge - 1 });

    expect(
      getPendingActivitiesToReconcile({
        activities: [activity],
        checkedHashes: new Set(),
        maxAge,
        now,
      }),
    ).toEqual([activity]);
  });

  it("excludes a stale activity after it has been checked", function () {
    const activity = createActivity({ date: now - maxAge - 1 });

    expect(
      getPendingActivitiesToReconcile({
        activities: [activity],
        checkedHashes: new Set([activity.txHash]),
        maxAge,
        now,
      }),
    ).toEqual([]);
  });

  it("applies the cutoff using the current time", function () {
    const activity = createActivity({ date: now - maxAge + 1 });
    const checkedHashes = new Set([activity.txHash]);

    expect(
      getPendingActivitiesToReconcile({
        activities: [activity],
        checkedHashes,
        maxAge,
        now,
      }),
    ).toEqual([activity]);
    expect(
      getPendingActivitiesToReconcile({
        activities: [activity],
        checkedHashes,
        maxAge,
        now: now + 2,
      }),
    ).toEqual([]);
  });

  it("excludes completed and bridge activities", function () {
    const completedActivity = createActivity({ status: "completed" });
    const bridgeActivity = createActivity({ page: "bridge" });

    expect(
      getPendingActivitiesToReconcile({
        activities: [completedActivity, bridgeActivity],
        checkedHashes: new Set(),
        maxAge,
        now,
      }),
    ).toEqual([]);
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

describe("shouldMarkPendingActivityAsChecked", function () {
  const now = 1_000;
  const maxAge = 100;

  it("marks stale activities after a failed receipt lookup", function () {
    expect(
      shouldMarkPendingActivityAsChecked({
        activity: createActivity({ date: now - maxAge - 1 }),
        maxAge,
        now,
        status: undefined,
      }),
    ).toBe(true);
  });

  it("keeps fresh activities eligible after a failed receipt lookup", function () {
    expect(
      shouldMarkPendingActivityAsChecked({
        activity: createActivity({ date: now - maxAge + 1 }),
        maxAge,
        now,
        status: undefined,
      }),
    ).toBe(false);
  });
});

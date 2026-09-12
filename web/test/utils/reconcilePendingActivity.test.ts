import { TransactionReceiptNotFoundError, type Hash } from "viem";
import { describe, expect, it, vi } from "vitest";

import type { Activity } from "../../src/components/base/activityList/types";
import {
  getPendingActivitiesToReconcile,
  getPendingActivityStatus,
} from "../../src/utils/reconcilePendingActivity";

const transactionHash =
  "0x0000000000000000000000000000000000000000000000000000000000000001" as Hash;

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
  it("maps a successful receipt to a completed activity", async function () {
    const getReceipt = vi.fn(async () => ({ status: "success" as const }));

    await expect(
      getPendingActivityStatus({
        activity: createActivity(),
        getReceipt,
      }),
    ).resolves.toBe("completed");
    expect(getReceipt).toHaveBeenCalledExactlyOnceWith(transactionHash);
  });

  it("maps a reverted receipt to a failed activity", async function () {
    const getReceipt = vi.fn(async () => ({ status: "reverted" as const }));

    await expect(
      getPendingActivityStatus({
        activity: createActivity(),
        getReceipt,
      }),
    ).resolves.toBe("failed");
  });

  it("keeps an activity pending when no receipt is available", async function () {
    const getReceipt = vi
      .fn()
      .mockRejectedValue(
        new TransactionReceiptNotFoundError({ hash: transactionHash }),
      );

    await expect(
      getPendingActivityStatus({
        activity: createActivity(),
        getReceipt,
      }),
    ).resolves.toBeNull();
  });

  it("does not mark an activity as checked when the receipt lookup fails", async function () {
    const getReceipt = vi.fn().mockRejectedValue(new Error("RPC unavailable"));

    await expect(
      getPendingActivityStatus({
        activity: createActivity(),
        getReceipt,
      }),
    ).resolves.toBeUndefined();
  });

  it("does not reconcile bridge activities", async function () {
    const getReceipt = vi.fn(async () => ({ status: "success" as const }));

    await expect(
      getPendingActivityStatus({
        activity: createActivity({ page: "bridge" }),
        getReceipt,
      }),
    ).resolves.toBeUndefined();
    expect(getReceipt).not.toHaveBeenCalled();
  });

  it("does not reconcile activities that are no longer pending", async function () {
    const getReceipt = vi.fn(async () => ({ status: "success" as const }));

    await expect(
      getPendingActivityStatus({
        activity: createActivity({ status: "completed" }),
        getReceipt,
      }),
    ).resolves.toBeUndefined();
    expect(getReceipt).not.toHaveBeenCalled();
  });
});

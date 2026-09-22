import {
  type Hash,
  TransactionReceiptNotFoundError,
  type TransactionReceipt,
} from "viem";

import type { Activity } from "../components/base/activityList/types";

type PendingActivityStatus = "completed" | "failed" | null | undefined;

export const getPendingActivitiesToReconcile = ({
  activities,
  checkedHashes,
  maxAge,
  now,
}: {
  activities: Activity[];
  checkedHashes: ReadonlySet<string>;
  maxAge: number;
  now: number;
}) =>
  // Give persisted activities one receipt lookup after a new session starts,
  // even when they are already older than the polling cutoff.
  activities.filter(
    (activity) =>
      activity.status === "pending" &&
      activity.page !== "bridge" &&
      (now - activity.date < maxAge || !checkedHashes.has(activity.txHash)),
  );

// Fresh activities can retry transient lookup errors, but stale activities
// should stop polling after their final lookup regardless of its result.
export const shouldMarkPendingActivityAsChecked = ({
  activity,
  maxAge,
  now,
  status,
}: {
  activity: Activity;
  maxAge: number;
  now: number;
  status: PendingActivityStatus;
}) => status !== undefined || now - activity.date >= maxAge;

type ReceiptReader = (
  hash: Hash,
) => Promise<Pick<TransactionReceipt, "status">>;

export async function getPendingActivityStatus({
  activity,
  getReceipt,
}: {
  activity: Activity;
  getReceipt: ReceiptReader;
}): Promise<"completed" | "failed" | null | undefined> {
  if (activity.status !== "pending" || activity.page === "bridge") {
    return undefined;
  }

  try {
    const receipt = await getReceipt(activity.txHash as Hash);
    return receipt.status === "success" ? "completed" : "failed";
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) {
      // A missing receipt means the transaction is still pending. The lookup
      // completed, so stale activities do not need to be checked again.
      return null;
    }

    // Keep the activity eligible for another attempt when the RPC is
    // temporarily unavailable.
    return undefined;
  }
}

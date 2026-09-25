import { type Client, type Hash, TransactionReceiptNotFoundError } from "viem";
import { getTransactionReceipt } from "viem/actions";

import type { Activity } from "../components/base/activityList/types";

export const getPendingActivitiesToReconcile = ({
  activities,
}: {
  activities: Activity[];
}) =>
  activities.filter(
    (activity) => activity.status === "pending" && activity.page !== "bridge",
  );

// Fresh activities can retry transient lookup errors, but stale activities
// should stop polling after their final lookup regardless of its result.
export const shouldStopPendingActivityPolling = ({
  activity,
  data,
  error,
  maxAge,
  now,
}: {
  activity: Activity;
  data: unknown;
  error: unknown;
  maxAge: number;
  now: number;
}) => now - activity.date >= maxAge && (data !== undefined || error !== null);

export const createPendingActivityStatus = (publicClient: Client) =>
  async function getPendingActivityStatus(
    activity: Activity,
  ): Promise<"completed" | "failed" | null | undefined> {
    if (activity.status !== "pending" || activity.page === "bridge") {
      return undefined;
    }

    try {
      const receipt = await getTransactionReceipt(publicClient, {
        hash: activity.txHash as Hash,
      });
      return receipt.status === "success" ? "completed" : "failed";
    } catch (error) {
      if (error instanceof TransactionReceiptNotFoundError) {
        // A missing receipt means the transaction is still pending. The lookup
        // completed, so stale activities do not need to be checked again.
        return null;
      }

      // Let React Query handle the failed lookup so the activity remains
      // eligible for another polling attempt.
      throw error;
    }
  };

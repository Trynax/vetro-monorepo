import { useQueries } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { useAccount } from "wagmi";

import { updateActivity, useActivities } from "../stores/activityStore";
import { SECONDS_PER_DAY, unixNowTimestamp } from "../utils/date";
import {
  createPendingActivityStatus,
  getPendingActivitiesToReconcile,
  shouldMarkPendingActivityAsChecked,
} from "../utils/reconcilePendingActivity";

import { useEthereumClient } from "./useEthereumClient";

const pendingActivityPollInterval = 10_000;
const pendingActivityMaxAge = SECONDS_PER_DAY;

type PendingActivityStatus = "completed" | "failed" | null | undefined;

export function usePendingActivityReconciliation() {
  const { address } = useAccount();
  const activities = useActivities(address);
  const publicClient = useEthereumClient();
  const checkedHashesRef = useRef(new Set<string>());
  const [checkedHashVersion, setCheckedHashVersion] = useState(0);
  const getPendingActivityStatus = useMemo(
    () =>
      publicClient ? createPendingActivityStatus(publicClient) : undefined,
    [publicClient],
  );

  // Bridge transactions can start on several chains, and source confirmation
  // does not mean that the bridged funds have arrived. They need separate
  // delivery tracking.
  const pendingActivities = useMemo(
    () =>
      getPendingActivitiesToReconcile({
        activities,
        checkedHashes: checkedHashesRef.current,
        maxAge: pendingActivityMaxAge,
        now: unixNowTimestamp(),
      }),
    [activities, checkedHashVersion],
  );

  function markStaleActivityAsChecked({
    activity,
    now,
    status,
  }: {
    activity: (typeof pendingActivities)[number];
    now: number;
    status: PendingActivityStatus;
  }) {
    if (
      now - activity.date < pendingActivityMaxAge ||
      !shouldMarkPendingActivityAsChecked({
        activity,
        maxAge: pendingActivityMaxAge,
        now,
        status,
      }) ||
      checkedHashesRef.current.has(activity.txHash)
    ) {
      return;
    }

    checkedHashesRef.current.add(activity.txHash);
    setCheckedHashVersion((version) => version + 1);
  }

  useQueries({
    queries: pendingActivities.map((activity) => ({
      enabled: Boolean(address && publicClient),
      queryFn: async function reconcileActivity() {
        const now = unixNowTimestamp();

        if (!getPendingActivityStatus) {
          return null;
        }

        try {
          const status = await getPendingActivityStatus(activity);

          markStaleActivityAsChecked({ activity, now, status });

          if (status) {
            updateActivity(address!, activity.txHash, { status });
          }

          return status ?? null;
        } catch (error) {
          markStaleActivityAsChecked({
            activity,
            now,
            status: undefined,
          });
          throw error;
        }
      },
      queryKey: ["pending-activity-reconciliation", address, activity.txHash],
      refetchInterval: () =>
        unixNowTimestamp() - activity.date >= pendingActivityMaxAge &&
        checkedHashesRef.current.has(activity.txHash)
          ? false
          : pendingActivityPollInterval,
      refetchIntervalInBackground: true,
      retry: false,
    })),
  });
}

import { type Query, useQueries } from "@tanstack/react-query";
import { useEthereumClient } from "hooks/useEthereumClient";
import { useMemo } from "react";
import { updateActivity, useActivities } from "stores/activityStore";
import { SECONDS_PER_DAY, unixNowTimestamp } from "utils/date";
import {
  createPendingActivityStatus,
  getPendingActivitiesToReconcile,
  shouldStopPendingActivityPolling,
} from "utils/reconcilePendingActivity";
import { useAccount } from "wagmi";

const pendingActivityPollInterval = 10_000;
const pendingActivityMaxAge = SECONDS_PER_DAY;

export function usePendingActivityReconciliation() {
  const { address } = useAccount();
  const activities = useActivities(address);
  const publicClient = useEthereumClient();
  const getPendingActivityStatus = useMemo(
    () => createPendingActivityStatus(publicClient!),
    [publicClient],
  );

  // Bridge transactions can start on several chains, and source confirmation
  // does not mean that the bridged funds have arrived. They need separate
  // delivery tracking.
  const pendingActivities = useMemo(
    () => getPendingActivitiesToReconcile({ activities }),
    [activities],
  );

  useQueries({
    queries: pendingActivities.map((activity) => ({
      enabled: Boolean(address && publicClient),
      queryFn: async function reconcileActivity() {
        const status = await getPendingActivityStatus(activity);

        if (status) {
          updateActivity(address!, activity.txHash, { status });
        }

        return status ?? null;
      },
      queryKey: ["pending-activity-reconciliation", address, activity.txHash],
      refetchInterval: (query: Query) =>
        shouldStopPendingActivityPolling({
          activity,
          data: query.state.data,
          error: query.state.error,
          maxAge: pendingActivityMaxAge,
          now: unixNowTimestamp(),
        })
          ? false
          : pendingActivityPollInterval,
      refetchIntervalInBackground: true,
      refetchOnReconnect: false,
      refetchOnWindowFocus: false,
      retry: false,
    })),
  });
}

import { useEffect, useMemo, useRef } from "react";
import { getTransactionReceipt } from "viem/actions";
import { useAccount } from "wagmi";

import { updateActivity, useActivities } from "../stores/activityStore";
import { SECONDS_PER_DAY, unixNowTimestamp } from "../utils/date";
import {
  getPendingActivitiesToReconcile,
  getPendingActivityStatus,
} from "../utils/reconcilePendingActivity";

import { useEthereumClient } from "./useEthereumClient";

const pendingActivityPollInterval = 10_000;
const pendingActivityMaxAge = SECONDS_PER_DAY;

export function usePendingActivityReconciliation() {
  const { address } = useAccount();
  const activities = useActivities(address);
  const client = useEthereumClient();
  const checkedHashesRef = useRef(new Set<string>());

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
    [activities],
  );
  const pendingActivitiesRef = useRef(pendingActivities);
  pendingActivitiesRef.current = pendingActivities;
  const pendingActivityHashes = useMemo(
    () => pendingActivities.map(({ txHash }) => txHash).join(","),
    [pendingActivities],
  );

  useEffect(
    function reconcilePendingActivities() {
      if (!address || !client || pendingActivities.length === 0) {
        return undefined;
      }

      const account = address;
      const publicClient = client;
      let isActive = true;
      let isChecking = false;
      const intervalRef = {
        current: undefined as ReturnType<typeof setInterval> | undefined,
      };

      async function reconcile() {
        if (!isActive || isChecking) {
          return;
        }

        isChecking = true;
        try {
          const now = unixNowTimestamp();
          const activitiesToReconcile = getPendingActivitiesToReconcile({
            activities: pendingActivitiesRef.current,
            checkedHashes: checkedHashesRef.current,
            maxAge: pendingActivityMaxAge,
            now,
          });

          pendingActivitiesRef.current = activitiesToReconcile;

          if (activitiesToReconcile.length === 0) {
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
            }
            return;
          }

          const reconciledActivities = await Promise.all(
            activitiesToReconcile.map(
              async function reconcileActivity(activity) {
                const status = await getPendingActivityStatus({
                  activity,
                  getReceipt: (hash) =>
                    getTransactionReceipt(publicClient, { hash }),
                });

                return { activity, status };
              },
            ),
          );

          if (isActive) {
            reconciledActivities.forEach(function updateReconciledActivity({
              activity,
              status,
            }) {
              if (status !== undefined) {
                checkedHashesRef.current.add(activity.txHash);
              }
              if (status) {
                updateActivity(account, activity.txHash, { status });
              }
            });

            pendingActivitiesRef.current = getPendingActivitiesToReconcile({
              activities: pendingActivitiesRef.current,
              checkedHashes: checkedHashesRef.current,
              maxAge: pendingActivityMaxAge,
              now: unixNowTimestamp(),
            });

            if (
              pendingActivitiesRef.current.length === 0 &&
              intervalRef.current
            ) {
              clearInterval(intervalRef.current);
            }
          }
        } finally {
          isChecking = false;
        }
      }

      intervalRef.current = setInterval(
        () => void reconcile(),
        pendingActivityPollInterval,
      );
      void reconcile();

      return function cleanup() {
        isActive = false;
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
        }
      };
    },
    [address, client, pendingActivityHashes],
  );
}

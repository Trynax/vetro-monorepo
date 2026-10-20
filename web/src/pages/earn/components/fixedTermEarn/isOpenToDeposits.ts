export const isOpenToDeposits = ({
  deposits,
  entryWindow,
  isPaused,
  isShutdown,
  isTerminated,
  maxDeposits,
  now,
}: {
  deposits: bigint;
  entryWindow: { end: bigint; start: bigint };
  isPaused: boolean;
  isShutdown: boolean;
  isTerminated: boolean;
  maxDeposits: bigint;
  now: bigint;
}) =>
  !isPaused &&
  !isShutdown &&
  !isTerminated &&
  deposits < maxDeposits &&
  now >= entryWindow.start &&
  now < entryWindow.end;

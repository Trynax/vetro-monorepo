export const fulfilledValues = <T>(results: PromiseSettledResult<T>[]) =>
  results.flatMap((result) =>
    result.status === "fulfilled" ? [result.value] : [],
  );

export function throwIfAllRejected(results: PromiseSettledResult<unknown>[]) {
  if (results.every((result) => result.status === "rejected")) {
    throw (results[0] as PromiseRejectedResult).reason;
  }
}

export const valueOrEmpty = <T>(result: PromiseSettledResult<T[]>) =>
  result.status === "fulfilled" ? result.value : [];

const sourceTimeoutMs = 15_000;

export const withTimeout = function <T>(promise: Promise<T>) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>(function (_resolve, reject) {
    timer = setTimeout(
      () => reject(new Error(`Timed out after ${sourceTimeoutMs} ms`)),
      sourceTimeoutMs,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
};

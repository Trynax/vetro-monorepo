const secondsPerYear = 31_536_000n;
const wad = 10n ** 18n;

// ERC-8416 simple interest on an ACT/365 basis. A deposit only earns for the
// part of the accrual interval that is still ahead, so `now` clips its start.
export function getEstimatedYield({
  accrualEnd,
  accrualStart,
  amount,
  now,
  rate,
}: {
  accrualEnd: bigint;
  accrualStart: bigint;
  amount: bigint;
  now: bigint;
  rate: bigint;
}) {
  const start = now > accrualStart ? now : accrualStart;
  if (start >= accrualEnd) {
    return 0n;
  }
  return (amount * rate * (accrualEnd - start)) / (secondsPerYear * wad);
}

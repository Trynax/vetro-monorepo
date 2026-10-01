export function getInputError({
  amount,
  balance,
  maxRequest,
  nativeBalance,
}: {
  amount: bigint;
  balance: bigint | undefined;
  maxRequest: bigint | undefined;
  nativeBalance: bigint | undefined;
}) {
  if (amount === 0n) {
    return "enter-amount";
  }
  if (balance !== undefined && amount > balance) {
    return "insufficient-balance";
  }
  if (nativeBalance === 0n) {
    return "insufficient-gas";
  }
  if (maxRequest !== undefined && amount > maxRequest) {
    return "exceeds-max-request";
  }
  return undefined;
}

export const isFormLoading = ({
  balance,
  isMaxRequestError,
  maxRequest,
  nativeBalance,
}: {
  balance: bigint | undefined;
  isMaxRequestError: boolean;
  maxRequest: bigint | undefined;
  nativeBalance: bigint | undefined;
}) =>
  balance === undefined ||
  nativeBalance === undefined ||
  (maxRequest === undefined && !isMaxRequestError);

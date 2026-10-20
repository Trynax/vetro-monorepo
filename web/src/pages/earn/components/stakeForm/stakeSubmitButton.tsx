import { Button } from "components/base/button";
import { Spinner } from "components/base/spinner";
import { ExclamationTriangleIcon } from "components/icons/exclamationTriangleIcon";
import { RequireWalletConnected } from "components/requireWalletConnected";
import { useTranslation } from "react-i18next";
import { isGeoRestricted } from "utils/geoRestriction";

type Props = {
  actionText: string;
  blockingText?: string;
  inputError: string | undefined;
  isLoading: boolean;
  isPending: boolean;
  pendingText: string;
};

export function StakeSubmitButton({
  actionText,
  blockingText,
  inputError,
  isLoading,
  isPending,
  pendingText,
}: Props) {
  const { t } = useTranslation();

  if (isGeoRestricted()) {
    return (
      <Button disabled size="small" type="submit" variant="primary">
        <ExclamationTriangleIcon />
        {t("common.geo-restriction-title")}
      </Button>
    );
  }

  function getButtonText() {
    if (isPending) {
      return pendingText;
    }
    if (isLoading) {
      return <Spinner />;
    }
    if (blockingText) {
      return blockingText;
    }
    if (inputError === "enter-amount") {
      return t("common.enter-amount");
    }
    if (inputError === "exceeds-max-request") {
      return t("common.exceeds-max-request");
    }
    if (inputError === "insufficient-balance") {
      return t("common.insufficient-balance");
    }
    if (inputError === "insufficient-gas") {
      return t("common.insufficient-gas");
    }
    return actionText;
  }

  const isDisabled = isLoading || !!blockingText || !!inputError || isPending;

  return (
    <RequireWalletConnected size="small">
      <Button
        disabled={isDisabled}
        size="small"
        type="submit"
        variant="primary"
      >
        {getButtonText()}
      </Button>
    </RequireWalletConnected>
  );
}

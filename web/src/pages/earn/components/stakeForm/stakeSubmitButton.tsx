import { Button } from "components/base/button";
import { ExclamationTriangleIcon } from "components/icons/exclamationTriangleIcon";
import { RequireWalletConnected } from "components/requireWalletConnected";
import { useTranslation } from "react-i18next";
import { isGeoRestricted } from "utils/geoRestriction";

type Props = {
  actionText: string;
  balancesLoaded: boolean;
  inputError: string | undefined;
  isPending: boolean;
  pendingText: string;
};

export function StakeSubmitButton({
  actionText,
  balancesLoaded,
  inputError,
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
    if (!balancesLoaded) {
      return actionText;
    }
    if (inputError === "enter-amount") {
      return t("common.enter-amount");
    }
    if (inputError === "insufficient-balance") {
      return t("common.insufficient-balance");
    }
    if (inputError === "insufficient-gas") {
      return t("common.insufficient-gas");
    }
    return actionText;
  }

  const isDisabled = !balancesLoaded || !!inputError || isPending;

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

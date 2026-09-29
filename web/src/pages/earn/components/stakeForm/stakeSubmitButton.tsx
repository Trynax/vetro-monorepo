import { Button } from "components/base/button";
import { ExclamationTriangleIcon } from "components/icons/exclamationTriangleIcon";
import { RequireWalletConnected } from "components/requireWalletConnected";
import { useTranslation } from "react-i18next";
import { isGeoRestricted } from "utils/geoRestriction";

type Props = {
  actionText: string;
  balancesLoaded: boolean;
  enterAmountText?: string;
  inputError: string | undefined;
  insufficientBalanceText?: string;
  insufficientGasText?: string;
  isPending: boolean;
  pendingText: string;
};

export function StakeSubmitButton({
  actionText,
  balancesLoaded,
  enterAmountText,
  inputError,
  insufficientBalanceText,
  insufficientGasText,
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
      return enterAmountText ?? t("common.enter-amount");
    }
    if (inputError === "insufficient-balance") {
      return insufficientBalanceText ?? t("common.insufficient-balance");
    }
    if (inputError === "insufficient-gas") {
      return insufficientGasText ?? t("common.insufficient-gas");
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

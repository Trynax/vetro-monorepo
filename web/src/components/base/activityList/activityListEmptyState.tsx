import { Button } from "components/base/button";
import { StatusMessage } from "components/base/statusMessage";
import { useWalletDrawer } from "components/walletDrawer/walletDrawerContext";
import { useI18nNavigate } from "hooks/useI18nNavigate";
import { useTranslation } from "react-i18next";

import { ActivityEmptyIcon } from "./icons/activityEmptyIcon";

type Props = {
  hasTransactions: boolean;
  onResetFilters: VoidFunction;
};

export function ActivityListEmptyState({
  hasTransactions,
  onResetFilters,
}: Props) {
  const navigate = useI18nNavigate();
  const { close } = useWalletDrawer();
  const { t } = useTranslation();

  function handleStartSwapping() {
    close();
    navigate("/swap");
  }

  return (
    <div className="flex h-full flex-col items-center justify-center gap-6">
      <StatusMessage
        description={t(
          hasTransactions
            ? "pages.wallet.activity-empty-description-filtered"
            : "pages.wallet.activity-empty-description-no-transactions",
        )}
        icon={<ActivityEmptyIcon />}
        title={t("pages.wallet.activity-empty-title")}
      />
      <div className="flex items-center gap-3">
        <Button onClick={handleStartSwapping} size="small" type="button">
          {t("pages.wallet.activity-empty-start-swapping")}
        </Button>
        <Button
          onClick={onResetFilters}
          size="small"
          type="button"
          variant="tertiary"
        >
          {t("pages.wallet.activity-empty-reset-filters")}
        </Button>
      </div>
    </div>
  );
}

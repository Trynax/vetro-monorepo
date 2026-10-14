import { Button } from "components/base/button";
import { StatusMessage } from "components/base/statusMessage";
import { InboxCircleIcon } from "components/icons/inboxCircleIcon";
import { WarningCircleIcon } from "components/icons/warningCircleIcon";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";

const TableState = ({ children }: { children: ReactNode }) => (
  <div className="flex items-center justify-center border-b border-gray-200 bg-white px-8 py-12">
    {children}
  </div>
);

export function EmptyState() {
  const { t } = useTranslation();
  return (
    <TableState>
      <StatusMessage
        description={t("pages.dex-liquidity.empty-description")}
        icon={<InboxCircleIcon />}
        title={t("pages.dex-liquidity.empty-title")}
      />
    </TableState>
  );
}

type ErrorStateProps = {
  onRetry: VoidFunction;
};

export function ErrorState({ onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  return (
    <TableState>
      <StatusMessage
        action={
          <Button
            onClick={onRetry}
            size="xSmall"
            type="button"
            variant="secondary"
          >
            {t("pages.dex-liquidity.try-again")}
          </Button>
        }
        description={t("pages.dex-liquidity.error-description")}
        icon={<WarningCircleIcon />}
        title={t("pages.dex-liquidity.error-title")}
      />
    </TableState>
  );
}

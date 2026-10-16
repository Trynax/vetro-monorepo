import { StatusMessage } from "components/base/statusMessage";
import { SearchCircleIcon } from "components/icons/searchCircleIcon";
import { useTranslation } from "react-i18next";

export function EmptyState() {
  const { t } = useTranslation();

  return (
    <div className="flex flex-1 items-center justify-center py-12">
      <StatusMessage
        description={t("common.try-different-search")}
        icon={<SearchCircleIcon />}
        title={t("common.no-results-found")}
      />
    </div>
  );
}

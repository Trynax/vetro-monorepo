import { Button } from "components/base/button";
import { StatusMessage } from "components/base/statusMessage";
import { WarningCircleIcon } from "components/icons/warningCircleIcon";
import { StripedDivider } from "components/stripedDivider";
import { useTranslation } from "react-i18next";

const defaultTexts = {
  description: "Try refreshing the page or come back in a few.",
  refresh: "Refresh page",
  title: "Something went wrong",
};

export const ErrorPage = function () {
  const { t } = useTranslation();

  return (
    <div className="my-auto flex size-full flex-col justify-center">
      <div className="flex flex-col items-center border-t border-gray-200 bg-gray-100">
        <div className="flex flex-col items-center py-17">
          <StatusMessage
            action={
              <Button onClick={() => window.location.reload()} size="xSmall">
                {t("pages.server-error.refresh", defaultTexts.refresh)}
              </Button>
            }
            description={t(
              "pages.server-error.description",
              defaultTexts.description,
            )}
            icon={<WarningCircleIcon />}
            title={t("pages.server-error.title", defaultTexts.title)}
          />
        </div>
        <div className="w-full border-y border-gray-200 px-1">
          <StripedDivider variant="small" />
        </div>
        <div className="flex items-center justify-center overflow-hidden py-6 max-md:px-4 md:py-2">
          <img alt="" src="/vetroLogoOutline.svg" />
        </div>
        <div className="w-full border-t border-gray-200 px-1">
          <StripedDivider variant="small" />
        </div>
      </div>
    </div>
  );
};

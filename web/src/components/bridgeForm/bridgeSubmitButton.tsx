import { Button } from "components/base/button";
import { Spinner } from "components/base/spinner";
import { ExclamationTriangleIcon } from "components/icons/exclamationTriangleIcon";
import { RequireWalletConnected } from "components/requireWalletConnected";
import type { InputError } from "components/tokenInput/utils";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { isGeoRestricted } from "utils/geoRestriction";

const Container = ({ children }: { children: ReactNode }) => (
  <div className="mt-2 flex w-full flex-col border-t border-gray-200 px-2 py-3">
    {children}
  </div>
);

type Props = {
  inputError: InputError | undefined;
  isLoadingData?: boolean;
  isPending?: boolean;
  isPreviewError?: boolean;
};

export function BridgeSubmitButton({
  inputError,
  isLoadingData,
  isPending,
  isPreviewError,
}: Props) {
  const { t } = useTranslation();

  if (isGeoRestricted()) {
    return (
      <Container>
        <Button disabled size="xLarge" type="submit">
          <ExclamationTriangleIcon />
          {t("common.geo-restriction-title")}
        </Button>
      </Container>
    );
  }

  function renderButton() {
    if (inputError) {
      return (
        <Button disabled size="xLarge" type="button">
          {t(`common.${inputError}`)}
        </Button>
      );
    }

    if (isPreviewError) {
      return (
        <Button disabled size="xLarge" type="button">
          {t("pages.bridge.form.preview-error")}
        </Button>
      );
    }

    if (isLoadingData || isPending) {
      return (
        <Button disabled size="xLarge" type="button">
          <Spinner />
        </Button>
      );
    }

    return (
      <Button size="xLarge" type="submit">
        {t("pages.bridge.form.action")}
      </Button>
    );
  }

  return (
    <Container>
      <RequireWalletConnected size="xLarge">
        {renderButton()}
      </RequireWalletConnected>
    </Container>
  );
}

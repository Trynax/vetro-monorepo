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
  actionText: string;
  inputError: InputError | undefined;
  isActive: boolean | undefined;
  isActiveError?: boolean;
  isAllowanceError: boolean;
  isLoading: boolean;
  isPreviewError: boolean;
};

export function SubmitButton({
  actionText,
  inputError,
  isActive,
  isActiveError = false,
  isAllowanceError,
  isLoading,
  isPreviewError,
}: Props) {
  const { t } = useTranslation();

  const buttonProps = {
    disabled: true,
    size: "xLarge",
    type: "submit",
  } as const;

  if (isGeoRestricted()) {
    return (
      <Container>
        <Button {...buttonProps}>
          <ExclamationTriangleIcon />
          {t("common.geo-restriction-title")}
        </Button>
      </Container>
    );
  }

  function renderButton() {
    if (isActive === false) {
      return (
        <Button {...buttonProps}>{t("pages.swap.form.swaps-paused")}</Button>
      );
    }

    if (inputError) {
      return <Button {...buttonProps}>{t(`common.${inputError}`)}</Button>;
    }

    if (isActiveError) {
      return (
        <Button {...buttonProps}>
          {t("pages.swap.form.token-status-error")}
        </Button>
      );
    }

    // show error if it failed to load allowance
    if (isAllowanceError) {
      return (
        <Button {...buttonProps}>{t("pages.swap.form.allowance-error")}</Button>
      );
    }

    if (isPreviewError) {
      return (
        <Button {...buttonProps}>{t("pages.swap.form.preview-error")}</Button>
      );
    }

    if (isLoading) {
      return (
        <Button {...buttonProps}>
          <Spinner />
        </Button>
      );
    }

    return (
      <Button {...buttonProps} disabled={false}>
        {actionText}
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

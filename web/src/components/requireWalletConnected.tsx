import { useConnectModal } from "@rainbow-me/rainbowkit";
import { Button } from "components/base/button";
import type { ComponentProps, ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useAccount } from "wagmi";

type Props = {
  children: ReactNode;
  size?: ComponentProps<typeof Button>["size"];
};

export function RequireWalletConnected({ children, size }: Props) {
  const { address } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { t } = useTranslation();

  if (address !== undefined) {
    return children;
  }

  return (
    <Button
      onClick={openConnectModal}
      size={size}
      type="button"
      variant="primary"
    >
      {t("common.connect-wallet")}
    </Button>
  );
}

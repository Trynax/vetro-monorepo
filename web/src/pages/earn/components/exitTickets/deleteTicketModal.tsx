import { Button } from "components/base/button";
import { Modal } from "components/base/modal";
import { RequireWalletConnected } from "components/requireWalletConnected";
import { useActivityTracking } from "hooks/useActivityTracking";
import { useCancelWithdraw } from "hooks/useCancelWithdraw";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { formatAmount } from "utils/token";

import type { ExitTicket } from "../../types";

type Props = {
  onClose: VoidFunction;
  onSuccess?: VoidFunction;
  peggedToken: TokenWithGateway;
  ticket: ExitTicket;
};

export function DeleteTicketModal({
  onClose,
  onSuccess,
  peggedToken,
  ticket,
}: Props) {
  const { t } = useTranslation();

  const [isDeleting, setIsDeleting] = useState(false);

  const formattedAmount = formatAmount({
    amount: BigInt(ticket.assets),
    decimals: peggedToken.decimals,
    isError: false,
  });

  const { onCompleted, onFailed, onPending, onTransactionHash } =
    useActivityTracking({
      page: "earn",
      text: t("pages.earn.activity.cancel-withdraw-text", {
        amount: formattedAmount,
        symbol: peggedToken.symbol,
      }),
      title: `${t("nav.earn")} · ${t("pages.earn.exit-tickets.delete-title")}`,
    });

  const { mutate } = useCancelWithdraw({
    assets: BigInt(ticket.assets),
    onStatusChange(status) {
      const handlers: Partial<Record<typeof status, () => void>> = {
        cancelling() {
          onPending();
          setIsDeleting(true);
        },
        completed() {
          onCompleted();
          onClose();
          onSuccess?.();
        },
        failed() {
          onFailed();
          setIsDeleting(false);
        },
      };
      handlers[status]?.();
    },
    onTransactionHash,
    requestId: BigInt(ticket.requestId),
    stakingVaultAddress: ticket.stakingVaultAddress,
  });

  function handleDelete() {
    setIsDeleting(true);
    mutate();
  }

  return (
    <Modal
      ariaLabel={t("pages.earn.exit-tickets.delete-title")}
      onClose={onClose}
    >
      {({ close }) => (
        <div className="flex w-full flex-col gap-6 p-6 md:w-112">
          <div className="flex flex-col gap-2">
            <h4 className="text-base font-semibold tracking-tight text-gray-900">
              {t("pages.earn.exit-tickets.delete-title")}
            </h4>
            <p className="text-xsm font-normal text-gray-500">
              {t("pages.earn.exit-tickets.delete-description")}
            </p>
          </div>
          <div className="flex gap-3 *:flex-1">
            <Button
              disabled={isDeleting}
              onClick={close}
              size="xSmall"
              variant="secondary"
            >
              {t("pages.earn.exit-tickets.delete-btn-cancel")}
            </Button>
            <RequireWalletConnected size="xSmall">
              <Button
                disabled={isDeleting}
                onClick={handleDelete}
                size="xSmall"
                variant="danger"
              >
                {isDeleting
                  ? t("pages.earn.exit-tickets.delete-btn-deleting")
                  : t("pages.earn.exit-tickets.delete-btn")}
              </Button>
            </RequireWalletConnected>
          </div>
        </div>
      )}
    </Modal>
  );
}

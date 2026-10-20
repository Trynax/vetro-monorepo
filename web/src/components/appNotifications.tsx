import { Badge } from "components/base/badge";
import { Button } from "components/base/button";
import { ChevronIcon } from "components/base/chevronIcon";
import { type StackItem, Stack } from "components/base/stack";
import { useAtRiskPositions } from "hooks/borrow/useAtRiskPositions";
import { useGetRedeemRequests } from "hooks/useGetRedeemRequests";
import { useI18nNavigate } from "hooks/useI18nNavigate";
import { useNowTickingPast } from "hooks/useNowTickingPast";
import { getTicketStatus } from "pages/earn/components/exitTickets/getTicketStatus";
import { useExitTickets } from "pages/earn/hooks/useExitTickets";
import { useTranslation } from "react-i18next";
import type { TokenWithGateway } from "types";
import { formatNumber } from "utils/format";
import { formatUnits } from "viem";

function useLiquidationItems(): StackItem[] {
  const { data: positions = [] } = useAtRiskPositions();
  const navigate = useI18nNavigate();
  const { t } = useTranslation();

  function handleClick() {
    const el = document.getElementById("borrow-positions");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/borrow#borrow-positions");
    }
  }

  return positions.map((p) => ({
    content: (
      <div className="mx-auto w-fit *:w-2xs *:border-2 *:border-rose-500">
        <Button
          onClick={handleClick}
          size="xLarge"
          type="button"
          variant="danger"
        >
          <Badge variant="red">
            {p.collateralSymbol} / {p.loanSymbol}
          </Badge>
          {t("pages.borrow.position-at-risk")}
        </Button>
      </div>
    ),
    id: p.marketId,
  }));
}

function RedeemNotification({
  amountLocked,
  peggedToken,
}: {
  amountLocked: bigint;
  peggedToken: TokenWithGateway;
}) {
  const navigate = useI18nNavigate();
  const { t } = useTranslation();

  const formattedAmount = `${formatNumber(
    formatUnits(amountLocked, peggedToken.decimals),
  )} ${peggedToken.symbol}`;

  function handleClick() {
    const el = document.getElementById("redeem-queue");
    if (el) {
      // if we're already on the swap page, scroll to the redeem queue section
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/swap#redeem-queue");
    }
  }

  return (
    <div className="mx-auto w-fit *:w-2xs *:border-2 *:border-blue-500">
      <Button
        onClick={handleClick}
        size="xLarge"
        type="button"
        variant="primary"
      >
        <Badge variant="blue">{formattedAmount}</Badge>
        {t("pages.swap.redeem-queue.ready-to-redeem")}
        <ChevronIcon direction="right" />
      </Button>
    </div>
  );
}

function useRedeemItems(): StackItem[] {
  const { data: requests } = useGetRedeemRequests();
  const now = useNowTickingPast(requests, (r) => Number(r.claimableAt));

  if (!requests) {
    return [];
  }

  return requests
    .filter((r) => Number(r.claimableAt) <= now)
    .map((r) => ({
      content: (
        <RedeemNotification
          amountLocked={r.amountLocked}
          peggedToken={r.peggedToken}
        />
      ),
      id: `redeem-ready-${r.peggedToken.gatewayAddress}`,
    }));
}

function EarnExitTicketsNotification({ count }: { count: number }) {
  const navigate = useI18nNavigate();
  const { t } = useTranslation();

  function handleClick() {
    const el = document.getElementById("exit-tickets");
    if (el) {
      el.scrollIntoView({ behavior: "smooth" });
    } else {
      navigate("/earn#exit-tickets");
    }
  }

  return (
    <div className="mx-auto w-fit *:w-xs *:border-2 *:border-blue-500">
      <Button
        onClick={handleClick}
        size="xLarge"
        type="button"
        variant="primary"
      >
        <Badge variant="blue">
          <span className="mr-1">
            {t("pages.earn.exit-tickets.notification", { count })}
          </span>
        </Badge>
        <span>{t("pages.earn.exit-tickets.ready-to-withdraw")}</span>
        <ChevronIcon direction="right" />
      </Button>
    </div>
  );
}

function useEarnExitTicketItems(): StackItem[] {
  const { data: tickets } = useExitTickets();
  useNowTickingPast(tickets, (ticket) =>
    ticket.cancelTxHash || ticket.claimTxHash
      ? undefined
      : Number(ticket.claimableAt),
  );

  if (!tickets) {
    return [];
  }

  const readyCount = tickets.filter(
    (ticket) => getTicketStatus(ticket) === "ready",
  ).length;

  if (readyCount === 0) {
    return [];
  }

  return [
    {
      content: <EarnExitTicketsNotification count={readyCount} />,
      id: "exit-tickets-ready",
    },
  ];
}

export function AppNotifications() {
  const liquidationItems = useLiquidationItems();
  const redeemItems = useRedeemItems();
  const exitTicketItems = useEarnExitTicketItems();

  const items = [...liquidationItems, ...redeemItems, ...exitTicketItems];

  if (items.length === 0) {
    return null;
  }

  return <Stack items={items} position="bottom-center" />;
}

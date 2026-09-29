import { stakingVaultAddresses } from "@vetro-protocol/earn";
import { Badge } from "components/base/badge";
import { Button } from "components/base/button";
import { FilterMenu } from "components/base/filterMenu";
import { SectionHeader } from "components/base/sectionHeader";
import { StatusBadge } from "components/base/statusBadge";
import { Table, type TableColumnDef } from "components/base/table";
import { Header } from "components/base/table/header";
import { Toast } from "components/base/toast";
import { RequireWalletConnected } from "components/requireWalletConnected";
import { Tooltip } from "components/tooltip";
import { TableCellsIcon } from "pages/earn/icons/tableCellsIcon";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { isGeoRestricted } from "utils/geoRestriction";
import type { Address } from "viem";

import { useExitTickets } from "../../hooks/useExitTickets";
import type { ExitTicket } from "../../types";

import { ActionsCell } from "./actionsCell";
import { CooldownCell } from "./cooldownCell";
import { DateCreatedCell } from "./dateCreatedCell";
import { EmptyState } from "./emptyState";
import { getTicketStatus } from "./getTicketStatus";
import { TxsCell } from "./txsCell";
import { WithdrawalCell } from "./withdrawalCell";
import { type VaultWithdrawal, WithdrawAllDrawer } from "./withdrawAllDrawer";

const statusLabels = {
  cooldown: "pages.earn.exit-tickets.cooldown-in-progress",
  ready: "pages.earn.exit-tickets.ready-to-withdraw",
  withdrawn: "pages.earn.exit-tickets.withdrawn",
} as const;

export const getColumns = ({
  isWithdrawingAll,
  onDeleteSuccess,
  onWithdrawingChange,
  t,
}: {
  isWithdrawingAll: boolean;
  onDeleteSuccess: VoidFunction;
  onWithdrawingChange: (isWithdrawing: boolean) => void;
  t: ReturnType<typeof useTranslation>["t"];
}): TableColumnDef<ExitTicket>[] => [
  {
    cell: ({ row }) => <DateCreatedCell ticket={row.original} />,
    header: () => (
      <Header text={t("pages.earn.exit-tickets.col-date-created")} />
    ),
    id: "date-created",
    meta: { width: "136px" },
  },
  {
    cell: ({ row }) => <CooldownCell ticket={row.original} />,
    header: () => (
      <Header text={t("pages.earn.exit-tickets.col-cooldown-left")} />
    ),
    id: "cooldown-left",
    meta: { width: "136px" },
  },
  {
    cell: ({ row }) => <WithdrawalCell ticket={row.original} />,
    header: () => <Header text={t("pages.earn.exit-tickets.col-withdrawal")} />,
    id: "withdrawal",
    meta: { width: "136px" },
  },
  {
    cell({ row }) {
      const status = getTicketStatus(row.original);
      if (status === "cancelled") {
        return null;
      }
      return (
        <StatusBadge variant={status}>{t(statusLabels[status])}</StatusBadge>
      );
    },
    header: () => <Header text={t("pages.earn.exit-tickets.col-status")} />,
    id: "status",
    meta: { width: "190px" },
  },
  {
    cell: ({ row }) => <TxsCell ticket={row.original} />,
    header: () => <Header text={t("pages.earn.exit-tickets.col-txs")} />,
    id: "txs",
    meta: { width: "132px" },
  },
  {
    cell: ({ row }) => (
      <ActionsCell
        disabled={isWithdrawingAll}
        key={row.original.requestId}
        onDeleteSuccess={onDeleteSuccess}
        onWithdrawingChange={onWithdrawingChange}
        ticket={row.original}
      />
    ),
    header: () => <Header text={t("pages.earn.exit-tickets.actions")} />,
    id: "actions",
    meta: { className: "justify-end", width: "150px" },
  },
];

// The empty-state CTA is not vault-specific; it just needs a vault to link to.
const stakingVaultAddress = stakingVaultAddresses[0];

type WithdrawAllButtonProps = {
  count: number;
  disabled: boolean;
  isWithdrawing: boolean;
  onWithdrawAll: VoidFunction;
};

function WithdrawAllButton({
  count,
  disabled,
  isWithdrawing,
  onWithdrawAll,
}: WithdrawAllButtonProps) {
  const { t } = useTranslation();
  const geoRestricted = isGeoRestricted();

  const button = (
    <Button
      disabled={disabled || geoRestricted}
      onClick={onWithdrawAll}
      size="xSmall"
      variant="primary"
    >
      <span className="flex items-center gap-x-1">
        {isWithdrawing
          ? t("pages.earn.exit-tickets.withdrawing")
          : t("pages.earn.exit-tickets.withdraw-all")}
        {!isWithdrawing && count > 0 && <Badge variant="blue">{count}</Badge>}
      </span>
    </Button>
  );

  return (
    <RequireWalletConnected size="xSmall">
      {geoRestricted ? (
        <Tooltip content={t("common.geo-restriction-title")}>{button}</Tooltip>
      ) : (
        button
      )}
    </RequireWalletConnected>
  );
}

// Group ready tickets by staking vault: one claim transaction per vault.
function groupByVault(readyTickets: ExitTicket[]) {
  const map = new Map<Address, VaultWithdrawal>();
  for (const ticket of readyTickets) {
    const entry = map.get(ticket.stakingVaultAddress) ?? {
      amount: 0n,
      requestIds: [],
      stakingVaultAddress: ticket.stakingVaultAddress,
    };
    entry.amount += BigInt(ticket.assets);
    entry.requestIds.push(BigInt(ticket.requestId));
    map.set(ticket.stakingVaultAddress, entry);
  }
  return [...map.values()];
}

export function ExitTickets() {
  const { data, isLoading } = useExitTickets();
  const { t } = useTranslation();
  const [selectedFilters, setSelectedFilters] = useState([
    "completed",
    "pending",
  ]);
  const [isWithdrawAllDrawerOpen, setIsWithdrawAllDrawerOpen] = useState(false);
  const [showDeleteToast, setShowDeleteToast] = useState(false);
  const [showWithdrawAllToast, setShowWithdrawAllToast] = useState(false);
  const [withdrawingSingleCount, setWithdrawingSingleCount] = useState(0);

  const readyTickets = useMemo(
    () => (data ?? []).filter((ticket) => getTicketStatus(ticket) === "ready"),
    [data],
  );

  const filterOptions = useMemo(
    () => [
      {
        label: t("pages.earn.exit-tickets.pending-withdrawals"),
        value: "pending",
      },
      {
        label: t("pages.earn.exit-tickets.completed-withdrawals"),
        value: "completed",
      },
    ],
    [t],
  );

  const columns = useMemo(
    () =>
      getColumns({
        isWithdrawingAll: isWithdrawAllDrawerOpen,
        onDeleteSuccess() {
          setShowDeleteToast(true);
        },
        onWithdrawingChange(isWithdrawing) {
          setWithdrawingSingleCount((c) => c + (isWithdrawing ? 1 : -1));
        },
        t,
      }),
    [isWithdrawAllDrawerOpen, t],
  );

  // Filter and sort data based on selected filters and ticket status
  const filteredData = useMemo(
    function () {
      if (!data) {
        return [];
      }
      return data
        .filter(function (ticket) {
          const status = getTicketStatus(ticket);
          if (
            selectedFilters.includes("pending") &&
            (status === "cooldown" || status === "ready")
          ) {
            return true;
          }
          if (selectedFilters.includes("completed") && status === "withdrawn") {
            return true;
          }
          return false;
        })
        .sort(function (a, b) {
          // Ready tickets first, then most recent first
          const aReady = getTicketStatus(a) === "ready" ? 0 : 1;
          const bReady = getTicketStatus(b) === "ready" ? 0 : 1;
          if (aReady !== bReady) {
            return aReady - bReady;
          }
          return Number(b.claimableAt) - Number(a.claimableAt);
        });
    },
    [data, selectedFilters],
  );

  return (
    <div id="exit-tickets">
      {/* Title row */}
      <SectionHeader title={t("pages.earn.exit-tickets.title")}>
        <div className="flex items-center gap-3">
          <FilterMenu
            icon={<TableCellsIcon />}
            label={t("pages.earn.exit-tickets.view-settings")}
            onChange={setSelectedFilters}
            sections={[
              {
                label: t("pages.earn.exit-tickets.col-status"),
                options: filterOptions,
              },
            ]}
            selectedValues={selectedFilters}
          />
          <div className="h-3 w-0.5 rounded-full bg-gray-200" />
          <WithdrawAllButton
            count={readyTickets.length}
            disabled={
              readyTickets.length === 0 ||
              isWithdrawAllDrawerOpen ||
              withdrawingSingleCount > 0
            }
            isWithdrawing={isWithdrawAllDrawerOpen}
            onWithdrawAll={() => setIsWithdrawAllDrawerOpen(true)}
          />
        </div>
      </SectionHeader>
      {/* Table */}
      <Table
        columns={columns}
        data={filteredData}
        getRowId={(ticket) =>
          `${ticket.stakingVaultAddress}-${ticket.requestId}`
        }
        loading={isLoading}
        maxBodyHeight="280px"
        placeholder={<EmptyState stakingVaultAddress={stakingVaultAddress} />}
        priorityColumnIdsOnSmall={["actions"]}
      />
      {isWithdrawAllDrawerOpen && (
        <WithdrawAllDrawer
          onClose={() => setIsWithdrawAllDrawerOpen(false)}
          onSuccess={() => setShowWithdrawAllToast(true)}
          withdrawals={groupByVault(readyTickets)}
        />
      )}
      {showDeleteToast && (
        <Toast
          closable
          description={t("pages.earn.exit-tickets.delete-toast-description")}
          onClose={() => setShowDeleteToast(false)}
          title={t("pages.earn.exit-tickets.delete-toast-title")}
        />
      )}
      {showWithdrawAllToast && (
        <Toast
          closable
          description={t(
            "pages.earn.exit-tickets.withdraw-all-toast-description",
          )}
          onClose={() => setShowWithdrawAllToast(false)}
          title={t("pages.earn.exit-tickets.withdraw-all-toast-title")}
        />
      )}
    </div>
  );
}

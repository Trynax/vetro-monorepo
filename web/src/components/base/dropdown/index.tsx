import { useOnClickOutside } from "@hemilabs/react-hooks/useOnClickOutside";
import { useMenuPosition } from "hooks/useMenuPosition";
import {
  Fragment,
  type KeyboardEvent,
  type ReactNode,
  type TransitionEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

type DropdownSection<T> = {
  items: readonly T[];
  label?: string;
};

type TriggerProps = {
  "aria-expanded": boolean;
  "aria-haspopup": "listbox" | "menu";
  id: string;
  onClick: () => void;
  onKeyDown: (event: KeyboardEvent) => void;
  ref: (node: HTMLElement | null) => void;
  role: "button";
  tabIndex: 0;
};

type ItemWrapperProps<T> = {
  isFocused: boolean;
  isSelected: boolean;
  item: T;
  onActivate: VoidFunction;
  ref: (el: HTMLElement | null) => void;
  tabIndex: 0 | -1;
};

type BaseProps<T> = {
  getItemKey: (item: T) => string;
  items?: readonly T[];
  matchTriggerWidth?: boolean;
  menuLabel?: string;
  renderFooter?: (onClose: VoidFunction) => ReactNode;
  renderItem: (item: T, isSelected: boolean) => ReactNode;
  renderItemWrapper?: (
    props: ItemWrapperProps<T>,
    children: ReactNode,
  ) => ReactNode;
  renderTrigger: (isOpen: boolean, triggerProps: TriggerProps) => ReactNode;
  sections?: DropdownSection<T>[];
  triggerId: string;
};

type SingleSelectProps<T> = BaseProps<T> & {
  multiSelect?: false;
  onChange: (item: T) => void;
  value?: T;
};

type MultiSelectProps<T> = BaseProps<T> & {
  multiSelect: true;
  onChange: (item: T, selected: boolean) => void;
  selectedValues: string[];
};

type NavigationProps<T> = BaseProps<T> & {
  multiSelect?: never;
  onChange?: never;
  selectedValues?: never;
  value?: never;
};

type DropdownProps<T> =
  | MultiSelectProps<T>
  | NavigationProps<T>
  | SingleSelectProps<T>;

const isMultiSelect = <T,>(
  props: DropdownProps<T>,
): props is MultiSelectProps<T> => props.multiSelect === true;

const isNavigation = <T,>(
  props: DropdownProps<T>,
): props is NavigationProps<T> => !("onChange" in props);

const opacityClass = (show: boolean) => (show ? "opacity-100" : "opacity-0");

export function Dropdown<T>(props: DropdownProps<T>) {
  const {
    getItemKey,
    items: itemsProp,
    matchTriggerWidth = false,
    menuLabel,
    renderFooter,
    renderItem,
    renderItemWrapper,
    renderTrigger,
    sections,
    triggerId,
  } = props;

  const items = sections ? sections.flatMap((s) => s.items) : (itemsProp ?? []);

  const [isMounted, setIsMounted] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const triggerRef = useRef<HTMLElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  function focusItem(index: number) {
    itemRefs.current[index]?.focus();
  }

  const containerRef = useOnClickOutside<HTMLDivElement>(function (e) {
    // The list is portaled to document.body, so it's not a DOM child
    // of the container. Ignore clicks inside the portaled list.
    if (listRef.current?.contains(e.target as Node)) {
      return;
    }
    setIsOpen(false);
  });

  useMenuPosition({ isOpen: isMounted, listRef, triggerRef });

  useEffect(
    function applyTriggerWidth() {
      if (
        !matchTriggerWidth ||
        !isMounted ||
        !triggerRef.current ||
        !listRef.current
      ) {
        return;
      }
      const triggerRect = triggerRef.current.getBoundingClientRect();
      listRef.current.style.width = `${triggerRect.width}px`;
    },
    [isMounted, matchTriggerWidth],
  );

  useEffect(
    function fadeInAfterMount() {
      if (!isMounted) {
        return undefined;
      }
      const rafId = requestAnimationFrame(() => setIsOpen(true));
      return () => cancelAnimationFrame(rafId);
    },
    [isMounted],
  );

  function isItemSelected(item: T) {
    if (isMultiSelect(props)) {
      return props.selectedValues.includes(getItemKey(item));
    }
    return (
      props.value !== undefined && getItemKey(item) === getItemKey(props.value)
    );
  }

  const canOpenMenu = items.length > 0;

  function handleTriggerClick() {
    if (!canOpenMenu) {
      return;
    }
    if (isMounted) {
      setIsOpen(!isOpen);
    } else {
      setIsMounted(true);
    }
    setFocusedIndex(-1);
  }

  function handleTransitionEnd(event: TransitionEvent) {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (!isOpen) {
      setIsMounted(false);
      setFocusedIndex(-1);
    }
  }

  function closeMenu() {
    setIsOpen(false);
    triggerRef.current?.focus();
  }

  function handleItemClick(item: T) {
    if (isNavigation(props)) {
      closeMenu();
      return;
    }
    if (isMultiSelect(props)) {
      const selected = !isItemSelected(item);
      props.onChange(item, selected);
      triggerRef.current?.focus();
      return;
    }
    props.onChange(item);
    closeMenu();
  }

  function activateFocused(event: KeyboardEvent) {
    if (focusedIndex < 0 || focusedIndex >= items.length) {
      return;
    }
    if (isNavigation(props)) {
      // Let Enter fall through to the focused anchor's native activation so
      // modifier keys (e.g. Cmd+Enter to open in a new tab) are preserved.
      // Space doesn't activate anchors natively, so trigger it ourselves.
      if (event.key === " ") {
        event.preventDefault();
        itemRefs.current[focusedIndex]?.click();
      }
      return;
    }
    event.preventDefault();
    handleItemClick(items[focusedIndex]);
  }

  function handleOpenKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case "ArrowDown": {
        event.preventDefault();
        const next = Math.min(focusedIndex + 1, items.length - 1);
        setFocusedIndex(next);
        focusItem(next);
        break;
      }
      case "ArrowUp": {
        event.preventDefault();
        const next = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(next);
        focusItem(next);
        break;
      }
      case " ":
      case "Enter":
        activateFocused(event);
        break;
      case "Escape":
        event.preventDefault();
        closeMenu();
        break;
    }
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!isOpen) {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setIsOpen(true);
      }
      return;
    }
    handleOpenKeyDown(event);
  }

  const multi = isMultiSelect(props);
  const hasSelection = !multi && props.value !== undefined;
  const listRole = hasSelection ? "listbox" : "menu";
  const itemRole = multi
    ? "menuitemcheckbox"
    : hasSelection
      ? "option"
      : "menuitem";

  function renderItemNode(item: T, index: number) {
    const isSelected = isItemSelected(item);
    const isFocused = index === focusedIndex;
    const tabIndex: 0 | -1 = isFocused ? 0 : -1;
    function setRef(el: HTMLElement | null) {
      itemRefs.current[index] = el;
    }

    if (renderItemWrapper) {
      return (
        <Fragment key={getItemKey(item)}>
          {renderItemWrapper(
            {
              isFocused,
              isSelected,
              item,
              onActivate: () => handleItemClick(item),
              ref: setRef,
              tabIndex,
            },
            renderItem(item, isSelected),
          )}
        </Fragment>
      );
    }

    return (
      <div
        {...(multi
          ? { "aria-checked": isSelected }
          : hasSelection
            ? { "aria-selected": isSelected }
            : {})}
        className={`text-xsm group/item flex cursor-pointer items-center rounded px-3 py-2 focus-visible:outline-0 ${isFocused ? "bg-gray-100" : "hover:bg-gray-50"}`}
        key={getItemKey(item)}
        onClick={() => handleItemClick(item)}
        ref={setRef}
        role={itemRole}
        tabIndex={tabIndex}
      >
        <div className="flex w-full items-center justify-between gap-2 font-medium text-gray-900">
          {renderItem(item, isSelected)}
        </div>
      </div>
    );
  }

  return (
    <div className="relative inline-block" ref={containerRef}>
      {renderTrigger(isOpen, {
        "aria-expanded": isOpen,
        "aria-haspopup": listRole,
        id: triggerId,
        onClick: handleTriggerClick,
        onKeyDown: handleKeyDown,
        ref(node: HTMLElement | null) {
          triggerRef.current = node;
        },
        role: "button",
        tabIndex: 0,
      })}

      {isMounted &&
        createPortal(
          <div
            aria-labelledby={triggerId}
            className={`fixed z-30 min-w-3xs overflow-y-auto rounded-lg bg-white p-1 shadow-xl transition-opacity duration-300 ${opacityClass(isOpen)}`}
            onKeyDown={handleKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            onTransitionEnd={handleTransitionEnd}
            ref={listRef}
            role={listRole}
          >
            {menuLabel && (
              <div
                className="text-b-medium px-3 py-2 text-gray-500"
                role="presentation"
              >
                {menuLabel}
              </div>
            )}
            {sections
              ? sections.map((section, sectionIndex) => (
                  <div key={section.label ?? sectionIndex}>
                    {section.label && (
                      <div
                        className="text-b-medium h-7 px-3 py-1 text-gray-500"
                        role="presentation"
                      >
                        {section.label}
                      </div>
                    )}
                    {section.items.map((item) =>
                      renderItemNode(item, items.indexOf(item)),
                    )}
                  </div>
                ))
              : items.map((item, index) => renderItemNode(item, index))}
            <div className="w-0 min-w-full">{renderFooter?.(closeMenu)}</div>
          </div>,
          document.body,
        )}
    </div>
  );
}

import { type ReactNode } from "react";

type SegmentOption<T extends string> = {
  label: ReactNode;
  value: T;
};

type Props<T extends string> = {
  disabled?: boolean;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  size?: "s" | "xs";
  value: T;
  variant?: "bar" | "pill";
};

const sizeClasses = {
  s: "h-8 px-3 text-sm",
  xs: "h-7 px-2.5 text-xsm",
};

const variantClasses = {
  bar: "flex-1",
  pill: "w-fit",
};

export const SegmentedControl = <T extends string>({
  disabled = false,
  onChange,
  options,
  size = "s",
  value,
  variant = "bar",
}: Props<T>) => (
  <div className="flex gap-2">
    {options.map((option) => (
      <button
        className={`${sizeClasses[size]} ${variantClasses[variant]} rounded-full font-semibold transition-all not-disabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-65 ${
          value === option.value
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 not-disabled:hover:text-gray-700"
        }`}
        disabled={disabled}
        key={option.value}
        onClick={() => onChange(option.value)}
        type="button"
      >
        {option.label}
      </button>
    ))}
  </div>
);

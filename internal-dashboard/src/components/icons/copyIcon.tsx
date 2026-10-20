type Props = {
  size?: number;
};

export const CopyIcon = ({ size = 16 }: Props) => (
  <svg
    aria-hidden="true"
    fill="none"
    height={size}
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth={1.5}
    viewBox="0 0 16 16"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect height="9" rx="1.5" width="9" x="5.5" y="5.5" />
    <path d="M10.5 3V2.5A1 1 0 0 0 9.5 1.5h-7a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1H3" />
  </svg>
);

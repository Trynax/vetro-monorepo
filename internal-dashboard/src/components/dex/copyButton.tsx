import { useEffect, useState } from "react";

import { CopyIcon } from "../icons/copyIcon";
import { Tooltip } from "../tooltip";

const copiedDurationMs = 3000;

type Props = {
  text: string;
};

export const CopyButton = function ({ text }: Props) {
  const [copied, setCopied] = useState(false);

  useEffect(
    function () {
      if (!copied) {
        return undefined;
      }
      const timeout = setTimeout(() => setCopied(false), copiedDurationMs);
      return () => clearTimeout(timeout);
    },
    [copied],
  );

  const copy = () =>
    navigator.clipboard.writeText(text).then(() => setCopied(true));

  return (
    <Tooltip label={copied ? "Copied!" : "Copy"}>
      <button
        aria-label="Copy link"
        className="cursor-pointer text-neutral-400 hover:text-neutral-700"
        onClick={copy}
        type="button"
      >
        <CopyIcon />
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied!" : ""}
      </span>
    </Tooltip>
  );
};

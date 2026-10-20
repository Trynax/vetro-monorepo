import { ExternalLink } from "./base/externalLink";

const branch = import.meta.env.VITE_BUILD_BRANCH;
const version = import.meta.env.VITE_BUILD_VERSION;

const commitSha = version.replace(/-dirty$/, "");
const isCommitSha = /^[0-9a-f]{7,40}$/i.test(commitSha);
const displayedVersion = isCommitSha
  ? version.replace(commitSha, commitSha.slice(0, 8))
  : version;

type Props = {
  onClose: VoidFunction;
};

export const BuildInfo = ({ onClose }: Props) => (
  <div className="text-caption mt-1 flex cursor-default items-center gap-1.5 border-t border-gray-100 px-3 pt-2 pb-1 font-mono text-gray-400">
    <span className="min-w-0 truncate" title={branch}>
      {branch}
    </span>
    <span aria-hidden="true">·</span>
    {isCommitSha ? (
      <ExternalLink
        className="shrink-0 transition-colors hover:text-gray-600 hover:underline"
        href={`https://github.com/vetro-protocol/vetro-monorepo/tree/${commitSha}`}
        onClick={onClose}
        title={version}
      >
        {displayedVersion}
      </ExternalLink>
    ) : (
      <span className="shrink-0" title={version}>
        {displayedVersion}
      </span>
    )}
  </div>
);

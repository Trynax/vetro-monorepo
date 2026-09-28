import {
  TEST_ADDRESS,
  TEST_PRIVATE_KEY,
} from "@hemilabs/anvil-fork-setup/utils";
import { gatewayAbi as vetroGatewayAbi } from "@vetro-protocol/gateway";
import {
  getMaxMint,
  getTreasury,
  getWithdrawalDelayEnabled,
  isInstantRedeemWhitelisted,
} from "@vetro-protocol/gateway/actions";
import { getKeeperRole } from "@vetro-protocol/treasury/actions";
import { type Command, CommanderError } from "commander";
import {
  type Address,
  type Client,
  type Hex,
  createPublicClient,
  createTestClient,
  createWalletClient,
  encodePacked,
  hexToBigInt,
  http,
  keccak256,
  pad,
  parseAbi,
  parseEther,
  parseUnits,
  toHex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import {
  impersonateAccount,
  readContract,
  sendTransaction,
  setBalance,
  setStorageAt,
  stopImpersonatingAccount,
  waitForTransactionReceipt,
  writeContract,
} from "viem/actions";
import { mainnet } from "viem/chains";
import {
  defaultAdmin,
  grantRole,
  hasRole,
} from "viem-oz-access-control/actions";

import { type GlobalOptions } from "../../src/lib/client.ts";
import { printError } from "../../src/lib/output.ts";
import { createProgram } from "../../src/program.ts";

export const usdc = {
  address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  // Slot of the `balances` mapping in the mainnet USDC contract.
  balanceSlot: 9,
  decimals: 6,
  symbol: "USDC",
} as const;

export const vusd = {
  address: "0xCa83DDE9c22254f58e771bE5E157773212AcBAc3",
  decimals: 18,
  symbol: "VUSD",
} as const;

export type TransactionRequest = {
  chainId: Hex;
  data: Hex;
  to: Address;
  value: Hex;
};

export type RedeemRequest = {
  amountLocked: string;
  claimableAt: string;
  status: "cooldown" | "none" | "ready";
};

export const depositAbi = parseAbi([
  "function deposit(address tokenIn, uint256 amountIn, uint256 minPeggedTokenOut, address receiver)",
]);

export const redeemAbi = parseAbi([
  "function redeem(address tokenOut, uint256 peggedTokenIn, uint256 minAmountOut, address receiver)",
]);

export const requestRedeemAbi = parseAbi([
  "function requestRedeem(uint256 peggedTokenAmount)",
]);

export const swapAmount = "100";
export const slippage = "0.5";

export const mintArgs = (extra: string[] = []) => [
  "swap",
  "mint",
  "--from",
  usdc.symbol,
  "--amount",
  swapAmount,
  "--receiver",
  TEST_ADDRESS,
  ...extra,
];

export const sendToQueueArgs = (extra: string[] = []) => [
  "swap",
  "send-to-queue",
  "--from",
  vusd.symbol,
  "--amount",
  swapAmount,
  ...extra,
];

export const redeemArgs = (extra: string[] = []) => [
  "swap",
  "redeem",
  "--to",
  usdc.symbol,
  "--amount",
  swapAmount,
  "--receiver",
  TEST_ADDRESS,
  ...extra,
];

export const requestArgs = (extra: string[] = []) => [
  "swap",
  "request",
  ...extra,
];

export const approveArgs = (token: string) => [
  "swap",
  "approve",
  "--token",
  token,
  "--amount",
  swapAmount,
];

const captureStream = function (stream: NodeJS.WriteStream) {
  const chunks: string[] = [];
  const original = stream.write;
  stream.write = function (chunk: unknown) {
    chunks.push(String(chunk));
    return true;
  } as NodeJS.WriteStream["write"];
  return {
    read: () => chunks.join(""),
    restore() {
      stream.write = original;
    },
  };
};

// Commander copies these to subcommands as they are created, so the root alone
// would still let a subcommand call process.exit and take the test run with it.
const withExitOverride = function (command: Command) {
  command.exitOverride();
  command.commands.forEach(withExitOverride);
  return command;
};

/**
 * Runs the CLI in this process, mirroring how `src/cli.ts` reports failures:
 * commander prints its own usage errors, anything else goes through
 * `printError`. Driving `createProgram` in this process, rather than spawning
 * the bundled bin, is what lets coverage see these runs.
 */
export const runCliRaw = async function (args: string[]) {
  const stdout = captureStream(process.stdout);
  const stderr = captureStream(process.stderr);
  const previousExitCode = process.exitCode;

  process.exitCode = 0;

  const program = withExitOverride(createProgram());

  try {
    await program.parseAsync(args, { from: "user" });
  } catch (error) {
    if (error instanceof CommanderError) {
      process.exitCode = error.exitCode;
    } else {
      printError({ error, rpcUrl: program.opts<GlobalOptions>().rpcUrl });
    }
  } finally {
    stdout.restore();
    stderr.restore();
  }

  const exitCode = process.exitCode ?? 0;
  // Leaving this set would fail the vitest run itself.
  process.exitCode = previousExitCode;

  return { exitCode, stderr: stderr.read(), stdout: stdout.read() };
};

export const runCli = async function <T = string>(args: string[]) {
  const { exitCode, stderr, stdout } = await runCliRaw(args);
  if (exitCode !== 0) {
    throw new Error(
      `vetro-cli ${args.join(" ")} exited ${exitCode}: ${stderr}`,
    );
  }
  return JSON.parse(stdout) as T;
};

export const createClients = function (rpcUrl: string) {
  const transport = http(rpcUrl);
  return {
    publicClient: createPublicClient({ chain: mainnet, transport }),
    testClient: createTestClient({ chain: mainnet, mode: "anvil", transport }),
    walletClient: createWalletClient({
      account: privateKeyToAccount(TEST_PRIVATE_KEY),
      chain: mainnet,
      transport,
    }),
  };
};

export const fundTestAccount = async function ({
  amount,
  rpcUrl,
}: {
  amount: string;
  rpcUrl: string;
}) {
  const { testClient } = createClients(rpcUrl);
  await setBalance(testClient, {
    address: TEST_ADDRESS,
    value: parseEther("10"),
  });
  await setStorageAt(testClient, {
    address: usdc.address,
    index: keccak256(
      encodePacked(
        ["bytes32", "bytes32"],
        [pad(TEST_ADDRESS), pad(toHex(usdc.balanceSlot))],
      ),
    ),
    value: pad(toHex(parseUnits(amount, usdc.decimals))),
  });
};

export const setMaxMint = async function ({
  gateway,
  maxMint,
  rpcUrl,
}: {
  gateway: Address;
  maxMint: bigint;
  rpcUrl: string;
}) {
  const { publicClient, testClient } = createClients(rpcUrl);

  const [owner, mintLimit, maxMintBefore] = await Promise.all([
    readContract(publicClient, {
      abi: vetroGatewayAbi,
      address: gateway,
      functionName: "owner",
    }),
    readContract(publicClient, {
      abi: vetroGatewayAbi,
      address: gateway,
      functionName: "mintLimit",
    }),
    getMaxMint(publicClient, { address: gateway }),
  ]);

  await impersonateAccount(testClient, { address: owner });
  await setBalance(testClient, { address: owner, value: parseEther("1") });

  try {
    const hash = await writeContract(testClient, {
      abi: vetroGatewayAbi,
      account: owner,
      address: gateway,
      args: [mintLimit - maxMintBefore + maxMint],
      functionName: "updateMintLimit",
    });
    await waitForTransactionReceipt(publicClient, { hash });
  } finally {
    await stopImpersonatingAccount(testClient, { address: owner });
  }

  const maxMintAfter = await getMaxMint(publicClient, { address: gateway });

  return { maxMintAfter, maxMintBefore };
};

const confirmWrite = async function ({
  client,
  hash,
}: {
  client: Client;
  hash: Hex;
}) {
  const { status } = await waitForTransactionReceipt(client, { hash });
  if (status !== "success") {
    throw new Error("write reverted");
  }
};

const treasuryAbi = parseAbi([
  "function setDepositActive(address token, bool active)",
  "function setWithdrawActive(address token, bool active)",
]);

type SetTokenActiveParams = {
  active: boolean;
  gateway: Address;
  rpcUrl: string;
  token: Address;
};

const setTokenActive = async function ({
  active,
  functionName,
  gateway,
  rpcUrl,
  token,
}: SetTokenActiveParams & {
  functionName: "setDepositActive" | "setWithdrawActive";
}) {
  const { publicClient, testClient } = createClients(rpcUrl);

  const treasury = await readContract(publicClient, {
    abi: vetroGatewayAbi,
    address: gateway,
    functionName: "treasury",
  });
  const [admin, keeperRole] = await Promise.all([
    defaultAdmin(publicClient, { address: treasury }),
    getKeeperRole(publicClient, { address: treasury }),
  ]);

  await impersonateAccount(testClient, { address: admin });
  await setBalance(testClient, { address: admin, value: parseEther("1") });

  try {
    const isKeeper = await hasRole(publicClient, {
      account: admin,
      address: treasury,
      role: keeperRole,
    });
    if (!isKeeper) {
      await confirmWrite({
        client: publicClient,
        hash: await grantRole(
          createWalletClient({
            account: admin,
            chain: mainnet,
            transport: http(rpcUrl),
          }),
          { account: admin, address: treasury, role: keeperRole },
        ),
      });
    }
    await confirmWrite({
      client: publicClient,
      hash: await writeContract(testClient, {
        abi: treasuryAbi,
        account: admin,
        address: treasury,
        args: [token, active],
        functionName,
      }),
    });
  } finally {
    await stopImpersonatingAccount(testClient, { address: admin });
  }
};

export const setDepositActive = (params: SetTokenActiveParams) =>
  setTokenActive({ ...params, functionName: "setDepositActive" });

export const setWithdrawActive = (params: SetTokenActiveParams) =>
  setTokenActive({ ...params, functionName: "setWithdrawActive" });

const maintainerRoleAbi = parseAbi([
  "function MAINTAINER_ROLE() view returns (bytes32)",
]);

const impersonateMaintainer = async function ({
  gateway,
  rpcUrl,
}: {
  gateway: Address;
  rpcUrl: string;
}) {
  const { publicClient, testClient } = createClients(rpcUrl);

  const [maintainerRole, treasury] = await Promise.all([
    readContract(publicClient, {
      abi: maintainerRoleAbi,
      address: gateway,
      functionName: "MAINTAINER_ROLE",
    }),
    getTreasury(publicClient, { address: gateway }),
  ]);
  const admin = await defaultAdmin(publicClient, { address: treasury });

  await impersonateAccount(testClient, { address: admin });
  await setBalance(testClient, { address: admin, value: parseEther("1") });

  try {
    const isMaintainer = await hasRole(publicClient, {
      account: admin,
      address: treasury,
      role: maintainerRole,
    });
    if (!isMaintainer) {
      await confirmWrite({
        client: publicClient,
        hash: await grantRole(
          createWalletClient({
            account: admin,
            chain: mainnet,
            transport: http(rpcUrl),
          }),
          { account: admin, address: treasury, role: maintainerRole },
        ),
      });
    }
  } catch (error) {
    await stopImpersonatingAccount(testClient, { address: admin });
    throw error;
  }
  return admin;
};

export const setWithdrawalDelay = async function ({
  delay,
  enabled,
  gateway,
  rpcUrl,
}: {
  delay?: bigint;
  enabled: boolean;
  gateway: Address;
  rpcUrl: string;
}) {
  const { publicClient, testClient } = createClients(rpcUrl);
  const maintainer = await impersonateMaintainer({ gateway, rpcUrl });

  try {
    // updateWithdrawalDelay reverts on 0, so only write a delay the caller gave.
    if (delay !== undefined) {
      await confirmWrite({
        client: publicClient,
        hash: await writeContract(testClient, {
          abi: vetroGatewayAbi,
          account: maintainer,
          address: gateway,
          args: [delay],
          functionName: "updateWithdrawalDelay",
        }),
      });
    }
    await confirmWrite({
      client: publicClient,
      hash: await writeContract(testClient, {
        abi: vetroGatewayAbi,
        account: maintainer,
        address: gateway,
        args: [enabled],
        functionName: "setWithdrawalDelayEnabled",
      }),
    });
  } finally {
    await stopImpersonatingAccount(testClient, { address: maintainer });
  }
};

/** Adds an account to the gateway's instant-redeem whitelist, or removes it. */
export const setInstantRedeemWhitelisted = async function ({
  account,
  gateway,
  rpcUrl,
  whitelisted,
}: {
  account: Address;
  gateway: Address;
  rpcUrl: string;
  whitelisted: boolean;
}) {
  const { publicClient, testClient } = createClients(rpcUrl);
  // Both writes revert when the account is already in the wanted state.
  const isWhitelisted = await isInstantRedeemWhitelisted(publicClient, {
    account,
    address: gateway,
  });
  if (isWhitelisted === whitelisted) {
    return;
  }

  const maintainer = await impersonateMaintainer({ gateway, rpcUrl });
  try {
    await confirmWrite({
      client: publicClient,
      hash: await writeContract(testClient, {
        abi: vetroGatewayAbi,
        account: maintainer,
        address: gateway,
        args: [account],
        functionName: whitelisted
          ? "addToInstantRedeemWhitelist"
          : "removeFromInstantRedeemWhitelist",
      }),
    });
  } finally {
    await stopImpersonatingAccount(testClient, { address: maintainer });
  }
};

/** Turns the gateway's redeem queue on or off, and returns a restore for its previous state. */
export const setRedeemQueueEnabled = async function ({
  enabled,
  gateway,
  rpcUrl,
}: {
  enabled: boolean;
  gateway: Address;
  rpcUrl: string;
}) {
  const { publicClient } = createClients(rpcUrl);
  const enabledBefore = await getWithdrawalDelayEnabled(publicClient, {
    address: gateway,
  });
  await setWithdrawalDelay({ enabled, gateway, rpcUrl });
  return () => setWithdrawalDelay({ enabled: enabledBefore, gateway, rpcUrl });
};

/** Broadcasts a TransactionRequest the CLI emitted, exactly as an agent would. */
export const sendTransactionRequest = async function ({
  request,
  rpcUrl,
}: {
  request: TransactionRequest;
  rpcUrl: string;
}) {
  const { publicClient, walletClient } = createClients(rpcUrl);
  const hash = await sendTransaction(walletClient, {
    data: request.data,
    to: request.to,
    value: hexToBigInt(request.value),
  });
  return waitForTransactionReceipt(publicClient, { hash });
};

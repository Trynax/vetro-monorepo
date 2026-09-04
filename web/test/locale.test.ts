import { readdir, readFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { describe, expect, it } from "vitest";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface LocaleObject {
  [key: string]: string | LocaleObject;
}

const getFullKeys = function (
  obj: string | LocaleObject,
  prefix?: string,
): string[] {
  if (typeof obj === "string") {
    return prefix ? [prefix] : [];
  }
  return Object.keys(obj).flatMap(function (key: string) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    return typeof value === "object" && value !== null
      ? getFullKeys(value, fullKey)
      : fullKey;
  });
};

// i18next plural suffixes: https://www.i18next.com/translation-function/plurals
const pluralSuffixes = ["_zero", "_one", "_two", "_few", "_many", "_other"];
// Remove plural suffixes from keys to compare base keys across locales. This is because
// they may differ across locales (e.g. some languages may have more plural forms than others).
const stripPluralSuffix = (key: string) =>
  pluralSuffixes.reduce(
    (k, suffix) => (k.endsWith(suffix) ? k.slice(0, -suffix.length) : k),
    key,
  );

const getBaseKeys = (keys: string[]) => [
  ...new Set(keys.map(stripPluralSuffix)),
];

const sourceFileExtensions = /\.(cjs|js|jsx|mjs|ts|tsx)$/;

// Keys assembled at runtime — e.g. t(`common.${inputError}`) for the InputError
// union in src/components/tokenInput/utils.ts — can't be found by a static
// string search, so they are listed here to avoid being reported as orphaned.
const dynamicallyReferencedKeys = [
  "common.amount-too-small-to-bridge",
  "common.enter-amount",
  "common.exceeds-debt",
  "common.exceeds-max-mint",
  "common.insufficient-balance",
  "common.insufficient-collateral",
  "common.insufficient-gas",
  "common.insufficient-liquidity",
  "common.insufficient-treasury",
  "pages.borrow.activity.open-position-text",
  "pages.borrow.activity.open-position-title",
];

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// A key only counts as referenced when it is not immediately preceded or
// followed by another key character, so a key that is merely a fragment of a
// longer one — whether a prefix ("pages.borrow.borrow-more" inside
// "pages.borrow.borrow-more-progress") or a dot-boundary suffix ("enter-amount"
// inside "common.enter-amount") — is not mistaken for a match.
const isReferenced = ({ corpus, key }: { corpus: string; key: string }) =>
  new RegExp(`(?<![\\w.-])${escapeRegExp(key)}(?![\\w.-])`).test(corpus);

const readEnglishBaseKeys = async function () {
  const filePath = path.resolve(
    __dirname,
    "../src/i18n/locales/en/translation.json",
  );
  const content = JSON.parse(await readFile(filePath, "utf-8")) as LocaleObject;
  return getBaseKeys(getFullKeys(content));
};

// Concatenate every source file (excluding the locale JSON files themselves) so
// translation keys can be searched for as literals.
const readSourceCorpus = async function () {
  const srcDir = path.resolve(__dirname, "../src");
  const localesPath = path.join("i18n", "locales");
  const entries = await readdir(srcDir, { recursive: true });
  const sourceFiles = entries.filter(
    (entry: string) =>
      sourceFileExtensions.test(entry) && !entry.includes(localesPath),
  );
  const contents = await Promise.all(
    sourceFiles.map((file: string) =>
      readFile(path.join(srcDir, file), "utf-8"),
    ),
  );
  return contents.join("\n");
};

describe("locale messages", function () {
  describe("All locale resource files should have the same keys in the same order", function () {
    it("should have the same keys in the same order", async function () {
      // get the locale directories
      const localesDir = path.resolve(__dirname, "../src/i18n/locales");
      const localeDirs = await readdir(localesDir);

      // read the translation.json file from each locale directory
      const keysArrays = await Promise.all(
        localeDirs.map(async function (locale: string) {
          const filePath = path.join(localesDir, locale, "translation.json");
          const content = JSON.parse(
            await readFile(filePath, "utf-8"),
          ) as LocaleObject;
          return getFullKeys(content);
        }),
      );

      // compare base keys (with plural suffixes stripped) across all locales
      const baseKeysArrays = keysArrays.map(getBaseKeys);
      baseKeysArrays.forEach((baseKeys: string[]) =>
        expect(baseKeys).toEqual(baseKeysArrays[0]),
      );
    });
  });

  describe("English locale keys should be sorted alphabetically", function () {
    it("should have all keys sorted alphabetically", async function () {
      const localesDir = path.resolve(__dirname, "../src/i18n/locales");
      const englishFilePath = path.join(localesDir, "en", "translation.json");
      const content = JSON.parse(
        await readFile(englishFilePath, "utf-8"),
      ) as LocaleObject;
      const keys = getFullKeys(content);
      const sortedKeys = [...keys].sort();

      expect(keys).toEqual(sortedKeys);
    });
  });

  describe("English locale keys should all be referenced in the source code", function () {
    it("should not have unused (orphaned) keys", async function () {
      const baseKeys = await readEnglishBaseKeys();
      const corpus = await readSourceCorpus();

      const unusedKeys = baseKeys.filter(
        (key: string) =>
          !isReferenced({ corpus, key }) &&
          !dynamicallyReferencedKeys.includes(key),
      );

      expect(unusedKeys).toEqual([]);
    });

    // Guards the allow-list above from going stale: if a dynamically referenced
    // key is deleted from the translations, its allow-list entry must go too.
    it("should not allow-list keys that no longer exist", async function () {
      const baseKeys = await readEnglishBaseKeys();

      const staleAllowList = dynamicallyReferencedKeys.filter(
        (key: string) => !baseKeys.includes(key),
      );

      expect(staleAllowList).toEqual([]);
    });
  });
});

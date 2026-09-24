/**
 * A versioned registry snapshot installs one release as a whole: a pinned
 * item (`<homepage>/r/v<version>/<item>.json`) must pull the same version of
 * the items it depends on. Latest item files declare those dependencies by
 * their latest URL (`<homepage>/r/<item>.json`), so the snapshot rewrites the
 * `registryDependencies` entries that name an item of this registry.
 *
 * Only `registryDependencies` arrays change: `meta.registryUrl` keeps the
 * latest URL, and embedded file contents never match because their quotes
 * are escaped.
 */

const REGEX_REGISTRY_DEPENDENCIES = /"registryDependencies":\s*\[[^\]]*\]/g;
const REGEX_JSON_STRING = /"([^"\\]*)"/g;
const JSON_EXTENSION = ".json";

function latestItemName(dependency, latestPrefix) {
  if (
    !(
      dependency.startsWith(latestPrefix) && dependency.endsWith(JSON_EXTENSION)
    )
  ) {
    return null;
  }

  const name = dependency.slice(latestPrefix.length, -JSON_EXTENSION.length);
  return name.includes("/") ? null : name;
}

/**
 * @param {string} content A latest registry file (an item or the index).
 * @param {{ homepage: string, itemNames: string[], version: string }} options
 * @returns {string} The same file with this registry's dependencies pinned to
 * `version`.
 */
export function pinSnapshotDependencies(content, options) {
  const latestPrefix = `${options.homepage}/r/`;
  const itemNames = new Set(options.itemNames);

  return content.replace(REGEX_REGISTRY_DEPENDENCIES, (dependencies) =>
    dependencies.replace(REGEX_JSON_STRING, (token, value) => {
      const name = latestItemName(value, latestPrefix);
      if (!(name && itemNames.has(name))) {
        return token;
      }

      return `"${latestPrefix}v${options.version}/${name}${JSON_EXTENSION}"`;
    })
  );
}

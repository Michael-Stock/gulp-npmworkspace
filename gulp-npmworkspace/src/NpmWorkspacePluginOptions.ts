import * as path from "path"
import * as fs from "fs";
import * as _ from "underscore";

import {PackageDescriptor} from "./PackageDescriptor";

const argv = require("yargs")
    .alias("p", "package")
    .alias("v", "verbose")
    .argv;

/**
 * The 'gulp-npmworkspace' plugin name (useful for generating errors).
 */
export const PLUGIN_NAME = (<PackageDescriptor>require(path.join(__dirname, "../package.json"))).name;

/**
 * A type of increment to apply when bumping up version numbers during a publish.
 */
export enum VersionBump {
    major,
    premajor,
    minor,
    preminor,
    patch,
    prepatch,
    prerelease
}

/**
 * Represents the global options that are applied across all plugins.
 */
export interface NpmWorkspacePluginOptions {
    /**
     * The name of the workspace package to focus streaming on.
     */
    package?: string;

    /**
     * If [[NpmWorkspacePluginOptions#package]] is specified, then true will only
     * stream that named package; false will stream that named package and its
     * associated dependencies.
     */
    onlyNamedPackage?: boolean;

    /**
     * A switch to determine if logging should be enabled.
     */
    enableLogging?: boolean;

    /**
     * A switch to determine if verbose logging should be enabled.
     */
    verboseLogging?: boolean;

    /**
     * A [[VersionBump]] value that determines how version numbers are bumped up
     * during a publish.
     */
    versionBump?: string | VersionBump;

    /**
     * The current working directory.
     */
    cwd?: string;

    /**
     * Disables external workspace linking and treats assocaited dependencies as normal
     * dependencies.
     */
    disableExternalWorkspaces?: boolean;
}

/**
 * The default plugin options.
 */
const DEFAULT_WORKSPACE_PLUGIN_OPTIONS: NpmWorkspacePluginOptions = {
    enableLogging: true,
    verboseLogging: false,
    versionBump: VersionBump.patch,
    cwd: process.cwd(),
    disableExternalWorkspaces: false
};

/**
 * Returns the workspace plugin options.
 *
 * @param localOptions An optional set of options that should override the defaults.
 *
 * @returns An [[NpmWorkspacePluginOptions]] object that is a combination of the default
 * workspace plugin options, the provided options, and the options taken from the command line.
 *
 * Option precedence is command line options -> local options -> default options.
 */
export function getWorkspacePluginOptions(localOptions?: NpmWorkspacePluginOptions): NpmWorkspacePluginOptions {
        return _.extend(DEFAULT_WORKSPACE_PLUGIN_OPTIONS,
                        localOptions || { },
                        getCmdLineWorkspacePluginOptions());
}

/**
 * Returns the options that are set on the command line.
 */
var getCmdLineWorkspacePluginOptions = cache(function(): NpmWorkspacePluginOptions {
    const EXCLUSIVE_PACKAGE_SYMBOL: string = "!";

    let options: NpmWorkspacePluginOptions = { };

    if (argv.package) {
        let matches = /(\!?)(.+)/.exec(argv.package);

        if (matches) {
            let exclusiveMarkerToken = matches[1];
            let packageToken = matches[2];

            options.package = findPackageName(packageToken);
            options.onlyNamedPackage = options.package ? exclusiveMarkerToken === EXCLUSIVE_PACKAGE_SYMBOL : false;
        }
    }

    if (argv.verbose) {
        options.verboseLogging = true;
    }

    // --version-bump=<semver>
    if (argv.versionBump && typeof argv.versionBump === "string") {
        options.versionBump = argv.versionBump;
    }

    // --disable-externals
    if (argv.disableExternals) {
        options.disableExternalWorkspaces = true;
    }

    return options;
});

/**
 * Resolves the supplied package token to a package name.
 *
 * @param packageToken The package name that has been taken from the command line.
 *
 * @returns A string representing the resolved package name.
 */
function findPackageName(packageToken: string): string {
    let currentPath = path.isAbsolute(packageToken) ? packageToken : path.join(process.cwd(), packageToken);

    if (!fs.existsSync(currentPath)) {
        return packageToken;
    }

    if (fs.statSync(currentPath).isFile()) {
        currentPath = path.parse(currentPath).dir;
    }

    let currentPackagePath = path.join(currentPath, "package.json");
    let currentPackagePathInfo: path.ParsedPath;

    do {
        if (fs.existsSync(currentPackagePath)) {
            return (<PackageDescriptor>require(currentPackagePath)).name;
        }

        currentPackagePath = path.join(currentPackagePath, "..", "..", "package.json");
        currentPackagePathInfo = path.parse(currentPackagePath);
    } while (currentPackagePathInfo.dir !== currentPackagePathInfo.root)


    return packageToken;
}

/**
 * Caches a value returned from a function and returns that value on subsequent invocations.
 *
 * @param valueProviderFunc A function that will provide the value to cache.
 *
 * @returns A function that decorates the supplied value provider by ensuring that the value
 * provider is only invoked once.
 */
function cache<TValue>(valueProviderFunc: (...args: any[]) => TValue): (...args: any[]) => TValue {
    let cacheValue: TValue;

    return function(...args: any[]): TValue {
        if (cacheValue) {
            return cacheValue;
        }

        cacheValue = valueProviderFunc(args);

        return cacheValue;
    };
}

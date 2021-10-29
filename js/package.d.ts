import type { Configuration } from 'webpack';
import { AddonInstance } from '@embroider/shared-internals';
import type { TransformOptions } from '@babel/core';
export declare function reloadDevPackages(): void;
export interface Options {
    exclude?: string[];
    alias?: {
        [fromName: string]: string;
    };
    webpack?: Configuration;
    publicAssetURL?: string;
    styleLoaderOptions?: Record<string, unknown>;
    cssLoaderOptions?: Record<string, unknown>;
    forbidEval?: boolean;
    skipBabel?: {
        package: string;
        semverRange?: string;
    }[];
    watchDependencies?: (string | string[])[];
    insertScriptsAt?: string;
    insertStylesAt?: string;
}
export interface DepResolution {
    type: 'package';
    path: string;
    packageName: string;
    packageRoot: string;
}
interface LocalResolution {
    type: 'local';
    local: string;
}
interface URLResolution {
    type: 'url';
    url: string;
}
interface ImpreciseResolution {
    type: 'imprecise';
}
export default class Package {
    name: string;
    root: string;
    isAddon: boolean;
    private _options;
    private _parent;
    private _hasBabelDetails;
    private _babelMajorVersion?;
    private _babelOptions;
    private _emberCLIBabelExtensions?;
    private autoImportOptions;
    private isDeveloping;
    private pkgGeneration;
    private pkgCache;
    static lookupParentOf(child: AddonInstance): Package;
    constructor(child: AddonInstance);
    _ensureBabelDetails(): void;
    get babelOptions(): TransformOptions;
    get babelMajorVersion(): number | undefined;
    get isFastBootEnabled(): boolean;
    private buildBabelOptions;
    private get pkg();
    get namespace(): string;
    magicDeps: Map<string, string> | undefined;
    private hasDependency;
    requestedRange(packageName: string): string | undefined;
    private hasNonDevDependency;
    static categorize(importedPath: string, partial?: boolean): "local" | "url" | "imprecise" | "dep";
    resolve(importedPath: string, fromPath: string): DepResolution | LocalResolution | URLResolution | undefined;
    resolve(importedPath: string, fromPath: string, partial: true): DepResolution | LocalResolution | URLResolution | ImpreciseResolution | undefined;
    private assertAllowedDependency;
    private excludesDependency;
    get webpackConfig(): any;
    get skipBabel(): Options['skipBabel'];
    get aliases(): Record<string, string> | undefined;
    private aliasFor;
    get fileExtensions(): string[];
    publicAssetURL(): string;
    get styleLoaderOptions(): Record<string, unknown> | undefined;
    get cssLoaderOptions(): Record<string, unknown> | undefined;
    get forbidsEval(): boolean;
    get insertScriptsAt(): string | undefined;
    get insertStylesAt(): string | undefined;
    get watchedDirectories(): string[] | undefined;
    cleanBabelConfig(): TransformOptions;
    browserslist(): string;
}
export {};

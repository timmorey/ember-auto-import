import type Plugin from 'broccoli-plugin';
import type Splitter from './splitter';
import type Package from './package';
import type BundleConfig from './bundle-config';
import type { BundleName } from './bundle-config';
import type { TransformOptions } from '@babel/core';
import type webpack from 'webpack';
export interface BundlerOptions {
    consoleWrite: (msg: string) => void;
    environment: 'development' | 'test' | 'production';
    splitter: Splitter;
    packages: Set<Package>;
    bundles: BundleConfig;
    babelConfig: TransformOptions;
    publicAssetURL: string | undefined;
    browserslist: string;
    webpack: typeof webpack;
}
export interface BuildResult {
    entrypoints: Map<BundleName | string, string[]>;
    lazyAssets: string[];
}
export declare type Bundler = Plugin & {
    buildResult: BuildResult;
};
export declare function debugBundler(bundler: Bundler, label: string): Bundler;

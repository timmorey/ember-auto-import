"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeConfig = void 0;
const path_1 = require("path");
const lodash_1 = require("lodash");
const fs_1 = require("fs");
const handlebars_1 = require("handlebars");
const js_string_escape_1 = __importDefault(require("js-string-escape"));
const broccoli_plugin_1 = __importDefault(require("broccoli-plugin"));
const shared_internals_1 = require("@embroider/shared-internals");
const shared_internals_2 = require("@embroider/shared-internals");
const typescript_memoize_1 = require("typescript-memoize");
const debug_1 = __importDefault(require("debug"));
const fs_extra_1 = require("fs-extra");
const debug = debug_1.default('ember-auto-import:webpack');
handlebars_1.registerHelper('js-string-escape', js_string_escape_1.default);
handlebars_1.registerHelper('join', function (list, connector) {
    return list.join(connector);
});
const entryTemplate = handlebars_1.compile(`
module.exports = (function(){
  var d = _eai_d;
  var r = _eai_r;
  window.emberAutoImportDynamic = function(specifier) {
    if (arguments.length === 1) {
      return r('_eai_dyn_' + specifier);
    } else {
      return r('_eai_dynt_' + specifier)(Array.prototype.slice.call(arguments, 1))
    }
  };
  window.emberAutoImportSync = function(specifier) {
    {{! this is only used for synchronous importSync() using a template string }}
    return r('_eai_sync_' + specifier)(Array.prototype.slice.call(arguments, 1))
  };
  {{#each staticImports as |module|}}
    d('{{js-string-escape module.specifier}}', [], function() { return require('{{js-string-escape module.specifier}}'); });
  {{/each}}
  {{#each dynamicImports as |module|}}
    d('_eai_dyn_{{js-string-escape module.specifier}}', [], function() { return import('{{js-string-escape module.specifier}}'); });
  {{/each}}
  {{#each staticTemplateImports as |module|}}
    d('_eai_sync_{{js-string-escape module.key}}', [], function() {
      return function({{module.args}}) {
        return require({{{module.template}}});
      }
    });
  {{/each}}
  {{#each dynamicTemplateImports as |module|}}
    d('_eai_dynt_{{js-string-escape module.key}}', [], function() {
      return function({{module.args}}) {
        return import({{{module.template}}});
      }
    });
  {{/each}}
})();
`);
// this goes in a file by itself so we can tell webpack not to parse it. That
// allows us to grab the "require" and "define" from our enclosing scope without
// webpack messing with them.
//
// It's important that we're using our enclosing scope and not jumping directly
// to window.require (which would be easier), because the entire Ember app may be
// inside a closure with a "require" that isn't the same as "window.require".
const loader = `
window._eai_r = require;
window._eai_d = define;
`;
class WebpackBundler extends broccoli_plugin_1.default {
    constructor(priorTrees, opts) {
        super(priorTrees, {
            persistentOutput: true,
            needsCache: true,
            annotation: 'ember-auto-import-webpack',
        });
        this.opts = opts;
    }
    get buildResult() {
        if (!this.lastBuildResult) {
            throw new Error(`bug: no buildResult available yet`);
        }
        return this.lastBuildResult;
    }
    get webpack() {
        return this.setup().webpack;
    }
    get stagingDir() {
        return this.setup().stagingDir;
    }
    setup() {
        var _a, _b;
        if (this.state) {
            return this.state;
        }
        // resolve the real path, because we're going to do path comparisons later
        // that could fail if this is not canonical.
        //
        // cast is ok because we passed needsCache to super
        let stagingDir = fs_1.realpathSync(this.cachePath);
        let entry = {};
        this.opts.bundles.names.forEach(bundle => {
            entry[bundle] = [path_1.join(stagingDir, 'l.js'), path_1.join(stagingDir, `${bundle}.js`)];
        });
        let config = {
            mode: this.opts.environment === 'production' ? 'production' : 'development',
            entry,
            performance: {
                hints: false,
            },
            // this controls webpack's own runtime code generation. You still need
            // preset-env to preprocess the libraries themselves (which is already
            // part of this.opts.babelConfig)
            target: `browserslist:${this.opts.browserslist}`,
            output: {
                path: path_1.join(this.outputPath, 'assets'),
                publicPath: this.opts.publicAssetURL,
                filename: `chunk.[id].[chunkhash].js`,
                chunkFilename: `chunk.[id].[chunkhash].js`,
                libraryTarget: 'var',
                library: '__ember_auto_import__',
            },
            optimization: {
                splitChunks: {
                    chunks: 'all',
                },
            },
            resolveLoader: {
                alias: {
                    // these loaders are our dependencies, not the app's dependencies. I'm
                    // not overriding the default loader resolution rules in case the app also
                    // wants to control those.
                    'babel-loader-8': require.resolve('babel-loader'),
                    'eai-style-loader': require.resolve('style-loader'),
                    'eai-css-loader': require.resolve('css-loader'),
                },
            },
            resolve: {
                extensions: ['.js', '.ts', '.json'],
                mainFields: ['browser', 'module', 'main'],
                alias: Object.assign({}, ...[...this.opts.packages].map(pkg => pkg.aliases).filter(Boolean)),
            },
            module: {
                noParse: (file) => file === path_1.join(stagingDir, 'l.js'),
                rules: [
                    this.babelRule(stagingDir),
                    {
                        test: /\.css$/i,
                        use: [
                            {
                                loader: 'eai-style-loader',
                                options: (_a = [...this.opts.packages].find(pkg => pkg.styleLoaderOptions)) === null || _a === void 0 ? void 0 : _a.styleLoaderOptions,
                            },
                            {
                                loader: 'eai-css-loader',
                                options: (_b = [...this.opts.packages].find(pkg => pkg.cssLoaderOptions)) === null || _b === void 0 ? void 0 : _b.cssLoaderOptions,
                            },
                        ],
                    },
                ],
            },
            node: false,
            externals: this.externalsHandler,
        };
        mergeConfig(config, ...[...this.opts.packages].map(pkg => pkg.webpackConfig));
        if ([...this.opts.packages].find(pkg => pkg.forbidsEval)) {
            config.devtool = 'source-map';
        }
        debug('webpackConfig %j', config);
        this.state = { webpack: this.opts.webpack(config), stagingDir };
        return this.state;
    }
    skipBabel() {
        let output = [];
        for (let pkg of this.opts.packages) {
            let skip = pkg.skipBabel;
            if (skip) {
                output = output.concat(skip);
            }
        }
        return output;
    }
    babelRule(stagingDir) {
        let shouldTranspile = shared_internals_1.babelFilter(this.skipBabel());
        return {
            test(filename) {
                // We don't apply babel to our own stagingDir (it contains only our own
                // entrypoints that we wrote, and it can use `import()`, which we want
                // to leave directly for webpack).
                //
                // And we otherwise defer to the `skipBabel` setting as implemented by
                // `@embroider/shared-internals`.
                return path_1.dirname(filename) !== stagingDir && shouldTranspile(filename);
            },
            use: {
                loader: 'babel-loader-8',
                options: this.opts.babelConfig,
            },
        };
    }
    get externalsHandler() {
        let packageCache = shared_internals_2.PackageCache.shared('ember-auto-import');
        return function (params, callback) {
            let { context, request } = params;
            if (!context || !request) {
                return callback();
            }
            if (request.startsWith('!')) {
                return callback();
            }
            let name = shared_internals_1.packageName(request);
            if (!name) {
                // we're only interested in handling inter-package resolutions
                return callback();
            }
            let pkg = packageCache.ownerOfFile(context);
            if (!(pkg === null || pkg === void 0 ? void 0 : pkg.isV2Addon())) {
                // we're only interested in imports that appear inside v2 addons
                return callback();
            }
            try {
                let found = packageCache.resolve(name, pkg);
                if (!found.isEmberPackage() || found.isV2Addon()) {
                    // if we're importing a non-ember package or a v2 addon, we don't
                    // externalize. Those are all "normal" looking packages that should be
                    // resolvable statically.
                    return callback();
                }
                else {
                    // the package exists but it is a v1 ember addon, so it's not
                    // resolvable at build time, so we externalize it.
                    return callback(undefined, 'commonjs ' + request);
                }
            }
            catch (err) {
                if (err.code !== 'MODULE_NOT_FOUND') {
                    throw err;
                }
                // real package doesn't exist, so externalize it
                return callback(undefined, 'commonjs ' + request);
            }
        };
    }
    build() {
        return __awaiter(this, void 0, void 0, function* () {
            let bundleDeps = yield this.opts.splitter.deps();
            for (let [bundle, deps] of bundleDeps.entries()) {
                this.writeEntryFile(bundle, deps);
            }
            this.writeLoaderFile();
            this.linkDeps(bundleDeps);
            let stats = yield this.runWebpack();
            this.lastBuildResult = this.summarizeStats(stats, bundleDeps);
        });
    }
    summarizeStats(_stats, bundleDeps) {
        let { entrypoints, assets } = _stats.toJson();
        // webpack's types are written rather loosely, implying that these two
        // properties may not be present. They really always are, as far as I can
        // tell, but we need to check here anyway to satisfy the type checker.
        if (!entrypoints) {
            throw new Error(`unexpected webpack output: no entrypoints`);
        }
        if (!assets) {
            throw new Error(`unexpected webpack output: no assets`);
        }
        let output = {
            entrypoints: new Map(),
            lazyAssets: [],
        };
        let nonLazyAssets = new Set();
        for (let id of Object.keys(entrypoints)) {
            let { assets: entrypointAssets } = entrypoints[id];
            if (!entrypointAssets) {
                throw new Error(`unexpected webpack output: no entrypoint.assets`);
            }
            // our built-in bundles can be "empty" while still existing because we put
            // setup code in them, so they get a special check for non-emptiness.
            // Whereas any other bundle that was manually configured by the user
            // should always be emitted.
            if (!this.opts.bundles.isBuiltInBundleName(id) || nonEmptyBundle(id, bundleDeps)) {
                output.entrypoints.set(id, entrypointAssets.map(a => 'assets/' + a.name));
            }
            entrypointAssets.forEach(asset => nonLazyAssets.add(asset.name));
        }
        for (let asset of assets) {
            if (!nonLazyAssets.has(asset.name)) {
                output.lazyAssets.push('assets/' + asset.name);
            }
        }
        return output;
    }
    writeEntryFile(name, deps) {
        fs_1.writeFileSync(path_1.join(this.stagingDir, `${name}.js`), entryTemplate({
            staticImports: deps.staticImports,
            dynamicImports: deps.dynamicImports,
            dynamicTemplateImports: deps.dynamicTemplateImports.map(mapTemplateImports),
            staticTemplateImports: deps.staticTemplateImports.map(mapTemplateImports),
            publicAssetURL: this.opts.publicAssetURL,
        }));
    }
    writeLoaderFile() {
        fs_1.writeFileSync(path_1.join(this.stagingDir, `l.js`), loader);
    }
    linkDeps(bundleDeps) {
        for (let deps of bundleDeps.values()) {
            for (let resolved of deps.staticImports) {
                this.ensureLinked(resolved);
            }
            for (let resolved of deps.dynamicImports) {
                this.ensureLinked(resolved);
            }
            for (let resolved of deps.staticTemplateImports) {
                this.ensureLinked(resolved);
            }
            for (let resolved of deps.dynamicTemplateImports) {
                this.ensureLinked(resolved);
            }
        }
    }
    ensureLinked({ packageName, packageRoot }) {
        fs_extra_1.ensureDirSync(path_1.dirname(path_1.join(this.stagingDir, 'node_modules', packageName)));
        if (!fs_extra_1.existsSync(path_1.join(this.stagingDir, 'node_modules', packageName))) {
            fs_extra_1.symlinkSync(packageRoot, path_1.join(this.stagingDir, 'node_modules', packageName), 'junction');
        }
    }
    runWebpack() {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise((resolve, reject) => {
                this.webpack.run((err, stats) => {
                    const statsString = stats ? stats.toString() : '';
                    if (err) {
                        this.opts.consoleWrite(statsString);
                        reject(err);
                        return;
                    }
                    if (stats === null || stats === void 0 ? void 0 : stats.hasErrors()) {
                        this.opts.consoleWrite(statsString);
                        reject(new Error('webpack returned errors to ember-auto-import'));
                        return;
                    }
                    if ((stats === null || stats === void 0 ? void 0 : stats.hasWarnings()) || process.env.AUTO_IMPORT_VERBOSE) {
                        this.opts.consoleWrite(statsString);
                    }
                    // this cast is justified because we already checked hasErrors above
                    resolve(stats);
                });
            });
        });
    }
}
__decorate([
    typescript_memoize_1.Memoize()
], WebpackBundler.prototype, "externalsHandler", null);
exports.default = WebpackBundler;
function mergeConfig(dest, ...srcs) {
    return lodash_1.mergeWith(dest, ...srcs, combine);
}
exports.mergeConfig = mergeConfig;
function combine(objValue, srcValue, key) {
    if (key === 'noParse') {
        return eitherPattern(objValue, srcValue);
    }
    // arrays concat
    if (Array.isArray(objValue)) {
        return objValue.concat(srcValue);
    }
}
// webpack configs have several places where they accept:
//   - RegExp
//   - [RegExp]
//   - (resource: string) => boolean
//   - string
//   - [string]
// This function combines any of these with a logical OR.
function eitherPattern(...patterns) {
    let flatPatterns = lodash_1.flatten(patterns);
    return function (resource) {
        for (let pattern of flatPatterns) {
            if (pattern instanceof RegExp) {
                if (pattern.test(resource)) {
                    return true;
                }
            }
            else if (typeof pattern === 'string') {
                if (pattern === resource) {
                    return true;
                }
            }
            else if (typeof pattern === 'function') {
                if (pattern(resource)) {
                    return true;
                }
            }
        }
        return false;
    };
}
function mapTemplateImports(imp) {
    return {
        key: imp.importedBy[0].cookedQuasis.join('${e}'),
        args: imp.expressionNameHints.join(','),
        template: '`' +
            lodash_1.zip(imp.cookedQuasis, imp.expressionNameHints)
                .map(([q, e]) => q + (e ? '${' + e + '}' : ''))
                .join('') +
            '`',
    };
}
function nonEmptyBundle(name, bundleDeps) {
    let deps = bundleDeps.get(name);
    if (!deps) {
        return false;
    }
    return (deps.staticImports.length > 0 ||
        deps.staticTemplateImports.length > 0 ||
        deps.dynamicImports.length > 0 ||
        deps.dynamicTemplateImports.length > 0);
}
//# sourceMappingURL=webpack.js.map
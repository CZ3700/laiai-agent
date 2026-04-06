#!/usr/bin/env node
/**
 * LaiaiAgent Build Script — Hybrid Bundle Mode
 *
 * Bundles the entire project into a single cli.js, resolving all npm
 * dependencies inline (except SDKs and native modules).
 *
 * Handles three project-specific concerns:
 *   1. `bun:bundle` feature()  → shim returning false
 *   2. MACRO.* constants       → injected via define
 *   3. `src/*` bare specifiers → resolved to absolute .ts paths
 *   4. Missing feature-gated files → empty-module stubs
 */
import esbuild from 'esbuild';
import { cpSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { dirname, resolve, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, 'package.json'), 'utf-8'));
const VERSION = pkg.version || '0.0.1';

// ─── Plugin: bun:bundle shim ───────────────────────────────────────────────
const bunBundlePlugin = {
  name: 'bun-bundle-shim',
  setup(build) {
    build.onResolve({ filter: /^bun:bundle$/ }, () => ({
      path: 'bun:bundle',
      namespace: 'bun-bundle-shim',
    }));
    build.onLoad({ filter: /.*/, namespace: 'bun-bundle-shim' }, () => ({
      contents: `export function feature(name) { return false; }`,
      loader: 'js',
    }));
  },
};

// ─── Plugin: resolve bare `src/…` specifiers to actual .ts/.tsx files ──────
const srcPathPlugin = {
  name: 'src-path-resolver',
  setup(build) {
    build.onResolve({ filter: /^src\// }, (args) => {
      // src/utils/foo.js → try src/utils/foo.ts, .tsx, .js, /index.ts
      const base = resolve(__dirname, args.path);
      const candidates = [
        base,
        base.replace(/\.js$/, '.ts'),
        base.replace(/\.js$/, '.tsx'),
        base.replace(/\.js$/, '/index.ts'),
        base.replace(/\.js$/, '/index.tsx'),
      ];
      for (const c of candidates) {
        if (existsSync(c)) return { path: c };
      }
      // Not found — return a stub
      return { path: args.path, namespace: 'missing-stub' };
    });
  },
};

// ─── Plugin: stub out missing files (feature-gated code that was excluded) ─
const missingFilePlugin = {
  name: 'missing-file-stub',
  setup(build) {
    // Stub out missing npm packages (e.g., @ant/*, @anthropic-ai/sandbox-runtime)
    const NODE_BUILTINS = new Set([
      'assert','async_hooks','buffer','child_process','cluster','console',
      'constants','crypto','dgram','diagnostics_channel','dns','domain',
      'events','fs','fs/promises','http','http2','https','inspector','module',
      'net','os','path','perf_hooks','process','punycode','querystring',
      'readline','repl','stream','stream/promises','stream/web',
      'string_decoder','sys','test','timers','timers/promises','tls',
      'trace_events','tty','url','util','v8','vm','wasi','worker_threads','zlib',
    ]);
    build.onResolve({ filter: /^@?[a-z]/ }, (args) => {
      if (args.namespace !== 'file' && args.namespace !== '') return null;
      // Skip node builtins (with or without node: prefix)
      if (args.path.startsWith('node:')) return null;
      if (NODE_BUILTINS.has(args.path)) return null;
      // Check if the package exists in node_modules
      const pkgName = args.path.startsWith('@')
        ? args.path.split('/').slice(0, 2).join('/')
        : args.path.split('/')[0];
      if (NODE_BUILTINS.has(pkgName)) return null;
      const pkgDir = join(__dirname, 'node_modules', pkgName);
      if (existsSync(pkgDir)) return null; // installed, let esbuild handle
      // Not installed — stub it
      return { path: args.path, namespace: 'missing-stub' };
    });

    // Intercept file loads that would fail
    build.onResolve({ filter: /.*/ }, (args) => {
      if (args.namespace !== 'file' && args.namespace !== '') return null;
      if (!args.resolveDir) return null;
      // Only handle relative imports from within src/
      if (!args.path.startsWith('.')) return null;

      const base = resolve(args.resolveDir, args.path);
      // Already exists? Let esbuild handle it normally.
      const candidates = [
        base,
        base.replace(/\.js$/, '.ts'),
        base.replace(/\.js$/, '.tsx'),
        base + '.ts',
        base + '.tsx',
        base + '/index.ts',
        base + '/index.tsx',
      ];
      for (const c of candidates) {
        if (existsSync(c)) return null; // let normal resolution proceed
      }

      // File doesn't exist — provide an empty stub
      // Determine if it's a text file (md, txt) or a JS module
      const ext = args.path.split('.').pop();
      if (ext === 'md' || ext === 'txt') {
        return { path: args.path, namespace: 'missing-text-stub' };
      }
      return {
        path: args.path,
        namespace: 'missing-stub',
      };
    });
    build.onLoad({ filter: /.*/, namespace: 'missing-text-stub' }, (args) => ({
      contents: `// Missing text file: ${args.path}\nexport default '';`,
      loader: 'js',
    }));
    build.onLoad({ filter: /.*/, namespace: 'missing-stub' }, (args) => ({
      // Use a Proxy-based module that returns undefined for any named import.
      // This avoids "No matching export" errors for feature-gated modules.
      contents: [
        `// Stub: ${args.path} (feature-gated, not present in this build)`,
        `const handler = { get: () => undefined };`,
        `const stub = new Proxy({}, handler);`,
        `export default stub;`,
        // Export common names that appear in missing modules
        `export const WORKFLOW_TOOL_NAME = 'WorkflowTool';`,
        `export const isConnectorTextBlock = () => false;`,
        `export const checkManagedSettingsSecurity = async () => ({});`,
        `export const handleSecurityCheckResult = () => {};`,
        `export const TungstenTool = undefined;`,
        `export const DEFAULT_UPLOAD_CONCURRENCY = 5;`,
        `export const FILE_COUNT_LIMIT = 100;`,
        `export const OUTPUTS_SUBDIR = 'outputs';`,
        `export const isReplBridgeActive = () => false;`,
      ].join('\n'),
      loader: 'js',
    }));
  },
};

// ─── Plugin: handle .js → .ts resolution for relative imports ──────────────
const jsToTsPlugin = {
  name: 'js-to-ts-resolver',
  setup(build) {
    // For relative .js imports, try the .ts/.tsx equivalent
    build.onResolve({ filter: /^\..*\.js$/ }, (args) => {
      if (!args.resolveDir) return null;
      const jsPath = resolve(args.resolveDir, args.path);
      if (existsSync(jsPath)) return null; // .js exists, use it

      const tsPath = jsPath.replace(/\.js$/, '.ts');
      if (existsSync(tsPath)) return { path: tsPath };

      const tsxPath = jsPath.replace(/\.js$/, '.tsx');
      if (existsSync(tsxPath)) return { path: tsxPath };

      return null; // let missing-file plugin handle it
    });
  },
};

// ─── MACRO compile-time constants ──────────────────────────────────────────
const macroDefines = {
  'MACRO.VERSION':            JSON.stringify(VERSION),
  'MACRO.BUILD_TIME':         JSON.stringify(new Date().toISOString()),
  'MACRO.PACKAGE_URL':        JSON.stringify('@laiai/laiai-agent'),
  'MACRO.NATIVE_PACKAGE_URL': JSON.stringify('@laiai/laiai-agent-native'),
  'MACRO.FEEDBACK_CHANNEL':   JSON.stringify('https://www.laiai.ai/support'),
  'MACRO.ISSUES_EXPLAINER':   JSON.stringify(
    'report the issue at https://www.laiai.ai/support',
  ),
  'MACRO.VERSION_CHANGELOG':  JSON.stringify(''),
};

// ─── Packages kept external (loaded at runtime from node_modules) ──────────
// Only externalize packages that are ACTUALLY INSTALLED. Missing optional
// packages are handled by the missing-stub plugin instead.
function getExternalPackages() {
  const candidates = [
    '@anthropic-ai/sdk',
    '@anthropic-ai/bedrock-sdk', '@anthropic-ai/foundry-sdk',
    '@anthropic-ai/vertex-sdk', '@anthropic-ai/mcpb',
    '@aws-sdk/*', '@aws-crypto/*', '@smithy/*',
    '@azure/*',
    'google-auth-library',
    'sharp', '@img/*',
    'keytar',
    '*.node',
    'color-diff-napi', 'audio-capture-napi', 'modifiers-napi',
    'https-proxy-agent', 'undici', 'proper-lockfile',
    'fflate', 'turndown', 'yaml',
    // CJS packages that don't bundle cleanly into ESM
    'axios', 'ajv', 'ajv-formats',
    // Execa (pure ESM, import chain issues)
    'execa',
    // Semver
    'semver',
    '@opentelemetry/*', '@modelcontextprotocol/*', '@growthbook/*',
  ];
  // Only include patterns (with *) and packages that actually exist
  return candidates.filter(pkg => {
    if (pkg.includes('*')) return true; // glob patterns always included
    try {
      const pkgDir = join(__dirname, 'node_modules', ...pkg.split('/'));
      return existsSync(pkgDir);
    } catch { return false; }
  });
}
const externalPackages = [
  ...getExternalPackages(),
  // @ant/* packages are handled by missing-stub plugin (not installed)
];

// ─── Build ─────────────────────────────────────────────────────────────────
async function build() {
  const outdir = resolve(__dirname, 'dist');

  console.log(`\n  LaiaiAgent Build v${VERSION}`);
  console.log(`  ${'─'.repeat(40)}`);
  console.log(`  Mode:    hybrid bundle`);
  console.log(`  Output:  ${outdir}/cli.js`);
  console.log(`  Format:  ESM  |  Target: Node 18+\n`);

  const t0 = Date.now();

  const result = await esbuild.build({
    entryPoints: ['src/entrypoints/cli.tsx'],
    bundle: true,
    outfile: join(outdir, 'cli.js'),

    platform: 'node',
    target: 'node18',
    format: 'esm',

    sourcemap: true,
    minify: false,
    keepNames: true,
    treeShaking: true,

    banner: {
      js: [
        `#!/usr/bin/env node`,
        `// LaiaiAgent v${VERSION}  |  Built ${new Date().toISOString()}`,
        `import { createRequire as __cjsReq } from 'module';`,
        `const require = __cjsReq(import.meta.url);`,
      ].join('\n'),
    },

    define: macroDefines,
    plugins: [
      bunBundlePlugin,
      srcPathPlugin,
      jsToTsPlugin,
      missingFilePlugin,
    ],
    external: externalPackages,

    jsx: 'automatic',
    loader: {
      '.tsx': 'tsx',
      '.ts':  'ts',
      '.js':  'js',
      '.json': 'json',
      '.md':  'text',
      '.txt': 'text',
    },

    // Suppress non-critical warnings
    logLevel: 'warning',
    logOverride: {
      'commonjs-variable-in-esm': 'silent',
    },
  });

  const warnCount = result.warnings.length;

  // ─── Copy config/models.json ───
  mkdirSync(join(outdir, 'config'), { recursive: true });
  cpSync(
    join(__dirname, 'config', 'models.json'),
    join(outdir, 'config', 'models.json'),
  );

  // ─── Copy package.json ───
  cpSync(join(__dirname, 'package.json'), join(outdir, 'package.json'));

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
  const outSize = (readFileSync(join(outdir, 'cli.js')).length / 1024 / 1024).toFixed(1);

  console.log(`\n  Build complete in ${elapsed}s`);
  console.log(`  Bundle size: ${outSize} MB`);
  if (warnCount > 0) console.log(`  Warnings: ${warnCount} (non-critical)`);
  console.log(`  Output files:`);
  console.log(`    dist/cli.js              (main bundle)`);
  console.log(`    dist/cli.js.map          (source map)`);
  console.log(`    dist/config/models.json  (model config)`);
  console.log(`    dist/package.json\n`);
}

build().catch((err) => {
  console.error('\n  Build FAILED:\n');
  console.error(err);
  process.exit(1);
});

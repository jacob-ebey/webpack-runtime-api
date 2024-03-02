import * as path from "node:path";

import type { Compiler, Stats } from "webpack";

const PLUGIN_NAME = "WebpackAPI";

export function createWebpackAPI(compiler: Compiler) {
  const context = compiler.options.context;
  if (!context) {
    throw new Error("context must be set in webpack config");
  }

  const libraryType = compiler.options.output.library?.type;
  if (!libraryType) {
    throw new Error(
      "output.library.type (or output.libraryTarget) must be set in webpack config"
    );
  }

  if (
    typeof compiler.options.output.filename !== "string" ||
    !compiler.options.output.filename.includes("[contenthash]") ||
    typeof compiler.options.output.chunkFilename !== "string" ||
    !compiler.options.output.chunkFilename.includes("[contenthash]")
  ) {
    throw new Error(
      "output.filename and output.chunkFilename must contain [contenthash] in webpack config"
    );
  }

  compiler.options.entry = {
    __noop: {
      filename: path.resolve(__dirname, "./noop.js"),
    },
  };

  const manager = createManager(compiler);

  const modCache: Record<string, { hash: string; mod: any }> = {};

  return {
    close() {
      return manager.close();
    },
    async ssrLoadModule(filename: string) {
      manager.addEntry(path.resolve(filename));
      const stats = await manager.waitForDone();
      if (stats.hasErrors()) throw new Error(stats.toString());
      const statsJson = stats.toJson();
      if (!statsJson.hash) throw new Error("No hash found in stats");

      let relative = path.relative(context, filename).replace(/\\/g, "/");
      if (!relative.startsWith("./") && !relative.startsWith("../"))
        relative = `./${relative}`;
      let toLoad = statsJson.assetsByChunkName?.[relative]?.slice(-1)[0];

      toLoad = toLoad && path.resolve(statsJson.outputPath!, toLoad);
      if (!toLoad) throw new Error("No assets found for " + relative);

      const cached = modCache[toLoad];
      if (cached && cached.hash === statsJson.hash) return cached.mod;

      switch (libraryType) {
        case "commonjs": {
          const mod = require(toLoad);
          modCache[toLoad] = { hash: statsJson.hash, mod };

          return mod;
        }
        case "module": {
          const mod = await import(toLoad);
          modCache[toLoad] = { hash: statsJson.hash, mod };
          return mod;
        }
        default:
          throw new Error(`Unsupported library type: ${libraryType}`);
      }
    },
  };
}

interface WebpackManager {
  addEntry(filename: string): void;
  close(): Promise<void>;
  waitForDone(): Promise<Stats>;
}

function createManager(compiler: Compiler): WebpackManager {
  const context = compiler.options.context;
  if (!context) {
    throw new Error("context must be set in webpack config");
  }

  const waiting: Deferred<Stats>[] = [];
  let lastStatus: [Stats] | [undefined, Error] | null = null;

  let running = false;
  let abortController = new AbortController();
  let signal = abortController.signal;

  const watching = compiler.watch({}, (err, stats) => {
    if (err || !stats) {
      lastStatus = [undefined, err || new Error("No stats from build")];
    } else {
      lastStatus = [stats];
      console.log(
        stats.toString({
          preset: "minimal",
          colors: true,
        })
      );
    }

    for (const deferred of waiting) {
      if (lastStatus.length === 2) deferred.reject(lastStatus[1]);
      else deferred.resolve(lastStatus[0]);
    }

    if (!signal.aborted) running = false;
  });

  const runningCallback = () => {
    running = true;
  };
  compiler.hooks.watchRun.tap(PLUGIN_NAME, runningCallback);
  compiler.hooks.invalid.tap(PLUGIN_NAME, runningCallback);
  compiler.hooks.done.tap(PLUGIN_NAME, () => {
    running = false;
  });

  const entries = new Set<string>();

  return {
    addEntry(filename: string) {
      const size = entries.size;
      entries.add(filename);
      if (entries.size !== size) {
        let relative = path.relative(context, filename).replace(/\\/g, "/");
        if (!relative.startsWith("./") && !relative.startsWith("../"))
          relative = `./${relative}`;
        new compiler.webpack.EntryPlugin(context, relative, relative).apply(
          compiler
        );
        watching.invalidate();
      }
    },
    close() {
      const closing = new Deferred<void>();
      watching.close((error) => {
        if (error) closing.reject(error);
        else closing.resolve();
      });
      return closing.promise;
    },
    async waitForDone() {
      if (!running) {
        if (!lastStatus) throw new Error("No build status available");
        if (lastStatus.length === 2) throw lastStatus[1];
        return lastStatus[0];
      }
      const deferred = new Deferred<Stats>();
      waiting.push(deferred);
      return deferred.promise;
    },
  };
}

class Deferred<T> {
  promise: Promise<T>;
  resolve!: (value: T) => void;
  reject!: (err: Error) => void;

  constructor() {
    this.promise = new Promise<T>((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

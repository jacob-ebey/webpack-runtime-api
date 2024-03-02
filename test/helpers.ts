import * as fsp from "node:fs/promises";
import * as path from "node:path";

import webpack from "webpack";

export async function testHelper({
  entry,
  files,
  type,
}: {
  entry: string | string[];
  files: Record<string, string>;
  type: "commonjs" | "module";
}) {
  const randomDirName = Math.random().toString(36).slice(2);
  const rootDir = path.resolve(".test", randomDirName);
  const srcDir = path.resolve(rootDir, "src");
  const distDir = path.resolve(rootDir, "dist");

  for (const [filename, content] of Object.entries(files)) {
    const filePath = path.resolve(srcDir, filename);
    const dir = path.dirname(filePath);
    await fsp.mkdir(dir, { recursive: true });
    await fsp.writeFile(filePath, content);
  }

  const compiler = webpack({
    mode: "development",
    devtool: false,
    optimization: { minimize: false },
    entry: Array.isArray(entry)
      ? entry.map((entry) => path.resolve(srcDir, entry))
      : path.resolve(srcDir, entry),
    target: "node",
    output: {
      filename: `[name].[contenthash].${type === "commonjs" ? "cjs" : "mjs"}`,
      chunkFilename: `[name].[contenthash].${
        type === "commonjs" ? "cjs" : "mjs"
      }`,
      chunkFormat: type,
      chunkLoading: type === "commonjs" ? "require" : "import",
      library: {
        type,
      },
      path: distDir,
    },
    experiments: { outputModule: type === "module" },
    resolve: { extensions: [".ts", ".js"] },
    module: {
      rules: [
        {
          test: /\.[jt]sx?$/,
          loader: "esbuild-loader",
          options: {
            target: "es2015",
          },
        },
      ],
    },
  });

  return {
    compiler,
    sourceFile(filename: string) {
      return path.resolve(srcDir, filename);
    },
    async writeFile(filename: string, content: string, wait = true) {
      if (!wait) {
        await fsp.writeFile(path.resolve(srcDir, filename), content);
        return;
      }
      const deferred = new Deferred<void>();
      compiler.hooks.invalid.tap("TestHelper", () => deferred.resolve());
      await fsp.writeFile(path.resolve(srcDir, filename), content);
      return deferred.promise;
    },
    async cleanup() {
      await fsp.rm(rootDir, { recursive: true, force: true });
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

import * as assert from "node:assert/strict";
import { describe, test } from "node:test";

import { createWebpackAPI } from "../src/mod";
import { testHelper } from "./helpers";

describe("commonjs", () => {
  test("can import module with dynamic imports", async (t) => {
    const helper = await testHelper({
      type: "commonjs",
      entry: "server.ts",
      files: {
        "server.ts": `
            export async function sayHello(name: string) {
              const { prefix } = await import("./msg");
              return prefix + name + "!";
            }
          `,
        "msg.ts": `
            export const prefix = "Hello, ";
          `,
      },
    });
    t.after(() => helper.cleanup());

    const api = createWebpackAPI(helper.compiler);
    t.after(() => api.close());

    const mod = await api.ssrLoadModule(helper.sourceFile("server.ts"));
    assert.strictEqual(typeof mod.sayHello, "function");
    assert.strictEqual(await mod.sayHello("world"), "Hello, world!");

    const mod2 = await api.ssrLoadModule(helper.sourceFile("server.ts"));
    assert.strictEqual(mod, mod2);

    await helper.writeFile(
      "msg.ts",
      `
            export const prefix = "Hi, ";
          `
    );

    const mod3 = await api.ssrLoadModule(helper.sourceFile("server.ts"));
    assert.notStrictEqual(mod, mod3);
    assert.strictEqual(typeof mod2.sayHello, "function");
    assert.strictEqual(await mod3.sayHello("world"), "Hi, world!");
  });

  test("can import multiple standalone modules", async (t) => {
    const helper = await testHelper({
      type: "commonjs",
      entry: ["server-a.ts", "server-b.ts"],
      files: {
        "server-a.ts": `
          export function sayHelloA(name: string) {
            return "Hello, " + name + ", from server-a!";
          }
        `,
        "server-b.ts": `
          export function sayHelloB(name: string) {
            return "Hello, " + name + ", from server-b!";
          }
        `,
      },
    });
    t.after(() => helper.cleanup());

    const api = createWebpackAPI(helper.compiler);
    t.after(() => api.close());

    const [modA, modB] = await Promise.all([
      api.ssrLoadModule(helper.sourceFile("server-a.ts")),
      api.ssrLoadModule(helper.sourceFile("server-b.ts")),
    ]);
    assert.strictEqual(typeof modA.sayHelloA, "function");
    assert.strictEqual(modA.sayHelloA("world"), "Hello, world, from server-a!");

    assert.strictEqual(typeof modB.sayHelloB, "function");
    assert.strictEqual(modB.sayHelloB("world"), "Hello, world, from server-b!");

    const modA2 = await api.ssrLoadModule(helper.sourceFile("server-a.ts"));
    assert.strictEqual(modA, modA2);

    const modB2 = await api.ssrLoadModule(helper.sourceFile("server-b.ts"));
    assert.strictEqual(modB, modB2);

    await Promise.all([
      helper.writeFile(
        "server-a.ts",
        "export function sayHelloA(name: string) { return `Hi, ${name}, from server-a!`; }"
      ),
      helper.writeFile(
        "server-b.ts",
        "export function sayHelloB(name: string) { return `Hi, ${name}, from server-b!`; }"
      ),
    ]);

    const modA3 = await api.ssrLoadModule(helper.sourceFile("server-a.ts"));
    assert.notStrictEqual(modA, modA3);
    assert.strictEqual(typeof modA3.sayHelloA, "function");
    assert.strictEqual(modA3.sayHelloA("world"), "Hi, world, from server-a!");

    const modB3 = await api.ssrLoadModule(helper.sourceFile("server-b.ts"));
    assert.notStrictEqual(modB, modB3);
    assert.strictEqual(typeof modB3.sayHelloB, "function");
    assert.strictEqual(modB3.sayHelloB("world"), "Hi, world, from server-b!");
  });

  test("can add dynamic standalone server modules", async (t) => {
    const helper = await testHelper({
      type: "commonjs",
      entry: "a.ts",
      files: {
        "a.ts": `
          export const a = "a";
        `,
      },
    });
    t.after(() => helper.cleanup());

    const api = createWebpackAPI(helper.compiler);
    t.after(() => api.close());

    const modA = await api.ssrLoadModule(helper.sourceFile("a.ts"));
    assert.strictEqual(modA.a, "a");

    await helper.writeFile(
      "b.ts",
      `
        export const b = "b";
      `,
      false
    );
    const modB = await api.ssrLoadModule(helper.sourceFile("b.ts"));
    assert.strictEqual(modB.b, "b");

    const modA2 = await api.ssrLoadModule(helper.sourceFile("a.ts"));
    assert.strictEqual(modA, modA2);

    const modB2 = await api.ssrLoadModule(helper.sourceFile("b.ts"));
    assert.strictEqual(modB, modB2);

    const modB3 = await api.ssrLoadModule(helper.sourceFile("b.ts"));
    assert.strictEqual(modB, modB3);
  });
});

describe("esm", () => {
  test("can import module with dynamic imports", async (t) => {
    const helper = await testHelper({
      type: "module",
      entry: "server.ts",
      files: {
        "server.ts": `
            export async function sayHello(name: string) {
              const { prefix } = await import("./msg");
              return prefix + name + "!";
            }
          `,
        "msg.ts": `
            export const prefix = "Hello, ";
          `,
      },
    });
    t.after(() => helper.cleanup());

    const api = createWebpackAPI(helper.compiler);
    t.after(() => api.close());

    const mod = await api.ssrLoadModule(helper.sourceFile("server.ts"));
    assert.strictEqual(typeof mod.sayHello, "function");
    assert.strictEqual(await mod.sayHello("world"), "Hello, world!");

    const mod2 = await api.ssrLoadModule(helper.sourceFile("server.ts"));
    assert.strictEqual(mod, mod2);

    await helper.writeFile(
      "msg.ts",
      `
            export const prefix = "Hi, ";
          `
    );

    const mod3 = await api.ssrLoadModule(helper.sourceFile("server.ts"));
    assert.notStrictEqual(mod, mod3);
    assert.strictEqual(typeof mod2.sayHello, "function");
    assert.strictEqual(await mod3.sayHello("world"), "Hi, world!");
  });

  test("can import multiple standalone modules", async (t) => {
    const helper = await testHelper({
      type: "module",
      entry: ["server-a.ts", "server-b.ts"],
      files: {
        "server-a.ts": `
          export function sayHelloA(name: string) {
            return "Hello, " + name + ", from server-a!";
          }
        `,
        "server-b.ts": `
          export function sayHelloB(name: string) {
            return "Hello, " + name + ", from server-b!";
          }
        `,
      },
    });
    t.after(() => helper.cleanup());

    const api = createWebpackAPI(helper.compiler);
    t.after(() => api.close());

    const [modA, modB] = await Promise.all([
      api.ssrLoadModule(helper.sourceFile("server-a.ts")),
      api.ssrLoadModule(helper.sourceFile("server-b.ts")),
    ]);
    assert.strictEqual(typeof modA.sayHelloA, "function");
    assert.strictEqual(modA.sayHelloA("world"), "Hello, world, from server-a!");

    assert.strictEqual(typeof modB.sayHelloB, "function");
    assert.strictEqual(modB.sayHelloB("world"), "Hello, world, from server-b!");

    const modA2 = await api.ssrLoadModule(helper.sourceFile("server-a.ts"));
    assert.strictEqual(modA, modA2);

    const modB2 = await api.ssrLoadModule(helper.sourceFile("server-b.ts"));
    assert.strictEqual(modB, modB2);

    await Promise.all([
      helper.writeFile(
        "server-a.ts",
        "export function sayHelloA(name: string) { return `Hi, ${name}, from server-a!`; }"
      ),
      helper.writeFile(
        "server-b.ts",
        "export function sayHelloB(name: string) { return `Hi, ${name}, from server-b!`; }"
      ),
    ]);

    const modA3 = await api.ssrLoadModule(helper.sourceFile("server-a.ts"));
    assert.notStrictEqual(modA, modA3);
    assert.strictEqual(typeof modA3.sayHelloA, "function");
    assert.strictEqual(modA3.sayHelloA("world"), "Hi, world, from server-a!");

    const modB3 = await api.ssrLoadModule(helper.sourceFile("server-b.ts"));
    assert.notStrictEqual(modB, modB3);
    assert.strictEqual(typeof modB3.sayHelloB, "function");
    assert.strictEqual(modB3.sayHelloB("world"), "Hi, world, from server-b!");
  });

  test("can add dynamic standalone server modules", async (t) => {
    const helper = await testHelper({
      type: "module",
      entry: "a.ts",
      files: {
        "a.ts": `
          export const a = "a";
        `,
      },
    });
    t.after(() => helper.cleanup());

    const api = createWebpackAPI(helper.compiler);
    t.after(() => api.close());

    const modA = await api.ssrLoadModule(helper.sourceFile("a.ts"));
    assert.strictEqual(modA.a, "a");

    await helper.writeFile(
      "b.ts",
      `
        export const b = "b";
      `,
      false
    );
    const modB = await api.ssrLoadModule(helper.sourceFile("b.ts"));
    assert.strictEqual(modB.b, "b");

    const modA2 = await api.ssrLoadModule(helper.sourceFile("a.ts"));
    assert.strictEqual(modA, modA2);

    const modB2 = await api.ssrLoadModule(helper.sourceFile("b.ts"));
    assert.strictEqual(modB, modB2);

    const modB3 = await api.ssrLoadModule(helper.sourceFile("b.ts"));
    assert.strictEqual(modB, modB3);
  });
});

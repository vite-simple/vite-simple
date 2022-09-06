import { Plugin, Loader } from "esbuild";
import { BARE_IMPORT_RE } from "../constants";
import resolve from "resolve";
// 用来分析 es 模块 import/export 语句的库
import { init, parse } from "es-module-lexer";
// 一个更加好用的文件操作库
import fs from "fs-extra";
import path from "path";
// 用来开发打印 debug 日志的库
import createDebug from "debug";

const debug = createDebug("dev");

export function preBundlePlugin(deps: Set<string>): Plugin {
  return {
    name: "esbuild:pre-bundle",
    setup(build) {
      build.onResolve(
        {
          filter: BARE_IMPORT_RE,
        },
        (resolveInfo) => {
          const { path: id, importer } = resolveInfo;
          const isEntry = !importer;
          if (deps.has(id)) {
            return isEntry
              ? {
                  path: id,
                  namespace: "dep",
                }
              : {
                  // 因为走到 onResolve 了，所以这里的 path 就是绝对路径了
                  path: resolve.sync(id, { basedir: process.cwd() }),
                };
          }
        }
      );

      // 拿到标记后的依赖，构造代理模块，交给 esbuild 打包
      build.onLoad(
        {
          filter: /.*/,
          namespace: "dep",
        },
        async (loadInfo) => {
          await init;
          const id = loadInfo.path;
          const root = process.cwd();
          const entryPath = resolve.sync(id, { basedir: root });
          const code = await fs.readFile(entryPath, "utf-8");
          const [importer, exports] = await parse(code);
          let proxyModule = [];
          // cjs
          if (!importer.length && !exports.length) {
            const res = require(entryPath);
            const specifiers = Object.keys(res);
            proxyModule.push(
              `export {${specifiers.join(",")}} from "${entryPath}"`,
              `export default require("${entryPath}")`
            );
          } else {
            // esm 格式比较好处理，export * 或者 export default 即可
            if (exports.includes("default")) {
              proxyModule.push(`import d from "${entryPath}";export default d`);
            }
            proxyModule.push(`export * from "${entryPath}"`);
          }
          debug("代理模块内容: %o", proxyModule.join("\n"));
          const loader = path.extname(entryPath).slice(1);
          return {
            loader: loader as Loader,
            contents: proxyModule.join("\n"),
            resolveDir: root,
          };
        }
      );
    },
  };
}

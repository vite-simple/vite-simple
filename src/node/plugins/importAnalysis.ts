import { init, parse } from "es-module-lexer";
import {
  BARE_IMPORT_RE,
  CLIENT_PUBLIC_PATH,
  PRE_BUNDLE_DIR,
} from "../constants";
import {
  cleanUrl,
  getShortName,
  isInternalRequest,
  isJSRequest,
} from "../utils";
import MagicString from "magic-string";
import path from "path";
import { Plugin } from "../plugin";
import { ServerContext } from "../server/index";

export function importAnalysisPlugin(): Plugin {
  let serverContext: ServerContext;
  return {
    name: "mo-vite:import-analysis",
    configureServer(s) {
      serverContext = s;
    },
    async transform(code: string, id: string) {
      if (!isJSRequest(id) || isInternalRequest(id)) {
        return null;
      }
      await init;
      const importedModules = new Set<string>();
      const [imports] = parse(code);
      const ms = new MagicString(code);
      const resolve = async (id: string, importer?: string) => {
        const resolved = await serverContext.pluginContainer.resolveId(
          id,
          importer
        );
        if (!resolved) {
          return;
        }
        const cleanedId = cleanUrl(resolved.id);
        // 获取绑定关系
        const mod = moduleGraph.getModuleById(cleanedId);
        let resolvedId = `/${getShortName(resolved.id, serverContext.root)}`;
        if (mod && mod.lastHMRTimestamp > 0) {
          // resolvedId += "?t=" + mod.lastHMRTimestamp;
        }
        return resolvedId;
      };
      const { moduleGraph } = serverContext;
      const curMod = moduleGraph.getModuleById(id)!;

      // 对每一个 import 语句依次进行分析
      for (const importInfo of imports) {
        // 举例说明: const str = `import React from 'react'`
        // str.slice(s, e) => 'react'
        const { s: modStart, e: modEnd, n: modSource } = importInfo;
        if (!modSource) continue;
        // 静态资源
        if (modSource.endsWith(".svg")) {
          // 加上 ?import 后缀
          const resolvedUrl = path.join(path.dirname(id), modSource);
          ms.overwrite(modStart, modEnd, `${resolvedUrl}?import`);
          continue;
        }
        // 第三方库: 路径重写到预构建产物的路径
        if (BARE_IMPORT_RE.test(modSource)) {
          const bundlePath = path.join(
            serverContext.root,
            PRE_BUNDLE_DIR,
            `${modSource}.js`
          );
          // 添加预构建的路径
          importedModules.add(bundlePath);
          ms.overwrite(modStart, modEnd, bundlePath);
        } else if (modSource.startsWith(".") || modSource.startsWith("/")) {
          // 直接调用的 resolve 方法，会自动经过路径解析插件的处理
          const resolved = await resolve(modSource, id);
          if (resolved) {
            ms.overwrite(modStart, modEnd, resolved);
            // 添加预构建的路径
            importedModules.add(resolved);
          }
        }
      }

      if (!id.includes("node_modules")) {
        ms.prepend(
          `import {createHotContext as __vite__createHotContext } from "${CLIENT_PUBLIC_PATH}"; ` +
            `import.meta.hot = __vite__createHotContext(${JSON.stringify(
              cleanUrl(curMod.url)
            )});`
        );
      }

      moduleGraph.updateModuleInfo(curMod, importedModules);

      return {
        code: ms.toString(),
        // 生成 SourceMap
        map: ms.generateMap(),
      };
    },
  };
}

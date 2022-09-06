import resolve from "resolve";
import path from "path";
import { ServerContext } from "../server";
import { Plugin } from "../plugin";
import { pathExists } from "fs-extra";
import { DEFAULT_EXTERSIONS } from "../constants";

export function resolvePlugin(): Plugin {
  let serverContext: ServerContext;
  return {
    name: "mo-vite:resolve",
    configureServer(s) {
      serverContext = s;
    },
    async resolveId(id: string, importer?: string) {
      // 1.
      if (path.isAbsolute(id)) {
        if (await pathExists(id)) {
          return { id };
        }

        id = path.join(serverContext.root, id);
        if (await pathExists(id)) {
          return { id };
        }
      } else if (id.startsWith(".")) {
        if (!importer) {
          throw new Error("`importer` should not be undefined");
        }

        const hasExtension = path.extname(id).length > 1;
        let resolvedId: string;
        // 2.1 包含文件名后缀
        // 如 ./App.tsx
        if (hasExtension) {
          resolvedId = resolve.sync(id, { basedir: path.dirname(importer) });
          if (await pathExists(resolvedId)) {
            return { id: resolvedId };
          }
          // 2.2 不包含文件名后缀
          // 如 ./App
        } else {
          // ./App -> ./App.tsx
          for (const extname of DEFAULT_EXTERSIONS) {
            try {
              const withExtension = `${id}${extname}`;
              resolvedId = resolve.sync(withExtension, {
                basedir: path.dirname(importer),
              });
              if (await pathExists(resolvedId)) {
                return { id: resolvedId };
              }
            } catch (e) {
              continue;
            }
          }
        }
      }
      return null
    },
  };
}

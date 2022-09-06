import { NextHandleFunction } from "connect";
import {
  isJSRequest,
  isCSSRequest,
  isImportRequest,
  cleanUrl,
} from "../../utils";
import { ServerContext } from "../index";
import createDebug from "debug";

const debug = createDebug("dev");

export async function transformRequest(
  url: string,
  serverContext: ServerContext
) {
  const { moduleGraph, pluginContainer } = serverContext;
  url = cleanUrl(url);
  let mod = await moduleGraph.getModuleByUrl(url);

  const resolvedResult = await pluginContainer.resolveId(url);
  let transformResult;
  if (resolvedResult?.id) {
    let code = await pluginContainer.load(resolvedResult.id);
    if (typeof code === "object" && code !== null) {
      code = code.code;
    }
    mod = await moduleGraph.ensureEntryFromUrl(url);
    if (code) {
      transformResult = await pluginContainer.transform(
        code as string,
        resolvedResult?.id
      );
    }
  }

  if (mod) {
    mod.transformResult = transformResult;
  }
  return transformResult;
}

export function transformMiddleware(
  serverContext: ServerContext
): NextHandleFunction {
  return async (req, res, next) => {
    // 资源文件为GET请求
    if (req.method !== "GET" || !req.url) {
      return next();
    }
    const url = req.url;
    debug("transformMiddleware: %s", url);
    // transform JS and CSS request
    if (
      isJSRequest(url) ||
      isCSSRequest(url) ||
      // 静态资源的 import 请求，如 import logo from './logo.svg';
      isImportRequest(url)
    ) {
      let result = await transformRequest(url, serverContext);
      if (!result) {
        return next();
      }
      if (result && typeof result !== "string") {
        result = result.code;
      }
      // 编译完成，返回响应给浏览器
      res.statusCode = 200;
      res.setHeader("Content-Type", "application/javascript");
      return res.end(result);
    }

    next();
  };
}

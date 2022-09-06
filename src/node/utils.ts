import path from "path";
import { CLIENT_PUBLIC_PATH, HASH_RE, JS_TYPES_RE, QEURY_RE } from "./constants";

export const isJSRequest = (id: string): boolean => {
  id = cleanUrl(id);
  if (JS_TYPES_RE.test(id)) {
    return true;
  }

  if (!path.extname(id) && !id.endsWith("/")) {
    return true;
  }

  return false;
};

export const isCSSRequest = (id: string): boolean =>
  cleanUrl(id).endsWith(".css");

export function isImportRequest(url: string): boolean {
  return url.endsWith("?import");
}

export const cleanUrl = (url: string): string =>
  url.replace(HASH_RE, "").replace(QEURY_RE, "");

export function removeImportQuery(url: string): string {
  return url.replace(/\?import$/, "");
}

export function isPlainObject(obj: any): boolean {
  return Object.prototype.toString.call(obj) === "[object Object]";
}

export function getShortName(file: string, root: string) {
  return file.startsWith(root + "/") ? path.posix.relative(root, file) : file;
}

const INTERNAL_LIST = [CLIENT_PUBLIC_PATH, "/@react-refresh"];
export function isInternalRequest(url: string): boolean {
    return INTERNAL_LIST.includes(url);
  }
import { fileURLToPath } from "url";
import { dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 親ディレクトリの無関係な lockfile を誤検出しないよう、本プロジェクトを root に固定
  outputFileTracingRoot: __dirname,
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  // The tool lives at a keyword-rich URL; the bare domain forwards there.
  redirects() {
    return [{ source: "/", destination: "/amazon-image-requirements-checker", permanent: true }];
  },
};

export default nextConfig;

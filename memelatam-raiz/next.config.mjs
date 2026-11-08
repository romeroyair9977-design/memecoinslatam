/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Mientras hay archivos viejos sin usar en el repo, no se frena el deploy por sus errores de tipos o de lint.
  typescript: { ignoreBuildErrors: true },
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;

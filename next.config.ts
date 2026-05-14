import type { NextConfig } from "next";
import dns from "node:dns";

// Force Node.js to use IPv4 first. This prevents "fetch failed" errors 
// on Windows machines with spotty IPv6 local configurations.
dns.setDefaultResultOrder("ipv4first");

const nextConfig: NextConfig = {
};

export default nextConfig;

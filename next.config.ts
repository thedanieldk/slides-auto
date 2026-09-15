import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Project saves go through a server action carrying the whole
      // project (every slide's text and images) as one payload. Uploads
      // are now downscaled client-side before that happens, but this
      // gives some headroom above the 1mb default for slideshows with
      // several images.
      bodySizeLimit: "4mb",
    },
  },
}

export default nextConfig

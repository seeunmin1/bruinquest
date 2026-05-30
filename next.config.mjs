/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingIncludes: {
    "/api/itinerary": ["./data/processed/unified_places.json"],
  },
};

export default nextConfig;

import type { MetadataRoute } from "next";
import { env } from "@/lib/env";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: env.NEXT_PUBLIC_APP_URL, changeFrequency: "weekly", priority: 1 },
    { url: `${env.NEXT_PUBLIC_APP_URL}/pricing`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${env.NEXT_PUBLIC_APP_URL}/login`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${env.NEXT_PUBLIC_APP_URL}/signup`, changeFrequency: "monthly", priority: 0.4 },
  ];
}

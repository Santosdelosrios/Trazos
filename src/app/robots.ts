import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard/", "/perfil/", "/agenda/", "/alumnos/"],
    },
    sitemap: "https://trazosdemaestra.com.ar/sitemap.xml",
  };
}

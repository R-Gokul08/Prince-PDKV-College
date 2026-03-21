import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://prince-pdkv.vercel.app/',
      lastModified: new Date(),
      changeFrequency: 'yearly',
      priority: 1,
    },
    // Add more pages like /about
    {
  url: 'https://prince-pdkv.vercel.app/about',
  lastModified: new Date(),
  changeFrequency: 'monthly',
  priority: 0.8,
},

  ]
}

import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'SpecScribe',
        short_name: 'SpecScribe',
        description: 'AI-powered clinical documentation and compliance automation',
        start_url: '/',
        display: 'standalone',
        background_color: '#0b0d17',
        theme_color: '#3b82f6',
        icons: [
            {
                src: '/api/icon?size=192',
                sizes: '192x192',
                type: 'image/png',
            },
            {
                src: '/api/icon?size=512',
                sizes: '512x512',
                type: 'image/png',
            },
        ],
    }
}

import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
    width: 180,
    height: 180,
}
export const contentType = 'image/png'

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    background: '#0b0d17',
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: '18%', // Standard Apple icon radius
                }}
            >
                <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ width: '70%', height: '70%' }}>
                    <g transform="translate(17.5, 10)">
                        <path d="M 50 10 L 20 10 L 10 40 L 40 40 L 30 70 L 0 70" stroke="#60a5fa" strokeWidth="10" strokeLinejoin="miter" strokeLinecap="square" />
                        <path d="M 65 10 L 35 10 L 25 40 L 55 40 L 45 70 L 15 70" stroke="#60a5fa" strokeWidth="10" strokeLinejoin="miter" strokeLinecap="square" />
                    </g>
                </svg>
            </div>
        ),
        {
            ...size,
        }
    )
}

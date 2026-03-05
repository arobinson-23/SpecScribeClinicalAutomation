/**
 * Dynamic PWA icon endpoint.
 * Returns an ImageResponse PNG at the requested size (default 192).
 * Used by manifest.ts for the web app icon entries.
 */
import { ImageResponse } from "next/og";
import { type NextRequest } from "next/server";

export const runtime = "edge";

export function GET(request: NextRequest) {
  const size = Math.min(
    512,
    Math.max(16, parseInt(request.nextUrl.searchParams.get("size") ?? "192", 10))
  );

  return new ImageResponse(
    (
      <div
        style={{
          background: "#0b0d17",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: "20%",
        }}
      >
        {/* SpecScribe logo mark — two overlapping S-shaped paths */}
        <svg
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          style={{ width: "80%", height: "80%" }}
        >
          <g transform="translate(17.5, 10)">
            <path
              d="M 50 10 L 20 10 L 10 40 L 40 40 L 30 70 L 0 70"
              stroke="#60a5fa"
              strokeWidth="10"
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
            <path
              d="M 65 10 L 35 10 L 25 40 L 55 40 L 45 70 L 15 70"
              stroke="#60a5fa"
              strokeWidth="10"
              strokeLinejoin="miter"
              strokeLinecap="square"
            />
          </g>
        </svg>
      </div>
    ),
    { width: size, height: size }
  );
}

import { ImageResponse } from "next/og";

const ALLOWED_SIZES = new Set([
  "640x1136",
  "750x1334",
  "828x1792",
  "1125x2436",
  "1170x2532",
  "1179x2556",
  "1242x2208",
  "1242x2688",
  "1284x2778",
  "1290x2796",
]);

export const runtime = "edge";

export async function GET(
  _request: Request,
  context: { params: Promise<{ width: string; height: string }> },
) {
  const { width: rawWidth, height: rawHeight } = await context.params;
  const key = `${rawWidth}x${rawHeight}`;
  const [width, height] = ALLOWED_SIZES.has(key)
    ? [Number(rawWidth), Number(rawHeight)]
    : [1290, 2796];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          background: "#000000",
        }}
      />
    ),
    {
      width,
      height,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}

import { ImageResponse } from "next/og";

const ALLOWED_SIZES = new Set([180, 192, 512, 1024]);

export const runtime = "edge";

export async function GET(
  request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await context.params;
  const requestedSize = Number(rawSize);
  const size = ALLOWED_SIZES.has(requestedSize) ? requestedSize : 512;
  const logoUrl = new URL("/branding/bos-operating-system-logo.png", request.url).toString();

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#000000",
          padding: "4%",
        }}
      >
        <img
          src={logoUrl}
          alt=""
          width={size}
          height={size}
          style={{
            width: "96%",
            height: "96%",
            objectFit: "contain",
          }}
        />
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}

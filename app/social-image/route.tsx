import { ImageResponse } from "next/og";

export function GET() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "stretch",
        background:
          "linear-gradient(135deg, #071019 0%, #10253b 40%, #1b4965 100%)",
        color: "#f7fbff",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        justifyContent: "space-between",
        padding: "56px",
        width: "100%",
      }}
    >
      <div
        style={{
          alignItems: "center",
          display: "flex",
          gap: "18px",
        }}
      >
        <div
          style={{
            background: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "24px",
            display: "flex",
            fontSize: 28,
            padding: "12px 20px",
          }}
        >
          Shadcn Registry
        </div>
        <div
          style={{
            background: "rgba(255, 255, 255, 0.12)",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "24px",
            display: "flex",
            fontSize: 28,
            padding: "12px 20px",
          }}
        >
          Open Source
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          maxWidth: "940px",
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 80,
            fontWeight: 700,
            letterSpacing: "-0.04em",
            lineHeight: 1,
          }}
        >
          React data table for Shadcn UI and TanStack Table
        </div>
        <div
          style={{
            color: "rgba(247, 251, 255, 0.82)",
            display: "flex",
            fontSize: 34,
            lineHeight: 1.35,
          }}
        >
          URL state, server-side workflows, bulk actions, i18n, and full code
          ownership.
        </div>
      </div>

      <div
        style={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              color: "#9bd7ff",
              display: "flex",
              fontSize: 26,
              textTransform: "uppercase",
            }}
          >
            YaYaw Table
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 24,
            }}
          >
            table.yayaw.app
          </div>
        </div>

        <div
          style={{
            alignItems: "center",
            border: "1px solid rgba(255, 255, 255, 0.18)",
            borderRadius: "28px",
            display: "flex",
            fontSize: 28,
            gap: "16px",
            padding: "14px 24px",
          }}
        >
          React
          <span style={{ color: "rgba(247, 251, 255, 0.4)" }}>|</span>
          Next.js
          <span style={{ color: "rgba(247, 251, 255, 0.4)" }}>|</span>
          TypeScript
        </div>
      </div>
    </div>,
    {
      height: 630,
      width: 1200,
    }
  );
}

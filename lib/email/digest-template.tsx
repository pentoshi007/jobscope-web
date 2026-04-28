import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

export interface DigestJob {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  score: number;
  url: string;
  source: string;
  matched: string[];
  missing: string[];
  postedAt: string;
  salary: string;
}

const PALETTE = {
  bg: "#f7f7f8",
  card: "#ffffff",
  border: "#ececef",
  text: "#15151a",
  muted: "#5f5f6a",
  subtle: "#9999a3",
  accent: "#4f46e5",
  accentSoft: "#eef2ff",
  success: "#0a8755",
  successSoft: "#dcfce7",
  scoreHigh: "#0a8755",
  scoreMid: "#4f46e5",
  scoreLow: "#a16207",
};

function scoreColor(s: number) {
  if (s >= 75) return PALETTE.scoreHigh;
  if (s >= 55) return PALETTE.scoreMid;
  return PALETTE.scoreLow;
}

export function DigestEmail({
  name,
  jobs,
  appUrl,
}: {
  name: string;
  jobs: DigestJob[];
  appUrl: string;
}) {
  const top = jobs[0];
  return (
    <Html>
      <Head />
      <Preview>{`${jobs.length} new matches${top ? ` · top ${top.score} ${top.title} at ${top.company}` : ""}`}</Preview>
      <Body
        style={{
          background: PALETTE.bg,
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
          color: PALETTE.text,
          margin: 0,
          padding: 0,
        }}
      >
        <Container style={{ maxWidth: 580, margin: "0 auto", padding: "32px 16px" }}>
          {/* Brand row */}
          <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
            <tbody>
              <tr>
                <td>
                  <Text
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.12em",
                      color: PALETTE.subtle,
                      textTransform: "uppercase",
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    JobScope
                  </Text>
                </td>
                <td align="right">
                  <Text
                    style={{
                      fontSize: 11,
                      color: PALETTE.subtle,
                      margin: 0,
                    }}
                  >
                    Daily digest
                  </Text>
                </td>
              </tr>
            </tbody>
          </table>

          <Heading
            style={{
              fontSize: 24,
              margin: "16px 0 6px",
              fontWeight: 700,
              letterSpacing: "-0.02em",
            }}
          >
            {jobs.length} fresh match{jobs.length === 1 ? "" : "es"}, {name || "there"}
          </Heading>
          <Text style={{ color: PALETTE.muted, fontSize: 14, margin: "0 0 4px" }}>
            Ranked against your active resume.{" "}
            {top ? (
              <>
                Top score{" "}
                <span style={{ fontWeight: 700, color: scoreColor(top.score) }}>{top.score}</span>.
              </>
            ) : null}
          </Text>

          <Hr style={{ borderColor: PALETTE.border, margin: "20px 0" }} />

          {jobs.map((j, idx) => (
            <Section
              key={j.id}
              style={{
                background: PALETTE.card,
                border: `1px solid ${PALETTE.border}`,
                borderRadius: 14,
                padding: 18,
                marginBottom: 12,
              }}
            >
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td valign="top">
                      <Text
                        style={{
                          margin: "0 0 2px",
                          fontSize: 11,
                          color: PALETTE.subtle,
                          fontWeight: 600,
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                        }}
                      >
                        #{idx + 1} · {j.source}
                      </Text>
                      <Link
                        href={`${appUrl}/jobs/${j.id}`}
                        style={{
                          color: PALETTE.text,
                          fontWeight: 700,
                          fontSize: 16,
                          textDecoration: "none",
                          letterSpacing: "-0.01em",
                          lineHeight: 1.3,
                        }}
                      >
                        {j.title}
                      </Link>
                      <Text style={{ margin: "4px 0 0", color: PALETTE.muted, fontSize: 13 }}>
                        {j.company}
                        {j.location ? ` · ${j.location}` : ""}
                        {j.remote ? " · Remote" : ""}
                      </Text>
                      {j.salary ? (
                        <Text
                          style={{
                            margin: "4px 0 0",
                            color: PALETTE.text,
                            fontSize: 13,
                            fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                            fontWeight: 600,
                          }}
                        >
                          {j.salary}
                        </Text>
                      ) : null}
                    </td>
                    <td align="right" valign="top" width="68">
                      <div
                        style={{
                          background: PALETTE.accentSoft,
                          color: scoreColor(j.score),
                          borderRadius: 999,
                          padding: "6px 12px",
                          fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                          fontSize: 18,
                          fontWeight: 800,
                          lineHeight: 1,
                          display: "inline-block",
                        }}
                      >
                        {j.score}
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>

              {j.matched.length > 0 ? (
                <Text
                  style={{
                    margin: "12px 0 0",
                    fontSize: 12,
                    color: PALETTE.muted,
                  }}
                >
                  <span style={{ color: PALETTE.success, fontWeight: 600 }}>Match:</span>{" "}
                  <span
                    style={{
                      fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  >
                    {j.matched.slice(0, 6).join(" · ")}
                  </span>
                </Text>
              ) : null}
              {j.missing.length > 0 ? (
                <Text
                  style={{
                    margin: "4px 0 0",
                    fontSize: 12,
                    color: PALETTE.subtle,
                  }}
                >
                  <span style={{ fontWeight: 600 }}>Gap:</span>{" "}
                  <span
                    style={{
                      fontFamily: "'SF Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
                    }}
                  >
                    {j.missing.slice(0, 4).join(" · ")}
                  </span>
                </Text>
              ) : null}

              <table
                role="presentation"
                width="100%"
                cellPadding={0}
                cellSpacing={0}
                style={{ marginTop: 14 }}
              >
                <tbody>
                  <tr>
                    <td>
                      <Link
                        href={j.url}
                        style={{
                          background: PALETTE.text,
                          color: "#fff",
                          fontSize: 13,
                          fontWeight: 600,
                          padding: "8px 14px",
                          borderRadius: 8,
                          textDecoration: "none",
                          display: "inline-block",
                        }}
                      >
                        Apply on {j.source}
                      </Link>
                    </td>
                    <td align="right">
                      <Link
                        href={`${appUrl}/jobs/${j.id}`}
                        style={{
                          color: PALETTE.accent,
                          fontSize: 13,
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        View match →
                      </Link>
                    </td>
                  </tr>
                </tbody>
              </table>
            </Section>
          ))}

          <Hr style={{ borderColor: PALETTE.border, margin: "24px 0 16px" }} />

          <Text
            style={{
              fontSize: 12,
              color: PALETTE.subtle,
              textAlign: "center" as const,
              margin: 0,
            }}
          >
            <Link href={`${appUrl}/jobs`} style={{ color: PALETTE.accent }}>
              Open jobs
            </Link>{" "}
            ·{" "}
            <Link href={`${appUrl}/settings/preferences`} style={{ color: PALETTE.subtle }}>
              Manage alerts
            </Link>
          </Text>
          <Text
            style={{
              fontSize: 11,
              color: PALETTE.subtle,
              textAlign: "center" as const,
              margin: "8px 0 0",
            }}
          >
            JobScope · always free.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

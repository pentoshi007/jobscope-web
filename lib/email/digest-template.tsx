import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from "@react-email/components";

export interface DigestJob {
  id: string;
  title: string;
  company: string;
  location: string;
  remote: boolean;
  score: number;
  url: string;
  matched: string[];
}

export function DigestEmail({ name, jobs, appUrl }: { name: string; jobs: DigestJob[]; appUrl: string }) {
  return (
    <Html>
      <Head />
      <Preview>{`${jobs.length} fresh matches for you on JobScope`}</Preview>
      <Body style={{ background: "#fafafa", fontFamily: "-apple-system, system-ui, sans-serif", color: "#171717" }}>
        <Container style={{ maxWidth: 540, margin: "0 auto", padding: "32px 16px" }}>
          <Text style={{ fontSize: 12, letterSpacing: "0.05em", color: "#7c7c7c", textTransform: "uppercase", fontWeight: 600 }}>
            JobScope · Daily digest
          </Text>
          <Heading style={{ fontSize: 22, margin: "8px 0 4px", fontWeight: 600 }}>
            {jobs.length} fresh matches, {name}
          </Heading>
          <Text style={{ color: "#525252", fontSize: 14, marginTop: 0 }}>
            Ranked against your active resume.
          </Text>
          <Hr style={{ borderColor: "#ebebeb", margin: "20px 0" }} />
          {jobs.map((j) => (
            <Section
              key={j.id}
              style={{
                background: "#ffffff",
                border: "1px solid #ebebeb",
                borderRadius: 12,
                padding: 16,
                marginBottom: 10,
              }}
            >
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                <tr>
                  <td>
                    <Link href={`${appUrl}/jobs/${j.id}`} style={{ color: "#171717", fontWeight: 600, fontSize: 15, textDecoration: "none" }}>
                      {j.title}
                    </Link>
                    <Text style={{ margin: "2px 0 0", color: "#7c7c7c", fontSize: 13 }}>
                      {j.company} · {j.location}
                      {j.remote ? " · Remote" : ""}
                    </Text>
                    <Text style={{ margin: "8px 0 0", fontSize: 12, color: "#7c7c7c", fontFamily: "monospace" }}>
                      {j.matched.slice(0, 4).join(" · ")}
                    </Text>
                  </td>
                  <td align="right" valign="top" width="60">
                    <Text style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#4f46e5", fontFamily: "monospace" }}>
                      {j.score}
                    </Text>
                  </td>
                </tr>
                </tbody>
              </table>
            </Section>
          ))}
          <Hr style={{ borderColor: "#ebebeb", margin: "20px 0" }} />
          <Text style={{ fontSize: 12, color: "#a1a1a1", textAlign: "center" as const }}>
            <Link href={`${appUrl}/dashboard`} style={{ color: "#4f46e5" }}>
              Open dashboard
            </Link>{" "}
            ·{" "}
            <Link href={`${appUrl}/settings/preferences`} style={{ color: "#a1a1a1" }}>
              Unsubscribe
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

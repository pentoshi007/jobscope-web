export const SKILLS_DICTIONARY: string[] = [
  "javascript", "typescript", "python", "go", "golang", "rust", "java", "kotlin", "swift",
  "c++", "c#", "ruby", "php", "scala", "elixir", "clojure", "haskell", "r", "dart",
  "react", "next.js", "vue", "nuxt", "angular", "svelte", "solid", "remix", "astro",
  "node.js", "nodejs", "express", "fastify", "nestjs", "deno", "bun",
  "django", "flask", "fastapi", "rails", "spring", "spring boot", ".net", "asp.net", "laravel",
  "tailwind", "tailwindcss", "css", "sass", "less", "html", "shadcn", "radix",
  "graphql", "rest", "grpc", "websocket", "trpc",
  "postgresql", "postgres", "mysql", "mariadb", "sqlite", "mongodb", "redis", "dynamodb",
  "cassandra", "elasticsearch", "opensearch", "snowflake", "bigquery", "clickhouse", "neo4j",
  "supabase", "firebase", "firestore", "planetscale", "neon",
  "aws", "amazon web services", "ec2", "s3", "lambda", "ecs", "eks", "rds", "cloudfront",
  "route53", "iam", "sqs", "sns", "kinesis",
  "gcp", "google cloud", "cloud run", "gke", "bigtable", "firebase functions",
  "azure", "aks", "azure functions",
  "docker", "kubernetes", "k8s", "helm", "terraform", "pulumi", "ansible", "packer",
  "github actions", "circleci", "jenkins", "gitlab ci", "argo", "spinnaker",
  "git", "github", "gitlab", "bitbucket", "linear", "jira", "notion", "figma",
  "vscode", "vim", "neovim", "intellij", "xcode", "android studio",
  "linux", "bash", "zsh", "fish",
  "kafka", "rabbitmq", "nats", "celery", "sidekiq", "bullmq",
  "prometheus", "grafana", "datadog", "sentry", "newrelic", "honeycomb", "opentelemetry",
  "jest", "vitest", "playwright", "cypress", "mocha", "rspec", "pytest", "junit",
  "ci/cd", "tdd", "bdd", "ddd", "microservices", "monorepo", "turborepo", "nx",
  "machine learning", "ml", "deep learning", "pytorch", "tensorflow", "scikit-learn",
  "pandas", "numpy", "spark", "airflow", "dbt", "duckdb", "polars", "ray",
  "llm", "openai", "anthropic", "langchain", "llamaindex", "rag", "vector database",
  "pinecone", "weaviate", "qdrant",
  "swiftui", "uikit", "jetpack compose", "react native", "flutter", "expo",
  "stripe", "twilio", "sendgrid", "mailchimp", "resend", "auth0", "clerk", "better-auth",
  "auth.js", "nextauth",
  "agile", "scrum", "kanban", "leadership", "mentoring", "communication", "collaboration",
  "product thinking", "user research",
];

const LOWER_SET = new Set(SKILLS_DICTIONARY.map((s) => s.toLowerCase()));

export function extractSkillsFromText(text: string): string[] {
  if (!text) return [];
  const t = text.toLowerCase();
  const found = new Set<string>();
  for (const s of SKILLS_DICTIONARY) {
    const re = new RegExp(`(?:^|[^a-z0-9+#.])${s.replace(/[.+#]/g, "\\$&")}(?=[^a-z0-9+#.]|$)`, "i");
    if (re.test(t)) found.add(s);
  }
  return [...found];
}

export function isKnownSkill(s: string): boolean {
  return LOWER_SET.has(s.toLowerCase());
}

import { remotiveAdapter } from "./remotive";
import { arbeitnowAdapter } from "./arbeitnow";
import { museAdapter } from "./themuse";
import { usajobsAdapter } from "./usajobs";
import { adzunaAdapter } from "./adzuna";
import { joobleAdapter } from "./jooble";
import { jsearchAdapter } from "./jsearch";
import type { JobAdapter } from "../types";

export const ADAPTERS: JobAdapter[] = [
  remotiveAdapter,
  arbeitnowAdapter,
  museAdapter,
  usajobsAdapter,
  adzunaAdapter,
  joobleAdapter,
  jsearchAdapter,
];

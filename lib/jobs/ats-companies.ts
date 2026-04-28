export type AtsKind = "greenhouse" | "lever" | "ashby" | "workable";

export interface AtsCompany {
  company: string;
  ats: AtsKind;
  token: string;
  priority: number;
}

// Keep this list curated and static. Never fetch arbitrary ATS URLs from users.
export const ATS_COMPANIES: AtsCompany[] = [
  { company: "Razorpay", ats: "greenhouse", token: "razorpay", priority: 10 },
  { company: "Meesho", ats: "greenhouse", token: "meesho", priority: 9 },
  { company: "Postman", ats: "lever", token: "postman", priority: 9 },
  { company: "BrowserStack", ats: "lever", token: "browserstack", priority: 9 },
  { company: "Atlan", ats: "lever", token: "atlan", priority: 8 },
  { company: "Zeta", ats: "lever", token: "zeta", priority: 8 },
  { company: "Rippling", ats: "ashby", token: "Rippling", priority: 8 },
];

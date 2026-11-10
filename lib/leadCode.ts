// Single source of truth for how a lead is shown to staff and patients.
// Uses the human-friendly lead_code (e.g. WJ-26-0001). Falls back to the
// old 8-char id only if lead_code is missing (e.g. before migration runs).
export const getLeadCode = (lead: {
  leadCode?: string | null;
  lead_code?: string | null;
  id?: string | null;
}): string => {
  const code = lead.leadCode || lead.lead_code;
  if (code) return code;
  return (lead.id || "").slice(0, 8).toUpperCase() || "PENDING";
};
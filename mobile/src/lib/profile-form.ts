/** The details a member may edit about themselves; names, status, and campus stay with the church office. */
export interface EditableProfile {
  email: string | null;
  phone: string | null;
  address: string | null;
  occupation: string | null;
  gender: string;
  civilStatus: string | null;
  birthDate: string | null;
}

export interface ProfileForm {
  email: string;
  phone: string;
  address: string;
  occupation: string;
  gender: string;
  civilStatus: string | null;
  /** YYYY-MM-DD, or blank for none. */
  birthDate: string;
}

const TEXT_FIELDS = ["email", "phone", "address", "occupation"] as const;

/** Date-only values come back as midnight UTC; the first ten characters are the calendar date. */
const dateOnly = (iso: string | null) => (iso ? iso.slice(0, 10) : "");

export function toForm(profile: EditableProfile): ProfileForm {
  return {
    email: profile.email ?? "",
    phone: profile.phone ?? "",
    address: profile.address ?? "",
    occupation: profile.occupation ?? "",
    gender: profile.gender,
    civilStatus: profile.civilStatus,
    birthDate: dateOnly(profile.birthDate),
  };
}

/** The update to send: changed fields only, trimmed, with cleared values as null. */
export function changedFields(
  form: ProfileForm,
  profile: EditableProfile,
): Record<string, string | null> {
  const patch: Record<string, string | null> = {};
  for (const key of TEXT_FIELDS) {
    const next = form[key].trim() || null;
    if (next !== (profile[key] ?? null)) patch[key] = next;
  }
  if (form.gender !== profile.gender) patch.gender = form.gender;
  if (form.civilStatus !== profile.civilStatus)
    patch.civilStatus = form.civilStatus;
  const birth = form.birthDate.trim();
  if (birth !== dateOnly(profile.birthDate)) patch.birthDate = birth || null;
  return patch;
}

/** A message when the birthday is not a real, past date in YYYY-MM-DD form; null when it is fine or blank. */
export function birthDateError(
  value: string,
  today = new Date(),
): string | null {
  const text = value.trim();
  if (!text) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
  if (!match) return "Use the format YYYY-MM-DD, for example 1990-04-12.";
  const [, y, m, d] = match.map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return "This date does not exist.";
  if (date.getTime() > today.getTime())
    return "A birthday cannot be in the future.";
  return null;
}

// Display names for the fixed value lists in shared/constants.json (one place for app wording)
export const THEMES = [
  ['ai_ml', 'AI/ML'], ['cybersecurity', 'Cybersecurity'], ['web', 'Web'], ['mobile', 'Mobile'],
  ['data_science', 'Data science'], ['blockchain', 'Blockchain'], ['iot_hardware', 'IoT/Hardware'],
  ['open_innovation', 'Open innovation'], ['coding_contest', 'Coding contests'],
];
export const THEME_NAMES = { ...Object.fromEntries(THEMES), other: 'Other' };
export const MODE_NAMES = { online: 'Online', offline: 'Offline', hybrid: 'Hybrid' };

// Degree -> years a student can be in. Researched 29 Sep 2026:
// NEP 2020 made BCA/BSc 4-year honours programmes (exit with a 3-year degree allowed);
// AICTE cut MCA from 3 to 2 years from 2020-21; BTech 4, MTech 2. "Other" keeps every option.
export const DEGREES = [
  { key: 'bca', label: 'BCA', years: 4, honoursYear: 4 },
  { key: 'bsc', label: 'BSc', years: 4, honoursYear: 4 },
  { key: 'btech', label: 'BTech', years: 4 },
  { key: 'mca', label: 'MCA', years: 2 },
  { key: 'mtech', label: 'MTech', years: 2 },
  { key: 'other', label: 'Other', years: 5 },
];

// [[1, 'Year 1'], ..., [4, 'Year 4 (Honours)']] for the chosen degree; [] until a degree is picked
export function yearOptions(degreeKey) {
  const d = DEGREES.find((x) => x.key === degreeKey);
  if (!d) return [];
  return Array.from({ length: d.years }, (_, i) => {
    const y = i + 1;
    return [y, y === d.honoursYear ? `Year ${y} (Honours)` : `Year ${y}`];
  });
}

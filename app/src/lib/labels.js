// Display names for the fixed value lists in shared/constants.json (one place for app wording)
export const THEMES = [
  ['ai_ml', 'AI/ML'], ['cybersecurity', 'Cybersecurity'], ['web', 'Web'], ['mobile', 'Mobile'],
  ['data_science', 'Data science'], ['blockchain', 'Blockchain'], ['iot_hardware', 'IoT/Hardware'],
  ['open_innovation', 'Open innovation'],
];
export const THEME_NAMES = { ...Object.fromEntries(THEMES), other: 'Other' };
export const MODE_NAMES = { online: 'Online', offline: 'Offline', hybrid: 'Hybrid' };

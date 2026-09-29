import { router } from 'expo-router';

import Chip from '../../components/Chip';
import OnboardingStep, { Group } from '../../components/OnboardingStep';
import { useDraft } from '../../lib/draft';

const MODES = [
  ['online', 'Online', ['online']],
  ['offline', 'Offline', ['offline', 'hybrid']],
  ['both', 'Both', ['online', 'offline', 'hybrid']],
];
const FEES = [['free', 'Free only', 0], ['500', 'Up to ₹500', 500], ['any', 'Any', null]];
const DEGREES = [['bca', 'BCA'], ['btech', 'BTech'], ['bsc', 'BSc'], ['mca', 'MCA'], ['mtech', 'MTech'], ['other', 'Other']];
const YEARS = [1, 2, 3, 4, 5];

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Step 3: how you want to join. Defaults: Both, Any fee.
export default function Join() {
  const { draft, update } = useDraft();
  const radio = (selected, label, onPress) => (
    <Chip key={label} label={label} selected={selected} showRemove={false} role="radio" onPress={onPress} />
  );
  const next = () => router.push('/location');
  return (
    <OnboardingStep
      step={3}
      title="How do you want to join?"
      next={{ label: 'Next', onPress: next }}
      skip={next}
    >
      <Group label="Mode">
        {MODES.map(([key, label, modes]) => radio(same(draft.modes, modes), label, () => update({ modes })))}
      </Group>
      <Group label="Fee">
        {FEES.map(([key, label, fee]) => radio(draft.fee_max === fee, label, () => update({ fee_max: fee })))}
      </Group>
      <Group label="Degree">
        {DEGREES.map(([key, label]) => radio(draft.degree === key, label, () => update({ degree: draft.degree === key ? null : key })))}
      </Group>
      <Group label="Year">
        {YEARS.map((y) => radio(draft.year === y, `Year ${y}`, () => update({ year: draft.year === y ? null : y })))}
      </Group>
    </OnboardingStep>
  );
}

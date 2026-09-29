import { router } from 'expo-router';

import Chip from '../../components/Chip';
import OnboardingStep, { Group } from '../../components/OnboardingStep';
import { useDraft } from '../../lib/draft';
import { DEGREES, yearOptions } from '../../lib/labels';

const MODES = [
  ['Online', ['online']],
  ['Offline', ['offline', 'hybrid']],
  ['Both', ['online', 'offline', 'hybrid']],
];
// User's call (29 Sep): no "Up to ₹500" option, just free or everything
const FEES = [['Free only', 0], ['Free and paid', null]];

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Step 3: how you want to join. Defaults: Both, free and paid. Year appears once a degree is picked.
export default function Join() {
  const { draft, update } = useDraft();
  const radio = (selected, label, onPress) => (
    <Chip key={label} label={label} selected={selected} showRemove={false} role="radio" onPress={onPress} />
  );

  const pickDegree = (key) => {
    const degree = draft.degree === key ? null : key;
    // a year that doesn't exist for the new degree (Year 4 after switching BTech -> MCA) is dropped
    const stillValid = yearOptions(degree).some(([y]) => y === draft.year);
    update({ degree, year: stillValid ? draft.year : null });
  };

  const years = yearOptions(draft.degree);
  const next = () => router.push('/location');
  return (
    <OnboardingStep step={3} title="How do you want to join?" next={{ label: 'Next', onPress: next }} skip={next}>
      <Group label="Mode">
        {MODES.map(([label, modes]) => radio(same(draft.modes, modes), label, () => update({ modes })))}
      </Group>
      <Group label="Fee">
        {FEES.map(([label, fee]) => radio(draft.fee_max === fee, label, () => update({ fee_max: fee })))}
      </Group>
      <Group label="Degree">
        {DEGREES.map((d) => radio(draft.degree === d.key, d.label, () => pickDegree(d.key)))}
      </Group>
      {years.length ? (
        <Group label="Year">
          {years.map(([y, label]) => radio(draft.year === y, label, () => update({ year: draft.year === y ? null : y })))}
        </Group>
      ) : null}
    </OnboardingStep>
  );
}

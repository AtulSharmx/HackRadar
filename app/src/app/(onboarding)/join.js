import { router } from 'expo-router';

import Chip from '../../components/Chip';
import OnboardingStep, { Group } from '../../components/OnboardingStep';
import Segmented from '../../components/Segmented';
import { useDraft } from '../../lib/draft';
import { DEGREES } from '../../lib/labels';

const MODES = [['online', 'Online'], ['offline', 'Offline'], ['both', 'Both']];
const MODE_LISTS = { online: ['online'], offline: ['offline', 'hybrid'], both: ['online', 'offline', 'hybrid'] };
// User's call (29 Sep): no "Up to ₹500" option, just free or everything
const FEES = [['free', 'Free only'], ['any', 'Free and paid']];

const same = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

// Step 3: how you want to join. Defaults: Both, free and paid. Degree hides listings closed to it (school-only,
// postgraduate-only...); year is not asked: no source says which years may enter (launch audit, 10 Oct 2026).
export default function Join() {
  const { draft, update } = useDraft();
  const radio = (selected, label, onPress) => (
    <Chip key={label} label={label} selected={selected} showRemove={false} role="radio" onPress={onPress} />
  );

  const pickDegree = (key) => update({ degree: draft.degree === key ? null : key });

  const next = () => router.push('/location');
  return (
    <OnboardingStep step={3} title="How do you want to join?" next={{ label: 'Next', onPress: next }} skip={next}>
      <Group label="Mode">
        <Segmented
          options={MODES}
          value={Object.keys(MODE_LISTS).find((k) => same(draft.modes, MODE_LISTS[k])) || null}
          onChange={(k) => update({ modes: MODE_LISTS[k] })}
          accessibilityLabel="Mode"
        />
      </Group>
      <Group label="Fee">
        <Segmented
          options={FEES}
          value={draft.fee_max === 0 ? 'free' : 'any'}
          onChange={(k) => update({ fee_max: k === 'free' ? 0 : null })}
          accessibilityLabel="Fee"
        />
      </Group>
      <Group label="Degree" note="Hackathons not open to your degree (like school-only ones) stay hidden.">
        {DEGREES.map((d) => radio(draft.degree === d.key, d.label, () => pickDegree(d.key)))}
      </Group>
    </OnboardingStep>
  );
}

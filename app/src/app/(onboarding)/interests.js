import { router } from 'expo-router';

import Chip from '../../components/Chip';
import OnboardingStep, { Group } from '../../components/OnboardingStep';
import { useDraft } from '../../lib/draft';
import { THEMES } from '../../lib/labels';

// Step 2: at least one theme; no Skip here (App Flow)
export default function Interests() {
  const { draft, update } = useDraft();
  const toggle = (key) =>
    update({ themes: draft.themes.includes(key) ? draft.themes.filter((t) => t !== key) : [...draft.themes, key] });
  return (
    <OnboardingStep
      step={2}
      title="What do you want to build?"
      subtitle="Pick at least one. You can change this later."
      next={{ label: 'Next', onPress: () => router.push('/join'), disabled: draft.themes.length === 0 }}
    >
      <Group label="Themes">
        {THEMES.map(([key, label]) => (
          <Chip key={key} label={label} selected={draft.themes.includes(key)} showRemove={false} onPress={() => toggle(key)} />
        ))}
      </Group>
    </OnboardingStep>
  );
}

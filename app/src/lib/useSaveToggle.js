import { useToast } from '../components/Toast';
import { useSaved } from './saved';

// One save/unsave behaviour for cards and the detail screen, with Undo.
// Reminders arrive in step 30; until then the toast doesn't promise them.
export function useSaveToggle() {
  const saved = useSaved();
  const toast = useToast();
  return (event) => {
    if (saved.isSaved(event.id)) {
      const before = saved.remove(event.id);
      toast('Removed from Saved.', { action: { label: 'Undo', onPress: () => saved.restore(event.id, before) } });
    } else {
      saved.save(event);
      toast('Saved to Interested.', { action: { label: 'Undo', onPress: () => saved.remove(event.id) } });
    }
  };
}

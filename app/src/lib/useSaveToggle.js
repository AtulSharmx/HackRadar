import { useCallback, useRef } from 'react';

import { useToast } from '../components/Toast';
import { joinAnd } from './format';
import { turnOnNotifications } from './notificationPermission';
import { usePrefs } from './prefs';
import { reminderWords, remindersWork } from './reminders';
import { isPast, useSaved } from './saved';

// One save/unsave behaviour for cards and the detail screen, with Undo.
// The Saved toast says which reminders were set (App Flow "Save and reminders").
// The returned function never changes (it reads the latest state through a ref), so memoized cards stay put.
export function useSaveToggle() {
  const latest = useRef(null);
  latest.current = { saved: useSaved(), toast: useToast(), ...usePrefs() };
  return useCallback((event) => {
    const { saved, toast, prefs, update } = latest.current;
    if (saved.isSaved(event.id)) {
      const before = saved.remove(event.id);
      toast('Removed from Saved.', { action: { label: 'Undo', onPress: () => saved.restore(event.id, before) } });
      return;
    }
    saved.save(event);
    const undo = { action: { label: 'Undo', onPress: () => saved.remove(event.id) } };
    if (!remindersWork() || isPast(event)) return toast('Saved to Interested.', undo);
    if (!event.registration_deadline) return toast('Saved. No deadline found, so no reminders.', undo);
    if (!prefs?.notifications) {
      return toast('Saved. Turn on notifications to get reminders.', { action: { label: 'Turn on', onPress: () => turnOnNotifications(update, toast) } });
    }
    const words = reminderWords(event);
    toast(
      words.length
        ? `Saved. Reminder${words.length > 1 ? 's' : ''} set for ${joinAnd(words)} before the deadline.`
        : 'Saved. Too close to the deadline for reminders.',
      undo,
    );
  }, []);
}

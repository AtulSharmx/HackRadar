// One place for touch feedback, so every screen feels the same. Silent where the phone has no motor (web)
// and never allowed to throw into a press handler.
import * as Haptics from 'expo-haptics';

const safe = (fn) => {
  try {
    fn()?.catch?.(() => {});
  } catch {
    // no haptics on this device
  }
};

// a choice changed: chips, tabs, sort, switches, pages
export const select = () => safe(() => Haptics.selectionAsync());
// a button or card pressed
export const tap = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
// something weightier: save, swipe to remove
export const thud = () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
// it worked: marked registered, location found
export const success = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
// it didn't: blocked permission, no app
export const warn = () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));

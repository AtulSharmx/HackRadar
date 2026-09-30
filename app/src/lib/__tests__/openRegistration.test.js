import { appFor, playStoreUrl } from '../openRegistration';

test('only sites with a confirmed Android app get the app route', () => {
  expect(appFor('https://unstop.com/hackathons/code-e-manipal-20-manipal-university-jaipur-1761234')).toEqual({ name: 'Unstop', package: 'com.dare2compete.app' });
  expect(appFor('https://www.Unstop.com/o/Fbk6CQq')?.name).toBe('Unstop');
  expect(appFor('https://hefty-hacks.devfolio.co/')).toBeNull();
  expect(appFor('https://hack2skill.com/event/pwvirtual1/')).toBeNull();
  expect(appFor('https://unstop.com.evil.example/x')).toBeNull(); // not unstop.com
  expect(appFor('http://unstop.com/x')).toBeNull(); // only https links go to an app
  expect(playStoreUrl('com.dare2compete.app')).toBe('https://play.google.com/store/apps/details?id=com.dare2compete.app');
});

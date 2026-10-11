import { expect, it } from 'vitest';
import { getTutorialSteps } from './steps';

it('uses the existing register button only with an active shift', () => {
  expect(getTutorialSteps(false, false)[3].target).toBe('shift');
  expect(getTutorialSteps(true, false)[3].target).toBe('register-ride');
});
it('keeps both plans on available destinations without a GPS or strategy destination', () => {
  const destinations = ['home', 'home', 'home', 'home', 'financial', 'history', 'goals', 'profile'];
  expect(getTutorialSteps(false, false).map(step => step.tab)).toEqual(destinations);
  expect(getTutorialSteps(true, true).map(step => step.tab)).toEqual(destinations);
});
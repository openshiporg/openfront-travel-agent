/** The sidebar card is for an empty agency: hidden once setup is finished or dismissed, or trips exist. */
export function shouldShowOnboardingCard(input: {
  canManageOnboarding?: boolean | null
  onboardingStatus?: string | null
  tripsCount?: number | null
}): boolean {
  if (!input.canManageOnboarding) return false
  if (input.onboardingStatus === 'completed' || input.onboardingStatus === 'dismissed') return false
  if (typeof input.tripsCount === 'number' && input.tripsCount > 0) return false
  return true
}

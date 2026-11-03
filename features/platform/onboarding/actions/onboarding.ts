'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed' | 'dismissed';

export async function updateOnboardingStatus(status: OnboardingStatus) {
  const response = await keystoneClient(
    `mutation SetOnboardingStatus($status: String!) { setOnboardingStatus(status: $status) }`,
    { status }
  );
  const saved = response.success ? response.data?.setOnboardingStatus : null;
  if (!saved?.id || saved.onboardingStatus !== status) {
    return { success: false, error: (response as any).error || 'Setup status was not saved' };
  }
  revalidatePath('/dashboard');
  return { success: true, data: saved };
}

export async function dismissOnboarding() { return updateOnboardingStatus('dismissed'); }
export async function startOnboarding() { return updateOnboardingStatus('in_progress'); }
export async function completeOnboarding() { return updateOnboardingStatus('completed'); }

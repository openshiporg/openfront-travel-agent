import { useRef } from 'react';
import { GraphQLClient, gql } from 'graphql-request';
import { startOnboarding, completeOnboarding } from '../actions/onboarding';
import { SECTION_DEFINITIONS } from '../config/templates';
import type { OnboardingStep, TemplateType } from './useOnboardingState';

const PHASE_MUTATION = gql`
  mutation Phase($phase: String!, $template: String!) { ensureTravelOnboardingPhase(phase: $phase, template: $template) }
`;

// Ordered phases: parents before children (see mutations/onboarding.ts).
export function useOnboardingApi(p: {
  selectedTemplate: TemplateType;
  setProgress: (m: string) => void;
  setItemLoading: (t: string) => void;
  setItemCompleted: (t: string, n: number) => void;
  setItemError: (t: string, m: string) => void;
  setStep: (s: OnboardingStep) => void;
  setError: (e: string | null) => void;
  setIsLoading: (b: boolean) => void;
  resetOnboardingState: () => void;
}) {
  const running = useRef(false);
  const runOnboarding = async () => {
    if (running.current) return;
    running.current = true;
    p.setIsLoading(true);
    p.resetOnboardingState();
    p.setStep('progress');
    p.setProgress('Starting agency setup');
    try {
      const started = await startOnboarding();
      if (!started.success) throw new Error(started.error || 'Could not record setup progress');
      const client = new GraphQLClient('/api/graphql', { headers: { 'Content-Type': 'application/json' } });
      for (const section of SECTION_DEFINITIONS) {
        if (p.selectedTemplate === 'minimal' && section.key === 'inquiries') { p.setItemCompleted(section.key, 0); continue; }
        p.setProgress(`Saving ${section.label.toLowerCase()}`);
        p.setItemLoading(section.key);
        try {
          const res: any = await client.request(PHASE_MUTATION, { phase: section.key, template: p.selectedTemplate });
          p.setItemCompleted(section.key, res.ensureTravelOnboardingPhase?.count ?? 0);
        } catch (e: any) {
          const message = e?.response?.errors?.map((x: any) => x.message).join(', ') || e?.message || 'Setup failed';
          p.setItemError(section.key, message);
          throw new Error(`${section.label}: ${message}`);
        }
      }
      const done = await completeOnboarding();
      if (!done.success) throw new Error(done.error || 'Could not complete setup');
      p.setProgress('Agency setup saved');
      p.setStep('done');
    } catch (e: any) {
      p.setError(e?.message || 'Setup failed');
    } finally {
      running.current = false;
      p.setIsLoading(false);
    }
  };
  return { runOnboarding };
}

import { useEffect, useState } from 'react';
import { getSeedForTemplate, getItemsFromJsonData, emptyItems } from '../utils/dataUtils';
import seedData from '../lib/seed.json';

export type OnboardingStep = 'template' | 'progress' | 'done';
export type TemplateType = 'full' | 'minimal';

export function useOnboardingState() {
  const [step, setStep] = useState<OnboardingStep>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateType>('full');
  const [currentJsonData, setCurrentJsonData] = useState<any>(null);
  const [progressMessage, setProgress] = useState('');
  const [loadingItems, setLoadingItems] = useState<Record<string, string[]>>(emptyItems());
  const [completedItems, setCompletedItems] = useState<Record<string, string[]>>(emptyItems());
  const [itemErrors, setItemErrors] = useState<Record<string, string | undefined>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => { setCurrentJsonData(getSeedForTemplate(selectedTemplate, seedData)); }, [selectedTemplate]);

  const setItemLoading = (type: string) => setLoadingItems((p) => ({ ...p, [type]: ['…'] }));
  const setItemCompleted = (type: string, count: number) => {
    setLoadingItems((p) => ({ ...p, [type]: [] }));
    setCompletedItems((p) => ({ ...p, [type]: getItemsFromJsonData(currentJsonData, type).slice(0, Math.max(count, 1)) }));
  };
  const setItemError = (type: string, message: string) => {
    setLoadingItems((p) => ({ ...p, [type]: [] }));
    setItemErrors((p) => ({ ...p, [type]: message }));
  };
  const resetOnboardingState = () => { setError(null); setItemErrors({}); setLoadingItems(emptyItems()); setCompletedItems(emptyItems()); };

  return {
    step, setStep, selectedTemplate, setSelectedTemplate, currentJsonData, progressMessage, setProgress,
    loadingItems, completedItems, itemErrors, error, setError, isLoading, setIsLoading,
    setItemLoading, setItemCompleted, setItemError, resetOnboardingState, getItemsFromJsonData,
  };
}

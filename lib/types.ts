export interface ReflectionPrompt {
  title: string;
  prompt: string;
}

export interface GrowthStep {
  title: string;
  description: string;
}

export interface GrowthPath {
  intention: string;
  encouragement: string;
  steps: GrowthStep[];
}

export type SubjectId = 'A' | 'B' | 'C' | 'D';

interface SubjectTheme {
  id: SubjectId;
  name: string;
  primaryColor: string;
  borderColor: string;
  softBg: string;
  textColor: string;
  indicatorLabel: string;
}

/**
 * Global theme configuration for four subjects.
 * Note: do not use emoji in code or comments, only plain text labels.
 */
export const SUBJECT_THEMES: Record<SubjectId, SubjectTheme> = {
  A: {
    id: 'A',
    name: 'Crimson',
    primaryColor: 'text-red-400',
    borderColor: 'border-red-500/60',
    softBg: 'bg-red-500/10',
    textColor: 'text-red-300',
    indicatorLabel: 'A',
  },
  B: {
    id: 'B',
    name: 'Indigo',
    primaryColor: 'text-blue-400',
    borderColor: 'border-blue-500/60',
    softBg: 'bg-blue-500/10',
    textColor: 'text-blue-300',
    indicatorLabel: 'B',
  },
  C: {
    id: 'C',
    name: 'Amber',
    primaryColor: 'text-amber-400',
    borderColor: 'border-amber-500/60',
    softBg: 'bg-amber-500/10',
    textColor: 'text-amber-300',
    indicatorLabel: 'C',
  },
  D: {
    id: 'D',
    name: 'Emerald',
    primaryColor: 'text-emerald-400',
    borderColor: 'border-emerald-500/60',
    softBg: 'bg-emerald-500/10',
    textColor: 'text-emerald-300',
    indicatorLabel: 'D',
  },
};

export function getSubjectTheme(subjectId: SubjectId): SubjectTheme {
  return SUBJECT_THEMES[subjectId] || SUBJECT_THEMES.A;
}



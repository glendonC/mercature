import { useMemo } from 'react';
import type { EditKind } from '../edits/store';
import type { EditWords } from '../edits/words';
import { useLanguage } from '.';

/** The editing controls' words in the interface language, in the shape the edit components take. */
export function useEditWords(): EditWords {
  const { t } = useLanguage();
  return useMemo(() => ({
    addTitle: t('edit.addTitle'),
    addWhere: (where: string, from: number, to: number) => t('edit.addWhere', { where, from, to }),
    kinds: { steps: t('edit.kind.steps'), kerb: t('edit.kind.kerb'), narrow: t('edit.kind.narrow'), other: t('edit.kind.other') } as Record<EditKind, string>,
    noteLabel: t('edit.noteLabel'),
    notePlaceholder: t('edit.notePlaceholder'),
    noteKept: t('edit.noteKept'),
    takenAs: (language: string) => t('edit.takenAs', { language }),
    languages: { en: t('edit.language.en'), es: t('edit.language.es'), ko: t('edit.language.ko'), other: t('edit.language.other') } as Record<string, string>,
    changeLanguage: t('edit.changeLanguage'),
    add: t('edit.add'),
    cancel: t('edit.cancel'),
    remove: t('edit.remove'),
    fixTitle: t('edit.fixTitle'),
    fixOn: (date: string) => t('edit.fixOn', { date }),
    fixNoteLabel: t('edit.fixNoteLabel'),
    fix: t('edit.fix'),
    undoFix: t('edit.undoFix'),
    addedBy: t('edit.addedBy'),
    fixedOn: (date: string) => t('edit.fixedOn', { date }),
    yourNote: t('edit.yourNote'),
    save: t('edit.save'),
    notSaved: t('edit.notSaved'),
    unreadable: t('edit.unreadable'),
  }), [t]);
}

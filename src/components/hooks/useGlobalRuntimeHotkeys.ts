import { useEffect } from 'react';
import { isEditableOrInteractiveTarget } from '../editor/graph/isEditableOrInteractiveTarget';

interface UseGlobalRuntimeHotkeysOptions {
  enabled: boolean;
  onToggleRunPause: () => void;
}

export const useGlobalRuntimeHotkeys = ({
  enabled,
  onToggleRunPause,
}: UseGlobalRuntimeHotkeysOptions) => {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const handleLifecycleHotkey = (event: KeyboardEvent) => {
      if (
        event.code !== 'Space' ||
        event.repeat ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        isEditableOrInteractiveTarget(event.target)
      ) {
        return;
      }

      event.preventDefault();
      onToggleRunPause();
    };

    window.addEventListener('keydown', handleLifecycleHotkey);

    return () => {
      window.removeEventListener('keydown', handleLifecycleHotkey);
    };
  }, [enabled, onToggleRunPause]);
};

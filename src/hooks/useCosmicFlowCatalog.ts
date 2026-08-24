import { useEffect, useState } from 'react';
import type { CosmicFlowGroup } from '../core/cosmicFlowModel';

export function useCosmicFlowCatalog(enabled: boolean): readonly CosmicFlowGroup[] | undefined {
  const [groups, setGroups] = useState<readonly CosmicFlowGroup[]>();

  useEffect(() => {
    if (!enabled || groups) return;
    let active = true;
    import('../core/cosmicFlowCatalog').then(({ CF4_SUPERGALACTIC_SLICE }) => {
      if (active) setGroups(CF4_SUPERGALACTIC_SLICE);
    }).catch(() => {
      // Exact basin cores and probabilities remain visible if the optional slice fails.
    });
    return () => { active = false; };
  }, [enabled, groups]);

  return groups;
}

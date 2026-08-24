import { useEffect, useState } from 'react';
import { loadBrightStarCatalog } from '../core/starCatalog';
import type { CatalogStar } from '../core/types';

export function useBrightStarCatalog(): readonly CatalogStar[] | undefined {
  const [catalog, setCatalog] = useState<readonly CatalogStar[]>();

  useEffect(() => {
    let active = true;
    loadBrightStarCatalog().then((loaded) => {
      if (active) setCatalog(loaded);
    }).catch(() => {
      // The renderer retains a small procedural fallback if an asset host fails.
    });
    return () => { active = false; };
  }, []);

  return catalog;
}

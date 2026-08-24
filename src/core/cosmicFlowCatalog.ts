import { CF4_GROUP_PACKED_BASE64 } from '../data/cosmicFlowGroups';
import { CF4_GROUP_SAMPLE_COUNT } from '../data/cosmicFlowMetadata';
import type { CosmicFlowGroup } from './cosmicFlowModel';

function decodePackedGroups(): readonly CosmicFlowGroup[] {
  const binary = atob(CF4_GROUP_PACKED_BASE64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const view = new DataView(bytes.buffer);
  const groups = Array.from({ length: CF4_GROUP_SAMPLE_COUNT }, (_, index): CosmicFlowGroup => {
    const offset = index * 8;
    return {
      sgx: view.getInt16(offset, true) / 100,
      sgy: view.getInt16(offset + 2, true) / 100,
      sgz: view.getInt16(offset + 4, true) / 100,
      peculiarVelocityKmPerSecond: view.getInt16(offset + 6, true),
    };
  });
  return Object.freeze(groups);
}

export const CF4_SUPERGALACTIC_SLICE = decodePackedGroups();

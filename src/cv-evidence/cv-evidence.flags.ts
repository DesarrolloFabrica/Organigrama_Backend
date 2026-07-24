import type { EvidenceSourceType } from '../cv-skills/cv-skills.types';
import type {
  EvidenceEngineConfig,
  EvidenceQualityFlag,
  NormalizedEvidenceItem,
} from './cv-evidence.types';

export function computeQualityFlags(params: {
  unique: NormalizedEvidenceItem[];
  duplicateCount: number;
  sourceTypes: Set<EvidenceSourceType>;
  appliedCount: number;
  substantiveCount: number;
  ambiguousCount: number;
  listingCount: number;
  config: EvidenceEngineConfig;
}): EvidenceQualityFlag[] {
  const {
    unique,
    duplicateCount,
    sourceTypes,
    appliedCount,
    substantiveCount,
    ambiguousCount,
    listingCount,
    config,
  } = params;
  const flags: EvidenceQualityFlag[] = [];

  if (unique.length === 0) {
    flags.push('NO_EVIDENCE');
    return flags;
  }

  const onlySkills =
    sourceTypes.size === 1 && sourceTypes.has('SKILLS_SECTION');
  const onlyProfile =
    sourceTypes.size === 1 && sourceTypes.has('PROFILE_SUMMARY');

  // Listing: solo skills, o todas listing sin aplicada
  const allListing = unique.every((u) => u.isListing);
  const listingOnly =
    onlySkills ||
    (allListing && appliedCount === 0 && substantiveCount === 0) ||
    (sourceTypes.size > 0 &&
      [...sourceTypes].every(
        (t) => t === 'SKILLS_SECTION' || t === 'PROFILE_SUMMARY',
      ) &&
      appliedCount === 0 &&
      substantiveCount === 0 &&
      config.rulesProfile === 'er1');

  if (onlySkills) flags.push('ONLY_SKILLS_SECTION');
  if (onlyProfile) flags.push('ONLY_PROFILE_SUMMARY');
  if (listingOnly || (allListing && appliedCount === 0 && substantiveCount === 0)) {
    flags.push('ONLY_LISTING_EVIDENCE');
  }
  if (appliedCount > 0) flags.push('HAS_APPLIED_EVIDENCE');
  if (sourceTypes.size >= 2) flags.push('MULTIPLE_SOURCE_TYPES');
  if (duplicateCount > 0) flags.push('DUPLICATE_EVIDENCE');
  if (unique.some((u) => u.isShort)) flags.push('SHORT_EVIDENCE');
  if (unique.some((u) => u.isNameOnly)) flags.push('NAME_ONLY_EVIDENCE');
  if (
    unique.some((u) => u.isNameOnly) ||
    (unique.length > 0 && unique.every((u) => u.isShort && u.isNameOnly))
  ) {
    flags.push('GENERIC_EVIDENCE');
  }
  if (sourceTypes.has('OTHER')) flags.push('OTHER_SOURCE_PRESENT');
  if (sourceTypes.size <= 1) flags.push('LOW_SOURCE_DIVERSITY');
  if (sourceTypes.size >= 3) flags.push('HIGH_SOURCE_DIVERSITY');
  if (sourceTypes.has('CERTIFICATION')) flags.push('HAS_CERTIFICATION');
  if (sourceTypes.has('WORK_EXPERIENCE')) flags.push('HAS_WORK_EXPERIENCE');
  if (sourceTypes.has('PROJECT')) flags.push('HAS_PROJECT');
  if (sourceTypes.has('ACHIEVEMENT')) flags.push('HAS_ACHIEVEMENT');
  if (sourceTypes.has('RESPONSIBILITY')) flags.push('HAS_RESPONSIBILITY');

  if (ambiguousCount > 0) flags.push('AMBIGUOUS_EVIDENCE');
  if (unique.length > 0 && ambiguousCount === unique.length) {
    flags.push('ONLY_AMBIGUOUS_EVIDENCE');
  }
  if (substantiveCount > 0) flags.push('HAS_SUBSTANTIVE_EVIDENCE');

  void listingCount;

  return [...new Set(flags)];
}

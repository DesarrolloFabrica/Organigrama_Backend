/**
 * Semantic reuse gate experimental.
 * NO importar desde p3-runner / p4-runner / profile-assembler.
 */
export {
  buildP3SemanticFingerprint,
  compareP3SemanticInputs,
  decideP3Reuse,
  defaultP3SemanticInput,
  evidenceIdentityFromUnits,
  normalizeP3FieldContext,
} from './p3-gate';
export {
  buildP4SemanticFingerprint,
  compareP4SemanticInputs,
  decideP4Reuse,
  defaultP4SemanticInput,
  normalizeP4Specialties,
} from './p4-gate';
export { buildP3PromptEffective, buildP4PromptEffective, unitsToPromptPayload } from './payload';
export { runSemanticGateAdversarialTests, runSemanticGateMutationTests } from './adversarial';
export { mapCompareToReuse, metadataOnlyChanged } from './types';
export type {
  P3FieldContract,
  P3SemanticInput,
  P4SemanticInput,
  ReuseDecision,
  SemanticCompareResult,
  SemanticLineage,
  SemanticReuseRecord,
} from './types';

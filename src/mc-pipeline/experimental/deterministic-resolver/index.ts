/**
 * Prototipo experimental. NO importar desde p2-runner / p3-runner / p4-runner.
 */
export { RESOLVER_CODE, RESOLVER_VERSION } from './types';
export { resolveFields } from './field-resolver';
export { resolveSpecialties } from './specialty-resolver';
export { loadEvidenceUnitsFromP1Pack } from './evidence';
export { COHORT } from './cohort';
export { resolveFieldsHardened } from './field-resolver-hardened';
export { resolveSpecialtiesHardened } from './specialty-resolver-hardened';
export { EXPERIMENTAL_RESOLVER_POLICY } from './experimental-policy';
export { EXPERIMENTAL_RESOLVER_POLICY_V03 } from './experimental-policy-v03';
export {
  runDeterministicResolverPrototype,
  writePrototypeArtifacts,
  stableStringify,
} from './run-prototype';
export { runHardening, writeHardeningArtifacts } from './run-hardening';

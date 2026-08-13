# PEOPLE_HR Specialty Foundation V1

## Veredicto de evidencia (José 1265, Katiuska 1266, Paula 1271, Nataly 1272)

Fuentes: Evidence Units P1 referenciadas por `supportingEvidenceUnitIds` de P2 `PEOPLE_HR` + R1 secondary.

### Clusters

| Cluster | Naturaleza | Personas | Decisión |
|---|---|---|---|
| Selección / reclutamiento / vinculación laboral / perfiles / descriptivos de cargo | Recurrente | 1266, 1271 | Specialty `TALENT_ACQUISITION` |
| Turnos / permisos / capacitaciones del personal / integración de talento | Recurrente débil (fuerte en 1271; apoyo 1266) | 1271, 1266 | Specialty `WORKFORCE_ADMINISTRATION` |
| Entrevistas de retiro | Fuerte, 1 CV | 1265 | Radar `HR_EXIT_SEPARATION` only |
| Bienestar / eventos internos | Apoyo, 1 CV | 1271 | Radar `HR_WELLBEING_INTERNAL` only |
| Técnico en recursos humanos (SENA) | Educación, no práctica | 1265 | Excluido (educación ≠ experiencia) |
| Carpetas/HV docentes en Drive | Ops académica/admin | 1265 | EDUCATION / FINANCE_ADMIN border |
| Liderazgo / coordinación de personal | Supervisión genérica | 1272 (LOW_COVERAGE) | Incidental; no specialty |

### No inventado

Sin evidencia suficiente para nómina HR, SST, desempeño formal, clima como specialty, ni “HR generalist”.

## Specialties V1

| code | nombre | evidencia recurrente | personas | frontera |
|---|---|---|---|---|
| `TALENT_ACQUISITION` | Atracción y vinculación de talento | selección, reclutamiento, vinculación personal/pasantes, perfiles, descriptivos | 1266, 1271 | ≠ CS intake; ≠ archivo HV docente; ≠ título RRHH |
| `WORKFORCE_ADMINISTRATION` | Administración operativa de personal | turnos, permisos, capacitaciones del personal, integración de talento | 1271, 1266 | ≠ liderazgo genérico; ≠ FA archivo; ≠ EDUCATION docencia |

## Radar (7)

`HR_TALENT_ACQUISITION` · `HR_ROLE_PROFILING` · `HR_ONBOARDING_INTEGRATION` · `HR_WORKFORCE_OPS` · `HR_PEOPLE_LEARNING` · `HR_WELLBEING_INTERNAL` · `HR_EXIT_SEPARATION`

Invariantes: tools ≠ práctica; educación ≠ experiencia; keyword aislada no activa; cobertura>0 requiere skills; sin substring matching; una skill no infla ejes semánticamente distintos sin evidencia.

## Validación post-implementación (P3→P4→Gate→Profile)

| Persona | P3 PEOPLE_HR | Gate | Profile tab |
|---|---|---|---|
| José 1265 | WEAK `WORKFORCE_ADMINISTRATION` | `SECONDARY_NO_OBSERVED_SPECIALTY` · taxonomyPending=false | no (WEAK) |
| Katiuska 1266 | OBSERVED `TALENT_ACQUISITION` | `SECONDARY_WITH_OBSERVED_SPECIALTY` · PUBLISHABLE | sí · 1 skill · radar 3 ejes |
| Paula 1271 | WEAK ambos V1 | `SECONDARY_NO_OBSERVED_SPECIALTY` · taxonomyPending=false | no (WEAK) |
| Nataly 1272 | vacío | `SECONDARY_NO_OBSERVED_SPECIALTY` · taxonomyPending=false | no |

Primary `FINANCE_ADMIN` intacto en los cuatro.

**Veredicto:** `PEOPLE_HR_OPERATIONAL_VALIDATED`

**Wiring mínimo:** P3/Profile evalúan secondaries catalogadas también bajo R1 `RESOLVED` (CLEAR_LEAD), no solo `MULTI_FIELD`.

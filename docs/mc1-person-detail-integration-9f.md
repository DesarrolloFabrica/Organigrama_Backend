# MC1 — FASE 9F PersonDetail competencies integration

Git-safe. Local ARTIFACT_ONLY. No Cloud / no persistence of P2–P4/profile.

## Legacy flow (audited)

```
PersonDetailPanel
  → PersonCompetenciesPanel
    → CompetenciesExplorer
      → GET /api/org-chart/person/:id/competencies/professional-profile
        → OrgChartController
          → OrgChartCompetenciesService.getProfessionalProfile
            → mc_profile_evaluation + MVP (cv_extraction_skill…)
```

“Perfil profesional en proceso de clasificación” when `evaluatedDomains` empty and MVP non-empty.

## Applied architecture

```
MC1 Profile Assembly (tmp packs)
  → readMc1PersonProfile (personId → index/bindings → pack)
  → Mc1PersonCompetenciesPresentationDto
  → professional-profile.mc1Profile
  → Mc1PersonCompetenciesView (replaces legacy when AVAILABLE)
```

Gate unchanged: `OrgChartVisibilityService.assertCanView` / `canViewFullProfile`.

## Fallback

personId without MC1 pack → `mc1Profile` null → legacy path intact.

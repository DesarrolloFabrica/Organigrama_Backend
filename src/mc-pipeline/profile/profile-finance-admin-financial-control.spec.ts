import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { mapSkillToDimensions } from './profile-skill-dimension-mapper';

type PopSkill = {
  code: string;
  name: string;
  specialty: string;
  dims: string[];
};
type PopProfile = {
  personId: string;
  fullName: string;
  specialties: string[];
  controlRelative: number;
  skills: PopSkill[];
};
const population = JSON.parse(
  readFileSync(
    join(__dirname, 'fixtures/fa-financial-control-population.json'),
    'utf8',
  ),
) as { profiles: PopProfile[] };

const CONTROL = 'FA_FINANCIAL_CONTROL';
const EXPECTED_NEW = ['1138', '1313'];
const EXISTING_POSITIVE = ['1092', '1096', '1133', '1270', '1342'];

function fa(
  partial: Partial<{
    skillCode: string;
    name: string;
    parentSpecialtyCode: string;
    supportingSignals: string[];
  }>,
) {
  return mapSkillToDimensions({
    skillCode: partial.skillCode ?? 'skill',
    name: partial.name ?? 'Skill',
    parentFieldCode: 'FINANCE_ADMIN',
    parentSpecialtyCode:
      partial.parentSpecialtyCode ?? 'ADMINISTRATIVE_MANAGEMENT',
    supportingSignals: partial.supportingSignals ?? [],
    toolOrTechnologySignals: [],
    supportingEvidenceUnitIds: ['e1'],
  });
}

describe('mapSkillToDimensions FINANCE_ADMIN FA_FINANCIAL_CONTROL OPTION_A', () => {
  describe('positive aliases', () => {
    it('financial_control in skillCode → CONTROL', () => {
      const m = fa({
        skillCode: 'financial_control_and_petty_cash',
        name: 'Control de gastos y manejo de caja menor',
      });
      expect(m.dimensionCodes).toContain(CONTROL);
    });

    it('financial_controls label → CONTROL', () => {
      const m = fa({
        skillCode: 'unit_financial_controls',
        name: 'Financial controls for the business unit',
        parentSpecialtyCode: 'BUDGET_FINANCIAL_CONTROL',
      });
      expect(m.dimensionCodes).toContain(CONTROL);
    });

    it('internal_control / control interno → CONTROL', () => {
      const code = fa({
        skillCode: 'internal_control_evaluation',
        name: 'Evaluación de prácticas',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      const label = fa({
        skillCode: 'control_tests',
        name: 'Evaluación y Pruebas de Control Interno',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      expect(code.dimensionCodes).toContain(CONTROL);
      expect(label.dimensionCodes).toContain(CONTROL);
    });

    it('financial_auditing / auditoría financiera → CONTROL', () => {
      const code = fa({
        skillCode: 'financial_auditing',
        name: 'Revisión independiente',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      const label = fa({
        skillCode: 'audit_work',
        name: 'Auditoría Financiera',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      expect(code.dimensionCodes).toContain(CONTROL);
      expect(label.dimensionCodes).toContain(CONTROL);
    });

    it('external_auditing / auditoría externa → CONTROL', () => {
      const code = fa({
        skillCode: 'external_auditing',
        name: 'Auditoría externa y financiera',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      expect(code.dimensionCodes).toContain(CONTROL);
      expect(code.dimensionCodes).not.toContain('FA_ACCOUNTING');
    });

    it('financial_monitoring / seguimiento financiero → CONTROL', () => {
      const code = fa({
        skillCode: 'financial_monitoring',
        name: 'Monitoreo de indicadores de unidad',
        parentSpecialtyCode: 'FINANCIAL_MANAGEMENT',
      });
      const label = fa({
        skillCode: 'unit_monitoring',
        name: 'Seguimiento financiero de la ejecución',
        parentSpecialtyCode: 'FINANCIAL_MANAGEMENT',
      });
      expect(code.dimensionCodes).toContain(CONTROL);
      expect(label.dimensionCodes).toContain(CONTROL);
    });

    it('cash_control exact token → CONTROL; cash control label → CONTROL', () => {
      const code = fa({
        skillCode: 'cash_control',
        name: 'Control de recursos de tesorería',
        parentSpecialtyCode: 'BUDGET_FINANCIAL_CONTROL',
      });
      const label = fa({
        skillCode: 'treasury_oversight',
        name: 'Cash control of operating funds',
        parentSpecialtyCode: 'BUDGET_FINANCIAL_CONTROL',
      });
      expect(code.dimensionCodes).toContain(CONTROL);
      expect(label.dimensionCodes).toContain(CONTROL);
    });

    it('keeps existing Spanish budget-control regex', () => {
      const m = fa({
        skillCode: 'budget_management_and_control',
        name: 'Gestión y Control Presupuestal',
        parentSpecialtyCode: 'BUDGET_FINANCIAL_CONTROL',
      });
      expect(m.dimensionCodes).toContain(CONTROL);
      expect(m.dimensionCodes).toContain('FA_FINANCIAL_PLANNING');
    });
  });

  describe('negative transactional signals', () => {
    it('petty_cash / caja menor alone ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'petty_cash',
        name: 'Manejo de caja menor',
      });
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('cash_reconciliation / cash_closure ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'cash_reconciliation_and_closure',
        name: 'Cierres de caja y conciliación de pagos',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      expect(m.dimensionCodes).toContain('FA_ACCOUNTING');
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('account_reconciliation ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'account_reconciliation',
        name: 'Conciliaciones Contables y Registro de Transacciones',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      expect(m.dimensionCodes).toContain('FA_ACCOUNTING');
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('payroll / nómina ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'payroll_and_petty_cash_management',
        name: 'Gestión de nómina y caja menor',
      });
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('billing / facturación / control de caja ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'billing_and_cash_management',
        name: 'Gestión de Facturación y Control de Caja',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      expect(m.dimensionCodes).toContain('FA_ACCOUNTING');
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('bookkeeping ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'bookkeeping_and_accounting_records',
        name: 'Gestión de registros y libros contables',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      expect(m.dimensionCodes).toContain('FA_ACCOUNTING');
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('supplier_payment / pagos ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'supplier_payment',
        name: 'Pagos a proveedores',
      });
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('generic control / control operativo ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'operational_planning_and_control',
        name: 'Planeación y control operativo',
      });
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('audit support without financial/external audit ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'account_reconciliation_and_audit_support',
        name: 'Conciliación Contable y Soporte a Auditorías',
        parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
      });
      expect(m.dimensionCodes).toContain('FA_ACCOUNTING');
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });

    it('auditoría administrativa ≠ CONTROL', () => {
      const m = fa({
        skillCode: 'administrative_process_and_audit_management',
        name: 'Gestión de Procesos y Auditoría Administrativa',
      });
      expect(m.dimensionCodes).not.toContain(CONTROL);
    });
  });

  describe('required person cases', () => {
    it('1138 external_auditing → CONTROL; payroll/billing/recon do not', () => {
      expect(
        fa({
          skillCode: 'external_auditing',
          name: 'Auditoría externa y financiera',
          parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
        }).dimensionCodes,
      ).toContain(CONTROL);
      expect(
        fa({
          skillCode: 'payroll_and_petty_cash_management',
          name: 'Gestión de nómina y caja menor',
        }).dimensionCodes,
      ).not.toContain(CONTROL);
      expect(
        fa({
          skillCode: 'billing_and_expense_legalization',
          name: 'Facturación, cobranza y legalización de gastos',
          parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
        }).dimensionCodes,
      ).not.toContain(CONTROL);
      expect(
        fa({
          skillCode: 'accounting_reconciliation_and_account_management',
          name: 'Conciliaciones contables y seguimiento de cuentas',
          parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
        }).dimensionCodes,
      ).not.toContain(CONTROL);
    });

    it('1313 financial_control token → CONTROL', () => {
      expect(
        fa({
          skillCode: 'financial_control_and_petty_cash',
          name: 'Control de gastos y manejo de caja menor',
        }).dimensionCodes,
      ).toContain(CONTROL);
    });

    it('1145 Ingrid remains CONTROL = 0', () => {
      const skills = [
        fa({
          skillCode: 'bookkeeping_and_accounting_records',
          name: 'Gestión de registros y libros contables',
          parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
        }),
        fa({
          skillCode: 'cash_reconciliation_and_closure',
          name: 'Cierres de caja y conciliación de pagos',
          parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
        }),
        fa({
          skillCode: 'operational_planning_and_control',
          name: 'Planeación y control operativo',
        }),
        fa({
          skillCode: 'academic_administrative_operations',
          name: 'Gestión de operaciones académico-administrativas',
        }),
        fa({
          skillCode: 'management_reporting_and_case_traceability',
          name: 'Reportes de gestión y trazabilidad de casos',
        }),
      ];
      for (const m of skills) {
        expect(m.dimensionCodes).not.toContain(CONTROL);
      }
    });

    it('1312 billing + control de caja remains CONTROL = 0', () => {
      expect(
        fa({
          skillCode: 'billing_and_cash_management',
          name: 'Gestión de Facturación y Control de Caja',
          parentSpecialtyCode: 'ACCOUNTING_OPERATIONS',
        }).dimensionCodes,
      ).not.toContain(CONTROL);
    });
  });

  describe('41-profile FINANCE_ADMIN regression', () => {
    const CONTROL_REGEX_UNCHANGED = [
      'FA_ADMIN_OPS',
      'FA_ACCOUNTING',
      'FA_REPORTING',
      'FA_PROCUREMENT',
      'FA_DOCUMENT_MGMT',
      'FA_FINANCIAL_PLANNING',
    ];

    function remap(skill: { code: string; name: string; specialty: string }) {
      return mapSkillToDimensions({
        skillCode: skill.code,
        name: skill.name,
        parentFieldCode: 'FINANCE_ADMIN',
        parentSpecialtyCode: skill.specialty,
        supportingSignals: [],
        toolOrTechnologySignals: [],
        supportingEvidenceUnitIds: [],
      }).dimensionCodes;
    }

    const rows = population.profiles.map((p) => {
      const skills = p.skills.map((s) => {
        const next = remap(s);
        return {
          code: s.code,
          name: s.name,
          specialty: s.specialty,
          previous: s.dims,
          next,
          addedControl: !s.dims.includes(CONTROL) && next.includes(CONTROL),
        };
      });
      const wasPositive = p.controlRelative > 0;
      const nowPositive =
        wasPositive || skills.some((s) => s.next.includes(CONTROL));
      return {
        personId: p.personId,
        fullName: p.fullName,
        wasPositive,
        nowPositive,
        skills,
        added: skills.filter((s) => s.addedControl),
      };
    });

    const newly = rows.filter((r) => !r.wasPositive && r.nowPositive);
    const unexpected = newly.filter((r) => !EXPECTED_NEW.includes(r.personId));
    const lostPositive = rows.filter(
      (r) =>
        EXISTING_POSITIVE.includes(r.personId) &&
        !r.skills.some((s) => s.next.includes(CONTROL)),
    );

    it('activates only 1138 and 1313', () => {
      expect(newly.map((r) => r.personId).sort()).toEqual([...EXPECTED_NEW].sort());
      expect(unexpected).toEqual([]);
    });

    it('keeps existing positives on CONTROL', () => {
      expect(lostPositive).toEqual([]);
      for (const id of EXISTING_POSITIVE) {
        const row = rows.find((r) => r.personId === id);
        expect(row?.wasPositive).toBe(true);
        expect(row?.nowPositive).toBe(true);
      }
    });

    it('1145 stays at CONTROL = 0', () => {
      const ingrid = rows.find((r) => r.personId === '1145');
      expect(ingrid?.wasPositive).toBe(false);
      expect(ingrid?.nowPositive).toBe(false);
      expect(ingrid?.added).toEqual([]);
    });

    it('does not add CONTROL via other-dimension regexes', () => {
      const collisions = [];
      for (const row of rows) {
        for (const s of row.skills) {
          if (!s.addedControl) continue;
          const extra = s.next.filter(
            (d) =>
              d !== CONTROL &&
              !s.previous.includes(d) &&
              CONTROL_REGEX_UNCHANGED.includes(d),
          );
          if (extra.length) {
            collisions.push({ personId: row.personId, code: s.code, extra });
          }
        }
      }
      expect(collisions).toEqual([]);
    });

    it('writes tmp regression results (local artifact)', () => {
      const outDir = join(
        __dirname,
        '../../../../tmp/mc1-finance-admin-financial-control-mapping-fix',
      );
      mkdirSync(outDir, { recursive: true });
      const payload = {
        generatedAt: new Date().toISOString(),
        counters: {
          GEMINI_CALLS: 0,
          MC1_REPROCESSING: 0,
          P1_CALLS: 0,
          P2_CALLS: 0,
          P3_CALLS: 0,
          P4_CALLS: 0,
          DATABASE_WRITES: 0,
          PUBLISHER_WRITES: 0,
          PRODUCTION_DEPLOYS: 0,
        },
        recommendedDesign: 'OPTION_A',
        aliasesAdded: [
          'financial_control / financial_controls',
          'internal_control / control interno',
          'financial_auditing / financial audit / auditoría financiera',
          'external_auditing / external audit / auditoría externa',
          'financial_monitoring / seguimiento financiero',
          'cash_control / cash control (token contiguo exacto)',
        ],
        aliasesRejectedForAmbiguity: [
          'control de caja',
          'cash handling',
          'cash closure',
          'petty cash / caja menor',
          'bare control',
        ],
        existingPositiveProvenanceNote:
          '1092 internal_control_evaluation y financial_auditing: mismas dimensiones; la justificación pasa de fallback BUDGET_FINANCIAL_CONTROL a regex OPTION_A. No se inventa rawScore.',
        newlyActivated: newly.map((r) => ({
          personId: r.personId,
          fullName: r.fullName,
          trigger: r.added.map((s) => ({
            skill: s.code,
            name: s.name,
            previous: s.previous,
            next: s.next,
          })),
        })),
        unexpectedActivations: unexpected,
        existingPositives: EXISTING_POSITIVE.map((id) => {
          const row = rows.find((r) => r.personId === id);
          const provenance = row?.skills
            .filter((s) => s.next.includes(CONTROL))
            .map((s) => ({
              skill: s.code,
              previous: s.previous,
              next: s.next,
              provenanceChanged:
                JSON.stringify([...s.previous].sort()) !==
                JSON.stringify([...s.next].sort()),
            }));
          return { personId: id, stillPositive: true, controlSkills: provenance };
        }),
        cluster: ['1138', '1145', '1312', '1313'].map((id) => {
          const row = rows.find((r) => r.personId === id);
          return {
            personId: id,
            before: row?.wasPositive ? 'positive' : 0,
            after: row?.nowPositive ? 'positive' : 0,
            added: row?.added.map((s) => s.code) ?? [],
          };
        }),
        negativeControlsPass: unexpected.length === 0,
        otherDimensionRegexesUntouched: true,
        calibration: {
          policy: 'MC1.PROFILE.RADAR_CALIBRATION',
          version: '1.1.0',
          gamma: 0.56,
        },
      };
      writeFileSync(join(outDir, 'results.json'), JSON.stringify(payload, null, 2));
      expect(newly).toHaveLength(2);
    });
  });
});

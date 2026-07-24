import {
  parseEnrichCliArgs,
  assertEnrichMainCli,
  assertActivateCli,
  assertDeactivateCli,
} from './cv-skills-enrichment.cli-args';

describe('parseEnrichCliArgs / assertEnrichMainCli', () => {
  const base = [
    '--document=1000518830',
    '--inventoryArtifact=tmp/cv-skills/1000518830-c1-1.0.1.json',
    '--dry-run',
  ];

  it('parsea dry-run válido', () => {
    const args = parseEnrichCliArgs(base);
    expect(args.document).toBe('1000518830');
    expect(args.dryRun).toBe(true);
    expect(args.persist).toBe(false);
    expect(args.blockSize).toBe(15);
    assertEnrichMainCli(args);
  });

  it('detecta --persist', () => {
    expect(parseEnrichCliArgs([...base, '--persist']).persist).toBe(true);
  });

  it('rechaza documento inválido', () => {
    expect(() =>
      parseEnrichCliArgs([
        '--document=abc',
        '--inventoryArtifact=x.json',
        '--dry-run',
      ]),
    ).toThrow(/Documento inválido/);
  });

  it('rechaza blockSize fuera de rango', () => {
    expect(() =>
      parseEnrichCliArgs([...base, '--blockSize=99']),
    ).toThrow(/blockSize/);
  });

  it('requiere inventoryArtifact o extractionId en dry-run', () => {
    expect(() =>
      assertEnrichMainCli(
        parseEnrichCliArgs(['--document=1000518830', '--dry-run']),
      ),
    ).toThrow(/inventario/i);
  });

  it('acepta extractionId sin artifact', () => {
    const args = parseEnrichCliArgs([
      '--document=1072896519',
      '--extractionId=201',
      '--dry-run',
    ]);
    expect(args.extractionId).toBe('201');
    expect(args.inventoryArtifact).toBeUndefined();
    assertEnrichMainCli(args);
  });

  it('rechaza artifact y extractionId juntos', () => {
    expect(() =>
      parseEnrichCliArgs([
        '--document=1000518830',
        '--inventoryArtifact=x.json',
        '--extractionId=1',
        '--dry-run',
      ]),
    ).toThrow(/solo una fuente/i);
  });

  it('--persist sin confirmación aborta', () => {
    expect(() =>
      assertEnrichMainCli(
        parseEnrichCliArgs(['--extractionId=201', '--persist']),
      ),
    ).toThrow(/i-confirm-persist/);
  });

  it('--persist + activate sin confirm activate aborta', () => {
    expect(() =>
      assertEnrichMainCli(
        parseEnrichCliArgs([
          '--extractionId=201',
          '--persist',
          '--i-confirm-persist',
          '--activate',
        ]),
      ),
    ).toThrow(/i-confirm-activate/);
  });

  it('--activate sin --persist en CLI principal aborta', () => {
    expect(() =>
      assertEnrichMainCli(
        parseEnrichCliArgs([
          '--extractionId=201',
          '--dry-run',
          '--activate',
          '--i-confirm-activate',
        ]),
      ),
    ).toThrow(/activate/i);
  });

  it('rechaza --versionId y --batch', () => {
    expect(() =>
      parseEnrichCliArgs(['--extractionId=201', '--dry-run', '--versionId=1']),
    ).toThrow(/versionId/);
    expect(() =>
      parseEnrichCliArgs(['--extractionId=201', '--dry-run', '--batch']),
    ).toThrow(/lotes/);
  });

  it('activate CLI requiere confirmación', () => {
    expect(() =>
      assertActivateCli(parseEnrichCliArgs(['--enrichmentId=9'])),
    ).toThrow(/i-confirm-activate/);
    assertActivateCli(
      parseEnrichCliArgs(['--enrichmentId=9', '--i-confirm-activate']),
    );
  });

  it('deactivate CLI requiere confirmación', () => {
    expect(() =>
      assertDeactivateCli(parseEnrichCliArgs(['--enrichmentId=1'])),
    ).toThrow(/i-confirm-deactivate/);
    assertDeactivateCli(
      parseEnrichCliArgs(['--enrichmentId=1', '--i-confirm-deactivate']),
    );
  });
});

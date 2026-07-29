import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type McMappingPackReleaseStatus = 'DRAFT' | 'PUBLISHED' | 'RETIRED';

@Entity({ name: 'mc_mapping_pack_release', schema: 'organigrama' })
export class McMappingPackRelease {
  @PrimaryGeneratedColumn('increment', { type: 'bigint' })
  id!: string;

  @Column({ type: 'varchar', length: 80 })
  pack_code!: string;

  @Column({ type: 'varchar', length: 64 })
  pack_version!: string;

  @Column({ type: 'varchar', length: 80 })
  domain_code!: string;

  @Column({ type: 'varchar', length: 64 })
  content_hash!: string;

  @Column({ type: 'varchar', length: 20, default: 'PUBLISHED' })
  status!: McMappingPackReleaseStatus;

  @Column({ type: 'text', nullable: true })
  source_ref!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}

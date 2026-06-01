import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'person_profile_state', schema: 'organigrama' })
export class PersonProfileState {
  @PrimaryColumn({ type: 'bigint' })
  person_id: string;

  @Column({ type: 'timestamptz', nullable: true })
  profile_completed_at: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  profile_updated_by_user_at: Date | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  profile_photo_source: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  profile_photo_url: string | null;

  @Column({ type: 'timestamptz', default: () => 'NOW()' })
  created_at: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at: Date;
}

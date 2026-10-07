import type { PipelineItem, RejectionReason, Stage } from './types.ts';

const STAGE_LABELS: Record<Stage, string> = {
  received: 'Recibida',
  screening: 'Cribado',
  interview: 'Entrevista',
  offer: 'Oferta',
  hired: 'Contratado',
  rejected: 'Rechazado',
};

const REJECTION_REASON_LABELS: Record<RejectionReason, string> = {
  not_a_fit: 'No encaja con el perfil',
  candidate_withdrew: 'Retirada del candidato',
  other: 'Otro',
  job_closed: 'Oferta cerrada',
};

export function stageLabel(stage: Stage): string {
  return STAGE_LABELS[stage];
}

export function rejectionReasonLabel(reason: RejectionReason): string {
  return REJECTION_REASON_LABELS[reason];
}

/** Groups the items by stage keeping the order received (DD-08); the six stages are always present. */
export function groupByStage(items: readonly PipelineItem[]): Record<Stage, PipelineItem[]> {
  const groups: Record<Stage, PipelineItem[]> = {
    received: [],
    screening: [],
    interview: [],
    offer: [],
    hired: [],
    rejected: [],
  };
  for (const item of items) groups[item.stage].push(item);
  return groups;
}

import type { CompanyProfile } from '@/features/company-profile/types';
import type { StageKind } from '@/features/recruitment-pipelines/types';

/** The five things a brand-new company is walked through, in wizard order. */
export type SetupStep =
    'company' | 'departments' | 'leave-types' | 'recruitment' | 'performance';

/** What the company did with a step. A skip is an answer, not an absence. */
export type StepStatus = 'done' | 'skipped' | 'pending';

/** A suggested department. `code` is what the server resolves it by. */
export type DepartmentBlueprint = {
    code: string;
    name: string;
    description: string;
};

/** A suggested kind of leave, with the entitlement it normally carries. */
export type LeaveTypeBlueprint = {
    code: string;
    name: string;
    description: string;
    color: string;
    default_days: number;
    is_paid: boolean;
    allow_half_day: boolean;
    requires_approval: boolean;
    /** Pre-ticked in the wizard — the set almost every company needs. */
    recommended: boolean;
};

/** A hiring process to start from (ADR 0029). */
export type PipelineBlueprint = {
    key: string;
    name: string;
    description: string;
    stages: { name: string; kind: StageKind }[];
};

/** One weighted part of an appraisal blueprint. */
export type FrameworkSectionBlueprint = {
    key: string;
    name: string;
    description: string;
    weight: number;
};

/** One thing a blueprint measures, resolved to the criterion behind it. */
export type FrameworkItemBlueprint = {
    section: string;
    weight: number;
    name: string;
    description: string;
    /** The instrument it is measured on, e.g. "Competency level". */
    scale: string;
};

/** An appraisal framework to start from (ADR 0028). */
export type FrameworkBlueprint = {
    key: string;
    name: string;
    description: string;
    scale: string;
    result_display: string;
    sections: FrameworkSectionBlueprint[];
    items: FrameworkItemBlueprint[];
};

export type SetupProgress = {
    steps: Record<SetupStep, StepStatus>;
    /** The step the wizard opens on — the first one still unanswered. */
    resume: SetupStep;
    completed: boolean;
};

/** What the company already has, so a step can say so instead of assuming empty. */
export type ExistingConfiguration = {
    departments: string[];
    leaveTypes: string[];
    pipelines: string[];
    frameworks: string[];
};

export type SetupWizardPageProps = {
    company: CompanyProfile;
    progress: SetupProgress;
    blueprints: {
        departments: DepartmentBlueprint[];
        leaveTypes: LeaveTypeBlueprint[];
        pipelines: PipelineBlueprint[];
        frameworks: FrameworkBlueprint[];
    };
    existing: ExistingConfiguration;
    /** Per step, because the five steps are five different permissions. */
    can: Record<SetupStep, boolean>;
};

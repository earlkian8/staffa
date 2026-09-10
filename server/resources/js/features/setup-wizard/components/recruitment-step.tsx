import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    KIND_DOT,
    KIND_LABELS,
} from '@/features/recruitment-pipelines/constants';
import { setupWizardRoutes } from '../routes';
import type { PipelineBlueprint } from '../types';
import AlreadyConfigured from './already-configured';
import ChoiceCard from './choice-card';
import StepBody from './step-body';
import StepFooter from './step-footer';

type Props = {
    blueprints: PipelineBlueprint[];
    existing: string[];
    onSaved: () => void;
    onBack: () => void;
    onSkip: () => void;
    skipping: boolean;
};

/**
 * Step 4 — the hiring process. Each option shows its actual stages rather than a
 * count, because the stages are the whole difference between them.
 *
 * Only one pipeline is created here, and it becomes the company's default. More
 * can be added later — a company that hires interns and executives differently
 * usually wants one process each.
 */
export default function RecruitmentStep({
    blueprints,
    existing,
    onSaved,
    onBack,
    onSkip,
    skipping,
}: Props) {
    const { data, setData, post, processing, errors, clearErrors } = useForm({
        blueprint: blueprints[0]?.key ?? '',
        name: '',
    });

    const chosen = blueprints.find(
        (blueprint) => blueprint.key === data.blueprint,
    );

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        post(setupWizardRoutes.recruitment, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: onSaved,
        });
    };

    return (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <StepBody>
                <AlreadyConfigured
                    names={existing}
                    noun="hiring process"
                    where="Company Setup → Recruitment Pipelines"
                />

                <div className="flex flex-col gap-2.5">
                    {blueprints.map((blueprint) => (
                        <ChoiceCard
                            key={blueprint.key}
                            mode="single"
                            name="pipeline"
                            value={blueprint.key}
                            checked={data.blueprint === blueprint.key}
                            onChange={() => {
                                clearErrors('blueprint');
                                setData('blueprint', blueprint.key);
                            }}
                            title={blueprint.name}
                            description={blueprint.description}
                            aside={`${blueprint.stages.length} stages`}
                        >
                            <span className="mt-1 flex flex-wrap items-center gap-1.5 pl-7">
                                {blueprint.stages.map((stage, index) => (
                                    <span
                                        key={stage.name}
                                        className="flex items-center gap-1.5"
                                    >
                                        {index > 0 && (
                                            <span
                                                aria-hidden
                                                className="text-muted-foreground/40"
                                            >
                                                ›
                                            </span>
                                        )}
                                        <span
                                            title={KIND_LABELS[stage.kind]}
                                            className="inline-flex items-center gap-1.5 rounded-full border border-sidebar-border/70 bg-background px-2 py-0.5 text-[11px] text-foreground dark:border-sidebar-border"
                                        >
                                            <span
                                                aria-hidden
                                                className={`size-1.5 rounded-full ${KIND_DOT[stage.kind]}`}
                                            />
                                            {stage.name}
                                        </span>
                                    </span>
                                ))}
                            </span>
                        </ChoiceCard>
                    ))}
                </div>

                <InputError message={errors.blueprint} />

                <div className="max-w-sm">
                    <Label htmlFor="pipeline-name" className="mb-1.5 block">
                        Call it something else{' '}
                        <span className="text-muted-foreground">
                            (optional)
                        </span>
                    </Label>
                    <Input
                        id="pipeline-name"
                        value={data.name}
                        onChange={(event) =>
                            setData('name', event.target.value)
                        }
                        placeholder={chosen?.name ?? 'Standard Hiring'}
                    />
                    <InputError message={errors.name} className="mt-1.5" />
                </div>

                <p className="text-xs leading-relaxed text-muted-foreground">
                    Stages are yours to rename, reorder and add to afterwards.
                    What recruitment reads is a stage's meaning rather than its
                    name — exactly one stage means hired, at least one means the
                    candidate did not go through, and the rest are in progress.
                </p>
            </StepBody>

            <StepFooter
                onBack={onBack}
                onSkip={onSkip}
                processing={processing}
                skipping={skipping}
                disabled={data.blueprint === ''}
                note={
                    chosen
                        ? `Creates "${data.name.trim() || chosen.name}"`
                        : undefined
                }
            />
        </form>
    );
}

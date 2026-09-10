import { useForm } from '@inertiajs/react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { setupWizardRoutes } from '../routes';
import type { DepartmentBlueprint, DepartmentDraft } from '../types';
import AlreadyConfigured from './already-configured';
import ChoiceCard from './choice-card';
import CustomSection, { CustomRow } from './custom-section';
import StepBody from './step-body';
import StepFooter from './step-footer';

type Props = {
    blueprints: DepartmentBlueprint[];
    existing: string[];
    onSaved: () => void;
    onBack: () => void;
    onSkip: () => void;
    skipping: boolean;
};

/**
 * Step 2 — the org structure. Tick the functions the company has, reword the
 * ones it calls something else, and add the ones only it has.
 *
 * Nothing is pre-ticked: a department list is the one thing on this screen that
 * really is different at every company, and a pre-filled one would be adopted
 * unread. A ticked suggestion is sent as a code and resolved server-side, so its
 * wording is not the client's to decide — **Customise** is how a company says it
 * wants different wording, and moves that department into its own list, where it
 * carries the name, code and description the company gave it.
 */
export default function DepartmentsStep({
    blueprints,
    existing,
    onSaved,
    onBack,
    onSkip,
    skipping,
}: Props) {
    const { data, setData, post, processing, errors, clearErrors, transform } =
        useForm({
            codes: [] as string[],
            custom: [] as DepartmentDraft[],
        });

    const taken = new Set(existing.map((name) => name.toLowerCase()));

    // A suggestion the company has taken over is no longer on offer: it is in
    // the list below, in that company's own words.
    const customised = new Set(
        data.custom
            .map((row) => row.source)
            .filter((code): code is string => code !== null),
    );

    const toggle = (code: string, checked: boolean) => {
        clearErrors('codes');

        setData(
            'codes',
            checked
                ? [...data.codes, code]
                : data.codes.filter((value) => value !== code),
        );
    };

    const setRow = (index: number, patch: Partial<DepartmentDraft>) => {
        setData(
            'custom',
            data.custom.map((row, at) =>
                at === index ? { ...row, ...patch } : row,
            ),
        );
    };

    const addRow = (draft: DepartmentDraft) => {
        clearErrors('codes');
        setData('custom', [...data.custom, draft]);
    };

    /** Take a suggestion over: out of the ticked list, into the company's own. */
    const customise = (blueprint: DepartmentBlueprint) => {
        setData((current) => ({
            codes: current.codes.filter((code) => code !== blueprint.code),
            custom: [
                ...current.custom,
                {
                    name: blueprint.name,
                    code: blueprint.code,
                    description: blueprint.description,
                    source: blueprint.code,
                },
            ],
        }));
    };

    const total =
        data.codes.length +
        data.custom.filter((row) => row.name.trim() !== '').length;

    const submit = (event: React.FormEvent) => {
        event.preventDefault();

        transform((payload) => ({
            ...payload,
            // `source` is the wizard's own bookkeeping — which suggestion a row
            // started as — and means nothing to the server.
            custom: payload.custom.map((row) => ({
                name: row.name,
                code: row.code,
                description: row.description,
            })),
        }));

        post(setupWizardRoutes.departments, {
            preserveScroll: true,
            preserveState: true,
            onSuccess: onSaved,
        });
    };

    const rows = data.custom.map((row, index) => (
        <CustomRow
            // Rows are positional — a typed department has no id until it is saved.
            key={index}
            label={`Department ${index + 1}`}
            removeLabel={`Remove ${row.name || `department ${index + 1}`}`}
            onRemove={() =>
                setData(
                    'custom',
                    data.custom.filter((_, at) => at !== index),
                )
            }
        >
            <div className="flex flex-col gap-2 sm:flex-row">
                <div className="min-w-0 flex-1">
                    <Input
                        value={row.name}
                        onChange={(event) =>
                            setRow(index, { name: event.target.value })
                        }
                        placeholder="Department name"
                        aria-label={`Department ${index + 1} name`}
                        className="bg-background font-medium"
                    />
                    <InputError
                        message={
                            errors[
                                `custom.${index}.name` as keyof typeof errors
                            ]
                        }
                        className="mt-1"
                    />
                </div>
                <div className="w-full sm:w-28">
                    <Input
                        value={row.code}
                        onChange={(event) =>
                            setRow(index, {
                                code: event.target.value.toUpperCase(),
                            })
                        }
                        placeholder="Code"
                        aria-label={`Department ${index + 1} code`}
                        className="bg-background font-mono text-xs uppercase"
                    />
                    <InputError
                        message={
                            errors[
                                `custom.${index}.code` as keyof typeof errors
                            ]
                        }
                        className="mt-1"
                    />
                </div>
            </div>

            <Input
                value={row.description}
                onChange={(event) =>
                    setRow(index, { description: event.target.value })
                }
                placeholder="What this department does (optional)"
                aria-label={`Department ${index + 1} description`}
                className="mt-2 bg-background"
            />
        </CustomRow>
    ));

    return (
        <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <StepBody>
                <AlreadyConfigured
                    names={existing}
                    noun="department"
                    where="Company Setup → Departments"
                />

                <div>
                    <h2 className="text-sm font-semibold">
                        Common departments
                    </h2>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                        Pick the ones your company has. Call one something else
                        with <span className="text-foreground">Customise</span>,
                        and you can nest them and add positions later.
                    </p>

                    <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                        {blueprints.map((blueprint) => {
                            const already = taken.has(
                                blueprint.name.toLowerCase(),
                            );
                            const moved = customised.has(blueprint.code);

                            return (
                                <ChoiceCard
                                    key={blueprint.code}
                                    mode="multiple"
                                    name="departments"
                                    value={blueprint.code}
                                    checked={data.codes.includes(
                                        blueprint.code,
                                    )}
                                    onChange={(checked) =>
                                        toggle(blueprint.code, checked)
                                    }
                                    disabled={already || moved}
                                    title={blueprint.name}
                                    description={blueprint.description}
                                    aside={
                                        already ? (
                                            'Already added'
                                        ) : moved ? (
                                            'In your list'
                                        ) : (
                                            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] tracking-wide">
                                                {blueprint.code}
                                            </code>
                                        )
                                    }
                                    action={
                                        already || moved ? undefined : (
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    customise(blueprint)
                                                }
                                                className="ml-7 text-[11px] font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                                            >
                                                Customise
                                            </button>
                                        )
                                    }
                                />
                            );
                        })}
                    </div>

                    <InputError message={errors.codes} className="mt-2" />
                </div>

                <CustomSection
                    title="Departments you name yourself"
                    hint="Anything the list above doesn't cover, and anything you customised. A short code goes on reports and exports — leave it blank and we'll make one from the name."
                    addLabel="Add a department"
                    empty="Nothing here yet. Everything you add becomes a real department you can nest, staff and post jobs against."
                    onAdd={() =>
                        addRow({
                            name: '',
                            code: '',
                            description: '',
                            source: null,
                        })
                    }
                >
                    {rows.length > 0 ? rows : undefined}
                </CustomSection>
            </StepBody>

            <StepFooter
                onBack={onBack}
                onSkip={onSkip}
                processing={processing}
                skipping={skipping}
                disabled={total === 0}
                note={
                    total === 0
                        ? undefined
                        : `Creates ${total} ${total === 1 ? 'department' : 'departments'}`
                }
            />
        </form>
    );
}

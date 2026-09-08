import { BadgeCheck, ImageOff, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalSection,
} from '@/components/modal';
import { PersonAvatar } from '@/components/person-avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { formatDuration, formatTime, PUNCH_META } from '../constants';
import { attendanceRoutes } from '../routes';
import type { AttendanceRecord, Punch } from '../types';
import { AttendanceStatusBadge } from './attendance-status-badge';
import { PunchTimeline } from './punch-timeline';

type Props = {
    record: AttendanceRecord | null;
    canManage: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onEdit: (record: AttendanceRecord) => void;
    onApprove: (record: AttendanceRecord) => void;
    onDelete: (record: AttendanceRecord) => void;
};

/**
 * One employee's day, opened in the middle of the screen.
 *
 * The day's shape is carried by three fixed regions rather than one long column:
 * the header states who and when, a totals band under it stays put while the body
 * scrolls, and the body splits the audit trail (the punch timeline) from the
 * evidence (the selfies captured at each punch, the remarks, the sign-off).
 *
 * The selfies are the point of the record — they are what makes a mobile punch
 * checkable — so they are shown at a size a face can actually be recognised in,
 * rather than as the 40px thumbnails the timeline used to float beside each row.
 */
export function RecordDetailDialog({
    record,
    canManage,
    open,
    onOpenChange,
    onEdit,
    onApprove,
    onDelete,
}: Props) {
    if (!record) {
        return null;
    }

    return (
        <Modal open={open} onOpenChange={onOpenChange}>
            <ModalContent size="xl">
                <Body
                    key={`${record.hashid ?? record.employee?.id}-${record.work_date}`}
                    record={record}
                    canManage={canManage}
                    onEdit={onEdit}
                    onApprove={onApprove}
                    onDelete={onDelete}
                />
            </ModalContent>
        </Modal>
    );
}

function Body({
    record,
    canManage,
    onEdit,
    onApprove,
    onDelete,
}: {
    record: AttendanceRecord;
    canManage: boolean;
    onEdit: (record: AttendanceRecord) => void;
    onApprove: (record: AttendanceRecord) => void;
    onDelete: (record: AttendanceRecord) => void;
}) {
    const employee = record.employee;
    const [detail, setDetail] = useState<AttendanceRecord>(record);

    // Enrich with the full punch timeline the board list doesn't carry. A
    // transient roster row (no hashid) has nothing to fetch — the keyed remount
    // already seeds `detail` from the record.
    useEffect(() => {
        if (!record.hashid) {
            return;
        }

        let active = true;

        fetch(attendanceRoutes.show(record.hashid), {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                if (active && payload?.data) {
                    setDetail(payload.data as AttendanceRecord);
                }
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [record]);

    const punches = detail.punches ?? [];
    const shots = punches.filter((punch) => punch.photo);
    const hasRecord = Boolean(record.hashid);
    const needsApproval = detail.approval_status === 'pending';
    const approval = detail.approval_status;

    // The rail only earns its column when it has something to hold.
    const hasAside =
        shots.length > 0 || Boolean(detail.remarks) || Boolean(approval);

    return (
        <>
            <ModalHeader
                icon={
                    <PersonAvatar
                        name={employee?.full_name ?? 'Unknown employee'}
                        initials={employee?.initials ?? '?'}
                        photo={employee?.photo}
                        className="size-11 shrink-0"
                        fallbackClassName="text-sm"
                    />
                }
                title={employee?.full_name ?? 'Unknown employee'}
                description={
                    <>
                        {employee?.position?.title ?? 'No position'}
                        {employee?.department
                            ? ` · ${employee.department.name}`
                            : ''}
                    </>
                }
                meta={
                    <>
                        <AttendanceStatusBadge status={record.status} />
                        <span className="text-xs text-muted-foreground">
                            {formatDate(record.work_date)}
                        </span>
                        {record.scheduled_start && record.scheduled_end && (
                            <span className="text-xs text-muted-foreground">
                                Shift {record.scheduled_start}–
                                {record.scheduled_end}
                            </span>
                        )}
                    </>
                }
            />

            {/* The day's totals. Outside the scrolling body, so they stay in
                view while a long timeline is read. */}
            <dl className="flex shrink-0 divide-x divide-border border-b border-border px-5 py-3 sm:px-6">
                <Total
                    label="Worked"
                    value={formatDuration(detail.worked_minutes)}
                />
                <Total
                    label="Break"
                    value={formatDuration(detail.break_minutes)}
                />
                <Total
                    label="Late"
                    value={formatDuration(detail.late_minutes)}
                    tone={
                        detail.late_minutes > 0
                            ? 'text-amber-600 dark:text-amber-400'
                            : undefined
                    }
                />
                <Total
                    label="Overtime"
                    value={formatDuration(detail.overtime_minutes)}
                    tone={
                        detail.overtime_minutes > 0
                            ? 'text-indigo-600 dark:text-indigo-400'
                            : undefined
                    }
                />
            </dl>

            <ModalBody
                className={cn(
                    hasAside &&
                        'lg:grid lg:grid-cols-[minmax(0,1fr)_17rem] lg:items-start lg:gap-x-6',
                )}
            >
                <ModalSection title="Punch timeline">
                    {/* The selfies move to the rail when it is shown, so a row
                        here stays a single line of time, source and place. */}
                    <PunchTimeline punches={punches} withPhotos={!hasAside} />
                </ModalSection>

                {hasAside && (
                    <aside className="mt-6 space-y-5 lg:mt-0">
                        {shots.length > 0 && (
                            <ModalSection
                                title="Verification"
                                hint="Captured by the employee at each punch"
                            >
                                <ul className="grid grid-cols-2 gap-2.5">
                                    {shots.map((punch) => (
                                        <Shot key={punch.id} punch={punch} />
                                    ))}
                                </ul>
                            </ModalSection>
                        )}

                        {detail.remarks && (
                            <ModalSection title="Remarks">
                                <p className="rounded-lg bg-muted/50 px-3 py-2 text-sm whitespace-pre-wrap">
                                    {detail.remarks}
                                </p>
                            </ModalSection>
                        )}

                        {approval && (
                            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <BadgeCheck className="size-3.5 shrink-0" />
                                {approval === 'approved'
                                    ? `Approved${detail.approver ? ` by ${detail.approver}` : ''}`
                                    : `Approval ${approval}`}
                            </p>
                        )}
                    </aside>
                )}
            </ModalBody>

            {canManage && (
                <ModalFooter className="justify-between">
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(record)}
                        >
                            <Pencil className="size-4" />
                            {hasRecord ? 'Correct' : 'Record'}
                        </Button>
                        {hasRecord && (
                            <Button
                                variant="ghost"
                                size="icon"
                                className="size-8 text-muted-foreground hover:text-destructive"
                                aria-label="Delete record"
                                onClick={() => onDelete(record)}
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        )}
                    </div>

                    {needsApproval && (
                        <Button
                            size="sm"
                            className="bg-emerald-600 text-white hover:bg-emerald-600/90"
                            onClick={() => onApprove(record)}
                        >
                            <BadgeCheck className="size-4" />
                            Approve
                        </Button>
                    )}
                </ModalFooter>
            )}
        </>
    );
}

/** One figure in the totals band. */
function Total({
    label,
    value,
    tone,
}: {
    label: string;
    value: string;
    tone?: string;
}) {
    return (
        <div className="min-w-0 flex-1 px-4 first:pl-0 last:pr-0">
            <dt className="truncate text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                {label}
            </dt>
            <dd
                className={cn(
                    'mt-0.5 text-sm font-semibold tabular-nums',
                    tone,
                )}
            >
                {value}
            </dd>
        </div>
    );
}

/**
 * A verification selfie, captioned by the punch it belongs to. A photo that no
 * longer resolves falls back to a labelled tile — a broken-image icon with its
 * alt text spilling across the rail is worse than saying so plainly.
 */
function Shot({ punch }: { punch: Punch }) {
    const meta = PUNCH_META[punch.type];
    const [broken, setBroken] = useState(false);

    const caption = (
        <p className="mt-1 truncate text-[11px] text-muted-foreground">
            {meta.label}
            <span className="ml-1 tabular-nums">
                {formatTime(punch.punched_at)}
            </span>
        </p>
    );

    if (broken) {
        return (
            <li>
                <div
                    className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-lg bg-muted/50 text-muted-foreground ring-1 ring-border"
                    title="This photo is no longer available"
                >
                    <ImageOff className="size-5" />
                    <span className="text-[10px]">Unavailable</span>
                </div>
                {caption}
            </li>
        );
    }

    return (
        <li>
            <a
                href={punch.photo ?? undefined}
                target="_blank"
                rel="noreferrer"
                className="group block overflow-hidden rounded-lg ring-1 ring-border focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            >
                <img
                    src={punch.photo ?? undefined}
                    alt={`${meta.label} selfie`}
                    loading="lazy"
                    onError={() => setBroken(true)}
                    className="aspect-square w-full bg-muted/50 object-cover transition-opacity group-hover:opacity-90"
                />
            </a>
            {caption}
        </li>
    );
}

function formatDate(date: string | null): string {
    if (!date) {
        return '—';
    }

    return new Date(`${date}T00:00:00`).toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}

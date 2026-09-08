import { router } from '@inertiajs/react';
import { Clock3 } from 'lucide-react';
import { useEffect, useState } from 'react';
import {
    Modal,
    ModalBody,
    ModalContent,
    ModalFooter,
    ModalHeader,
    ModalIcon,
} from '@/components/modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { attendanceRoutes } from '../routes';
import type {
    AttendanceRecord,
    EmployeeOption,
    Punch,
    PunchType,
} from '../types';

type Props = {
    record: AttendanceRecord | null;
    employees: EmployeeOption[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

type Times = {
    time_in: string;
    break_start: string;
    break_end: string;
    time_out: string;
};

const EMPTY_TIMES: Times = {
    time_in: '',
    break_start: '',
    break_end: '',
    time_out: '',
};

const PUNCH_TO_FIELD: Record<PunchType, keyof Times> = {
    clock_in: 'time_in',
    break_start: 'break_start',
    break_end: 'break_end',
    clock_out: 'time_out',
};

function localTime(iso: string | null): string {
    if (!iso) {
        return '';
    }

    const d = new Date(iso);

    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/**
 * Recording a day by hand, or correcting one the clock got wrong.
 *
 * The four punches are the form's substance, so they sit on one row from `sm`
 * up — the order they happen in, readable in a glance — rather than stacked two
 * by two down a narrow strip.
 */
export function ManualEntryDialog({
    record,
    employees,
    open,
    onOpenChange,
}: Props) {
    return (
        <Modal open={open} onOpenChange={onOpenChange}>
            <ModalContent size="lg">
                {open && (
                    <Body
                        key={record?.hashid ?? record?.employee?.id ?? 'new'}
                        record={record}
                        employees={employees}
                        onDone={() => onOpenChange(false)}
                    />
                )}
            </ModalContent>
        </Modal>
    );
}

function Body({
    record,
    employees,
    onDone,
}: {
    record: AttendanceRecord | null;
    employees: EmployeeOption[];
    onDone: () => void;
}) {
    const isEdit = Boolean(record?.hashid);
    const lockedEmployee = record?.employee ?? null;
    const today = new Date().toISOString().slice(0, 10);

    const [employeeId, setEmployeeId] = useState<string>(
        lockedEmployee ? String(lockedEmployee.id) : '',
    );
    const [date, setDate] = useState<string>(record?.work_date ?? today);
    const [times, setTimes] = useState<Times>(() => ({
        ...EMPTY_TIMES,
        time_in: localTime(record?.first_in_at ?? null),
        time_out: localTime(record?.last_out_at ?? null),
    }));
    const [remarks, setRemarks] = useState(record?.remarks ?? '');
    const [processing, setProcessing] = useState(false);

    // When editing, pull the full punch set to prefill break times too.
    useEffect(() => {
        if (!record?.hashid) {
            return;
        }

        let active = true;

        fetch(attendanceRoutes.show(record.hashid), {
            headers: { Accept: 'application/json' },
            credentials: 'same-origin',
        })
            .then((response) => (response.ok ? response.json() : null))
            .then((payload) => {
                if (!active || !payload?.data) {
                    return;
                }

                const next = { ...EMPTY_TIMES };
                (payload.data.punches ?? []).forEach((punch: Punch) => {
                    next[PUNCH_TO_FIELD[punch.type]] = localTime(
                        punch.punched_at,
                    );
                });
                setTimes(next);
                setRemarks(payload.data.remarks ?? '');
            })
            .catch(() => undefined);

        return () => {
            active = false;
        };
    }, [record]);

    const setField = (field: keyof Times, value: string) =>
        setTimes((prev) => ({ ...prev, [field]: value }));

    const submit = () => {
        const options = {
            preserveScroll: true,
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => onDone(),
        };

        if (isEdit && record?.hashid) {
            router.post(
                attendanceRoutes.update(record.hashid),
                { ...times, remarks: remarks || null },
                options,
            );
        } else {
            router.post(
                attendanceRoutes.store,
                {
                    employee_id: Number(employeeId),
                    work_date: date,
                    ...times,
                    remarks: remarks || null,
                },
                options,
            );
        }
    };

    const canSubmit = isEdit || (employeeId !== '' && date !== '');
    const needsSubject = !lockedEmployee;

    return (
        <>
            <ModalHeader
                icon={
                    <ModalIcon>
                        <Clock3 />
                    </ModalIcon>
                }
                title={isEdit ? 'Correct attendance' : 'Record attendance'}
                description={
                    lockedEmployee
                        ? `${lockedEmployee.full_name}${record?.work_date ? ` · ${record.work_date}` : ''}`
                        : 'Enter a day the clock missed. Blank times mark the day absent.'
                }
            />

            <ModalBody className="space-y-5">
                {needsSubject && (
                    <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_11rem]">
                        <div className="space-y-1.5">
                            <Label htmlFor="manual-employee">Employee</Label>
                            <Select
                                value={employeeId}
                                onValueChange={setEmployeeId}
                            >
                                <SelectTrigger
                                    id="manual-employee"
                                    className="w-full"
                                >
                                    <SelectValue placeholder="Select an employee" />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map((employee) => (
                                        <SelectItem
                                            key={employee.id}
                                            value={String(employee.id)}
                                        >
                                            {employee.full_name} ·{' '}
                                            {employee.employee_no}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {!isEdit && (
                            <div className="space-y-1.5">
                                <Label htmlFor="manual-date">Date</Label>
                                <Input
                                    id="manual-date"
                                    type="date"
                                    value={date}
                                    max={today}
                                    onChange={(event) =>
                                        setDate(event.target.value)
                                    }
                                />
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <TimeField
                            id="manual-time-in"
                            label="Time in"
                            value={times.time_in}
                            onChange={(v) => setField('time_in', v)}
                        />
                        <TimeField
                            id="manual-break-start"
                            label="Break start"
                            value={times.break_start}
                            onChange={(v) => setField('break_start', v)}
                        />
                        <TimeField
                            id="manual-break-end"
                            label="Break end"
                            value={times.break_end}
                            onChange={(v) => setField('break_end', v)}
                        />
                        <TimeField
                            id="manual-time-out"
                            label="Time out"
                            value={times.time_out}
                            onChange={(v) => setField('time_out', v)}
                        />
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Worked hours, lateness and overtime are computed against
                        the employee&apos;s schedule.
                    </p>
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="manual-remarks">
                        Remarks{' '}
                        <span className="font-normal text-muted-foreground">
                            (optional)
                        </span>
                    </Label>
                    <textarea
                        id="manual-remarks"
                        value={remarks}
                        onChange={(event) => setRemarks(event.target.value)}
                        rows={2}
                        placeholder="Reason for the manual entry / correction…"
                        className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/30"
                    />
                </div>
            </ModalBody>

            <ModalFooter>
                <Button variant="ghost" onClick={onDone} disabled={processing}>
                    Cancel
                </Button>
                <Button onClick={submit} disabled={!canSubmit || processing}>
                    {processing && <Spinner />}
                    {isEdit ? 'Save correction' : 'Save record'}
                </Button>
            </ModalFooter>
        </>
    );
}

function TimeField({
    id,
    label,
    value,
    onChange,
}: {
    id: string;
    label: string;
    value: string;
    onChange: (value: string) => void;
}) {
    return (
        <div className="space-y-1.5">
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="time"
                value={value}
                onChange={(event) => onChange(event.target.value)}
            />
        </div>
    );
}

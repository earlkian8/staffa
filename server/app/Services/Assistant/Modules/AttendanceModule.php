<?php

namespace App\Services\Assistant\Modules;

use App\Models\AttendanceRecord;
use App\Models\Employee;
use App\Models\User;
use App\Queries\AttendanceRangeQuery;
use App\Services\Assistant\Contracts\ContributesContext;
use App\Services\Assistant\Retrieval\ContextSection;
use App\Services\Assistant\Retrieval\RetrievedSubject;
use App\Services\Assistant\ToolResult;
use App\Support\ActivityLogger;
use App\Support\Attendance\AttendanceClock;
use App\Support\Attendance\AttendancePunchException;
use App\Support\OrganizationClock;
use Carbon\CarbonImmutable;
use Illuminate\Support\Carbon;

/**
 * Attendance capability: look up an employee's Daily Time Records and record a
 * clock punch on their behalf. Every punch goes through {@see AttendanceClock} —
 * the same engine the web and mobile API use — so totals and status stay correct.
 */
class AttendanceModule extends Module implements ContributesContext
{
    public function __construct(private readonly AttendanceClock $clock) {}

    public function key(): string
    {
        return 'attendance';
    }

    public function isAvailable(User $user): bool
    {
        return $user->can('attendance.view');
    }

    protected function toolMap(): array
    {
        return [
            'find_attendance' => 'findAttendance',
            'record_punch' => 'recordPunch',
        ];
    }

    public function run(User $user, string $tool, array $args): ToolResult
    {
        return $this->{$this->toolMap()[$tool]}($user, $args);
    }

    /** How far back an attendance read-out looks when nobody says otherwise. */
    private const CONTEXT_DAYS = 30;

    /** Statuses that mean the employee showed up. */
    private const PRESENT_STATUSES = ['present', 'late', 'undertime', 'incomplete'];

    /**
     * How this person has actually been turning up — the closest thing the
     * assistant has to an answer for "how are they doing?".
     *
     * It is built from the same day-matrix the weekly grid and the monthly
     * report are built from ({@see AttendanceRangeQuery}), so a day with no
     * record still counts as the absence or the rest day it was, rather than
     * quietly not existing. A read-out from saved punches alone would flatter
     * everybody who never clocked in at all.
     *
     * Their own DTR is readable without `attendance.view`, because
     * `/attendance/me` is.
     */
    public function contextFor(User $user, RetrievedSubject $subject): ?ContextSection
    {
        $employee = $subject->employeeModel();

        if ($employee === null || (! $subject->isSelf && $user->cannot('attendance.view'))) {
            return null;
        }

        $end = CarbonImmutable::parse(OrganizationClock::today());
        $start = $end->subDays(self::CONTEXT_DAYS - 1);

        $row = app(AttendanceRangeQuery::class)
            ->days($start->toDateString(), $end->toDateString(), null, (string) $employee->employee_no)
            ->first(fn (array $row): bool => $row['employee']->id === $employee->id);

        $cells = array_values(array_filter(
            $row['cells'] ?? [],
            fn (array $cell): bool => ! $cell['is_future'] && $cell['status'] !== null,
        ));

        if ($cells === []) {
            return null;
        }

        $counts = [];
        $lateMinutes = 0;
        $overtimeMinutes = 0;
        $workedMinutes = 0;
        $worked = 0;

        foreach ($cells as $cell) {
            $counts[$cell['status']] = ($counts[$cell['status']] ?? 0) + 1;
            $lateMinutes += (int) $cell['late_minutes'];
            $overtimeMinutes += (int) $cell['overtime_minutes'];

            if (in_array($cell['status'], self::PRESENT_STATUSES, true)) {
                $worked++;
                $workedMinutes += (int) $cell['worked_minutes'];
            }
        }

        $scheduled = $worked + ($counts['absent'] ?? 0);
        $late = $counts['late'] ?? 0;

        $recent = array_slice(array_reverse($cells), 0, 5);

        return ContextSection::of('Attendance (last '.self::CONTEXT_DAYS.' days)', [
            'Window: '.$start->toDateString().' to '.$end->toDateString().', '.count($cells).' days accounted for',
            'Worked '.$worked.' of '.$scheduled.' scheduled days'.($scheduled > 0 ? ' ('.round($worked / $scheduled * 100).'% attendance)' : ''),
            'Late on '.$late.' of those days'.($worked > 0 ? ' ('.round(($worked - $late) / $worked * 100).'% on time)' : '').
                ($lateMinutes > 0 ? ', '.$this->hours($lateMinutes).' late in total' : ''),
            ($counts['absent'] ?? 0) > 0 ? 'Absent '.$counts['absent'].' day'.($counts['absent'] === 1 ? '' : 's') : 'No unexplained absences',
            ($counts['on_leave'] ?? 0) > 0 ? 'On approved leave '.$counts['on_leave'].' day'.($counts['on_leave'] === 1 ? '' : 's') : null,
            ($counts['holiday'] ?? 0) > 0 ? 'Public holidays (not scheduled) '.$counts['holiday'].' day'.($counts['holiday'] === 1 ? '' : 's') : null,
            ($counts['incomplete'] ?? 0) > 0 ? 'Missing a clock-out on '.$counts['incomplete'].' day'.($counts['incomplete'] === 1 ? '' : 's') : null,
            $worked > 0 ? 'Averaging '.$this->hours((int) round($workedMinutes / $worked)).' worked per day' : null,
            $overtimeMinutes > 0 ? $this->hours($overtimeMinutes).' of overtime' : null,
            'Most recent days — '.implode('; ', array_map(
                fn (array $cell): string => $cell['date'].': '.str_replace('_', ' ', (string) $cell['status']).
                    ((int) $cell['late_minutes'] > 0 ? ' ('.$this->hours((int) $cell['late_minutes']).' late)' : ''),
                $recent,
            )),
        ]);
    }

    /**
     * Minutes as the hours and minutes a person would say out loud.
     */
    private function hours(int $minutes): string
    {
        if ($minutes < 60) {
            return $minutes.'m';
        }

        $rest = $minutes % 60;

        return intdiv($minutes, 60).'h'.($rest > 0 ? ' '.$rest.'m' : '');
    }

    public function guidance(User $user): string
    {
        return <<<'TXT'
        ATTENDANCE — Daily Time Records (DTR): one record per employee per day, built from clock in/out and break punches. Worked hours, lateness, undertime and overtime are computed server-side against the employee's work schedule.
        - find_attendance lists an employee's recent records (pass `date` as YYYY-MM-DD for one specific day).
        - record_punch logs a clock punch for an employee: type is clock_in, clock_out, break_start or break_end. Punch order is validated (you can't clock out before clocking in). Punches are timed on the organisation's clock and filed under the shift they belong to — a night shift's clock-out after midnight closes the previous evening's day.
        - Pass `employee` as a name or employee number.
        TXT;
    }

    public function tools(User $user): array
    {
        return [
            [
                'name' => 'find_attendance',
                'description' => "List an employee's daily time records, most recent first.",
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'employee' => ['type' => 'STRING', 'description' => 'Employee name or employee number.'],
                        'date' => ['type' => 'STRING', 'description' => 'YYYY-MM-DD to fetch a single day (optional).'],
                    ],
                    'required' => ['employee'],
                ],
            ],
            [
                'name' => 'record_punch',
                'description' => 'Record a clock punch (in/out or break) for an employee.',
                'parameters' => [
                    'type' => 'OBJECT',
                    'properties' => [
                        'employee' => ['type' => 'STRING', 'description' => 'Employee name or employee number.'],
                        'type' => ['type' => 'STRING', 'enum' => ['clock_in', 'clock_out', 'break_start', 'break_end']],
                    ],
                    'required' => ['employee', 'type'],
                ],
            ],
        ];
    }

    // ── Tools ────────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $args
     */
    private function findAttendance(User $user, array $args): ToolResult
    {
        $employee = $this->locateEmployee($args);

        if (! $employee) {
            return ToolResult::error('Looked up the employee', 'No matching employee found.');
        }

        $date = $this->date($args['date'] ?? null);

        $records = AttendanceRecord::query()
            ->with('employee')
            ->where('employee_id', $employee->id)
            ->when($date, fn ($q) => $q->whereDate('work_date', $date))
            ->orderByDesc('work_date')
            ->limit($date ? 1 : 7)
            ->get();

        $cards = $records->map(fn (AttendanceRecord $r): array => $this->recordCard($r, 'find', 'neutral'))->all();

        return ToolResult::found("Attendance for {$employee->full_name}", count($cards).' day'.(count($cards) === 1 ? '' : 's'), $cards);
    }

    /**
     * @param  array<string, mixed>  $args
     */
    private function recordPunch(User $user, array $args): ToolResult
    {
        if ($user->cannot('attendance.manage')) {
            return $this->denied('record attendance punches');
        }

        $employee = $this->locateEmployee($args);

        if (! $employee) {
            return ToolResult::error('Looked up the employee', 'No matching employee found.');
        }

        $type = strtolower(trim((string) ($args['type'] ?? '')));

        try {
            $record = $this->clock->punch($employee, $type, ['source' => 'manual', 'recorded_by' => $user->id]);
        } catch (AttendancePunchException $e) {
            return ToolResult::error('Recorded the punch', $e->getMessage());
        }

        ActivityLogger::log(
            event: 'updated',
            description: "Recorded {$type} for {$employee->full_name} via assistant",
            subject: $record,
            logName: 'attendance',
            subjectLabel: $employee->full_name,
        );

        $record->setRelation('employee', $employee);

        return ToolResult::ok(
            $this->label($type)." for {$employee->full_name}",
            $record->status,
            $this->recordCard($record, 'add', 'positive'),
        );
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @param  array<string, mixed>  $args
     */
    private function locateEmployee(array $args): ?Employee
    {
        $needle = $this->firstFilled($args, ['employee', 'match', 'employee_name', 'name']);

        return $needle ? $this->matchByTokens(Employee::query(), $needle)->first() : null;
    }

    private function date(mixed $value): ?string
    {
        $value = trim((string) $value);

        if ($value === '') {
            return null;
        }

        try {
            return Carbon::parse($value)->toDateString();
        } catch (\Throwable) {
            return null;
        }
    }

    private function label(string $type): string
    {
        return match ($type) {
            'clock_in' => 'Clocked in',
            'clock_out' => 'Clocked out',
            'break_start' => 'Started break',
            'break_end' => 'Ended break',
            default => 'Punched',
        };
    }

    /**
     * @return array<string, mixed>
     */
    private function recordCard(AttendanceRecord $record, string $kind, string $tone): array
    {
        $employee = $record->employee;
        $in = $record->first_in_at ? OrganizationClock::local($record->first_in_at)->format('g:i A') : '—';
        $out = $record->last_out_at ? OrganizationClock::local($record->last_out_at)->format('g:i A') : '—';
        $hours = round($record->worked_minutes / 60, 1);

        return $this->card(
            kind: $kind,
            tone: $tone,
            badge: ucfirst(str_replace('_', ' ', $record->status)),
            title: $employee?->full_name ?? 'Employee',
            subtitle: $record->work_date->format('D, M j')." · {$in} – {$out}",
            meta: ["{$hours} h", $record->late_minutes > 0 ? "{$record->late_minutes}m late" : '', $record->overtime_minutes > 0 ? "{$record->overtime_minutes}m OT" : ''],
            avatar: $employee
                ? ['name' => $employee->full_name, 'initials' => $employee->initials(), 'photo' => $employee->photo_url]
                : null,
            id: $record->id,
        );
    }
}

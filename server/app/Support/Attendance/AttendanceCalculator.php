<?php

namespace App\Support\Attendance;

use App\Models\AttendancePunch;
use App\Models\AttendanceRecord;
use App\Models\WorkSchedule;
use Carbon\CarbonImmutable;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * Derives an {@see AttendanceRecord}'s summary from its punch events and the
 * {@see DayRules} frozen onto it: worked / break minutes, lateness, undertime,
 * overtime and the daily status. Pure and side-effect-free apart from mutating
 * the passed record's attributes (the caller persists) — it never reads the
 * database, the clock, or the employee's current schedule.
 *
 * The shift is read from the record's `scheduled_start_at` / `scheduled_end_at`:
 * instants worked out in the organisation's zone when the day opened, so a night
 * shift's 06:00 end is the next morning rather than sixteen hours before it
 * started (ADR 0036).
 *
 * Time arithmetic is done on UNIX timestamps so it is agnostic to the app's
 * mutable/immutable date setting (the app uses {@see CarbonImmutable}).
 */
class AttendanceCalculator
{
    /**
     * Recompute every derived field on the record from its (chronological)
     * punches and the day's rules. Does not save — the caller does.
     */
    public static function recompute(AttendanceRecord $record, DayRules $rules, bool $onApprovedLeave = false): void
    {
        /** @var Collection<int, AttendancePunch> $punches */
        $punches = $record->punches instanceof Collection
            ? $record->punches->sortBy(['punched_at', 'id'])->values()
            : collect();

        $firstIn = $punches->firstWhere('type', 'clock_in')?->punched_at;
        $lastOut = $punches->where('type', 'clock_out')->last()?->punched_at;

        [$worked, $break] = self::accumulate($punches);

        $scheduledStart = $record->scheduled_start_at;
        $scheduledEnd = $record->scheduled_end_at;

        $late = ($firstIn && $scheduledStart)
            ? max(0, intdiv($firstIn->getTimestamp() - ($scheduledStart->getTimestamp() + $rules->graceMinutes * 60), 60))
            : 0;

        $undertime = ($lastOut && $scheduledEnd && $lastOut->lt($scheduledEnd))
            ? self::minutesBetween($lastOut, $scheduledEnd)
            : 0;

        $overtime = max(0, $worked - $rules->requiredMinutes);

        $record->first_in_at = $firstIn;
        $record->last_out_at = $lastOut;
        $record->worked_minutes = $worked;
        $record->break_minutes = $break;
        $record->late_minutes = $late;
        $record->undertime_minutes = $undertime;
        $record->overtime_minutes = $overtime;
        $record->status = self::status($record, $rules, $onApprovedLeave, $punches->isNotEmpty());
    }

    /**
     * What a day with no punches is. Excused by approved leave; otherwise a
     * holiday nobody is expected to work; otherwise a rest day; and only then an
     * absence. A `special_working` holiday is an ordinary working day.
     *
     * Public because the roster queries synthesise a status for days that have no
     * record, and they must reach the same verdict a record would.
     */
    public static function noPunchStatus(DayRules $rules, bool $onApprovedLeave): string
    {
        return match (true) {
            $onApprovedLeave => 'on_leave',
            $rules->isNonWorkingHoliday() => 'holiday',
            ! $rules->isWorkingDay => 'day_off',
            default => 'absent',
        };
    }

    /**
     * Walk the punches as a state machine, accumulating on-the-clock minutes
     * (excluding breaks) and break minutes. Returns [worked, break].
     *
     * @param  Collection<int, AttendancePunch>  $punches
     * @return array{0: int, 1: int}
     */
    private static function accumulate(Collection $punches): array
    {
        $worked = 0;
        $break = 0;
        $prev = null;
        $onClock = false;
        $onBreak = false;

        foreach ($punches as $punch) {
            if ($prev !== null) {
                $minutes = self::minutesBetween($prev, $punch->punched_at);

                if ($onClock && $onBreak) {
                    $break += $minutes;
                } elseif ($onClock) {
                    $worked += $minutes;
                }
            }

            match ($punch->type) {
                'clock_in' => $onClock = true,
                'clock_out' => [$onClock, $onBreak] = [false, false],
                'break_start' => $onBreak = true,
                'break_end' => $onBreak = false,
                default => null,
            };

            $prev = $punch->punched_at;
        }

        return [$worked, $break];
    }

    /**
     * Derive the daily status. A no-punch day resolves through
     * {@see noPunchStatus()}; an open day (clocked in, never out) is incomplete;
     * otherwise the late / undertime flags drive present vs late vs undertime. A
     * holiday somebody worked is judged like any other day.
     */
    private static function status(AttendanceRecord $record, DayRules $rules, bool $onApprovedLeave, bool $hasPunches): string
    {
        if (! $hasPunches) {
            return self::noPunchStatus($rules, $onApprovedLeave);
        }

        if ($record->first_in_at && ! $record->last_out_at) {
            return 'incomplete';
        }

        if ($record->late_minutes > 0) {
            return 'late';
        }

        if ($record->undertime_minutes > 0) {
            return 'undertime';
        }

        return 'present';
    }

    /**
     * Whether the given date is a scheduled working day. Falls back to Mon–Fri
     * when no schedule (or no work_days) is set. Work days are stored as short
     * names, e.g. ["Mon","Tue",...]. The date is a calendar date, so its weekday
     * is the organisation's.
     */
    public static function isWorkingDay(CarbonInterface $date, ?WorkSchedule $schedule): bool
    {
        $days = $schedule?->work_days;

        if (! is_array($days) || $days === []) {
            return ! $date->isWeekend();
        }

        return in_array($date->format('D'), $days, true);
    }

    /**
     * Whole minutes between two moments (b − a), clamped at zero.
     */
    private static function minutesBetween(CarbonInterface $a, CarbonInterface $b): int
    {
        return max(0, intdiv($b->getTimestamp() - $a->getTimestamp(), 60));
    }
}

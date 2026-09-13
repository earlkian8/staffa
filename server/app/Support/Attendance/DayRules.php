<?php

namespace App\Support\Attendance;

use App\Models\Holiday;
use App\Models\WorkSchedule;
use Carbon\CarbonImmutable;

/**
 * The rules one attendance day is judged by, frozen onto its record when the day
 * opens (`attendance_records.rules`, ADR 0036).
 *
 * Before the snapshot a recompute read the employee's *current* schedule, so
 * editing a schedule's grace — or moving somebody to another shift — quietly
 * re-judged every past day the next time anyone corrected it. Frozen, a day's
 * verdict is a fact about that day. It changes only when HR deliberately
 * re-applies the current schedule ({@see AttendanceClock::reapplySchedule()}).
 *
 * The holiday is part of the snapshot for the same reason, and so the calculator
 * never has to look one up: it stays a pure function of the punches and these
 * rules.
 *
 * Versioned, so later phases grow it in the same column; {@see fromArray()} gives
 * any key an older snapshot lacks its default.
 */
final readonly class DayRules
{
    public const VERSION = 1;

    /** What a day requires when no schedule says otherwise — the historical eight hours. */
    public const DEFAULT_REQUIRED_MINUTES = 480;

    public function __construct(
        public int $graceMinutes,
        public int $requiredMinutes,
        public bool $isWorkingDay,
        public ?int $workScheduleId = null,
        public ?string $scheduleName = null,
        public ?string $holidayType = null,
        public ?string $holidayName = null,
    ) {}

    /**
     * The rules a schedule (or the lack of one) sets for a work date, with the
     * holiday that falls on it.
     */
    public static function fromSchedule(?WorkSchedule $schedule, string $date, ?Holiday $holiday = null): self
    {
        return new self(
            graceMinutes: (int) ($schedule?->grace_minutes ?? 0),
            requiredMinutes: $schedule?->required_hours !== null
                ? (int) round((float) $schedule->required_hours * 60)
                : self::DEFAULT_REQUIRED_MINUTES,
            isWorkingDay: AttendanceCalculator::isWorkingDay(CarbonImmutable::parse($date), $schedule),
            workScheduleId: $schedule?->id,
            scheduleName: $schedule?->name,
            holidayType: $holiday?->type,
            holidayName: $holiday?->name,
        );
    }

    /**
     * Read a stored snapshot back.
     *
     * @param  array<string, mixed>  $rules
     */
    public static function fromArray(array $rules): self
    {
        return new self(
            graceMinutes: (int) ($rules['grace_minutes'] ?? 0),
            requiredMinutes: (int) ($rules['required_minutes'] ?? self::DEFAULT_REQUIRED_MINUTES),
            isWorkingDay: (bool) ($rules['is_working_day'] ?? true),
            workScheduleId: isset($rules['work_schedule_id']) ? (int) $rules['work_schedule_id'] : null,
            scheduleName: isset($rules['schedule_name']) ? (string) $rules['schedule_name'] : null,
            holidayType: isset($rules['holiday_type']) ? (string) $rules['holiday_type'] : null,
            holidayName: isset($rules['holiday_name']) ? (string) $rules['holiday_name'] : null,
        );
    }

    /**
     * The snapshot as it is stored.
     *
     * @return array{version: int, grace_minutes: int, required_minutes: int, is_working_day: bool, work_schedule_id: ?int, schedule_name: ?string, holiday_type: ?string, holiday_name: ?string}
     */
    public function toArray(): array
    {
        return [
            'version' => self::VERSION,
            'grace_minutes' => $this->graceMinutes,
            'required_minutes' => $this->requiredMinutes,
            'is_working_day' => $this->isWorkingDay,
            'work_schedule_id' => $this->workScheduleId,
            'schedule_name' => $this->scheduleName,
            'holiday_type' => $this->holidayType,
            'holiday_name' => $this->holidayName,
        ];
    }

    /**
     * Whether the day is a holiday nobody is expected to work — `regular` or
     * `special_non_working`. A `special_working` holiday is an ordinary working
     * day, as it is for Leave.
     */
    public function isNonWorkingHoliday(): bool
    {
        return $this->holidayType !== null && in_array($this->holidayType, Holiday::NON_WORKING_TYPES, true);
    }
}

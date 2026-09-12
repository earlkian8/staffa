<?php

namespace App\Services\Assistant\Retrieval;

/**
 * One module's contribution to a {@see ContextBrief} — the slice of a subject's
 * record that module owns, already reduced to lines a model can read.
 *
 * A section is written, not queried, at read time: the module has already
 * checked the asker's permission and applied whatever disclosure policy governs
 * its data, so everything here is safe to put in front of the model. `source` is
 * also what the chat timeline names, so it should read as a place a person could
 * go and check — "Attendance (last 30 days)", not "attendance_records".
 */
final class ContextSection
{
    /**
     * @param  list<string>  $lines
     */
    public function __construct(
        public readonly string $source,
        public readonly array $lines,
        /** A caveat the model should carry into its answer, if any. */
        public readonly ?string $note = null,
    ) {}

    /**
     * @param  list<string|null>  $lines
     */
    public static function of(string $source, array $lines, ?string $note = null): self
    {
        return new self(
            $source,
            array_values(array_filter(array_map(
                fn (?string $line): ?string => filled($line) ? trim((string) $line) : null,
                $lines,
            ), fn (?string $line): bool => $line !== null && $line !== '')),
            $note,
        );
    }

    public function isEmpty(): bool
    {
        return $this->lines === [];
    }

    public function toPrompt(): string
    {
        $body = implode("\n", array_map(fn (string $line): string => '- '.$line, $this->lines));

        if ($this->note !== null) {
            $body .= "\n- Note: ".$this->note;
        }

        return "## {$this->source}\n{$body}";
    }
}

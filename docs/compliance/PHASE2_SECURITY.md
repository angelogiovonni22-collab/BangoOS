# Phase 2 Security Controls

- Public cancellation requires a validated secure contract token.
- Company-scoped compliance profiles use RLS for authenticated members.
- Cancellation evidence is preserved separately from mutable profile state.
- Server-side send and work-start controls are authoritative; UI state is informational.
- Timely cancellation places the related project on an indefinite compliance hold.
- Expired cancellation holds release only through a guarded server/database operation and never when cancellation is recorded.

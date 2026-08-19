begin;

-- B.O.S. no longer uses a second email-verification step for estimate contracts.
-- Any still-pending legacy verification token must be made inert so it cannot be
-- replayed against the retired endpoint or mistaken for a current legal action.
update public.estimate_contract_verifications
   set status = 'expired',
       updated_at = now()
 where status = 'pending';

commit;

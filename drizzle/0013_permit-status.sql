-- Do you have a seller's permit, asked on the application. Not the number.
--
-- The paperwork step is gone from the form: it asked for tax documents before
-- anyone had said yes, and none of it reached the jury. But the team wants to
-- know what is coming, and there is a real reason to: outdoor makers sell for
-- their own account, and CDTFA Publication 111 penalises us per seller we
-- cannot show a permit record for.
--
-- So the application asks the question and not the document. The number is
-- collected after acceptance, when a maker has a reason to go and find it.
--
-- Only outdoor and both are asked. An indoor maker does not need a permit at
-- all, because Mermade is the retailer of record for their sales (agreement
-- 6.2), and asking would imply otherwise.
--
-- Safe to run twice.
ALTER TABLE applications ADD COLUMN IF NOT EXISTS permit_status text;

COMMENT ON COLUMN applications.permit_status IS
  'have | occasional | unsure. Asked of outdoor applicants. NULL for indoor, who do not need a permit. The permit number itself is collected after acceptance.';

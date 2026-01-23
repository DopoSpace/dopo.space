-- Add provider_event_id column for webhook idempotency
ALTER TABLE "payment_logs" ADD COLUMN "provider_event_id" TEXT;

-- Create unique index for idempotency (allows NULL values)
CREATE UNIQUE INDEX "payment_logs_provider_event_id_key" ON "payment_logs"("provider_event_id");

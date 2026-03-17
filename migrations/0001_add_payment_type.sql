-- Add payment_type column to user_subscriptions
-- Values: 'subscription' (recurring) | 'one_time' (single payment, expires at current_period_end)
ALTER TABLE user_subscriptions ADD COLUMN payment_type TEXT DEFAULT 'subscription';

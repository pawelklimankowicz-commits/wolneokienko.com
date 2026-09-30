-- =====================================================================
-- Limity wysyłki kodów SMS niezależne od numeru (src/serwer/kody-sms.ts):
-- na adres IP i łącznie na godzinę. Bez nich ktoś mógłby wyczerpać punkty
-- SMSAPI, zamawiając kody na wiele różnych numerów.
--
-- Adresu IP nie przechowujemy — tylko jego HMAC z pieprzem (jak kody).
-- =====================================================================

alter table public.kody_sms add column ip_skrot text;

create index kody_sms_ip on public.kody_sms (ip_skrot, created_at desc) where ip_skrot is not null;
create index kody_sms_created on public.kody_sms (created_at desc);

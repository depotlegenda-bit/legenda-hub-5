
CREATE POLICY "pic_daily_photos read authenticated"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pic-daily-photos');

CREATE POLICY "pic_daily_photos insert own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'pic-daily-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "pic_daily_photos update own folder"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'pic-daily-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "pic_daily_photos delete own folder"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'pic-daily-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

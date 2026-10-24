# Hajiri Lagao — Bug Repair & Login UI Update

## Video mein confirm hue issues
1. `column attendance.rejection_reason does not exist`
2. `Could not find the function public.review_advance_request(...) in the schema cache`

Nayi migration `supabase/migrations/20261024160000_repair_attendance_and_advance_review.sql` in dono issues ko repair karti hai aur in-app kharchi review/confirm/dispute RPCs ko current frontend ke saath align karti hai.

## Safe deployment order

1. **Supabase backup:** Supabase Dashboard → Database → Backups (ya available backup/export option). Production data ke liye backup skip na karein.
2. Supabase → SQL Editor → New query.
3. File `supabase/migrations/20261024160000_repair_attendance_and_advance_review.sql` ka poora SQL paste karke Run karein. Yeh migration idempotent banayi gayi hai, lekin ise same Supabase project par run karein jo Vercel se connected hai.
4. Agar error aaye to andaze se doosra SQL na chalayein; poora error text/screenshot save karein.
5. GitHub par is ZIP ka code update/commit karein. Existing repository ke root par `src/`, `supabase/`, `package.json` wagairah merge karein; duplicate nested `Hajiri-Lagao-App/Hajiri-Lagao-App` folder na banayein.
6. Vercel → Deployments mein latest commit ka deployment Ready ho. `VITE_SUPABASE_URL` aur `VITE_SUPABASE_ANON_KEY` wahi Supabase project ke hon. Frontend mein service_role/secret key kabhi na daalein.
7. Mobile Incognito browser mein login karke test karein:
   - Existing Gmail → existing saved role/dashboard
   - New Gmail → first-time profile setup
   - Attendance request approve/reject
   - Kharchi request approve/reject
   - Mazdoor side: pending advance confirm/dispute

## Important notes
- Login page redesign sirf UI/UX hai; Google OAuth ko Supabase Authentication → Providers → Google aur redirect URLs (`https://hajiri-lagao.vercel.app/**` ke relevant callback) sahi set hone chahiye.
- SQL `review_advance_request` ke RPC argument keys ko frontend ke saath same rakhta hai: `p_approve`, `p_note`, `p_request_id`.
- Is repair migration mein OTP/NFC data delete nahi kiya jaata. Legacy cleanup alag migration mein hai; production backup aur verification ke baad hi destructive cleanup run karein.
- Source syntax aur package integrity check karni chahiye; live Supabase/Auth/permission tests sirf project ke real environment mein confirm hote hain.

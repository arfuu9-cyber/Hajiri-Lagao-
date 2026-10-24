# Hajiri Lagao — Mobile UI, NFC Removal aur Kharchi Confirmation (Hindi Setup)

Is package mein tumhari existing React + TypeScript + Vite + Supabase app rakhi gayi hai. App ko scratch se rebuild nahi kiya gaya. Login screen ko mobile-first layout diya hai, NFC feature ko app se hataaya hai aur kharchi confirmation ko SMS code ke bajaye authenticated in-app confirmation/dispute se replace kiya hai.

## Is update mein kya badla hai

- Login page ka layout visibly refresh kiya: cleaner branding, readable benefit cards, prominent Google login button, loading/error state aur small-screen spacing.
- NFC attendance/card-assignment screen, quick actions, related service, Android NFC permissions aur CSV NFC field hata diye.
- Supabase migration purane worker NFC column ko drop karne se pehle worker-protection trigger ko update karti hai.
- Thekedar kharchi record karta hai; linked Mazdoor apne Google-login account se `Maine le li` confirm kare ya amount par dikkat report kare.
- Sirf `verified` kharchi payroll se kategi. `pending` ya `disputed` entries deduction mein count nahi hongi.
- In-app confirmation RPC server par check karti hai ki signed-in account ka `workers.user_id` usi Mazdoor record se match ho. Client-side button akela doosre worker ka advance confirm nahi kar sakta.
- Registration, attendance, team connections, payroll aur baki screens existing features ke roop mein preserve kiye hain.

## 1. GitHub aur Vercel update

1. ZIP extract karo.
2. Extracted project files ko apni existing GitHub repository ke root mein update/push karo. Existing `.env` ya Vercel settings ko repository mein secrets ke roop mein mat daalna.
3. Commit ke baad Vercel ka deployment complete hone do.
4. Website ko Chrome Incognito mein kholo ya site data clear karke test karo.

## 2. Supabase migration

Supabase Dashboard → **SQL Editor** mein is project ke pending migrations ko order mein apply karo. Jo migration pehle successfully apply ho chuki ho, use andaze se dobara run mat karo.

Is update ka naya migration:

`supabase/migrations/20261024130000_in_app_advance_confirmation_and_disputes.sql`

Yeh in-app confirmation/dispute functions banata hai, `advances.status` mein `disputed` allow karta hai, legacy NFC field, kharchi ke purane OTP code/expiry columns aur unused `auth_otp_codes` table ko remove karta hai. Isse tab apply karo jab base `workers`/`advances` tables, `workers.user_id`, `workers.invite_code` aur secure/team-connection migrations already apply ho chuki hon. Is SQL ko production se pehle backup ke baad hi run karo. Agar Supabase Edge Functions mein `advance-otp` naam ka function pehle deploy kiya tha, use Dashboard se disable/delete bhi karo; is app build mein uska koi call nahi hai.

Vercel ka `VITE_SUPABASE_URL` usi Supabase project ko point karna chahiye jahan migration apply ki. Frontend mein sirf `VITE_SUPABASE_ANON_KEY` (publishable/anon key) use karo; `service_role`/secret key kabhi frontend par mat rakho.

## 3. Kharchi in-app confirmation test

Pehle real payroll nahi, test worker aur chhoti test amount use karo.

1. Thekedar login se aise Mazdoor ko kharchi add karo jo app mein apne account se linked/approved ho.
2. Mazdoor ke Google account se login karo. Uske Home screen par pending confirmation dikhni chahiye.
3. Sahi test amount par `Maine le li` press karo. Hisaab mein entry `verified` honi chahiye aur payroll deduction mein include honi chahiye.
4. Doosri test advance par `Rashi galat hai` select karke reason bhejo. Entry `disputed` honi chahiye aur payroll se deduct nahi honi chahiye.
5. Kisi doosre Google account se pehle worker ki advance confirm karne ki koshish na karein; RPC ko reject karna chahiye.

Agar worker apne account mein pending advance nahi dekhta, pehle **Team & Invite** mein uski connection request approve karo aur verify karo ki correct `workers` row mein `user_id` usi logged-in account se linked hai. Sirf phone/name match hona account ownership proof nahi hai.

## 4. Login aur NFC test

- Pehli baar Google sign-in karke role/profile complete karo.
- Logout karke wahi Google account dobara use karo; existing profile/dashboard load hona chahiye.
- Naya test account use karne par role/profile setup start hona chahiye.
- Dashboard, Workers, Settings aur Android app mein NFC card-assignment screen/button/permission nahi rehni chahiye.

## Important

SQL Editor mein `Success` aana migration ke execute hone ko batata hai—yeh live auth, policies aur poore flow ka proof nahi hai. Dependencies install karke local `npm run typecheck` aur `npm run build` chalao, aur live Supabase par above checklist test karo. Is package ke source changes ke baad bhi external Google OAuth configuration aur production RLS policies ko actual project par verify karna zaroori hai.

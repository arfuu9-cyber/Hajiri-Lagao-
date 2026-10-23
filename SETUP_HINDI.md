# Hajiri Lagao — Registration Fix (Hindi Setup)

Is package mein poori existing app rakhi gayi hai. Design ko rebuild nahi kiya gaya. Registration flow ko timeout-safe aur retry-safe banaya gaya hai.

## Is fix mein kya badla hai

- Mazdoor ke liye 6-character Thekedar invite-code input registration screen par dikhna chahiye.
- Submit hote waqt code uppercase/trim hota hai aur Supabase RPC tak jaata hai.
- Naya Thekedar/Gatekeeper account ab profile aur uska worker record ek hi database transaction mein banata hai.
- Same registration retry karne par existing profile/worker record reuse hota hai; normal retry se duplicate row create nahi honi chahiye.
- Server response late ho to loading infinite nahi rehni chahiye; button unlock hoga aur screen par error dikhna chahiye.
- Profile refresh error chupaya nahi jaata; user ko message milta hai.
- Frontend mein sirf Supabase anon/publishable key use hoti hai. `service_role` key browser/Vercel frontend variable mein kabhi na daalein.

## 1. ZIP update karo

1. ZIP extract karo.
2. Project ko apne GitHub repo mein update/push karo (existing repository ko replace karo; alag duplicate project mat banao).
3. Vercel mein wahi repo/project select karke **Redeploy** karo.
4. Deploy complete hone ke baad website ko Chrome Incognito mein kholo, taaki old cached build na khule.

## 2. Supabase manually setup

Supabase Dashboard → **SQL Editor** mein `supabase/migrations` ke pending migrations ko project ke existing database setup ke hisaab se apply karo.

Is registration fix ke liye naya SQL file hai:

`supabase/migrations/20261023130000_idempotent_account_registration.sql`

Use tab run karo jab `public.user_profiles`, `public.workers`, `workers.user_id`, `workers.thekedar_id`, aur `workers.daily_wage` pehle se maujood hon. SQL successful hone par bhi runtime testing zaroori hai.

Mazdoor registration ke liye pehle se included migration/function bhi chahiye:

`supabase/migrations/20261023120000_atomic_labour_registration_with_invite.sql`

Yeh verified connection tables/functions ke baad apply hona chahiye. Agar migration order ka doubt ho, sabse pehle existing Supabase database ka backup lo aur live database par blindly base migrations dobara run mat karo.

## 3. Vercel environment variables

Vercel → Project → Settings → Environment Variables mein yeh variables configure karo:

- `VITE_SUPABASE_URL` — wahi Supabase Project URL jahan SQL run kiya hai.
- `VITE_SUPABASE_ANON_KEY` — usi project ki anon/publishable key.

In values ko change karne ke baad **Redeploy** karna zaroori hai. `service_role`/secret key frontend mein mat daalna.

## 4. Test checklist

Har test alag test account se karo; real payroll data par pehle test mat karo.

1. **Thekedar:** new account se registration submit karo. Success ke baad Thekedar dashboard khulna chahiye.
2. **Repeat submit:** same signed-in account par retry karo. Duplicate Thekedar worker row nahi banna chahiye.
3. **Mazdoor:** role select karne par invite-code input name se pehle dikhna chahiye. Valid 6-character code submit karne par pending connection request bani chahiye.
4. **Invalid code:** clear error aana chahiye aur Submit button dobara active hona chahiye.
5. **Network/SQL error:** error message dikhe aur Submit button unlock ho; infinite spinner nahi rehna chahiye.
6. **Different Supabase project:** Vercel URL aur jahan SQL run hua hai un dono ko match karo.

## Important honesty note

Koi bhi ZIP live Supabase/Vercel environment ko access kiye bina zero bugs ki guarantee nahi de sakti. Is package mein registration ko safer banaya gaya hai aur local source/static checks kiye ja rahe hain, lekin live auth, RLS, database migration aur mobile-device end-to-end test tumhare actual Supabase project par karne honge. Agar SQL function missing ho, app ab generic infinite spinner ke bajay setup/error message dikhayegi.

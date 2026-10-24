# Hajiri Lagao — Manual Setup aur Bug-Fix Guide (Hindi/Hinglish)

Yeh package React + TypeScript + Vite + Supabase + Capacitor project hai. Ismein app-style fixed viewport, screen ke andar scrolling, fixed bottom navigation, compact home quick actions, cleaner Google login, better error text, and worker/team selection fixes hain.

## 1. Pehle ye samjho: tumhari live website purana code kyun dikha rahi ho sakti hai?

Tumhari video mein `Card tap karo...` NFC marketing aur Home par floating `Add Labor` shortcut dikh raha tha. Is updated source ke `src/`, `public/` aur Android manifest mein NFC screen/marketing active code se remove hai, aur Home ka overlapping floating Add Labor button bhi remove hai. Iska matlab agar deploy ke baad bhi yeh screen live rahe to aam taur par:

- Updated ZIP ke files GitHub repository ke root par replace/commit nahi huye, ya
- Vercel ne latest commit deploy nahi kiya, ya
- Browser cached old page dikhata hai.

**Sirf ZIP download karne se live website change nahi hoti.**

## 2. GitHub aur Vercel update

1. ZIP extract karo. Folder ke andar `package.json`, `src`, `public`, `supabase`, `android` jaisi files/folders honi chahiye.
2. In files/folders ko apni GitHub repository ke root mein update karo. Galti se ek extra `Hajiri-Lagao-App/` folder ke andar project nest mat karna.
3. GitHub par commit/push karo.
4. Vercel Dashboard → Project → Deployments mein check karo ki latest commit ka deployment **Ready** hai.
5. Phone par website Incognito tab mein kholo. Agar phir bhi purana UI dikhe to Chrome → Site settings → Storage → Clear data, phir page dobara kholo.

## 3. Native Android app ya website?

- `https://hajiri-lagao.vercel.app` browser/PWA version hai; browser address bar dikhegi.
- Is project mein `android/` aur Capacitor configuration hai. Isse APK banane par app icon se full-screen Android app khulega; Chrome address bar nahi hogi. UI React WebView mein render hota hai—ye native React Native components wala project nahi hai, lekin app-style fixed navigation/content scrolling supported hai.

### APK banane ke liye Windows laptop par

1. Node.js LTS (20+), Android Studio, Android SDK aur Android Studio ke recommended Java/JDK install karo.
2. Extract kiye project ke root mein `.env.local` banao. `.env.example` ho to uski copy karo.
3. `.env.local` mein Supabase project ke Dashboard → Project Settings → API se values bharo:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...` (ya project ke newer dashboard mein publishable key agar app setup usko use karta hai)
   - **Service-role/secret key kabhi frontend mein mat daalna.**
4. Command Prompt/PowerShell mein project root khol kar chalao:

   ```bash
   npm ci
   npm run typecheck
   npm run build
   npx cap sync android
   npx cap open android
   ```

5. Android Studio mein `Build → Build Bundle(s) / APK(s) → Build APK(s)` chuno.
6. Debug APK aam taur par yahan milega: `android/app/build/outputs/apk/debug/app-debug.apk`.

## 4. Attendance approval error ka manual check

Video mein approval card par `Attendance requests load nahi hui` tha. Purana frontend asli Supabase message chhupa raha tha; is updated frontend mein Supabase error message dikhane ke liye error handling sudhaari gayi hai.

Pehle Supabase Dashboard → SQL Editor mein yeh **read-only diagnostic query** run karo:

```sql
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'attendance'
  AND column_name IN (
    'approval_status', 'marked_by', 'approved_by', 'approved_at',
    'rejection_reason', 'updated_at'
  )
ORDER BY column_name;
```

- Agar `approval_status` result mein nahi hai, to tumhare live Supabase project mein attendance approval migration missing ho sakti hai.
- `supabase/migrations/20261022130000_attendance_approval_workflow.sql` ko **sirf tab** apply karo jab missing ho aur uske required base/security migrations pehle se apply ho chuke hon: `20261021100000_secure_data_access.sql` aur `20261022100000_invite_code.sql`.
- Agar migration pehle hi apply ki thi, use blindly dobara mat chalao. Jo exact error text updated screen par dikhe, uske basis par next step lo.
- Vercel → Settings → Environment Variables mein `VITE_SUPABASE_URL` usi Supabase project ka hona chahiye jahan migration run hui. Project mismatch hone par SQL success ke bawajood live app mein column missing dikhega.

## 5. Data counts / dashboard mismatch

Video mein dashboard par 60 attendance pending aur quick task list mein sirf 1 worker jaisa mismatch tha. Is version mein:

- Logged-in account ka apna worker row role ke hisaab se select hota hai; Thekedar ke account ko ghalti se linked Mazdoor row select nahi karna chahiye.
- Attendance quick tasks worker roles ko case-insensitive tareeke se filter karte hain.
- Home dashboard worker query ko current thekedar team ID se filter kiya jata hai, aur Thekedar/Gatekeeper rows Mazdoor count se exclude hote hain.

Phir bhi counts ko real DB par verify karna zaroori hai. Is read-only query se sirf role-wise totals dikhenge:

```sql
SELECT lower(coalesce(role, '(null)')) AS role, count(*) AS total
FROM public.workers
GROUP BY lower(coalesce(role, '(null)'))
ORDER BY role;
```

Agar count ab bhi mismatch ho, to updated frontend ka exact error aur role-wise counts dekho. User ke real phone/Aadhaar details ya secrets public chat mein share mat karna.

## 6. Google login / Welcome Back

1. Supabase → Authentication → URL Configuration mein Site URL `https://hajiri-lagao.vercel.app` set karo.
2. Redirect URLs mein `https://hajiri-lagao.vercel.app/**` add karo.
3. Google Cloud OAuth client ke Authorized redirect URI mein Supabase ka callback `https://<project-ref>.supabase.co/auth/v1/callback` hona chahiye.
4. App mein Google se login karo. Existing profile load successfully ho to saved role/dashboard khulna chahiye. Profile query fail ho to error + retry screen aayegi; ise naya account samajhkar dobara register mat karo.

## 7. Kharchi bina SMS OTP

Is version mein kharchi recipient ko apne linked Google login se app ke andar confirm ya dispute karna hai. Sirf verified kharchi payroll se deduct hoti hai. Isko live use karne se pehle ensure karo ki migration `20261024130000_in_app_advance_confirmation_and_disputes.sql` pehle se applied hai; agar applied hai to dubara mat chalana. Migration NFC/legacy OTP fields aur old OTP table ka data remove kar sakti hai, isliye backup ke bina production database par run mat karo.

## 8. Test checklist

- [ ] Existing Thekedar Google login → wahi dashboard, no new registration loop.
- [ ] Ek doosra fresh Google account → alag account create ho sake.
- [ ] Thekedar team mein kai Mazdoor rows hon → dashboard count aur attendance list match kare.
- [ ] Mazdoor attendance request bheje → Thekedar ke approval queue mein aaye.
- [ ] Approval/refresh error aaye → actual database error text screen par aaye.
- [ ] Pending kharchi → linked Mazdoor confirm ya dispute kar sake.
- [ ] 320px–430px mobile width → body/browser-style page scroll nahi; screen content andar scroll ho, bottom nav fixed rahe.
- [ ] Search project `src/` aur deployed login for `Card tap karo` / NFC. Agar live dikhe, latest commit/deployment verify karo.

## Build verification note

Packaging environment mein npm dependency installation timeout hui, isliye full Vite production build aur live Supabase end-to-end test is ZIP ke liye claim nahi kiya ja raha. Local laptop/CI par `npm ci`, `npm run typecheck` aur `npm run build` successful hone ke baad hi production deploy promote karo.

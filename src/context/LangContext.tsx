import { createContext, useContext, useState, type ReactNode } from 'react';

export type Lang = 'en' | 'hi';

type Dict = Record<string, { en: string; hi: string }>;

// 'en' = Hinglish (Roman script, default), 'hi' = Devanagari Hindi
const dict: Dict = {
  // App
  appName: { en: 'Hajiri Lagao', hi: 'Hajiri Lagao' },
  tagline: { en: 'Apni team manage karo', hi: 'Apni Team Manage Karen' },
  loading: { en: 'Load ho raha hai...', hi: 'Load ho raha hai...' },
  save: { en: 'Save', hi: 'Save Karen' },
  cancel: { en: 'Cancel', hi: 'Radd Karen' },
  done: { en: 'Ho gaya', hi: 'Ho Gaya' },
  retry: { en: 'Dobara try karo', hi: 'Phir Koshish Karen' },
  search: { en: 'Search', hi: 'Khojen' },
  delete: { en: 'Delete', hi: 'Hataen' },
  remove: { en: 'Hatao', hi: 'Hataen' },
  edit: { en: 'Edit', hi: 'Sampadit Karen' },
  close: { en: 'Band karo', hi: 'Band Karen' },
  share: { en: 'Share', hi: 'Share Karen' },
  print: { en: 'Print', hi: 'Print Karen' },
  export: { en: 'CSV Export', hi: 'CSV Niryaat Karen' },
  logout: { en: 'Logout', hi: 'Logout' },

  // Tabs
  home: { en: 'Home', hi: 'Home' },
  history: { en: 'Haziri', hi: 'Itihaas' },
  workers: { en: 'Mazdoor', hi: 'Worker' },
  payroll: { en: 'Hisaab', hi: 'Payment' },
  alerts: { en: 'Alerts', hi: 'Suchnaen' },

  // Login
  signIn: { en: 'Apni team manage karne ke liye login karo', hi: 'Apni Team Manage Karne Ke Liye Sign In Karen' },
  createAccount: { en: 'Apna supervisor account banao', hi: 'Apna Supervisor Account Banayen' },
  email: { en: 'Email', hi: 'Email' },
  password: { en: 'Password', hi: 'Password' },
  login: { en: 'Login', hi: 'Login' },
  createId: { en: 'ID Banao', hi: 'ID Banayen' },
  newSupervisor: { en: 'Naya supervisor? ID banao', hi: 'Naya Supervisor? ID Banayen' },
  haveId: { en: 'Pehle se ID hai? Login karo', hi: 'Pehle se ID hai? Login Karen' },
  continueGoogle: { en: 'Google se aage badho', hi: 'Google se Jari Rakhen' },
  workEmailNote: { en: 'Kaam ka email use karo aur password private rakho.', hi: 'Kaam ka Email Istemaal Karen aur Password Gopniye Rakhen.' },

  // Home / Dashboard
  todaysOverview: { en: 'Aaj ki Sthiti', hi: 'Aaj ki Sthiti' },
  siteDashboard: { en: 'Construction Site Dashboard', hi: 'Construction Site Dashboard' },
  siteReady: { en: 'Site ready · records live hain', hi: 'Site ready · records live hain' },
  constructionTagline: { en: 'Haziri, hisaab aur team — site par sab ek jagah', hi: 'Haziri, hisaab aur team — site par sab ek jagah' },
  presentToday: { en: 'Aaj Maujood', hi: 'Aaj Maujood' },
  absentToday: { en: 'Aaj Gair-Hazir', hi: 'Aaj Anupasthit' },
  newWorkersToday: { en: 'Aaj Naye Mazdoor', hi: 'Aaj Naye Worker' },
  weeklyPayout: { en: 'Is hafte ka bhugtaan', hi: 'Is Hafte ka Bhugtaan' },
  attendanceRate: { en: 'Haziri Rate', hi: 'Upasthiti Dar' },
  pendingAdvances: { en: 'Baki Advance', hi: 'Lambit Advance' },
  quickActions: { en: 'Jaldi Kaam', hi: 'Twarit Karya' },
  markAttendance: { en: 'Haziri Lagao (NFC)', hi: 'Haziri Lagao (NFC)' },
  markAttendanceDesc: { en: 'Mazdoor ka card tap karke haziri lagao', hi: 'Worker ka Card Tap karke Haziri Lagao' },
  addNewWorker: { en: 'Naya Mazdoor Jodo', hi: 'Naya Worker Jode' },
  addNewWorkerDesc: { en: 'Naya construction mazdoor register karo', hi: 'Naya Nirman Worker Register Karen' },
  viewPayroll: { en: 'Hisaab & Bhugtaan', hi: 'Bhugtaan aur Hisaab' },
  viewPayrollDesc: { en: 'Weekly hisaab nikalo aur report share karo', hi: 'Saptahik Bhugtaan ki Ganana Karen aur Report Share Karen' },
  viewAlerts: { en: 'Alerts & Suchna', hi: 'Suchnaen aur Alert' },
  viewAlertsDesc: { en: 'Bachi haziri aur baki advance', hi: 'Anupasthit Haziri aur Lambit Advance' },
  noAlerts: { en: 'Koi alert nahi. Sab kuch sahi hai!', hi: 'Koi Alert Nahi. Sab Kuch Theek hai!' },

  // Add Worker
  addNewWorkerTitle: { en: 'Naya Mazdoor Jodo', hi: 'Naya Worker Jode' },
  fullName: { en: 'Pura Naam', hi: 'Pura Naam' },
  phoneNumber: { en: 'Phone Number', hi: 'Phone Number' },
  workerRole: { en: 'Kaam ka Prakaar', hi: 'Kaam ka Prakaar' },
  dailyWageRate: { en: 'Dainik Mazdoori (Dar)', hi: 'Dainik Mazdoori (Dar)' },
  selectRole: { en: 'Prakaar chuno', hi: 'Prakaar Chuno' },
  enterCustomRole: { en: '+ Custom prakaar likho', hi: '+ Custom Prakaar Darj Karen' },
  chooseFromList: { en: '← List se chuno', hi: '← List se Chuno' },
  saveWorker: { en: 'Mazdoor Save Karo', hi: 'Worker Save Karen' },
  saving: { en: 'Save ho raha hai...', hi: 'Save ho raha hai...' },
  nameRequired: { en: 'Naam zaroori hai', hi: 'Naam Avashyak hai' },
  phoneRequired: { en: 'Phone number zaroori hai', hi: 'Phone Number Avashyak hai' },
  roleRequired: { en: 'Prakaar zaroori hai', hi: 'Prakaar Avashyak hai' },
  enterValidWage: { en: 'Sahi dainik mazdoori darj karo', hi: 'Many Dainik Mazdoori Darj Karen' },

  // Workers list
  registeredWorkers: { en: 'registered mazdoor', hi: 'Registered Worker' },
  searchByNamePhone: { en: 'Naam ya phone se search karo', hi: 'Naam ya Phone se Khojen' },
  noWorkersAdded: { en: 'Abhi koi mazdoor nahi hai', hi: 'Abhi Koi Worker Nahi hai' },
  addFirstWorker: { en: 'Shuru karne ke liye pehla mazdoor jodo.', hi: 'Shuru Karne Ke Liye Pehla Worker Jode.' },
  cardAssigned: { en: 'Card Assigned', hi: 'Card Assigned' },
  noCard: { en: 'Card Nahi', hi: 'Card Nahi' },
  assignNfcCard: { en: 'NFC Card Assign Karo', hi: 'NFC Card Assign Karen' },
  replaceCard: { en: 'Card Badlo', hi: 'Card Badle' },
  giveAdvance: { en: 'Advance', hi: 'Advance' },
  dailyWage: { en: 'dainik mazdoori', hi: 'Dainik Mazdoori' },
  viewDetails: { en: 'Vivaraan', hi: 'Vivaraan' },

  // Advance modal
  giveAdvanceTitle: { en: 'Advance Do', hi: 'Advance De' },
  amount: { en: 'Rashi', hi: 'Rashi' },
  date: { en: 'Tareekh', hi: 'Tareekh' },
  note: { en: 'Note', hi: 'Note' },
  noteOptional: { en: '(optional)', hi: '(Vaikalpik)' },
  saveAdvance: { en: 'Advance Save Karo', hi: 'Advance Save Karen' },
  enterAdvanceAmount: { en: 'Zero se zyada rashi darj karo.', hi: 'Shunya se Adhik Rashi Darj Karen.' },

  // Advance verification
  advanceStep1: { en: 'Step 1: Kharchi ki detail', hi: 'Step 1: Kharchi ki Detail' },
  advanceStep2: { en: 'Step 2: Mazdoor ki Verify', hi: 'Step 2: Mazdoor ki Satyapeet' },
  sendOtpToWorker: { en: 'OTP Bhejo Mazdoor ko', hi: 'OTP Bhejo Mazdoor ko' },
  otpSentToWorker: { en: 'OTP bheja gaya mazdoor ke number pe:', hi: 'OTP Bheja Gaya Mazdoor ke Number par:' },
  enterWorkerOtp: { en: 'Mazdoor ko mila OTP yahan darj karo', hi: 'Mazdoor ko Mila OTP yahan Darj Karen' },
  verifyAdvance: { en: 'Advance Verify Karo', hi: 'Advance Satyapeet Karen' },
  advanceVerified: { en: 'Advance Verify Ho Gaya!', hi: 'Advance Satyapeet Ho Gaya!' },
  advancePending: { en: 'Pending', hi: 'Pending' },
  advanceStatusVerified: { en: 'Verify Hua', hi: 'Satyapeet Hua' },
  advanceStatusPending: { en: 'Averify Nahi', hi: 'Asatyapeet' },
  otpSending: { en: 'OTP bheja ja raha hai...', hi: 'OTP Bheja ja raha hai...' },
  otpVerifying: { en: 'Verify ho raha hai...', hi: 'Satyapeet ho raha hai...' },
  otpExpired: { en: 'OTP ka samay khatam. Dobara OTP bhejo.', hi: 'OTP ka Samay Khatam. Phir OTP Bheje.' },
  otpMismatch: { en: 'Galat OTP. Dobara try karo.', hi: 'Galat OTP. Phir Koshish Karen.' },
  resendOtpWorker: { en: 'OTP Dobara Bhejo', hi: 'OTP Phir Bheje' },
  advanceFraudNote: { en: 'Suraksha: Kharchi tab tak hisaab me nahi kategi jab tak mazdoor OTP se verify na kare.', hi: 'Suraksha: Kharchi tab tak Hisaab me Nahi Categi jab tak Mazdoor OTP se Satyapeet na Kare.' },
  onlyVerifiedCounted: { en: 'Sirf verify hua advance hisaab me kata hai', hi: 'Sirf Satyapeet Hua Advance Hisaab me Kata hai' },

  // NFC
  nfcAttendance: { en: 'NFC Haziri', hi: 'NFC Haziri' },
  tapWorkerCard: { en: 'Mazdoor Card Phone Pe Tap Karo', hi: 'Phone par Worker Card Tap Karen' },
  tapCardDesc: { en: "Assigned NFC card ko phone ke NFC reader ke paas lao.", hi: 'Assign kiye gaye NFC Card ko Phone ke NFC Reader ke paas laye.' },
  startNfcScan: { en: 'NFC Scan Shuru Karo', hi: 'NFC Scan Shuru Karen' },
  cancelScan: { en: 'Scan Cancel', hi: 'Scan Radd Karen' },
  scanAnother: { en: 'Dusra Card Scan Karo', hi: 'Dusra Card Scan Karen' },
  attendanceMarked: { en: 'Haziri Lag Gayi!', hi: 'Haziri Lag Gayi!' },
  alreadyMarked: { en: 'Pehle se lagi hai', hi: 'Pehle se Lagi hai' },
  scanFailed: { en: 'Scan Fail', hi: 'Scan Vifal' },
  simulateScan: { en: 'NFC Scan Simulate Karo (Test)', hi: 'NFC Scan Simulate Karen (Test)' },
  hideSimulate: { en: 'Simulate chupao', hi: 'Simulate Chupaye' },
  scanNfcCard: { en: 'NFC Card Scan Karo', hi: 'NFC Card Scan Karen' },
  chooseWorker: { en: 'Mazdoor chuno...', hi: 'Worker Chuno...' },
  simulateAndAssign: { en: 'Simulate & Assign', hi: 'Simulate aur Assign' },
  noWorkersYet: { en: 'Abhi koi mazdoor nahi hai', hi: 'Abhi Koi Worker Nahi hai' },
  addWorkerFirst: { en: 'Pehle mazdoor jodo, phir NFC card assign karke haziri lagao.', hi: 'Pehle Worker Jode, Phir NFC Card Assign karke Haziri Lagao.' },
  onePerDay: { en: 'Har mazdoor ki haziri din me ek hi baar lagegi. Duplicate scan reject hoga.', hi: 'Har Worker ki Haziri Din me ek hi Baar Lagegi. Duplicate Scan Asweekar Hoga.' },

  // History
  attendanceHistory: { en: 'Haziri History', hi: 'Haziri Itihaas' },
  recordsByDate: { en: 'Tareekh anusaar records', hi: 'Tareekh Anusaar Record' },
  searchNameRolePhone: { en: 'Naam, prakaar, ya phone se search karo', hi: 'Naam, Prakaar, ya Phone se Khojen' },
  noAttendanceRecords: { en: 'Abhi koi haziri record nahi', hi: 'Abhi Koi Haziri Record Nahi' },
  recordsWillAppear: { en: 'Jab mazdoor haziri lagana shuru karenge tab records yahan dikhenge.', hi: 'Jab Worker Haziri Lagana Shuru Karenge tab Record yahan Dikhenge.' },
  noMatches: { en: 'Koi match nahi mila', hi: 'Koi Milan Nahi Mila' },
  tryDifferentSearch: { en: 'Dusra shabd search karo.', hi: 'Dusra Shabd Khojen.' },
  worker: { en: 'mazdoor', hi: 'Worker' },
  workersPlural: { en: 'mazdoor', hi: 'Worker' },

  // Payroll
  payrollSettlement: { en: 'Hisaab / Bhugtaan', hi: 'Bhugtaan / Hisaab' },
  weeklyDihadiCalc: { en: 'Saptahik dihadi hisaab', hi: 'Saptahik Dihadi Hisaab' },
  selectDateInWeek: { en: 'Hafte ki koi bhi tareekh chuno', hi: 'Hafte ki Koi bhi Tareekh Chuno' },
  week: { en: 'Hafta', hi: 'Hafta' },
  calculatingPayroll: { en: 'Hisaab ho raha hai...', hi: 'Bhugtaan ki Ganana ho rahi hai...' },
  couldNotCalcPayroll: { en: 'Hisaab nahi ho saka.', hi: 'Bhugtaan ki Ganana Nahi ho Saki.' },
  days: { en: 'Din', hi: 'Din' },
  totalWage: { en: 'Kul mazdoori', hi: 'Kul Mazdoori' },
  advances: { en: 'Advance', hi: 'Advance' },
  finalPayout: { en: 'Antim bhugtaan', hi: 'Antim Bhugtaan' },
  advanceCut: { en: 'Advance kat', hi: 'Advance Kat' },
  wage: { en: 'Mazdoori', hi: 'Mazdoori' },
  perDay: { en: '/din', hi: '/Din' },
  noWorkersFound: { en: 'Koi mazdoor nahi mila.', hi: 'Koi Worker Nahi Mila.' },
  shareWeeklyReport: { en: 'Weekly Report Share Karo', hi: 'Saptahik Report Share Karen' },
  overtime: { en: 'Overtime', hi: 'Overtime' },
  otHours: { en: 'OT ghante', hi: 'OT Ghante' },

  // Worker Detail
  workerDetails: { en: 'Mazdoor Vivaraan', hi: 'Worker Vivaraan' },
  attendanceCalendar: { en: 'Haziri Calendar', hi: 'Haziri Calendar' },
  advanceHistory: { en: 'Advance History', hi: 'Advance Itihaas' },
  salarySummary: { en: 'Salary Summary', hi: 'Vetaan Saaransh' },
  totalDaysWorked: { en: 'Kul kaam kie din', hi: 'Kul Kaam Kie Din' },
  totalEarned: { en: 'Kul Kamai', hi: 'Kul Kamai' },
  totalAdvances: { en: 'Kul Advance', hi: 'Kul Advance' },
  netPayable: { en: 'Baki Bhugtaan', hi: 'Shesh Bhugtaan' },
  noAdvancesYet: { en: 'Abhi koi advance nahi diya', hi: 'Abhi Koi Advance Nahi Diya' },
  present: { en: 'Maujood', hi: 'Maujood' },
  late: { en: 'Der se', hi: 'Der se' },
  halfDay: { en: 'Aadha Din', hi: 'Aadhiya' },
  absent: { en: 'Gair-Hazir', hi: 'Anupasthit' },

  // Alerts
  alertsNotifications: { en: 'Alerts & Suchna', hi: 'Suchnaen aur Alert' },
  missingAttendance: { en: 'Bachi Haziri', hi: 'Anupasthit Haziri' },
  workersNotMarkedToday: { en: 'Ye mazdoor aaj hazir nahi hue:', hi: 'Ye Worker Aaj Hazir Nahi Hue:' },
  recentAdvances: { en: 'Haal ke Advance', hi: 'Haal ke Advance' },
  allMarked: { en: 'Sab mazdoor aaj hazir hain!', hi: 'Sabhi Worker Aaj Hazir hain!' },

  // misc
  couldNotSave: { en: 'Save nahi hua. Dobara try karo.', hi: 'Save Nahi Hua. Phir Koshish Karen.' },
  couldNotLoad: { en: 'Data load nahi hua.', hi: 'Data Load Nahi ho Saka.' },
  signedInAs: { en: 'Login:', hi: 'Sign In: ' },

  // Google Login
  googleSignInSubtitle: { en: 'Apne Google account se login karo', hi: 'Apne Google Account se Sign In Karen' },
  connectingGoogle: { en: 'Google se connect ho raha hai...', hi: 'Google se Connect ho raha hai...' },
  googleSignInNote: { en: 'Surakshit login ke liye apna Google account use karo.', hi: 'Surakshit Login ke Liye Apna Google Account Use Karen.' },
  secureLogin: { en: 'Secure Login', hi: 'Surakshit Login' },
  otpSixDigits: { en: '6 digit ka OTP darj karo', hi: '6 Ango ka OTP Darj Karen' },

  // Settings
  settings: { en: 'Settings', hi: 'Settings' },
  settingsSubtitle: { en: 'Apni app pasand manage karo', hi: 'Apni App Pasand Manage Karen' },
  faq: { en: 'Sawaal-Jawaab', hi: 'Aksar Puche Jane Wale Sawaal' },
  backup: { en: 'Backup', hi: 'Backup' },
  contactSupport: { en: 'Support se sampark karo', hi: 'Sahayata se Sampark Karen' },
  about: { en: 'App ke baare me', hi: 'App ke baare me' },
  language: { en: 'Bhasha', hi: 'Bhasha' },
  appInfo: { en: 'App Jankari', hi: 'App Jankari' },

  // FAQ
  faqTitle: { en: 'Aksar Puche Jane Wale Sawaal', hi: 'Aksar Puche Jane Wale Sawaal' },
  faq1Q: { en: 'Haziri kaise lagaye?', hi: 'Haziri Kaise Lagao?' },
  faq1A: { en: 'Haziri Lagao pe jao, mazdoor ka NFC card phone pe tap karo. NFC na ho to Simulate use karo.', hi: 'Haziri Lagao par Jao, Worker ka NFC Card Phone par Tap Karen. NFC na ho to Simulate Vikalp Istemaal Karen.' },
  faq2Q: { en: 'Weekly hisaab kaise banta hai?', hi: 'Saptahik Bhugtaan Kaise Ganana hoti hai?' },
  faq2A: { en: 'Hisaab = kaam kie din x dihadi + overtime - advance kat.', hi: 'Bhugtaan = Kaam Kie Din x Dihadi + Overtime - Advance Katoti.' },
  faq3Q: { en: 'Kya ek mazdoor ki haziri din me do baar lag sakti hai?', hi: 'Kya ek Worker ki Haziri Din me Do Baar Lag Sakti hai?' },
  faq3A: { en: 'Nahi, har mazdoor ki haziri din me ek hi baar lagegi. Duplicate scan apne aap reject ho jata hai.', hi: 'Nahi, Har Worker ki Haziri Din me ek hi Baar Lagegi. Duplicate Scan Apne Aap Asweekar ho Jate hain.' },
  faq4Q: { en: 'NFC card kaise assign kare?', hi: 'Worker ko NFC Card Kaise Assign Karu?' },
  faq4A: { en: 'Mazdoor pe jao, mazdoor ko tap karo, phir NFC Card Assign Karo tap karke card scan karo.', hi: 'Worker par Jao, Worker ko Tap Karen, Phir NFC Card Assign Karen Tap karke Card Scan Karen.' },
  faq5Q: { en: 'Kya mera data surakshit hai?', hi: 'Kya Mera Data Surakshit hai?' },
  faq5A: { en: 'Haan, saara data cloud me encrypted hai. Sirf aap apne mazdoor ka data dekh sakte ho.', hi: 'Haan, Saara Data Cloud me Encrypted roop se Surakshit hai. Sirf Aap apne Worker ka Data Dekh Sakte ho.' },

  // Backup
  backupTitle: { en: 'Backup & Export', hi: 'Backup aur Niryaat' },
  backupDesc: { en: 'Apne mazdoor aur haziri data export karo.', hi: 'Apne Worker aur Haziri Data ko Niryaat Karen.' },
  exportWorkers: { en: 'Mazdoor CSV Export', hi: 'Worker CSV Niryaat Karen' },
  exportAttendance: { en: 'Haziri CSV Export', hi: 'Haziri CSV Niryaat Karen' },
  exportAdvances: { en: 'Advance CSV Export', hi: 'Advance CSV Niryaat Karen' },
  backupSuccess: { en: 'Export successfully download hua.', hi: 'Niryaat Safaltapurvak Download hua.' },
  backupFailed: { en: 'Data export nahi hua. Dobara try karo.', hi: 'Data Niryaat Nahi ho Saka. Phir Koshish Karen.' },
  noDataExport: { en: 'Export karne ke liye koi data nahi.', hi: 'Niryaat Karne Ke Liye Koi Data Nahi.' },

  // Contact Support
  supportTitle: { en: 'Support se Sampark Karo', hi: 'Sahayata se Sampark Karen' },
  supportDesc: { en: 'Hum yahan madad ke liye hain. Inme se kisi bhi madhyam se sampark karo.', hi: 'Hum Yahan Madad Ke Liye hain. Inme se Kisi bhi Madhyam se Sampark Karen.' },
  callUs: { en: 'Call Karo', hi: 'Call Karen' },
  emailUs: { en: 'Email Karo', hi: 'Email Karen' },
  whatsappUs: { en: 'WhatsApp', hi: 'WhatsApp' },
  supportHours: { en: 'Support time: 9 AM - 6 PM (Mon-Sat)', hi: 'Sahayata Samay: Subah 9 - Shaam 6 (Som-Shani)' },

  // About
  aboutTitle: { en: 'Hajiri Lagao ke baare me', hi: 'Hajiri Lagao ke baare me' },
  aboutDesc: { en: 'NFC card se construction mazdoor ki hajiri, bhugtaan, aur advance manage karne ka aasan aur shaktishali app.', hi: 'NFC Card se Nirman Worker ki Hajiri, Bhugtaan, aur Advance Manage Karne ka Aasan aur Shaktishali App.' },
  version: { en: 'Version', hi: 'Version' },
  developedBy: { en: 'Developed by', hi: 'Developed by' },
  privacyPolicy: { en: 'Privacy Policy', hi: 'Gopniye Neeti' },
  termsOfUse: { en: 'Terms of Use', hi: 'Upyog ki Sharten' },

  // Registration / Aadhaar
  newRegistration: { en: 'Naya Registration', hi: 'Naya Registration' },
  aadhaarNumber: { en: 'Aadhaar Number', hi: 'Aadhaar Number' },
  captureIdCard: { en: 'ID Card ki Photo Lo', hi: 'ID Card ki Photo Lo' },
  captureId: { en: 'ID Capture Karo', hi: 'ID Capture Karen' },
  captureIdDesc: { en: 'Record ke liye Aadhaar card ki photo lo', hi: 'Record ke liye Aadhaar Card ki Photo Lo' },
  capture: { en: 'Capture', hi: 'Capture Karen' },
  cameraError: { en: 'Camera access nahi hua. Permission check karo.', hi: 'Camera Access Nahi ho Saka. Anumati Jaachen.' },
  removePhoto: { en: 'Photo hatao', hi: 'Photo Hataen' },
  aadhaarError: { en: 'Aadhaar number 12 digit ka hona chahiye', hi: 'Aadhaar Number 12 Ango ka Hona Chahiye' },
  submitRegistration: { en: 'Registration Submit Karo', hi: 'Registration Submit Karen' },

  // Gate Pass
  gatePassThekedar: { en: 'Mera Gate Pass QR', hi: 'Mera Gate Pass QR' },
  gatePassThekedarDesc: { en: 'Pravesh ke liye ye QR gate pe dikhao', hi: 'Pravesh ke liye ye QR Gate par Dikhaye' },
  gatePassScanner: { en: 'Gate Pass Scanner', hi: 'Gate Pass Scanner' },
  gatePassScannerDesc: { en: 'Thekedar QR scan karke entry approve karo', hi: 'Pravesh Swikrut Karne ke liye Thekedar QR Scan Karen' },
  yourThekedarId: { en: 'Aapki Thekedar ID', hi: 'Aapki Thekedar ID' },
  qrCodeDesc: { en: 'Gatekeeper aapke mazdoor verify karne ke liye ye code scan karega', hi: 'Gatekeeper Aapke Worker Satyapeet Karne ke liye ye Code Scan Karega' },
  associatedWorkers: { en: 'Jude Mazdoor', hi: 'Jude Worker' },
  gatePassTime: { en: 'Current Time', hi: 'Vartamaan Samay' },
  downloadQr: { en: 'QR Code Download Karo', hi: 'QR Code Download Karen' },
  noThekedarFound: { en: 'Abhi koi thekedar register nahi hai. Pehle registration karo.', hi: 'Abhi Koi Thekedar Register Nahi hai. Pehle Registration Karen.' },
  startScan: { en: 'Scan Shuru Karo', hi: 'Scan Shuru Karen' },
  scanQrDesc: { en: 'Camera thekedar QR code pe ghumaao', hi: 'Camera Thekedar QR Code par Ghumao' },
  manualEntry: { en: 'Ya thekedar ID manually darj karo', hi: 'Ya Thekedar ID Manually Darj Karen' },
  enterThekedarId: { en: 'Thekedar ID darj karo', hi: 'Thekedar ID Darj Karen' },
  verify: { en: 'Verify', hi: 'Satyapeet' },
  thekedarNotFound: { en: 'Thekedar nahi mila. ID check karo.', hi: 'Thekedar Nahi Mila. ID Jaachen.' },
  gateScanFailed: { en: 'Scan nahi hua. Dobara try karo.', hi: 'Scan Nahi ho Saka. Phir Koshish Karen.' },
  associatedWorkersList: { en: 'Jude Mazdoor', hi: 'Jude Worker' },
  approveEntry: { en: 'Entry Approve Karo', hi: 'Pravesh Swikare' },
  approveFailed: { en: 'Entry approve nahi hua. Dobara try karo.', hi: 'Pravesh Swikrut Nahi ho Saka. Phir Koshish Karen.' },
  entryApproved: { en: 'Entry Approved!', hi: 'Pravesh Swikrut!' },
  workersMarked: { en: 'Mazdoor hazir mark hue:', hi: 'Worker Hazir Mark Hue:' },
  scanAnotherGate: { en: 'Dusra Scan Karo', hi: 'Dusra Scan Karen' },

  // Home quick actions
  newRegistrationAction: { en: 'Naya Registration (Aadhaar)', hi: 'Naya Registration (Aadhaar)' },
  newRegistrationDesc: { en: 'Aadhaar aur photo ke saath mazdoor ya thekedar register karo', hi: 'Aadhaar aur Photo ke saath Mazdoor ya Thekedar Register Karen' },
  gatePassAction: { en: 'Digital Gate Pass', hi: 'Digital Gate Pass' },
  gatePassDesc: { en: 'QR banao ya scan karke entry approve karo', hi: 'Pravesh Swikrut Karne ke liye QR Banaye ya Scan Karen' },

  // Role-based
  selectYourRole: { en: 'Apni Bhumika Chuno', hi: 'Apni Bhumika Chuno' },
  role_thekedar: { en: 'Thekedar', hi: 'Thekedar' },
  role_labour: { en: 'Mazdoor', hi: 'Mazdoor' },
  role_gatekeeper: { en: 'Gatekeeper', hi: 'Gatekeeper' },
  roleIntro: { en: 'Aap is app mein kaun hain? Ek chuno. Baad mein role badalne ka option nahi hai, isliye dhyan se chuno.', hi: 'Aap is App mein Kaun Hain? Ek Chuno. Baad mein Role Badalne ka Option Nahi Hai, isliye Dhyan se Chuno.' },
  roleDesc_thekedar: { en: 'Aap team chalate ho: mazdoor jodo, haziri lagao, hisaab aur advance sambhalo.', hi: 'Aap Team Chalate Hain: Worker Jode, Haziri Lagaen, Hisaab aur Advance Sambhalen.' },
  roleDesc_labour: { en: 'Aap kaam karte ho: apni haziri, kamai aur advance dekho.', hi: 'Aap Kaam Karte Hain: Apni Haziri, Kamai aur Advance Dekhen.' },
  roleDesc_gatekeeper: { en: 'Aap gate par ho: mazdoor ka QR scan karke entry check karo aur haziri lagao.', hi: 'Aap Gate par Hain: Worker ka QR Scan Karke Entry Check Karen aur Haziri Lagaen.' },
  loginPoint1: { en: 'Card tap karo, haziri lag gayi', hi: 'Card Tap Karen, Haziri Lag Gayi' },
  loginPoint2: { en: 'Hafte ka hisaab apne aap ban jata hai', hi: 'Hafte ka Hisaab Apne Aap Ban Jata Hai' },
  loginPoint3: { en: 'Advance mazdoor ke OTP se safe', hi: 'Advance Worker ke OTP se Surakshit' },
  howTitle: { en: 'Shuru kaise karein?', hi: 'Shuru Kaise Karen?' },
  howStep1: { en: 'Mazdoor jodo', hi: 'Worker Jode' },
  howStep2: { en: 'Mazdoor ko NFC card do', hi: 'Worker ko NFC Card Den' },
  howStep3: { en: 'Roz haziri lagao', hi: 'Roz Haziri Lagaen' },
  recentUpdates: { en: 'Taaza update', hi: 'Taaza Update' },
  updAttendance: { en: 'Haziri lag gayi', hi: 'Haziri Lag Gayi' },
  updAdvance: { en: 'Kharchi mili', hi: 'Kharchi Mili' },
  updVerified: { en: 'OTP se pakki', hi: 'OTP se Pakki' },
  updPending: { en: 'OTP baaki hai', hi: 'OTP Baaki Hai' },
  tasksTitle: { en: 'Aaj ki haziri', hi: 'Aaj ki Haziri' },
  tasksPending: { en: 'mazdoor ki haziri baaki', hi: 'Worker ki Haziri Baaki' },
  tasksDone: { en: 'Sab ki haziri lag gayi', hi: 'Sab ki Haziri Lag Gayi' },
  markPresent: { en: 'Present', hi: 'Present' },
  markAll: { en: 'Sabko present karo', hi: 'Sabko Present Karen' },
  fullList: { en: 'Poori list', hi: 'Poori List' },
  todayDone: { en: 'Aaj ki haziri lag gayi', hi: 'Aaj ki Haziri Lag Gayi' },
  todayPending: { en: 'Aaj ki haziri abhi nahi lagi', hi: 'Aaj ki Haziri Abhi Nahi Lagi' },
  todayPendingHint: { en: 'Thekedar ya gate par haziri lagwao', hi: 'Thekedar ya Gate par Haziri Lagwaen' },
  namaste: { en: 'Namaste', hi: 'Namaste' },
  markMyself: { en: 'Meri haziri lagao', hi: 'Meri Haziri Lagaen' },
  periodWeek: { en: 'Hafta', hi: 'Hafta' },
  periodMonth: { en: 'Mahina', hi: 'Mahina' },
  myDaysMonth: { en: 'Is mahine ke din', hi: 'Is Mahine ke Din' },
  markPaid: { en: 'Bhugtaan kiya', hi: 'Bhugtaan Kiya' },
  paidDone: { en: 'Chukta', hi: 'Chukta' },
  updPaid: { en: 'Bhugtaan mila', hi: 'Bhugtaan Mila' },
  inviteLabel: { en: 'Thekedar ka code (agar mila ho)', hi: 'Thekedar ka Code (agar Mila Ho)' },
  inviteHint: { en: 'Thekedar ne jo 6 akshar ka code diya wo yahan daalo', hi: 'Thekedar ne Jo 6 Akshar ka Code Diya Wo Yahan Daalen' },
  inviteInvalid: { en: 'Code galat hai ya pehle hi use ho chuka hai', hi: 'Code Galat Hai ya Pehle Hi Use Ho Chuka Hai' },
  inviteShareTitle: { en: 'Mazdoor ko ye code bhejo', hi: 'Worker ko ye Code Bhejen' },
  shareInvite: { en: 'Code bhejo', hi: 'Code Bhejen' },
  pickRoleFirst: { en: 'Pehle apni bhumika chuno.', hi: 'Pehle Apni Bhumika Chuno.' },
  selectPersonRole: { en: 'Ye kaun hai? Bhumika chuno', hi: 'Ye Kaun Hai? Bhumika Chuno' },
  viewAllWorkers: { en: 'Saare mazdoor dekho', hi: 'Sabhi Worker Dekho' },

  // Smart Gate Pass
  selectWorkers: { en: 'Share karne ke liye mazdoor chuno', hi: 'Share Karne ke liye Worker Chuno' },
  selectAll: { en: 'Sab Chuno', hi: 'Sabhi Chuno' },
  deselectAll: { en: 'Clear', hi: 'Hataen' },
  shareWorkerDetails: { en: 'Mazdoor Vivaraan Share Karo', hi: 'Worker Vivaraan Share Karen' },
  sharedSuccessfully: { en: 'Safaltapurvak share hua!', hi: 'Safaltapurvak Share hua!' },
  copiedToClipboard: { en: 'Vivaraan copy ho gaye', hi: 'Vivaraan Copy ho Gaye' },
  shareFailed: { en: 'Share nahi hua. Dobara try karo.', hi: 'Share Nahi ho Saka. Phir Koshish Karen.' },
  verified: { en: 'Verified', hi: 'Satyapeet' },
  entryLog: { en: 'Entry Log', hi: 'Pravesh Log' },
  soundOn: { en: 'Sound On', hi: 'Dhwani Chalu' },
  soundOff: { en: 'Sound Band', hi: 'Dhwani Band' },
  moreActions: { en: 'Aur Kaam', hi: 'Aur Vikalp' },

  // Duty types (Hinglish)
  duty_0: { en: 'Chhutti', hi: 'Chhutti' },
  duty_0_5: { en: 'Aadhi Haziri', hi: 'Aadhi Haziri' },
  duty_1: { en: 'Puri Haziri', hi: 'Puri Haziri' },
  duty_1_5: { en: 'Dedh Duty', hi: 'Dedh Duty' },
  duty_2: { en: 'Double Duty', hi: 'Double Duty' },

  // Attendance flow
  selectDutyType: { en: 'Duty Prakaar Chuno', hi: 'Duty Prakaar Chuno' },
  confirmAttendance: { en: 'Haziri Pakki Karo', hi: 'Haziri Pakki Karen' },
  holdCardNear: { en: 'NFC card phone ke paas lao...', hi: 'NFC Card Phone ke paas Lao...' },
  lookingUpWorker: { en: 'Mazdoor khoja ja raha hai...', hi: 'Worker Khoja ja raha hai...' },
  cardNotAssigned: { en: 'Ye card kisi mazdoor se juda nahi hai.', hi: 'Ye Card Kisi Worker se Juda Nahi hai.' },
  recordingAttendance: { en: 'Haziri darj ho rahi hai...', hi: 'Haziri Darj ho rahi hai...' },
  couldNotRecord: { en: 'Haziri darj nahi hui. Dobara try karo.', hi: 'Haziri Darj Nahi ho Saki. Phir Koshish Karen.' },
  simulatedScan: { en: 'Simulated scan (test mode)', hi: 'Simulated Scan (Test)' },
  nfcNotAvailable: { en: 'Is device pe NFC hardware nahi hai. Neeche Simulate option use karo.', hi: 'Is Device par NFC Hardware Nahi hai. Neeche Simulate Vikalp Istemaal Karen.' },
  goBack: { en: 'Wapas Jao', hi: 'Wapas Jao' },
  hasCard: { en: 'card hai', hi: 'Card hai' },
  time: { en: 'Samay', hi: 'Samay' },
  selectWorkerSimulate: { en: 'Scan simulate karne ke liye mazdoor chuno:', hi: 'Scan Simulate Karne ke liye Worker Chuno:' },

  // Photo + Age (optional worker fields)
  takePhoto: { en: 'Photo Lo', hi: 'Photo Lo' },
  choosePhoto: { en: 'Photo Chuno', hi: 'Photo Chuno' },
  photoOptional: { en: 'Optional — pehchaan ke liye mazdoor ki photo', hi: 'Vaikalpik — Pehchaan ke liye Worker ki Photo' },
  ageLabel: { en: 'Umar', hi: 'Umar' },
  optional: { en: 'Optional', hi: 'Vaikalpik' },
  under18: { en: '18 se kam', hi: '18 se Kam' },
  under18Warning: { en: 'Ye mazdoor 18 saal se kam hai. Kuch site/company minors ko nahi rakhte.', hi: 'Ye Worker 18 se Kam Umar ka hai. Kuch Site/Company Nabaligo ko Nahi Rakhte.' },
  uploadingPhoto: { en: 'Photo upload ho rahi hai...', hi: 'Photo Upload ho rahi hai...' },
  enterValidAge: { en: 'Sahi umar darj karo (0–120).', hi: 'Kripya Sahi Umar Darj Karen (0–120).' },

  // Labour-specific home labels
  mySummary: { en: 'Mera Summary', hi: 'Mera Saaransh' },
  myDaysThisWeek: { en: 'Is Hafte ke Din', hi: 'Is Saptah ke Din' },
  myEarnings: { en: 'Meri Kamai', hi: 'Meri Kamai' },
  myAdvances: { en: 'Mere Advance', hi: 'Mere Advance' },
  myAttendance: { en: 'Meri Haziri Lagao', hi: 'Meri Haziri Lagao' },
  myAttendanceDesc: { en: 'Apna card tap karke haziri lagao', hi: 'Apna Card Tap karke Haziri Lagao' },
  myDetails: { en: 'Mera Vivaraan', hi: 'Mera Vivaraan' },
  myDetailsDesc: { en: 'Apni profile, haziri calendar aur kamai dekho', hi: 'Apni Profile, Haziri Calendar aur Kamai Dekho' },
  activeWorkers: { en: 'Sakriya Mazdoor', hi: 'Sakriya Worker' },

  // Splash
  splashTagline: { en: 'Mazdooron ki haziri, hisaab, aur advance — sab kuch ek jagah', hi: 'Mazdooron ki Haziri, Hisaab, aur Advance — Sab Kuch ek Jagah' },
};

interface LangContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string) => string;
}

const LangContext = createContext<LangContextValue | undefined>(undefined);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    const saved = localStorage.getItem('app-lang');
    return saved === 'hi' ? 'hi' : 'en';
  });

  const t = (key: string): string => {
    const entry = dict[key];
    if (!entry) return key;
    return entry[lang];
  };

  const handleSetLang = (newLang: Lang) => {
    setLang(newLang);
    localStorage.setItem('app-lang', newLang);
  };

  return (
    <LangContext.Provider value={{ lang, setLang: handleSetLang, t }}>
      {children}
    </LangContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLang(): LangContextValue {
  const context = useContext(LangContext);
  if (context === undefined) {
    throw new Error('useLang must be used within a LangProvider');
  }
  return context;
}
